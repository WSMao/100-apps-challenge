/**
 * Empirical Adversarial Challenger Test Suite for Layer 1 State Store
 * Target: tests/adversarial_store.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useProjectStore,
  useActivePageNodes,
  useActivePageEdges,
  useActivePage,
} from '../src/store/projectStore.ts';
import {
  SEED_PROJECT_ID,
  SEED_PAGE_IDS,
  createSeedProject,
} from '../src/store/seedData.ts';
import type { NeuroNode, NeuroEdge, Point } from '../src/types/index.ts';

// Helper: Verify structural invariants across the entire store
function verifyStoreInvariants(state = useProjectStore.getState()): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // 1. Every node in every page.nodeIds must exist in state.nodes
  for (const [pageId, page] of Object.entries(state.pages)) {
    const seenNodeIds = new Set<string>();
    for (const nid of page.nodeIds) {
      if (seenNodeIds.has(nid)) {
        violations.push(`Page [${pageId}] has duplicate nodeId: ${nid}`);
      }
      seenNodeIds.add(nid);

      if (!state.nodes[nid]) {
        violations.push(
          `Page [${pageId}] references non-existent node: ${nid}`
        );
      }
    }

    const seenEdgeIds = new Set<string>();
    for (const eid of page.edgeIds) {
      if (seenEdgeIds.has(eid)) {
        violations.push(`Page [${pageId}] has duplicate edgeId: ${eid}`);
      }
      seenEdgeIds.add(eid);

      if (!state.edges[eid]) {
        violations.push(
          `Page [${pageId}] references non-existent edge: ${eid}`
        );
      }
    }
  }

  // 2. Every edge in state.edges must have existing source and target nodes
  for (const [eid, edge] of Object.entries(state.edges)) {
    if (!state.nodes[edge.source]) {
      violations.push(
        `Edge [${eid}] has dangling source node: ${edge.source}`
      );
    }
    if (!state.nodes[edge.target]) {
      violations.push(
        `Edge [${eid}] has dangling target node: ${edge.target}`
      );
    }
  }

  // 3. Every node in state.nodes must have valid finite coordinates
  for (const [nid, node] of Object.entries(state.nodes)) {
    if (
      typeof node.position?.x !== 'number' ||
      !Number.isFinite(node.position.x) ||
      typeof node.position?.y !== 'number' ||
      !Number.isFinite(node.position.y)
    ) {
      violations.push(
        `Node [${nid}] has invalid non-finite position: ${JSON.stringify(
          node.position
        )}`
      );
    }

    // Check parentId reference if present
    if (node.parentId && !state.nodes[node.parentId]) {
      violations.push(
        `Node [${nid}] has dangling parentId reference to non-existent node: ${node.parentId}`
      );
    }
  }

  // 4. Ghost selections: selectedNodeIds / selectedEdgeIds must exist
  for (const nid of state.selectedNodeIds) {
    if (!state.nodes[nid]) {
      violations.push(`selectedNodeIds contains dead nodeId: ${nid}`);
    }
  }
  for (const eid of state.selectedEdgeIds) {
    if (!state.edges[eid]) {
      violations.push(`selectedEdgeIds contains dead edgeId: ${eid}`);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

describe('Empirical Adversarial Stress Tests: Layer 1 State Store', () => {
  beforeEach(() => {
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

  describe('1. Baseline Seed Data Invariant Auditing', () => {
    it('seed project satisfies all strict graph reference invariants', () => {
      const audit = verifyStoreInvariants();
      expect(audit.violations).toEqual([]);
      expect(audit.valid).toBe(true);
    });

    it('all nodes in seed data belong to their respective pages', () => {
      const state = useProjectStore.getState();
      const allPageNodeIds = new Set(
        Object.values(state.pages).flatMap((p) => p.nodeIds)
      );
      for (const nodeId of Object.keys(state.nodes)) {
        expect(allPageNodeIds.has(nodeId)).toBe(true);
      }
    });

    it('all edges in seed data belong to their respective pages', () => {
      const state = useProjectStore.getState();
      const allPageEdgeIds = new Set(
        Object.values(state.pages).flatMap((p) => p.edgeIds)
      );
      for (const edgeId of Object.keys(state.edges)) {
        expect(allPageEdgeIds.has(edgeId)).toBe(true);
      }
    });
  });

  describe('2. Cascading Deletions & Hierarchy Integrity', () => {
    it('cascading parent deletion: removing a frame node should not leave dangling parentId references', () => {
      // In seed data page 3 ('page-containers'), 'frame-client' is a parent to 'fn-canvas', 'fn-editor', 'fn-pagetabs'
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.containers);

      expect(store.nodes['frame-client']).toBeDefined();
      expect(store.nodes['fn-canvas']?.parentId).toBe('frame-client');

      // Delete the parent container
      store.removeNode('frame-client');

      const afterState = useProjectStore.getState();
      expect(afterState.nodes['frame-client']).toBeUndefined();

      // Check if child nodes still exist or have dangling parentId
      const audit = verifyStoreInvariants(afterState);
      expect(audit.violations).toEqual([]);
    });

    it('cascading edge deletion across multi-connected nodes', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      // Create a hub node connected to 20 spoke nodes
      const hubId = store.addNode({ data: { label: 'Hub' } });
      const spokeIds: string[] = [];
      const edgeIds: string[] = [];

      for (let i = 0; i < 20; i++) {
        const spokeId = store.addNode({ data: { label: `Spoke ${i}` } });
        spokeIds.push(spokeId);
        const edgeId = store.addEdge({ source: hubId, target: spokeId });
        edgeIds.push(edgeId);
      }

      // Verify all edges are registered
      let state = useProjectStore.getState();
      for (const eid of edgeIds) {
        expect(state.edges[eid]).toBeDefined();
      }

      // Delete the hub node
      store.removeNode(hubId);
      state = useProjectStore.getState();

      // All 20 connected edges must be purged from state.edges AND active page.edgeIds
      for (const eid of edgeIds) {
        expect(state.edges[eid]).toBeUndefined();
        expect(state.pages[SEED_PAGE_IDS.mindmap].edgeIds).not.toContain(eid);
      }

      const audit = verifyStoreInvariants(state);
      expect(audit.violations).toEqual([]);
    });

    it('batch deleteNodes cleans up all nodes and edges atomically', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const n1 = store.addNode({ data: { label: 'Batch 1' } });
      const n2 = store.addNode({ data: { label: 'Batch 2' } });
      const n3 = store.addNode({ data: { label: 'Batch 3' } });
      const e1 = store.addEdge({ source: n1, target: n2 });
      const e2 = store.addEdge({ source: n2, target: n3 });

      store.setSelectedNodes([n1, n2]);
      store.deleteNodes([n1, n2]);

      const state = useProjectStore.getState();
      expect(state.nodes[n1]).toBeUndefined();
      expect(state.nodes[n2]).toBeUndefined();
      expect(state.nodes[n3]).toBeDefined();
      expect(state.edges[e1]).toBeUndefined();
      expect(state.edges[e2]).toBeUndefined();
      expect(state.selectedNodeIds).not.toContain(n1);
      expect(state.selectedNodeIds).not.toContain(n2);

      const audit = verifyStoreInvariants(state);
      expect(audit.violations).toEqual([]);
    });

    it('onNodesChange with remove change maintains edge integrity and selections', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const n1 = store.addNode({ data: { label: 'RF Node 1' } });
      const n2 = store.addNode({ data: { label: 'RF Node 2' } });
      const e1 = store.addEdge({ source: n1, target: n2 });

      store.setSelectedNodes([n1]);
      store.setSelectedEdges([e1]);

      // Simulate React Flow onNodesChange remove
      store.onNodesChange([{ type: 'remove', id: n1 }]);

      const state = useProjectStore.getState();
      expect(state.nodes[n1]).toBeUndefined();
      expect(state.edges[e1]).toBeUndefined();
      // Should sanitize selectedNodeIds and selectedEdgeIds
      expect(state.selectedNodeIds).not.toContain(n1);
      expect(state.selectedEdgeIds).not.toContain(e1);

      const audit = verifyStoreInvariants(state);
      expect(audit.violations).toEqual([]);
    });

    it('onNodesChange position change should automatically transition layoutMode from auto-elk to manual', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      // 'mm-root' has layoutMode 'auto-elk' in seed data
      expect(store.nodes['mm-root'].layoutMode).toBe('auto-elk');

      // Simulate dragging node in React Flow canvas
      store.onNodesChange([
        {
          type: 'position',
          id: 'mm-root',
          position: { x: 450, y: 450 },
        },
      ]);

      const state = useProjectStore.getState();
      expect(state.nodes['mm-root'].position).toEqual({ x: 450, y: 450 });
      // Dragging a node MUST convert layoutMode to manual to preserve manual coordinates!
      expect(state.nodes['mm-root'].layoutMode).toBe('manual');
      expect(state.nodes['mm-root'].data.layoutMode).toBe('manual');
    });

    it('onEdgesChange with remove change sanitizes selectedEdgeIds', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const e1 = 'e-mm-root-state';
      expect(store.edges[e1]).toBeDefined();

      store.setSelectedEdges([e1]);
      expect(useProjectStore.getState().selectedEdgeIds).toContain(e1);

      // Remove edge via React Flow onEdgesChange
      store.onEdgesChange([{ type: 'remove', id: e1 }]);

      const state = useProjectStore.getState();
      expect(state.edges[e1]).toBeUndefined();
      expect(state.selectedEdgeIds).not.toContain(e1);
    });

    it('batch deleteNodes should be atomic in undo history (single undo restores all deleted nodes)', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const n1 = store.addNode({ data: { label: 'Atomic 1' } });
      const n2 = store.addNode({ data: { label: 'Atomic 2' } });

      expect(useProjectStore.getState().nodes[n1]).toBeDefined();
      expect(useProjectStore.getState().nodes[n2]).toBeDefined();

      // Delete both nodes in a single batch operation
      store.deleteNodes([n1, n2]);

      expect(useProjectStore.getState().nodes[n1]).toBeUndefined();
      expect(useProjectStore.getState().nodes[n2]).toBeUndefined();

      // A single user-facing undo should restore BOTH nodes
      store.undo();

      const stateAfterUndo = useProjectStore.getState();
      expect(stateAfterUndo.nodes[n1]).toBeDefined();
      expect(stateAfterUndo.nodes[n2]).toBeDefined();
    });
  });

  describe('3. High-Throughput Stress Testing (1,000+ Mutations)', () => {
    it('survives rapid generation of 500 nodes and 500 edges with zero corruption within budget', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const createdNodes: string[] = [];
      const createdEdges: string[] = [];

      const startTime = performance.now();

      // Create 500 nodes
      for (let i = 0; i < 500; i++) {
        const id = store.addNode({
          position: { x: (i % 25) * 100, y: Math.floor(i / 25) * 80 },
          data: { label: `Stress Node ${i}`, layoutMode: 'manual' },
        });
        createdNodes.push(id);
      }

      // Create 500 edges in a chain
      for (let i = 0; i < 499; i++) {
        const eid = store.addEdge({
          source: createdNodes[i],
          target: createdNodes[i + 1],
        });
        createdEdges.push(eid);
      }

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(4000); // Must complete within 4 seconds

      let state = useProjectStore.getState();
      expect(Object.keys(state.nodes).length).toBeGreaterThanOrEqual(500);
      expect(Object.keys(state.edges).length).toBeGreaterThanOrEqual(499);

      // Verify strict invariants at peak load
      let audit = verifyStoreInvariants(state);
      expect(audit.violations).toEqual([]);

      // Interleave 100 random deletions
      for (let i = 0; i < 100; i++) {
        const targetIndex = (i * 7) % createdNodes.length;
        const targetNodeId = createdNodes[targetIndex];
        if (state.nodes[targetNodeId]) {
          store.removeNode(targetNodeId);
        }
      }

      state = useProjectStore.getState();
      audit = verifyStoreInvariants(state);
      expect(audit.violations).toEqual([]);
    });
  });

  describe('4. Rapid Undo / Redo Scrubbing & Temporal Stack Integrity', () => {
    it('maintains strict invariants across 30 sequential undo and redo operations', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const initialNodeCount = Object.keys(store.nodes).length;
      const initialEdgeCount = Object.keys(store.edges).length;

      const addedNodeIds: string[] = [];
      for (let i = 0; i < 30; i++) {
        const id = store.addNode({
          position: { x: i * 20, y: i * 20 },
          data: { label: `Undo Step ${i}` },
        });
        addedNodeIds.push(id);
      }

      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(
        initialNodeCount + 30
      );

      // Scrub backwards 30 steps
      for (let i = 0; i < 30; i++) {
        store.undo();
        const audit = verifyStoreInvariants();
        expect(audit.violations).toEqual([]);
      }

      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(
        initialNodeCount
      );

      // Scrub forwards 30 steps
      for (let i = 0; i < 30; i++) {
        store.redo();
        const audit = verifyStoreInvariants();
        expect(audit.violations).toEqual([]);
      }

      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(
        initialNodeCount + 30
      );
    });

    it('scrubbing past node deletion faithfully restores connected edges and page references', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const n1 = store.addNode({ data: { label: 'Node Alpha' } });
      const n2 = store.addNode({ data: { label: 'Node Beta' } });
      const e1 = store.addEdge({ source: n1, target: n2 });

      // Now delete node Alpha (which cascades deletion of e1)
      store.removeNode(n1);

      expect(useProjectStore.getState().nodes[n1]).toBeUndefined();
      expect(useProjectStore.getState().edges[e1]).toBeUndefined();

      // Undo deletion
      store.undo();

      const restoredState = useProjectStore.getState();
      expect(restoredState.nodes[n1]).toBeDefined();
      expect(restoredState.edges[e1]).toBeDefined();
      expect(restoredState.edges[e1].source).toBe(n1);
      expect(restoredState.edges[e1].target).toBe(n2);
      expect(
        restoredState.pages[SEED_PAGE_IDS.mindmap].nodeIds
      ).toContain(n1);
      expect(
        restoredState.pages[SEED_PAGE_IDS.mindmap].edgeIds
      ).toContain(e1);

      const audit = verifyStoreInvariants(restoredState);
      expect(audit.violations).toEqual([]);
    });

    it('undoing a page deletion properly restores the page, its nodes, and its edges', () => {
      const store = useProjectStore.getState();
      const pageId = store.addPage('Page To Delete');
      const n1 = store.addNode({ data: { label: 'PNode' } });
      const n2 = store.addNode({ data: { label: 'PNode 2' } });
      const e1 = store.addEdge({ source: n1, target: n2 });

      // Delete the page
      store.deletePage(pageId);
      expect(useProjectStore.getState().pages[pageId]).toBeUndefined();

      // Undo deletion
      store.undo();

      const state = useProjectStore.getState();
      expect(state.pages[pageId]).toBeDefined();
      expect(state.nodes[n1]).toBeDefined();
      expect(state.nodes[n2]).toBeDefined();
      expect(state.edges[e1]).toBeDefined();

      const audit = verifyStoreInvariants(state);
      expect(audit.violations).toEqual([]);

      // Redo deletion
      store.redo();
      const redoState = useProjectStore.getState();
      expect(redoState.pages[pageId]).toBeUndefined();
      expect(redoState.nodes[n1]).toBeUndefined();
    });

    it('selection sanitization inside undo does not destroy redo capability', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const nodeId = store.addNode({ data: { label: 'Node with Selection' } });
      store.setSelectedNodes([nodeId]);

      // Undo should sanitize selectedNodeIds
      store.undo();
      expect(useProjectStore.getState().nodes[nodeId]).toBeUndefined();
      expect(useProjectStore.getState().selectedNodeIds).not.toContain(nodeId);

      // Redo MUST still be possible
      const temporalApi = (
        useProjectStore as unknown as {
          temporal: { getState: () => { futureStates: unknown[] } };
        }
      ).temporal.getState();
      expect(temporalApi.futureStates.length).toBeGreaterThan(0);

      store.redo();
      expect(useProjectStore.getState().nodes[nodeId]).toBeDefined();
    });
  });

  describe('5. Adversarial Edge Cases & Boundary Mutations', () => {
    it('handles duplicate addNode calls with pre-existing ID gracefully without duplicating page.nodeIds', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const customId = 'fixed-custom-id-123';
      store.addNode({ id: customId, data: { label: 'First' } });
      store.addNode({ id: customId, data: { label: 'Second' } });

      const state = useProjectStore.getState();
      const count = state.pages[SEED_PAGE_IDS.mindmap].nodeIds.filter(
        (id) => id === customId
      ).length;
      expect(count).toBe(1);

      const audit = verifyStoreInvariants(state);
      expect(audit.violations).toEqual([]);
    });

    it('rejects or ignores removeNode on non-existent ID without crashing or throwing', () => {
      const store = useProjectStore.getState();
      expect(() => {
        store.removeNode('completely-non-existent-id');
      }).not.toThrow();

      const audit = verifyStoreInvariants();
      expect(audit.violations).toEqual([]);
    });

    it('rejects or ignores removeEdge on non-existent ID without crashing or throwing', () => {
      const store = useProjectStore.getState();
      expect(() => {
        store.removeEdge('completely-non-existent-edge-id');
      }).not.toThrow();

      const audit = verifyStoreInvariants();
      expect(audit.violations).toEqual([]);
    });

    it('handles extreme and negative coordinates without corrupting node state', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const id = store.addNode({
        position: { x: -999999.99, y: 888888.88 },
        data: { label: 'Extreme Coords' },
      });

      store.updateNodePosition(id, { x: -1000000, y: 1000000 });

      const node = useProjectStore.getState().nodes[id];
      expect(node.position).toEqual({ x: -1000000, y: 1000000 });

      const audit = verifyStoreInvariants();
      expect(audit.violations).toEqual([]);
    });

    it('handles special characters, unicode emojis, and malicious script strings in labels', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      const maliciousLabel =
        '<script>alert("xss")</script> 🚀 🧠 \n\r\t "quotes" \'single\' &amp; `backticks`';

      const id = store.addNode({
        data: { label: maliciousLabel },
      });

      expect(useProjectStore.getState().nodes[id].data.label).toBe(
        maliciousLabel
      );

      store.updateNodeData(id, {
        label: maliciousLabel + ' (updated)',
      });

      expect(useProjectStore.getState().nodes[id].data.label).toBe(
        maliciousLabel + ' (updated)'
      );
    });

    it('handles updateNodePosition for a node on a non-active page without corrupting timestamps or data', () => {
      const store = useProjectStore.getState();
      // Flowchart page has 'fc-start'
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      // Now update position of a node on flowchart page while mindmap is active
      store.updateNodePosition('fc-start', { x: 420, y: 100 });

      const state = useProjectStore.getState();
      expect(state.nodes['fc-start'].position).toEqual({ x: 420, y: 100 });

      const audit = verifyStoreInvariants(state);
      expect(audit.violations).toEqual([]);
    });

    it('addEdge between non-existent nodes: should audit detect or prevent dangling edges', () => {
      const store = useProjectStore.getState();
      store.setActivePage(SEED_PAGE_IDS.mindmap);

      // What happens if caller passes non-existent node IDs to addEdge?
      const edgeId = store.addEdge({
        source: 'phantom-source-999',
        target: 'phantom-target-999',
      });

      const state = useProjectStore.getState();
      const audit = verifyStoreInvariants(state);

      // If store allows phantom edge, invariant audit catches it
      // Let's see if audit catches it:
      expect(audit.violations.length).toBeGreaterThan(0);
      expect(audit.violations[0]).toContain('dangling source node');
    });
  });
});
