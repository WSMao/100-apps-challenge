/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Layer 1 Dexie.js v4 IndexedDB Persistence Engine
 *
 * Conforms to:
 * - Dexie v4 class CreativeNeuroDB
 * - Tables: 'projects', 'settings'
 * - Debounced auto-save listener (500ms) with beforeunload flush
 * - Preloaded interactive seed data loader on initial launch
 * - In-memory fallback for private/restricted browser environments
 * - Isolated per-session timers and robust schema validation
 */

import Dexie, { type Table } from 'dexie';
import type {
  Project,
  Board,
  Page,
  NeuroNode,
  NeuroEdge,
} from '../types/index.ts';
import { useProjectStore } from '../store/projectStore.ts';
import {
  SEED_PROJECT,
  createSeedProject,
} from '../store/seedData.ts';

// ============================================================================
// 1. Table Record Schemas
// ============================================================================

export interface ProjectRecord extends Omit<Project, 'boards' | 'pages'> {
  boards: Record<string, Board>;
  pages: Record<string, Page>;
  nodes: Record<string, NeuroNode>;
  edges: Record<string, NeuroEdge>;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

// ============================================================================
// 2. Dexie Database Definition (with In-Memory Fallback for Node/Private Modes)
// ============================================================================

const hasNativeIndexedDB = (): boolean =>
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as { indexedDB?: unknown }).indexedDB !== 'undefined' &&
  (globalThis as { indexedDB?: unknown }).indexedDB !== null;

function createInMemoryTable<T extends object, K extends string>(
  primaryKey: string
): Table<T, K> {
  const store = new Map<K, T>();

  return {
    get: async (key: K) => {
      const val = store.get(key);
      return val ? structuredClone(val) : undefined;
    },
    put: async (item: T) => {
      const key = (item as Record<string, unknown>)[primaryKey] as K;
      store.set(key, structuredClone(item));
      return key;
    },
    add: async (item: T) => {
      const key = (item as Record<string, unknown>)[primaryKey] as K;
      store.set(key, structuredClone(item));
      return key;
    },
    delete: async (key: K) => {
      store.delete(key);
    },
    clear: async () => {
      store.clear();
    },
    count: async () => store.size,
    toArray: async () => Array.from(store.values()).map((v) => structuredClone(v)),
  } as unknown as Table<T, K>;
}

export class CreativeNeuroDB extends Dexie {
  projects!: Table<ProjectRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super('CreativeNeuroDB');
    this.version(1).stores({
      projects: 'id, name, updatedAt, createdAt',
      settings: 'key',
    });

    if (!hasNativeIndexedDB()) {
      this.projects = createInMemoryTable<ProjectRecord, string>('id');
      this.settings = createInMemoryTable<SettingRecord, string>('key');
      Object.assign(this, {
        transaction: async (...args: unknown[]) => {
          const callback = args[args.length - 1];
          if (typeof callback === 'function') {
            return await callback();
          }
          return undefined;
        },
        close: () => {},
      });
    }
  }
}

export const db = new CreativeNeuroDB();

// ============================================================================
// 3. Auto-Save Session Management & State Serialization
// ============================================================================

export interface AutoSaveSession {
  store: typeof useProjectStore;
  database: CreativeNeuroDB;
  timer: ReturnType<typeof setTimeout> | null;
  lastSavedSignature: string | null;
  unsubscribe: () => void;
}

const activeAutoSaveSessions = new Set<AutoSaveSession>();

/**
 * Computes a fast state signature to detect meaningful persistence changes.
 * Inspects project metadata, active page, viewport coordinates, element counts,
 * and active node positions.
 */
export function computeStateSignature(state: ReturnType<typeof useProjectStore.getState>): string {
  const activePage = state.pages[state.activePageId];
  const vp = activePage?.viewport;
  const vpKey = vp ? `${vp.x.toFixed(2)},${vp.y.toFixed(2)},${vp.zoom.toFixed(2)}` : 'none';

  let nodePosSummary = '';
  if (activePage && activePage.nodeIds) {
    const sample = activePage.nodeIds.slice(0, 50);
    nodePosSummary = sample
      .map((id) => {
        const n = state.nodes[id];
        return n ? `${id}:${n.position.x.toFixed(1)},${n.position.y.toFixed(1)}` : '';
      })
      .join('|');
  }

  return [
    state.project.id,
    state.project.updatedAt,
    state.activePageId,
    vpKey,
    Object.keys(state.pages).length,
    Object.keys(state.nodes).length,
    Object.keys(state.edges).length,
    nodePosSummary,
  ].join(':');
}

export async function saveProjectToDb(
  state: ReturnType<typeof useProjectStore.getState>,
  database: CreativeNeuroDB = db
): Promise<void> {
  const projectRecord: ProjectRecord = {
    ...state.project,
    activePageId: state.activePageId,
    boards: state.boards,
    pages: state.pages,
    nodes: state.nodes,
    edges: state.edges,
    updatedAt: Date.now(),
  };

  try {
    await database.transaction('rw', [database.projects, database.settings], async () => {
      await database.projects.put(projectRecord);
      await database.settings.put({
        key: 'lastActiveProjectId',
        value: projectRecord.id,
      });
    });
  } catch (error) {
    console.error('[CreativeNeuroDB] Failed to save project to IndexedDB:', error);
  }
}

/**
 * Subscribes to store modifications and commits to IndexedDB after a debounced interval.
 * Isolates timer and signature state per session to avoid cross-instance collisions.
 */
export function setupAutoSave(
  store: typeof useProjectStore = useProjectStore,
  database: CreativeNeuroDB = db,
  debounceMs: number = 500
): () => void {
  // Teardown pre-existing session for this exact store and database pair
  for (const existing of activeAutoSaveSessions) {
    if (existing.store === store && existing.database === database) {
      if (existing.timer) {
        clearTimeout(existing.timer);
        existing.timer = null;
      }
      existing.unsubscribe();
      activeAutoSaveSessions.delete(existing);
    }
  }

  const session: AutoSaveSession = {
    store,
    database,
    timer: null,
    lastSavedSignature: null,
    unsubscribe: () => {},
  };
  activeAutoSaveSessions.add(session);

  const unsub = store.subscribe((currentState, previousState) => {
    // Skip if persistent entity references are identical
    if (
      currentState.project === previousState.project &&
      currentState.boards === previousState.boards &&
      currentState.pages === previousState.pages &&
      currentState.nodes === previousState.nodes &&
      currentState.edges === previousState.edges &&
      currentState.activePageId === previousState.activePageId
    ) {
      return;
    }

    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    session.timer = setTimeout(async () => {
      session.timer = null;
      const sig = computeStateSignature(currentState);
      if (sig === session.lastSavedSignature) return;

      session.lastSavedSignature = sig;
      await saveProjectToDb(currentState, database);
    }, debounceMs);
  });

  session.unsubscribe = unsub;

  return () => {
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }
    activeAutoSaveSessions.delete(session);
    unsub();
  };
}

/**
 * Immediately flushes any pending debounced save to IndexedDB.
 */
export async function flushAutoSave(
  store: typeof useProjectStore = useProjectStore,
  database: CreativeNeuroDB = db
): Promise<void> {
  for (const session of activeAutoSaveSessions) {
    if (session.store === store && session.database === database) {
      if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
      }
    }
  }
  await saveProjectToDb(store.getState(), database);
}

// Hook into beforeunload to prevent data loss on sudden browser exit
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const session of activeAutoSaveSessions) {
      void flushAutoSave(session.store, session.database);
    }
  });
}

// ============================================================================
// 4. Schema Validation & Seed Loader
// ============================================================================

/**
 * Validates and sanitizes a raw project record from storage.
 * Returns null if the record is fundamentally corrupted.
 */
export function validateAndSanitizeProjectRecord(record: unknown): ProjectRecord | null {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const r = record as Partial<ProjectRecord>;
  if (typeof r.id !== 'string' || !r.id) {
    return null;
  }

  // Check if pages is a valid dictionary object
  const isPagesValidObject =
    Boolean(r.pages) &&
    typeof r.pages === 'object' &&
    !Array.isArray(r.pages);

  if (!isPagesValidObject) {
    return null;
  }

  const sanitizedPages = r.pages as Record<string, Page>;
  const pageKeys = Object.keys(sanitizedPages);
  if (pageKeys.length === 0) {
    return null;
  }

  // Check and sanitize nodes and edges
  const isNodesValidObject =
    Boolean(r.nodes) &&
    typeof r.nodes === 'object' &&
    !Array.isArray(r.nodes);
  const sanitizedNodes = isNodesValidObject ? (r.nodes as Record<string, NeuroNode>) : {};

  const isEdgesValidObject =
    Boolean(r.edges) &&
    typeof r.edges === 'object' &&
    !Array.isArray(r.edges);
  const sanitizedEdges = isEdgesValidObject ? (r.edges as Record<string, NeuroEdge>) : {};

  const isBoardsValidObject =
    Boolean(r.boards) &&
    typeof r.boards === 'object' &&
    !Array.isArray(r.boards);
  const sanitizedBoards = isBoardsValidObject ? (r.boards as Record<string, Board>) : {};

  // Ensure pageIds is a valid string array with length > 0
  let pageIds = Array.isArray(r.pageIds)
    ? r.pageIds.filter((pid): pid is string => typeof pid === 'string')
    : [];
  if (pageIds.length === 0) {
    pageIds = pageKeys;
  }

  // Ensure activePageId points to an existing page
  let activePageId = r.activePageId;
  if (!activePageId || !sanitizedPages[activePageId]) {
    activePageId = pageIds[0] || pageKeys[0];
  }

  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : 'Untitled Project',
    description: typeof r.description === 'string' ? r.description : '',
    version: typeof r.version === 'string' ? r.version : '1.0.0',
    activePageId,
    pageIds,
    activeBoardId: typeof r.activeBoardId === 'string' ? r.activeBoardId : 'board-1',
    boardIds: Array.isArray(r.boardIds) && r.boardIds.length > 0 ? r.boardIds : ['board-1'],
    boards: sanitizedBoards,
    pages: sanitizedPages,
    nodes: sanitizedNodes,
    edges: sanitizedEdges,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
  };
}

export async function seedDatabase(
  database: CreativeNeuroDB = db
): Promise<ProjectRecord> {
  const seed = createSeedProject();
  const seedRecord: ProjectRecord = {
    ...seed.project,
    boards: seed.boards,
    pages: seed.pages,
    nodes: seed.nodes,
    edges: seed.edges,
  };

  await database.transaction('rw', [database.projects, database.settings], async () => {
    await database.projects.put(seedRecord);
    await database.settings.put({
      key: 'lastActiveProjectId',
      value: seedRecord.id,
    });
  });

  return seedRecord;
}

export async function loadActiveProject(
  store: typeof useProjectStore = useProjectStore,
  database: CreativeNeuroDB = db
): Promise<ProjectRecord | null> {
  try {
    const lastActiveSetting = await database.settings.get('lastActiveProjectId');
    const projectId = lastActiveSetting?.value as string | undefined;

    let rawRecord: ProjectRecord | undefined;
    if (projectId) {
      rawRecord = await database.projects.get(projectId);
    }

    let record = rawRecord ? validateAndSanitizeProjectRecord(rawRecord) : null;

    if (!record) {
      const allProjects = await database.projects.toArray();
      for (const p of allProjects) {
        const validated = validateAndSanitizeProjectRecord(p);
        if (validated) {
          record = validated;
          break;
        }
      }
    }

    if (!record) {
      console.warn('[CreativeNeuroDB] No valid project record found. Falling back to seed database.');
      record = await seedDatabase(database);
    }

    if (record) {
      store.getState().setProject(
        record,
        record.pages,
        record.nodes,
        record.edges,
        record.boards
      );
      return record;
    }

    return null;
  } catch (error) {
    console.warn('[CreativeNeuroDB] Error in loadActiveProject, recovering with in-memory seed:', error);
    const fallbackSeed = createSeedProject();
    const seedRecord: ProjectRecord = {
      ...fallbackSeed.project,
      boards: fallbackSeed.boards,
      pages: fallbackSeed.pages,
      nodes: fallbackSeed.nodes,
      edges: fallbackSeed.edges,
    };
    store.getState().setProject(
      seedRecord,
      seedRecord.pages,
      seedRecord.nodes,
      seedRecord.edges,
      seedRecord.boards
    );
    return seedRecord;
  }
}

export async function initializeDatabase(
  store: typeof useProjectStore = useProjectStore,
  database: CreativeNeuroDB = db
): Promise<ProjectRecord | null> {
  try {
    const projectCount = await database.projects.count();

    if (projectCount === 0) {
      console.log('[CreativeNeuroDB] First launch detected. Seeding interactive demo project...');
      await seedDatabase(database);
    }

    const loadedProject = await loadActiveProject(store, database);

    // Initialize 500ms auto-save listener
    setupAutoSave(store, database, 500);

    return loadedProject;
  } catch (error) {
    console.warn(
      '[CreativeNeuroDB] IndexedDB access restricted or error thrown. Operating with in-memory seed.',
      error
    );
    const fallbackSeed = createSeedProject();
    store.getState().setProject(
      fallbackSeed.project,
      fallbackSeed.pages,
      fallbackSeed.nodes,
      fallbackSeed.edges,
      fallbackSeed.boards
    );
    return null;
  }
}

export async function resetDatabaseToSeed(
  store: typeof useProjectStore = useProjectStore,
  database: CreativeNeuroDB = db
): Promise<void> {
  for (const session of activeAutoSaveSessions) {
    if (session.store === store && session.database === database) {
      if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
      }
    }
  }

  const seed = createSeedProject();
  const seedRecord: ProjectRecord = {
    ...seed.project,
    boards: seed.boards,
    pages: seed.pages,
    nodes: seed.nodes,
    edges: seed.edges,
  };

  await database.transaction('rw', [database.projects, database.settings], async () => {
    await database.projects.clear();
    await database.projects.put(seedRecord);
    await database.settings.put({
      key: 'lastActiveProjectId',
      value: seedRecord.id,
    });
  });

  store.getState().setProject(
    seed.project,
    seed.pages,
    seed.nodes,
    seed.edges,
    seed.boards
  );

  // Clear temporal history to prevent undoing into wiped state
  useProjectStore.temporal.getState().clear();
}
