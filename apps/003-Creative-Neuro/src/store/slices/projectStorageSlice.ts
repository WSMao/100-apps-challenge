/**
 * Creative-Neuro Store Subsystem - Project & Storage Slice
 * Path: src/store/slices/projectStorageSlice.ts
 */

import type { TemporalState } from 'zundo';
import type {
  Project,
  Board,
  Page,
  NeuroNode,
  NeuroEdge,
  ProjectSummary,
} from '../../types/index.ts';
import { createSeedProject } from '../seedData.ts';
import type { StoreSet, StoreGet, ProjectRecord } from './types.ts';

const initialSeed = createSeedProject();

export const createProjectStorageSlice = (
  set: StoreSet,
  get: StoreGet,
  getTemporal?: () => TemporalState<unknown> | undefined
) => ({
  setProject: (
    projectOrRecord: ProjectRecord | Project,
    pages?: Record<string, Page>,
    nodes?: Record<string, NeuroNode>,
    edges?: Record<string, NeuroEdge>,
    boards?: Record<string, Board>
  ) => {
    set((state) => {
      let resolvedPages: Record<string, Page> = {};
      let resolvedNodes: Record<string, NeuroNode> = {};
      let resolvedEdges: Record<string, NeuroEdge> = {};
      let resolvedBoards: Record<string, Board> = {};

      const hasExplicitCollections =
        pages !== undefined ||
        nodes !== undefined ||
        edges !== undefined ||
        boards !== undefined;

      if (
        !hasExplicitCollections &&
        'pages' in projectOrRecord &&
        projectOrRecord.pages &&
        typeof projectOrRecord.pages === 'object' &&
        !Array.isArray(projectOrRecord.pages)
      ) {
        const record = projectOrRecord as ProjectRecord;
        resolvedPages = record.pages;
        resolvedNodes =
          record.nodes && typeof record.nodes === 'object' && !Array.isArray(record.nodes)
            ? record.nodes
            : {};
        resolvedEdges =
          record.edges && typeof record.edges === 'object' && !Array.isArray(record.edges)
            ? record.edges
            : {};
        resolvedBoards =
          record.boards && typeof record.boards === 'object' && !Array.isArray(record.boards)
            ? record.boards
            : {};

        const pageKeys = Object.keys(resolvedPages);
        const validPageIds =
          Array.isArray(record.pageIds) && record.pageIds.length > 0
            ? record.pageIds.filter((pid) => typeof pid === 'string')
            : pageKeys;

        const boardKeys = Object.keys(resolvedBoards);
        const validBoardIds =
          Array.isArray(record.boardIds) && record.boardIds.length > 0
            ? record.boardIds.filter((bid) => typeof bid === 'string')
            : boardKeys;

        const rawRecordName = typeof record.name === 'string' ? record.name : 'Untitled Project';
        const recordName =
          rawRecordName === 'Creative-Neuro Showcase' ||
          rawRecordName.startsWith('Creative-Neuro') ||
          record.id === 'proj-creative-neuro-demo'
            ? 'Demo'
            : rawRecordName;

        state.project = {
          id: typeof record.id === 'string' && record.id ? record.id : `proj-${Date.now()}`,
          name: recordName,
          description: typeof record.description === 'string' ? record.description : '',
          version: typeof record.version === 'string' ? record.version : '1.0.0',
          activePageId:
            record.activePageId && resolvedPages[record.activePageId]
              ? record.activePageId
              : validPageIds[0] || 'page-1',
          pageIds: validPageIds,
          activeBoardId: record.activeBoardId || validBoardIds[0] || 'board-1',
          boardIds: validBoardIds,
          createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
          updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
        };
        state.pages = resolvedPages;
        state.nodes = resolvedNodes;
        state.edges = resolvedEdges;
        state.boards = resolvedBoards;
        state.activePageId = state.project.activePageId;
      } else {
        const proj = projectOrRecord as Project;
        resolvedPages =
          pages && typeof pages === 'object' && !Array.isArray(pages)
            ? pages
            : proj?.pages && typeof proj.pages === 'object' && !Array.isArray(proj.pages)
              ? proj.pages
              : {};
        resolvedNodes =
          nodes && typeof nodes === 'object' && !Array.isArray(nodes) ? nodes : {};
        resolvedEdges =
          edges && typeof edges === 'object' && !Array.isArray(edges) ? edges : {};
        resolvedBoards =
          boards && typeof boards === 'object' && !Array.isArray(boards)
            ? boards
            : proj?.boards && typeof proj.boards === 'object' && !Array.isArray(proj.boards)
              ? proj.boards
              : {};

        const pageKeys = Object.keys(resolvedPages);
        const validPageIds =
          Array.isArray(proj?.pageIds) && proj.pageIds.length > 0
            ? proj.pageIds.filter((pid) => typeof pid === 'string')
            : pageKeys;

        const boardKeys = Object.keys(resolvedBoards);
        const validBoardIds =
          Array.isArray(proj?.boardIds) && proj.boardIds.length > 0
            ? proj.boardIds.filter((bid) => typeof bid === 'string')
            : boardKeys;

        const rawProjName = typeof proj?.name === 'string' ? proj.name : 'Untitled Project';
        const projName =
          rawProjName === 'Creative-Neuro Showcase' ||
          rawProjName.startsWith('Creative-Neuro') ||
          proj?.id === 'proj-creative-neuro-demo'
            ? 'Demo'
            : rawProjName;

        state.project = {
          id: typeof proj?.id === 'string' && proj.id ? proj.id : `proj-${Date.now()}`,
          name: projName,
          description: typeof proj?.description === 'string' ? proj.description : '',
          version: typeof proj?.version === 'string' ? proj.version : '1.0.0',
          activePageId:
            proj?.activePageId && resolvedPages[proj.activePageId]
              ? proj.activePageId
              : validPageIds[0] || 'page-1',
          pageIds: validPageIds,
          activeBoardId: proj?.activeBoardId || validBoardIds[0] || 'board-1',
          boardIds: validBoardIds,
          createdAt: typeof proj?.createdAt === 'number' ? proj.createdAt : Date.now(),
          updatedAt: typeof proj?.updatedAt === 'number' ? proj.updatedAt : Date.now(),
        };
        state.pages = resolvedPages;
        state.nodes = resolvedNodes;
        state.edges = resolvedEdges;
        state.boards = resolvedBoards;
        state.activePageId = state.project.activePageId;
      }

      // Sanitize text nodes to guarantee transparent background and border
      for (const node of Object.values(state.nodes)) {
        if (node && node.type === 'text') {
          if (!node.data) node.data = { label: '', layoutMode: 'manual' };
          if (
            !node.data.backgroundColor ||
            node.data.backgroundColor === '#ffffff' ||
            node.data.backgroundColor === '#f8fafc' ||
            node.data.backgroundColor === 'white' ||
            node.id === 'mm-note'
          ) {
            node.data.backgroundColor = 'transparent';
            node.data.borderColor = 'transparent';
            node.data.borderWidth = 0;
          }
        }
      }

      // Ephemeral UI State Sanitization
      state.toolMode = 'select';
      state.hoveredNodeId = null;
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
      state.focusedDiagramId = null;
      state.editingNodeId = null;
      state.editingInitialValue = null;
      state.isDragging = false;
    });

    const temporal = getTemporal?.();
    temporal?.clear();
  },

  createProject: (name: string = 'New Project'): string => {
    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pageId = `page-${Date.now()}-1`;
    const boardId = `board-${Date.now()}-1`;

    const newProject: Project = {
      id,
      name,
      version: '1.0.0',
      activeBoardId: boardId,
      boardIds: [boardId],
      activePageId: pageId,
      pageIds: [pageId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newBoard: Board = {
      id: boardId,
      projectId: id,
      name: 'Main Board',
      activePageId: pageId,
      pageIds: [pageId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newPage: Page = {
      id: pageId,
      projectId: id,
      boardId,
      title: 'Page 1',
      name: 'Page 1',
      order: 0,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodeIds: [],
      edgeIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((s) => {
      s.project = newProject;
      s.boards = { [boardId]: newBoard };
      s.pages = { [pageId]: newPage };
      s.nodes = {};
      s.edges = {};
      s.activePageId = pageId;
      s.selectedNodeIds = [];
      s.selectedEdgeIds = [];
      s.focusedDiagramId = null;

      // Update available project list
      const summary: ProjectSummary = {
        id,
        name,
        updatedAt: Date.now(),
        pageCount: 1,
      };
      s.availableProjects = [
        summary,
        ...s.availableProjects.filter((p) => p.id !== id),
      ];
    });

    const temporal = getTemporal?.();
    temporal?.clear();

    return id;
  },

  switchProject: async (projectId: string): Promise<boolean> => {
    try {
      const dbMod = await import('../../db/index.ts');
      const rec = await dbMod.db.projects.get(projectId);
      if (rec) {
        get().setProject(rec, rec.pages, rec.nodes, rec.edges, rec.boards);
        return true;
      }
    } catch {
      // ignore
    }

    // Fallback for in-memory / test environments
    if (projectId === initialSeed.project.id) {
      get().resetToSeed();
      return true;
    }
    return false;
  },

  deleteProject: async (projectId: string): Promise<boolean> => {
    set((s) => {
      s.availableProjects = s.availableProjects.filter((p) => p.id !== projectId);
    });
    try {
      const dbMod = await import('../../db/index.ts');
      await dbMod.db.projects.delete(projectId);
      return true;
    } catch {
      return true;
    }
  },

  refreshAvailableProjects: async (): Promise<void> => {
    try {
      const dbMod = await import('../../db/index.ts');
      const allProjects = await dbMod.db.projects.toArray();
      if (allProjects.length > 0) {
        const summaries: ProjectSummary[] = allProjects.map((p) => ({
          id: p.id,
          name: p.name,
          updatedAt: p.updatedAt,
          pageCount: p.pageIds?.length || Object.keys(p.pages || {}).length,
        }));
        set({ availableProjects: summaries });
      }
    } catch {
      // ignore in tests
    }
  },

  resetToSeed: () => {
    const seed = createSeedProject();
    get().setProject(
      seed.project,
      seed.pages,
      seed.nodes,
      seed.edges,
      seed.boards
    );
    get().resetSelectionFilter();
  },

  undo: () => {
    if (get().isDragging) return;
    const temporalApi = getTemporal?.();
    if (temporalApi) {
      temporalApi.undo();
      const current = get();
      const wasTracking = temporalApi.isTracking;
      temporalApi.pause();
      try {
        // Sanitize ghost selections if undone node/edge disappeared
        if (
          current.selectedNodeIds.some((id) => !current.nodes[id]) ||
          current.selectedEdgeIds.some((id) => !current.edges[id])
        ) {
          set((s) => {
            s.selectedNodeIds = s.selectedNodeIds.filter((id) => Boolean(s.nodes[id]));
            s.selectedEdgeIds = s.selectedEdgeIds.filter((id) => Boolean(s.edges[id]));
          });
        }
        // Fallback if active page was deleted in undo
        if (!current.pages[current.activePageId]) {
          const fallbackId = current.project.pageIds[0] || Object.keys(current.pages)[0];
          if (fallbackId) {
            set((s) => {
              s.activePageId = fallbackId;
              s.project.activePageId = fallbackId;
            });
          }
        }
      } finally {
        if (wasTracking) {
          temporalApi.resume();
        } else {
          temporalApi.pause();
        }
      }
    }
  },

  redo: () => {
    if (get().isDragging) return;
    const temporalApi = getTemporal?.();
    if (temporalApi) {
      temporalApi.redo();
      const current = get();
      const wasTracking = temporalApi.isTracking;
      temporalApi.pause();
      try {
        if (
          current.selectedNodeIds.some((id) => !current.nodes[id]) ||
          current.selectedEdgeIds.some((id) => !current.edges[id])
        ) {
          set((s) => {
            s.selectedNodeIds = s.selectedNodeIds.filter((id) => Boolean(s.nodes[id]));
            s.selectedEdgeIds = s.selectedEdgeIds.filter((id) => Boolean(s.edges[id]));
          });
        }
        if (!current.pages[current.activePageId]) {
          const fallbackId = current.project.pageIds[0] || Object.keys(current.pages)[0];
          if (fallbackId) {
            set((s) => {
              s.activePageId = fallbackId;
              s.project.activePageId = fallbackId;
            });
          }
        }
      } finally {
        if (wasTracking) {
          temporalApi.resume();
        } else {
          temporalApi.pause();
        }
      }
    }
  },
});
