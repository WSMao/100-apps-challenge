/**
 * Creative-Neuro Phase 1 Adversarial Test Suite
 * Persistence, Cold Restart, Corrupt DB Recovery & Debounce Stress Harness
 * Target: tests/adversarialPersistence.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useProjectStore,
  useActivePageNodes,
  useActivePageEdges,
  useActivePage,
} from '../src/store/projectStore.ts';
import {
  CreativeNeuroDB,
  saveProjectToDb,
  setupAutoSave,
  flushAutoSave,
  initializeDatabase,
  loadActiveProject,
  resetDatabaseToSeed,
  type ProjectRecord,
} from '../src/db/index.ts';
import {
  createSeedProject,
  SEED_PROJECT_ID,
  SEED_PAGE_IDS,
} from '../src/store/seedData.ts';

describe('Adversarial Persistence & Seed Data Stress Harness', () => {
  beforeEach(async () => {
    // Reset store to fresh seed and clear temporal undo history
    useProjectStore.getState().resetToSeed();
    const temporalApi = (
      useProjectStore as unknown as {
        temporal?: { getState: () => { clear: () => void } };
      }
    ).temporal;
    if (temporalApi) {
      temporalApi.getState().clear();
    }
  });

  // ==========================================================================
  // Suite 1: Cold Restart & Data Integrity
  // ==========================================================================
  describe('1. Cold Restart & State Hydration', () => {
    it('1.1 should faithfully restore complete project state across cold restarts', async () => {
      const db = new CreativeNeuroDB();
      await initializeDatabase(useProjectStore, db);
      const unsubscribe = setupAutoSave(useProjectStore, db, 30);

      // Perform user modifications across multiple pages
      const newPageId = useProjectStore.getState().addPage('Sprint Backlog');
      const nodeA = useProjectStore.getState().addNode({
        type: 'shape',
        position: { x: 250, y: 350 },
        data: {
          label: 'Auth Service',
          shapeType: 'diamond',
          backgroundColor: '#ef4444',
          color: '#ffffff',
          layoutMode: 'manual',
        },
      });
      const nodeB = useProjectStore.getState().addNode({
        type: 'shape',
        position: { x: 550, y: 350 },
        data: {
          label: 'User Cache',
          shapeType: 'database',
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          layoutMode: 'manual',
        },
      });
      const edgeAB = useProjectStore.getState().addEdge({
        source: nodeA,
        target: nodeB,
        type: 'jump',
        label: 'cache-read',
      });

      // Allow 30ms debounce to settle
      await new Promise((r) => setTimeout(r, 80));
      unsubscribe();

      // Simulate Cold Restart: wipe in-memory state
      useProjectStore.getState().resetToSeed();
      expect(useProjectStore.getState().nodes[nodeA]).toBeUndefined();
      expect(useProjectStore.getState().pages[newPageId]).toBeUndefined();

      // Cold Rehydration from database
      const loaded = await loadActiveProject(useProjectStore, db);
      expect(loaded).toBeDefined();

      const restoredState = useProjectStore.getState();
      expect(restoredState.project.id).toBe(SEED_PROJECT_ID);
      expect(restoredState.activePageId).toBe(newPageId);
      expect(restoredState.pages[newPageId]).toBeDefined();
      expect(restoredState.pages[newPageId].title).toBe('Sprint Backlog');
      expect(restoredState.nodes[nodeA]).toBeDefined();
      expect(restoredState.nodes[nodeA].data.label).toBe('Auth Service');
      expect(restoredState.nodes[nodeA].data.shapeType).toBe('diamond');
      expect(restoredState.nodes[nodeB]).toBeDefined();
      expect(restoredState.nodes[nodeB].data.label).toBe('User Cache');
      expect(restoredState.edges[edgeAB]).toBeDefined();
      expect(restoredState.edges[edgeAB].label).toBe('cache-read');
      expect(restoredState.pages[newPageId].nodeIds).toContain(nodeA);
      expect(restoredState.pages[newPageId].nodeIds).toContain(nodeB);
      expect(restoredState.pages[newPageId].edgeIds).toContain(edgeAB);

      await db.close();
    });

    it('1.2 should persist React Flow node dragging (onNodesChange) across cold restarts', async () => {
      const db = new CreativeNeuroDB();
      await initializeDatabase(useProjectStore, db);
      const unsubscribe = setupAutoSave(useProjectStore, db, 30);

      // Move a node using updateNodePosition to establish initial saved state
      useProjectStore.getState().updateNodePosition('mm-root', { x: 300, y: 300 });
      await new Promise((r) => setTimeout(r, 80));

      // User drags mm-root via React Flow's onNodesChange
      useProjectStore.getState().onNodesChange([
        {
          type: 'position',
          id: 'mm-root',
          position: { x: 1200, y: 950 },
        },
      ]);

      // Wait for debounce period to persist to IndexedDB
      await new Promise((r) => setTimeout(r, 80));
      unsubscribe();

      // Check DB directly: Did onNodesChange actually persist to IndexedDB?
      const savedInDb = await db.projects.get(useProjectStore.getState().project.id);
      expect(savedInDb).toBeDefined();

      // ADVERSARIAL CHALLENGE: If computeStateSignature ignores onNodesChange,
      // savedInDb.nodes['mm-root'].position will still be { x: 300, y: 300 }
      expect(savedInDb!.nodes['mm-root'].position).toEqual({ x: 1200, y: 950 });

      // Cold Restart
      useProjectStore.getState().resetToSeed();
      await loadActiveProject(useProjectStore, db);

      expect(useProjectStore.getState().nodes['mm-root'].position).toEqual({
        x: 1200,
        y: 950,
      });

      await db.close();
    });

    it('1.3 should persist canvas viewport pan/zoom across cold restarts even after prior saves', async () => {
      const db = new CreativeNeuroDB();
      await initializeDatabase(useProjectStore, db);
      const unsubscribe = setupAutoSave(useProjectStore, db, 30);

      // 1. Establish an initial saved state
      useProjectStore.getState().addNode({
        type: 'shape',
        position: { x: 50, y: 50 },
        data: { label: 'Initial Baseline Node', layoutMode: 'manual' },
      });
      await new Promise((r) => setTimeout(r, 80));

      // 2. User pans/zooms the canvas
      useProjectStore
        .getState()
        .setViewport(SEED_PAGE_IDS.mindmap, { x: 750, y: -300, zoom: 1.85 });
      await new Promise((r) => setTimeout(r, 80));
      unsubscribe();

      // Direct DB inspection
      const savedInDb = await db.projects.get(useProjectStore.getState().project.id);
      expect(savedInDb).toBeDefined();

      // ADVERSARIAL CHALLENGE: If computeStateSignature ignores setViewport after an initial save,
      // savedInDb viewport will still be the seed default { x: 50, y: 50, zoom: 0.9 }
      expect(savedInDb!.pages[SEED_PAGE_IDS.mindmap].viewport).toEqual({
        x: 750,
        y: -300,
        zoom: 1.85,
      });

      // Cold restart
      useProjectStore.getState().resetToSeed();
      await loadActiveProject(useProjectStore, db);

      expect(
        useProjectStore.getState().pages[SEED_PAGE_IDS.mindmap].viewport
      ).toEqual({
        x: 750,
        y: -300,
        zoom: 1.85,
      });

      await db.close();
    });

    it('1.4 should sanitize ephemeral UI state across cold restarts', async () => {
      const db = new CreativeNeuroDB();
      await initializeDatabase(useProjectStore, db);
      const unsubscribe = setupAutoSave(useProjectStore, db, 30);

      // Set ephemeral UI properties
      useProjectStore.getState().setToolMode('draw');
      useProjectStore.getState().setSelectedNodes(['mm-root']);
      useProjectStore.getState().setSelectedEdges(['e-mm-root-state']);
      useProjectStore.getState().setFocusedDiagramId('fc-diagram-card');
      useProjectStore.getState().setHoveredNodeId('mm-branch-state');

      // Add node to trigger auto-save
      useProjectStore.getState().addNode({
        type: 'text',
        position: { x: 50, y: 50 },
        data: { label: 'Transient Check', layoutMode: 'manual' },
      });

      await new Promise((r) => setTimeout(r, 80));
      unsubscribe();

      // Cold Restart
      useProjectStore.getState().resetToSeed();
      await loadActiveProject(useProjectStore, db);

      const state = useProjectStore.getState();
      // ADVERSARIAL CHALLENGE: toolMode should be sanitized to 'select' on rehydration
      expect(state.toolMode).toBe('select');
      expect(state.selectedNodeIds).toEqual([]);
      expect(state.selectedEdgeIds).toEqual([]);
      expect(state.focusedDiagramId).toBe(null);
      expect(state.hoveredNodeId).toBe(null);
      expect(state.isDragging).toBe(false);

      await db.close();
    });
  });

  // ==========================================================================
  // Suite 2: Corrupt & Empty IndexedDB Recovery
  // ==========================================================================
  describe('2. Corrupt & Empty IndexedDB Recovery', () => {
    it('2.1 should auto-seed on completely empty database', async () => {
      const db = new CreativeNeuroDB();
      expect(await db.projects.count()).toBe(0);
      expect(await db.settings.count()).toBe(0);

      const record = await initializeDatabase(useProjectStore, db);
      expect(record).toBeDefined();
      expect(record?.id).toBe(SEED_PROJECT_ID);

      const state = useProjectStore.getState();
      expect(state.project.id).toBe(SEED_PROJECT_ID);
      expect(state.project.pageIds.length).toBe(3);
      expect(Object.keys(state.pages).length).toBe(3);
      expect(Object.keys(state.nodes).length).toBeGreaterThan(15);
      expect(Object.keys(state.edges).length).toBeGreaterThan(10);

      await db.close();
    });

    it('2.2 should recover gracefully from corrupted record with missing pageIds', async () => {
      const db = new CreativeNeuroDB();
      // Inoculate DB with corrupted record missing pages and pageIds
      await db.projects.put({
        id: 'corrupt-missing-pageids',
        name: 'Broken Project',
        description: 'Missing pageIds',
        version: '1.0.0',
        activeBoardId: 'board-1',
        boardIds: ['board-1'],
        activePageId: 'page-nonexistent',
        // pageIds is undefined
        // pages is undefined
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as ProjectRecord);

      await db.settings.put({
        key: 'lastActiveProjectId',
        value: 'corrupt-missing-pageids',
      });

      // System should either repair or fallback rather than loading a broken record
      await initializeDatabase(useProjectStore, db);

      // ADVERSARIAL CHALLENGE: addPage must not crash with TypeError
      expect(() => {
        useProjectStore.getState().addPage('Recovery Page');
      }).not.toThrow();

      const state = useProjectStore.getState();
      expect(Array.isArray(state.project.pageIds)).toBe(true);
      expect(state.project.pageIds.length).toBeGreaterThan(0);

      await db.close();
    });

    it('2.3 should reject and self-heal when record has malformed data types (pages is string)', async () => {
      const db = new CreativeNeuroDB();
      await db.projects.put({
        id: 'corrupt-type-mismatch',
        name: 'Type Mismatch',
        pages: 'corrupted_string_not_object' as unknown,
        nodes: null as unknown,
        edges: 12345 as unknown,
      } as unknown as ProjectRecord);

      await db.settings.put({
        key: 'lastActiveProjectId',
        value: 'corrupt-type-mismatch',
      });

      await initializeDatabase(useProjectStore, db);

      // ADVERSARIAL CHALLENGE: Store pages and nodes must be valid object dictionaries
      const state = useProjectStore.getState();
      expect(typeof state.pages).toBe('object');
      expect(state.pages !== null).toBe(true);
      expect(typeof state.nodes).toBe('object');
      expect(state.nodes !== null).toBe(true);

      // Canvas helper selectors must not crash with TypeErrors
      expect(() => useActivePageNodes()).not.toThrow();
      expect(() => useActivePageEdges()).not.toThrow();

      await db.close();
    });

    it('2.4 should recover when settings points to non-existent project ID', async () => {
      const db = new CreativeNeuroDB();
      // Create one valid project
      const seed = createSeedProject();
      await db.projects.put({
        ...seed.project,
        boards: seed.boards,
        pages: seed.pages,
        nodes: seed.nodes,
        edges: seed.edges,
      });

      // Point settings to non-existent project
      await db.settings.put({
        key: 'lastActiveProjectId',
        value: 'ghost-project-9999',
      });

      const loaded = await loadActiveProject(useProjectStore, db);
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(SEED_PROJECT_ID);
      expect(useProjectStore.getState().project.id).toBe(SEED_PROJECT_ID);

      await db.close();
    });

    it('2.5 should reset database and store cleanly to seed data via resetDatabaseToSeed', async () => {
      const db = new CreativeNeuroDB();
      await initializeDatabase(useProjectStore, db);

      // Add junk page and nodes
      useProjectStore.getState().addPage('Temporary Scratchpad');
      useProjectStore.getState().addNode({
        type: 'shape',
        position: { x: 999, y: 999 },
        data: { label: 'Junk Node', layoutMode: 'manual' },
      });

      await resetDatabaseToSeed(useProjectStore, db);

      const state = useProjectStore.getState();
      expect(state.project.id).toBe(SEED_PROJECT_ID);
      expect(state.project.pageIds.length).toBe(3);
      expect(state.nodes['mm-root']).toBeDefined();

      const dbProjects = await db.projects.toArray();
      expect(dbProjects.length).toBe(1);
      expect(dbProjects[0].id).toBe(SEED_PROJECT_ID);
      expect(dbProjects[0].pageIds.length).toBe(3);

      await db.close();
    });
  });

  // ==========================================================================
  // Suite 3: Rapid Multi-Page Auto-Save Debounce Triggers & Concurrency
  // ==========================================================================
  describe('3. Debounce Timing & Rapid Multi-Page Concurrency', () => {
    it('3.1 should coalesce rapid multi-page edits into a single consistent DB write', async () => {
      const db = new CreativeNeuroDB();
      await initializeDatabase(useProjectStore, db);
      const unsubscribe = setupAutoSave(useProjectStore, db, 60);

      // Rapidly perform cross-page edits every 10ms (< 60ms debounce)
      const pageIds: string[] = [];
      const nodeIds: string[] = [];

      for (let i = 0; i < 4; i++) {
        const pageId = useProjectStore.getState().addPage(`Batch Page ${i}`);
        pageIds.push(pageId);
        const nodeId = useProjectStore.getState().addNode({
          type: 'shape',
          position: { x: i * 100, y: i * 50 },
          data: { label: `Batch Node ${i}`, layoutMode: 'manual' },
        });
        nodeIds.push(nodeId);
        await new Promise((r) => setTimeout(r, 10));
      }

      // Wait for debounce (60ms) + safety buffer (40ms) = 100ms
      await new Promise((r) => setTimeout(r, 100));
      unsubscribe();

      const dbRecord = await db.projects.get(useProjectStore.getState().project.id);
      expect(dbRecord).toBeDefined();

      // All pages and nodes must be present in the persisted DB snapshot
      for (const pid of pageIds) {
        expect(dbRecord!.pages[pid]).toBeDefined();
      }
      for (const nid of nodeIds) {
        expect(dbRecord!.nodes[nid]).toBeDefined();
      }
      expect(dbRecord!.activePageId).toBe(pageIds[pageIds.length - 1]);

      await db.close();
    });

    it('3.2 should flush immediately via flushAutoSave without waiting for debounce timer', async () => {
      const db = new CreativeNeuroDB();
      await initializeDatabase(useProjectStore, db);
      const unsubscribe = setupAutoSave(useProjectStore, db, 200);

      const nodeId = useProjectStore.getState().addNode({
        type: 'shape',
        position: { x: 777, y: 888 },
        data: { label: 'Emergency Flush Node', layoutMode: 'manual' },
      });

      // Immediately flush before the 200ms debounce expires
      await flushAutoSave(useProjectStore, db);
      unsubscribe();

      // Inspect DB immediately
      const dbRecord = await db.projects.get(useProjectStore.getState().project.id);
      expect(dbRecord).toBeDefined();
      expect(dbRecord!.nodes[nodeId]).toBeDefined();
      expect(dbRecord!.nodes[nodeId].data.label).toBe('Emergency Flush Node');

      await db.close();
    });

    it('3.3 should abort pending debounce write on unsubscribe', async () => {
      const db = new CreativeNeuroDB();
      await initializeDatabase(useProjectStore, db);
      const unsubscribe = setupAutoSave(useProjectStore, db, 80);

      const nodeId = useProjectStore.getState().addNode({
        type: 'shape',
        position: { x: 123, y: 456 },
        data: { label: 'Aborted Node', layoutMode: 'manual' },
      });

      // Immediately teardown listener
      unsubscribe();

      // Wait past debounce time
      await new Promise((r) => setTimeout(r, 120));

      // Record in DB should NOT have the node because write was canceled
      const dbRecord = await db.projects.get(useProjectStore.getState().project.id);
      expect(dbRecord?.nodes[nodeId]).toBeUndefined();

      await db.close();
    });
  });

  // ==========================================================================
  // Suite 4: Schema Type Validation & Relational Integrity
  // ==========================================================================
  describe('4. Schema Contracts & Relational Integrity', () => {
    it('4.1 should maintain relational referential integrity on page deletion', async () => {
      const pageId = useProjectStore.getState().addPage('Page To Delete');
      const nodeA = useProjectStore.getState().addNode({
        type: 'shape',
        position: { x: 10, y: 10 },
        data: { label: 'Node A', layoutMode: 'manual' },
      });
      const nodeB = useProjectStore.getState().addNode({
        type: 'shape',
        position: { x: 200, y: 10 },
        data: { label: 'Node B', layoutMode: 'manual' },
      });
      const edge = useProjectStore.getState().addEdge({
        source: nodeA,
        target: nodeB,
      });

      expect(useProjectStore.getState().nodes[nodeA]).toBeDefined();
      expect(useProjectStore.getState().edges[edge]).toBeDefined();

      // Delete page
      useProjectStore.getState().deletePage(pageId);

      const state = useProjectStore.getState();
      expect(state.pages[pageId]).toBeUndefined();
      // Nodes and edges attached to the deleted page must be purged
      expect(state.nodes[nodeA]).toBeUndefined();
      expect(state.nodes[nodeB]).toBeUndefined();
      expect(state.edges[edge]).toBeUndefined();
    });

    it('4.2 should maintain referential integrity when deleting node with attached edges', async () => {
      const state = useProjectStore.getState();
      // In seed data: mm-root connects to e-mm-root-state, e-mm-root-engine, e-mm-root-ui
      expect(state.nodes['mm-root']).toBeDefined();
      expect(state.edges['e-mm-root-state']).toBeDefined();

      useProjectStore.getState().removeNode('mm-root');

      const updated = useProjectStore.getState();
      expect(updated.nodes['mm-root']).toBeUndefined();
      expect(updated.edges['e-mm-root-state']).toBeUndefined();
      expect(updated.edges['e-mm-root-engine']).toBeUndefined();
      expect(updated.edges['e-mm-root-ui']).toBeUndefined();

      // Page edgeIds must not have dangling references
      const page = updated.pages[SEED_PAGE_IDS.mindmap];
      expect(page.nodeIds).not.toContain('mm-root');
      expect(page.edgeIds).not.toContain('e-mm-root-state');
    });

    it('4.3 should validate that all seed data strictly adheres to Layer 1 schema contracts', () => {
      const seed = createSeedProject();

      // Project contract
      expect(seed.project.id).toBe(SEED_PROJECT_ID);
      expect(seed.project.name).toBe('Demo');
      expect(Array.isArray(seed.project.pageIds)).toBe(true);
      expect(seed.project.pageIds.length).toBeGreaterThan(0);
      expect(seed.project.pageIds).toContain(seed.project.activePageId);

      // Page contract
      for (const page of Object.values(seed.pages)) {
        expect(page.id).toBeDefined();
        expect(page.projectId).toBe(seed.project.id);
        expect(page.viewport).toBeDefined();
        expect(typeof page.viewport.x).toBe('number');
        expect(typeof page.viewport.y).toBe('number');
        expect(typeof page.viewport.zoom).toBe('number');
        expect(Array.isArray(page.nodeIds)).toBe(true);
        expect(Array.isArray(page.edgeIds)).toBe(true);
      }

      // Node contract
      for (const node of Object.values(seed.nodes)) {
        expect(node.id).toBeDefined();
        expect(['shape', 'text', 'frame', 'diagram', 'freehand', 'pageCard']).toContain(node.type);
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
        expect(['auto-elk', 'manual', 'fixed']).toContain(node.layoutMode);
        expect(node.data).toBeDefined();
        expect(typeof node.data.label).toBe('string');
        expect(['auto-elk', 'manual', 'fixed']).toContain(node.data.layoutMode);
      }

      // Edge contract
      for (const edge of Object.values(seed.edges)) {
        expect(edge.id).toBeDefined();
        expect(seed.nodes[edge.source]).toBeDefined();
        expect(seed.nodes[edge.target]).toBeDefined();
      }
    });
  });
});
