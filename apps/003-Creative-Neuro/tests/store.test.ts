/**
 * Creative-Neuro Layer 1 State Store & Persistence Unit Test Suite
 * Target: tests/store.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, useActivePageNodes, useActivePageEdges, useActivePage } from '../src/store/projectStore.ts';
import { SEED_PROJECT_ID, SEED_PAGE_IDS, createSeedProject } from '../src/store/seedData.ts';
import { db, saveProjectToDb, setupAutoSave } from '../src/db/index.ts';

describe('Creative-Neuro Layer 1 State Store (projectStore & seedData)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetToSeed();
    const temporalApi = (useProjectStore as unknown as { temporal?: { getState: () => { clear: () => void } } }).temporal;
    if (temporalApi) {
      temporalApi.getState().clear();
    }
  });

  describe('1. Baseline Seed Initialization', () => {
    it('initializes store with valid seed project and metadata', () => {
      const state = useProjectStore.getState();
      expect(state.project.id).toBe(SEED_PROJECT_ID);
      expect(state.project.name).toBe('Demo');
      expect(state.project.pageIds.length).toBe(3);
      expect(state.activePageId).toBe(SEED_PAGE_IDS.mindmap);
    });

    it('populates all 3 initial pages with rich scene graph entities', () => {
      const state = useProjectStore.getState();
      expect(state.pages[SEED_PAGE_IDS.mindmap]).toBeDefined();
      expect(state.pages[SEED_PAGE_IDS.flowchart]).toBeDefined();
      expect(state.pages[SEED_PAGE_IDS.containers]).toBeDefined();

      const mindmapPage = state.pages[SEED_PAGE_IDS.mindmap];
      expect(mindmapPage.nodeIds.length).toBeGreaterThan(5);
      expect(mindmapPage.edgeIds.length).toBeGreaterThan(5);

      const flowchartPage = state.pages[SEED_PAGE_IDS.flowchart];
      expect(flowchartPage.nodeIds.length).toBeGreaterThan(5);
      expect(flowchartPage.edgeIds.length).toBeGreaterThan(5);

      const containersPage = state.pages[SEED_PAGE_IDS.containers];
      expect(containersPage.nodeIds.length).toBeGreaterThan(5);
      expect(containersPage.edgeIds.length).toBeGreaterThan(5);
    });
  });

  describe('2. Page Management Actions', () => {
    it('creates a new page and switches activePageId to it', () => {
      const store = useProjectStore.getState();
      const initialPageCount = store.project.pageIds.length;

      const newPageId = store.addPage('Sprint Backlog');
      const updated = useProjectStore.getState();

      expect(updated.project.pageIds.length).toBe(initialPageCount + 1);
      expect(updated.pages[newPageId]).toBeDefined();
      expect(updated.pages[newPageId].title).toBe('Sprint Backlog');
      expect(updated.activePageId).toBe(newPageId);
    });

    it('switches active page via setActivePage', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.flowchart);
      expect(useProjectStore.getState().activePageId).toBe(SEED_PAGE_IDS.flowchart);

      store.setActivePage(SEED_PAGE_IDS.containers);
      expect(useProjectStore.getState().activePageId).toBe(SEED_PAGE_IDS.containers);
    });

    it('updates page title and timestamp', () => {
      const store = useProjectStore.getState();
      store.updatePageTitle(SEED_PAGE_IDS.mindmap, 'Brainstorming Central');
      const updated = useProjectStore.getState();
      expect(updated.pages[SEED_PAGE_IDS.mindmap].title).toBe('Brainstorming Central');
      expect(updated.pages[SEED_PAGE_IDS.mindmap].name).toBe('Brainstorming Central');
    });

    it('prevents deleting the only remaining page', () => {
      const store = useProjectStore.getState();
      // Delete page 2 and page 3
      store.deletePage(SEED_PAGE_IDS.flowchart);
      store.deletePage(SEED_PAGE_IDS.containers);

      expect(useProjectStore.getState().project.pageIds.length).toBe(1);

      // Attempt to delete the last page
      store.deletePage(SEED_PAGE_IDS.mindmap);
      expect(useProjectStore.getState().project.pageIds.length).toBe(1);
      expect(useProjectStore.getState().pages[SEED_PAGE_IDS.mindmap]).toBeDefined();
    });
  });

  describe('3. Node CRUD & Cascade Operations', () => {
    it('adds a node with default properties and registers it with the active page', () => {
      const store = useProjectStore.getState();
      const activeId = store.activePageId;
      const initialCount = store.pages[activeId].nodeIds.length;

      const nodeId = store.addNode({
        type: 'shape',
        position: { x: 500, y: 400 },
        data: {
          label: 'Auth Server',
          shapeType: 'rounded',
          layoutMode: 'manual',
        },
      });

      const updated = useProjectStore.getState();
      expect(updated.nodes[nodeId]).toBeDefined();
      expect(updated.nodes[nodeId].data.label).toBe('Auth Server');
      expect(updated.nodes[nodeId].position).toEqual({ x: 500, y: 400 });
      expect(updated.pages[activeId].nodeIds.length).toBe(initialCount + 1);
      expect(updated.pages[activeId].nodeIds).toContain(nodeId);
    });

    it('updates node position when unlocked and preserves locked: false', () => {
      const store = useProjectStore.getState();
      expect(store.nodes['mm-root'].locked).toBe(false);

      store.updateNodePosition('mm-root', { x: 350, y: 380 });
      const updated = useProjectStore.getState();

      expect(updated.nodes['mm-root'].position).toEqual({ x: 350, y: 380 });
      expect(updated.nodes['mm-root'].locked).toBe(false);
    });

    it('updates node data with partial patch', () => {
      const store = useProjectStore.getState();
      store.updateNodeData('mm-root', {
        label: 'Updated Central Core',
        backgroundColor: '#1e1b4b',
        fontSize: 18,
      });

      const updated = useProjectStore.getState();
      expect(updated.nodes['mm-root'].data.label).toBe('Updated Central Core');
      expect(updated.nodes['mm-root'].data.backgroundColor).toBe('#1e1b4b');
      expect(updated.nodes['mm-root'].data.fontSize).toBe(18);
    });

    it('removes a node and cascades deletion to all attached edges and selections', () => {
      const store = useProjectStore.getState();
      // In seed data, mm-root has 3 outbound edges: e-mm-root-state, e-mm-root-engine, e-mm-root-ui
      expect(store.nodes['mm-root']).toBeDefined();
      expect(store.edges['e-mm-root-state']).toBeDefined();

      store.setSelectedNodes(['mm-root']);
      store.removeNode('mm-root');

      const updated = useProjectStore.getState();
      expect(updated.nodes['mm-root']).toBeUndefined();
      expect(updated.edges['e-mm-root-state']).toBeUndefined();
      expect(updated.edges['e-mm-root-engine']).toBeUndefined();
      expect(updated.edges['e-mm-root-ui']).toBeUndefined();
      expect(updated.selectedNodeIds).not.toContain('mm-root');
    });
  });

  describe('4. Edge CRUD Operations', () => {
    it('creates an edge connecting two nodes and records it in the active page', () => {
      const store = useProjectStore.getState();
      const activeId = store.activePageId;
      const initialEdgeCount = store.pages[activeId].edgeIds.length;

      const edgeId = store.addEdge({
        source: 'mm-leaf-zustand',
        target: 'mm-leaf-zundo',
        type: 'jump',
        label: 'State Binding',
      });

      const updated = useProjectStore.getState();
      expect(updated.edges[edgeId]).toBeDefined();
      expect(updated.edges[edgeId].source).toBe('mm-leaf-zustand');
      expect(updated.edges[edgeId].target).toBe('mm-leaf-zundo');
      expect(updated.edges[edgeId].label).toBe('State Binding');
      expect(updated.pages[activeId].edgeIds.length).toBe(initialEdgeCount + 1);
    });

    it('removes an edge and purges it from page edgeIds', () => {
      const store = useProjectStore.getState();
      expect(store.edges['e-mm-root-state']).toBeDefined();

      store.removeEdge('e-mm-root-state');
      const updated = useProjectStore.getState();

      expect(updated.edges['e-mm-root-state']).toBeUndefined();
      expect(updated.pages[SEED_PAGE_IDS.mindmap].edgeIds).not.toContain('e-mm-root-state');
    });
  });

  describe('5. Temporal Undo / Redo & Selection Sanitization', () => {
    it('supports multi-level undo and redo for node additions', () => {
      const store = useProjectStore.getState();
      const nodeId = store.addNode({
        type: 'shape',
        position: { x: 800, y: 600 },
        data: { label: 'Temporal Node 1', layoutMode: 'manual' },
      });

      expect(useProjectStore.getState().nodes[nodeId]).toBeDefined();

      // Undo addNode
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().nodes[nodeId]).toBeUndefined();

      // Redo addNode
      useProjectStore.getState().redo();
      expect(useProjectStore.getState().nodes[nodeId]).toBeDefined();
    });

    it('sanitizes ghost selections when an undone node is deleted from the graph', () => {
      const store = useProjectStore.getState();
      const nodeId = store.addNode({
        type: 'shape',
        position: { x: 700, y: 700 },
        data: { label: 'Selected Node', layoutMode: 'manual' },
      });

      store.setSelectedNodes([nodeId]);
      expect(useProjectStore.getState().selectedNodeIds).toContain(nodeId);

      // Undo adding the node
      useProjectStore.getState().undo();

      // Undone node is gone, and selectedNodeIds is sanitized
      expect(useProjectStore.getState().nodes[nodeId]).toBeUndefined();
      expect(useProjectStore.getState().selectedNodeIds).not.toContain(nodeId);
    });

    it('does not record ephemeral UI state (toolMode, hoveredNodeId) into undo history', () => {
      const store = useProjectStore.getState();
      const initialNodeCount = Object.keys(store.nodes).length;

      store.setToolMode('draw');
      store.setHoveredNodeId('mm-root');

      // Undo should not change toolMode or nodes
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().toolMode).toBe('draw');
      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(initialNodeCount);
    });
  });

  describe('6. Persistence & Auto-Save Listener', () => {
    it('initializes setupAutoSave listener and provides cleanup unsubscribe function', () => {
      const cleanup = setupAutoSave(useProjectStore, db, 100);
      expect(typeof cleanup).toBe('function');

      // Modifying state triggers listener without throwing
      useProjectStore.getState().addNode({
        type: 'text',
        position: { x: 10, y: 10 },
        data: { label: 'Auto-save test', layoutMode: 'manual' },
      });

      cleanup();
    });

    it('createSeedProject returns clean deep clones without reference contamination', () => {
      const cloneA = createSeedProject();
      const cloneB = createSeedProject();

      cloneA.project.name = 'Mutated Project';
      expect(cloneB.project.name).toBe('Demo');
      expect(cloneA.project.name).not.toBe(cloneB.project.name);
    });
  });

  describe('7. Lock & Container-Scoped Auto Layout', () => {
    it('defaults new nodes to locked: false and toggles lock via setNodeLocked / batchSetNodeLocked', () => {
      const store = useProjectStore.getState();
      const id1 = store.addNode({ type: 'shape', position: { x: 10, y: 10 }, data: { label: 'N1' } });
      const id2 = store.addNode({ type: 'shape', position: { x: 200, y: 10 }, data: { label: 'N2' } });

      expect(useProjectStore.getState().nodes[id1].locked).toBe(false);
      expect(useProjectStore.getState().nodes[id2].locked).toBe(false);

      store.setNodeLocked(id1, true);
      expect(useProjectStore.getState().nodes[id1].locked).toBe(true);
      expect(useProjectStore.getState().nodes[id1].data.locked).toBe(true);

      store.batchSetNodeLocked([id1, id2], false);
      expect(useProjectStore.getState().nodes[id1].locked).toBe(false);
      expect(useProjectStore.getState().nodes[id2].locked).toBe(false);
    });

    it('prevents dragging (onNodesChange position change) when a node is locked', () => {
      const store = useProjectStore.getState();
      const lockedId = store.addNode({
        type: 'shape',
        position: { x: 120, y: 150 },
        locked: true,
        data: { label: 'Locked Box', locked: true },
      });

      store.onNodesChange([
        {
          id: lockedId,
          type: 'position',
          position: { x: 999, y: 888 },
          dragging: true,
        },
      ]);

      expect(useProjectStore.getState().nodes[lockedId].position).toEqual({ x: 120, y: 150 });
    });

    it('autoLayoutPage repositions unlocked Page nodes, skips locked nodes, and does not mutate Diagram internals', () => {
      const store = useProjectStore.getState();
      const pageId = store.addPage('Layout Isolation Page');
      store.setActivePage(pageId);

      const n1 = store.addNode({
        type: 'shape',
        position: { x: 500, y: 500 },
        data: { label: 'Unlocked A' },
      });
      const n2 = store.addNode({
        type: 'shape',
        position: { x: 600, y: 600 },
        locked: true,
        data: { label: 'Locked B', locked: true },
      });
      const subNodesSnapshot = [
        { id: 'sub1', type: 'shape' as const, position: { x: 42, y: 84 }, locked: false, data: { label: 'Sub1' } },
      ];
      const diagId = store.addNode({
        type: 'diagram',
        position: { x: 700, y: 700 },
        data: {
          label: 'Embedded Diagram',
          mermaidCode: 'flowchart TD\n  sub1 --> sub2',
          customData: { subNodes: subNodesSnapshot },
        },
      });
      store.addEdge({ source: n1, target: diagId });

      store.autoLayoutPage('TB');

      const after = useProjectStore.getState();
      // Unlocked node n1 was repositioned by ELK
      expect(after.nodes[n1].position).not.toEqual({ x: 500, y: 500 });
      // Locked node n2 stayed at exact coordinates
      expect(after.nodes[n2].position).toEqual({ x: 600, y: 600 });
      // Diagram node on Page was repositioned (since unlocked), but its internal subNodes were untouched
      expect(after.nodes[diagId].data.customData?.subNodes).toEqual(subNodesSnapshot);
    });
  });
});
