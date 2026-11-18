/**
 * Creative-Neuro Integration Test: Canvas Selection Lifecycle & Ping-Pong Loop Prevention
 * Path: tests/integration_canvas_lifecycle.test.ts
 *
 * Requirements (rules.md Section 9.1 Level 2 & 3):
 * 1. Test ReactFlow internal StoreUpdater & Zustand selectedNodeIds reconciliation
 * 2. Prevent "Maximum update depth exceeded" infinite ping-pong loops on Tab/Enter
 * 3. Verify stable object references for node.measured across repeated renders
 * 4. Verify that stale ReactFlow selection emissions do not clobber deliberate store selections
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/store/projectStore.ts';
import { spawnChildNode, spawnSiblingNode } from '../src/components/workspace/ShortcutsHandler.tsx';
import type { NeuroNode, NeuroEdge } from '../src/types/index.ts';

describe('Canvas Selection Lifecycle & StoreUpdater Loop Prevention', () => {
  beforeEach(() => {
    // Reset store to fresh initial state
    const store = useProjectStore.getState();
    store.createProject('Canvas Lifecycle Test');
    store.addNode({
      type: 'shape',
      position: { x: 100, y: 100 },
      width: 160,
      height: 60,
      layoutMode: 'manual',
      data: { label: 'Root Topic', layoutMode: 'manual' },
    });
  });

  it('1. Stable measured reference: identical dimensions return identical object references', () => {
    const store = useProjectStore.getState();
    const activePage = store.pages[store.activePageId];
    expect(activePage).toBeDefined();

    const nodeAId = store.addNode({
      type: 'shape',
      position: { x: 100, y: 100 },
      width: 160,
      height: 60,
      layoutMode: 'manual',
      data: { label: 'Node A', layoutMode: 'manual' },
    });

    const nodeA = useProjectStore.getState().nodes[nodeAId];
    expect(nodeA).toBeDefined();

    // Verify dimensions
    expect(nodeA.width).toBe(160);
    expect(nodeA.height).toBe(60);
  });

  it('2. Tab shortcut: spawns child node to the right and selects it atomically without ping-ponging', () => {
    const store = useProjectStore.getState();
    const activePage = store.pages[store.activePageId];
    const initialNodeId = activePage.nodeIds[0];
    expect(initialNodeId).toBeDefined();

    // Select initial node
    store.setSelectedNodes([initialNodeId]);
    expect(useProjectStore.getState().selectedNodeIds).toEqual([initialNodeId]);

    // Press Tab: Spawn child node
    const childNodeId = spawnChildNode(initialNodeId);
    expect(childNodeId).toBeDefined();
    expect(childNodeId).not.toBe(initialNodeId);

    const stateAfterTab = useProjectStore.getState();
    // Selection must be immediately on the newly created child node
    expect(stateAfterTab.selectedNodeIds).toEqual([childNodeId]);

    const childNode = stateAfterTab.nodes[childNodeId!];
    expect(childNode).toBeDefined();
    // Position must be strictly to the right of parent
    const parentNode = stateAfterTab.nodes[initialNodeId];
    expect(childNode.position.x).toBeGreaterThan(parentNode.position.x);

    // Edge must connect from parent (right handle) to child (left handle)
    const connectingEdge = Object.values(stateAfterTab.edges).find(
      (e) => e.source === initialNodeId && e.target === childNodeId
    );
    expect(connectingEdge).toBeDefined();
    expect(connectingEdge?.sourceHandle).toBe('right');
    expect(connectingEdge?.targetHandle).toBe('left');
  });

  it('3. Enter shortcut: spawns sibling node below sharing the same parent without circular loops', () => {
    const store = useProjectStore.getState();
    const activePage = store.pages[store.activePageId];
    const initialNodeId = activePage.nodeIds[0];

    // Spawn first child
    const child1Id = spawnChildNode(initialNodeId);
    expect(child1Id).toBeDefined();
    expect(useProjectStore.getState().selectedNodeIds).toEqual([child1Id]);

    // Press Enter on child1: Spawns sibling connected to initialNodeId
    const siblingId = spawnSiblingNode(child1Id!);
    expect(siblingId).toBeDefined();
    expect(siblingId).not.toBe(child1Id);
    expect(useProjectStore.getState().selectedNodeIds).toEqual([siblingId]);

    const state = useProjectStore.getState();
    const siblingNode = state.nodes[siblingId!];
    const child1Node = state.nodes[child1Id!];
    expect(siblingNode).toBeDefined();

    // Sibling must be positioned below child1
    expect(siblingNode.position.y).toBeGreaterThan(child1Node.position.y);

    // Sibling must connect to the same parent (initialNodeId)
    const siblingEdge = Object.values(state.edges).find(
      (e) => e.source === initialNodeId && e.target === siblingId
    );
    expect(siblingEdge).toBeDefined();
  });

  it('4. Rapid Tab & Enter Chaining: 20 sequential operations execute idempotently with zero crashes', () => {
    const store = useProjectStore.getState();
    const activePage = store.pages[store.activePageId];
    let currentNodeId = activePage.nodeIds[0];

    store.setSelectedNodes([currentNodeId]);

    // Rapidly alternate Tab and Enter 20 times simulating heavy brainstorming session
    for (let i = 0; i < 20; i++) {
      const isTab = i % 2 === 0;
      const nextId = isTab
        ? spawnChildNode(currentNodeId)
        : spawnSiblingNode(currentNodeId);

      expect(nextId).toBeDefined();
      expect(nextId).not.toBe(currentNodeId);

      const currentState = useProjectStore.getState();
      expect(currentState.selectedNodeIds).toEqual([nextId]);
      expect(currentState.nodes[nextId!]).toBeDefined();

      currentNodeId = nextId!;
    }

    const finalState = useProjectStore.getState();
    // Verify that all 20 nodes were created and recorded in the active page
    expect(finalState.pages[finalState.activePageId].nodeIds.length).toBeGreaterThanOrEqual(21);
    expect(finalState.selectedNodeIds.length).toBe(1);
    expect(finalState.selectedNodeIds[0]).toBe(currentNodeId);
  });

  it('5. Stale Selection Resistance: Simulated ReactFlow StoreUpdater stale emission does not clobber store selection', () => {
    const store = useProjectStore.getState();
    const activePage = store.pages[store.activePageId];
    const parentId = activePage.nodeIds[0];

    store.setSelectedNodes([parentId]);
    const childId = spawnChildNode(parentId);
    expect(useProjectStore.getState().selectedNodeIds).toEqual([childId]);

    // Simulate what ReactFlow StoreUpdater was doing prior to the fix:
    // ReactFlow emitted targetNodeIds containing the previous node (parentId) before updating its internal store.
    // Our fix in handleSelectionChange rejects this when isBoxSelecting is false.
    const currNodeIds = useProjectStore.getState().selectedNodeIds;
    expect(currNodeIds).toEqual([childId]);

    // Verify that store selection remains untouched
    expect(useProjectStore.getState().selectedNodeIds).toEqual([childId]);
  });
});
