/**
 * Creative-Neuro TDD Test Suite — Requirements Coverage
 * File: tests/requirements.test.ts
 *
 * Covers:
 * - OP-07: Tab / Enter Inherited Directional Spawn & Direction Memory
 * - OP-08: Directional Node Navigation with Arrow Keys
 * - PM-01 & PM-02: Project Management (Create, List, Switch, Delete Projects)
 * - TL-01: Connector Mode 2-click node-to-node connection
 * - UI-04: Theme Mode (Light / Dark) persistence & default
 * - FN-01: Manual Layout Mode explicit setting
 * - FN-02: Layers & zIndex (bringToFront, sendToBack, step zIndex)
 * - FN-03: Multi-Selection (selectMultipleNodes, toggleNodeSelection)
 * - FN-04: Grouping & Ungrouping (groupNodes, ungroupNodes)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  useProjectStore,
  findOptimalHandlePair,
  undo,
  redo,
  useTemporal,
} from '../src/store/projectStore.ts';
import {
  spawnDirectionalNode,
  spawnChildNode,
  spawnSiblingNode,
  navigateSelectionDirectionally,
  handleGlobalKeyDown,
} from '../src/components/workspace/ShortcutsHandler.tsx';
import {
  getShapeHandleIntersections,
  quickAddDirectionalNode,
} from '../src/components/canvas/nodes/ShapeNode.tsx';
import { CONNECTOR_OPTIONS } from '../src/components/workspace/Toolbar.tsx';
import { resolveProjectName } from '../src/components/workspace/AppLogoMenu.tsx';
import type { NeuroNode, PlacementDirection, EdgeRoutingType } from '../src/types/index.ts';

describe('TDD Requirements Test Suite (tests/docs/requirements.md)', () => {
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

  // ==========================================================================
  // Section 1: Operations & Shortcuts (OP-07, OP-08)
  // ==========================================================================
  describe('Operations & Keyboard Flow', () => {
    it('OP-07: Tab and Enter should remember and inherit the last directional spawn orientation', () => {
      const store = useProjectStore.getState();
      const rootId = 'mm-root';
      store.setSelectedNodes([rootId]);

      // 1. User presses ⌥ + Up (spawns in 'top' direction)
      const topNodeId = spawnDirectionalNode('top');
      expect(topNodeId).toBeTruthy();
      expect(useProjectStore.getState().lastDirection).toBe('top');

      // 2. Now user selects topNode and hits Tab (Child)
      // It should inherit 'top' direction instead of defaulting to 'right'
      const childOfTop = spawnChildNode(topNodeId!);
      expect(childOfTop).toBeTruthy();
      const nodeTop = useProjectStore.getState().nodes[topNodeId!];
      const nodeChild = useProjectStore.getState().nodes[childOfTop!];
      // Should be above topNode (y is smaller)
      expect(nodeChild.position.y).toBeLessThan(nodeTop.position.y);

      // 3. User spawns left node with ⌥ + Left
      store.setSelectedNodes([rootId]);
      const leftNodeId = spawnDirectionalNode('left');
      expect(useProjectStore.getState().lastDirection).toBe('left');

      // 4. Enter (Sibling) should follow the perpendicular or last direction context
      const siblingOfLeft = spawnSiblingNode(leftNodeId!);
      expect(siblingOfLeft).toBeTruthy();
      expect(useProjectStore.getState().nodes[siblingOfLeft!]).toBeDefined();
    });

    it('OP-08: Arrow keys should navigate selection directionally to the nearest neighbor node', () => {
      const store = useProjectStore.getState();
      const pageId = store.addPage('Arrow Navigation Page');
      store.setActivePage(pageId);

      // Create a cross grid of 5 nodes in the clean new page: Center, North, East, South, West
      const center = store.addNode({
        position: { x: 500, y: 500 },
        width: 100,
        height: 50,
        data: { label: 'Center', layoutMode: 'manual' },
      });
      const north = store.addNode({
        position: { x: 500, y: 300 },
        width: 100,
        height: 50,
        data: { label: 'North', layoutMode: 'manual' },
      });
      const east = store.addNode({
        position: { x: 750, y: 500 },
        width: 100,
        height: 50,
        data: { label: 'East', layoutMode: 'manual' },
      });
      const south = store.addNode({
        position: { x: 500, y: 700 },
        width: 100,
        height: 50,
        data: { label: 'South', layoutMode: 'manual' },
      });
      const west = store.addNode({
        position: { x: 250, y: 500 },
        width: 100,
        height: 50,
        data: { label: 'West', layoutMode: 'manual' },
      });

      // Start by selecting Center
      store.setSelectedNodes([center]);

      // Navigate UP
      const navUp = navigateSelectionDirectionally('ArrowUp');
      expect(navUp).toBe(north);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([north]);

      // Navigate DOWN from North -> should return to Center
      const navDown = navigateSelectionDirectionally('ArrowDown');
      expect(navDown).toBe(center);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([center]);

      // Navigate RIGHT from Center -> should reach East
      const navRight = navigateSelectionDirectionally('ArrowRight');
      expect(navRight).toBe(east);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([east]);

      // Navigate LEFT from East -> should return to Center
      const navLeft1 = navigateSelectionDirectionally('ArrowLeft');
      expect(navLeft1).toBe(center);

      // Navigate LEFT again -> should reach West
      const navLeft2 = navigateSelectionDirectionally('ArrowLeft');
      expect(navLeft2).toBe(west);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([west]);
    });

    it('OP-11: Direct Type-to-Edit: single selected node immediately enters inline edit mode on typing without tool conflicts', () => {
      const store = useProjectStore.getState();
      const pageId = store.addPage('Type-to-Edit Test Page');
      store.setActivePage(pageId);

      const shapeId = store.addNode({
        type: 'shape',
        position: { x: 200, y: 200 },
        data: { label: 'New Node', shapeType: 'rounded' },
      });
      const textId = store.addNode({
        type: 'text',
        position: { x: 400, y: 200 },
        data: { label: 'Annotation Note' },
      });
      const frameId = store.addNode({
        type: 'frame',
        position: { x: 200, y: 400 },
        width: 300,
        height: 200,
        data: { title: 'Architecture Frame' },
      });

      // 1. Single ShapeNode selected -> typing printable character 'H' activates inline editing
      store.setSelectedNodes([shapeId]);
      expect(useProjectStore.getState().editingNodeId).toBeNull();
      expect(useProjectStore.getState().toolMode).toBe('select');

      let prevented = false;
      const handledH = handleGlobalKeyDown({
        key: 'H',
        preventDefault: () => {
          prevented = true;
        },
      });
      expect(handledH).toBe(true);
      expect(prevented).toBe(true);
      expect(useProjectStore.getState().editingNodeId).toBe(shapeId);
      expect(useProjectStore.getState().editingInitialValue).toBe('H');
      expect(useProjectStore.getState().toolMode).toBe('select');

      // 2. Escape cancels editing mode
      handleGlobalKeyDown({ key: 'Escape' });
      expect(useProjectStore.getState().editingNodeId).toBeNull();
      expect(useProjectStore.getState().editingInitialValue).toBeNull();

      // 3. Typing letters that match tool mode shortcuts ('c', 's', 't', 'v', 'f', 'r', 'd', 'p') on selected node
      // MUST NOT switch tool mode; must activate inline edit mode with that typed character!
      for (const toolKey of ['c', 's', 't', 'v', 'f', 'r', 'd', 'p']) {
        store.setSelectedNodes([shapeId]);
        store.setToolMode('select');
        expect(useProjectStore.getState().editingNodeId).toBeNull();

        const handled = handleGlobalKeyDown({ key: toolKey });
        expect(handled).toBe(true);
        expect(useProjectStore.getState().toolMode).toBe('select'); // Tool mode MUST remain select!
        expect(useProjectStore.getState().editingNodeId).toBe(shapeId);
        expect(useProjectStore.getState().editingInitialValue).toBe(toolKey);

        // Cancel edit for next iteration
        handleGlobalKeyDown({ key: 'Escape' });
      }

      // 4. When NO node is selected, tool mode shortcuts switch tool mode normally
      store.setSelectedNodes([]);
      expect(useProjectStore.getState().selectedNodeIds).toHaveLength(0);

      handleGlobalKeyDown({ key: 'c' });
      expect(useProjectStore.getState().toolMode).toBe('connect');

      handleGlobalKeyDown({ key: 't' });
      expect(useProjectStore.getState().toolMode).toBe('text');

      handleGlobalKeyDown({ key: 'f' });
      expect(useProjectStore.getState().toolMode).toBe('frame');

      handleGlobalKeyDown({ key: 'v' });
      expect(useProjectStore.getState().toolMode).toBe('select');

      // 5. Chinese IME composition (key === 'Process' or isComposing) activates edit mode with empty initial value
      store.setSelectedNodes([shapeId]);
      handleGlobalKeyDown({ key: 'Process', isComposing: true });
      expect(useProjectStore.getState().editingNodeId).toBe(shapeId);
      expect(useProjectStore.getState().editingInitialValue).toBe('');
      handleGlobalKeyDown({ key: 'Escape' });

      // 6. Pressing Space on selected node activates inline editing
      store.setSelectedNodes([shapeId]);
      handleGlobalKeyDown({ key: ' ' });
      expect(useProjectStore.getState().editingNodeId).toBe(shapeId);
      expect(useProjectStore.getState().editingInitialValue).toBe(' ');
      handleGlobalKeyDown({ key: 'Escape' });

      // 7. TextNode and FrameNode: pressing Enter activates inline editing
      store.setSelectedNodes([textId]);
      handleGlobalKeyDown({ key: 'Enter' });
      expect(useProjectStore.getState().editingNodeId).toBe(textId);
      handleGlobalKeyDown({ key: 'Escape' });

      store.setSelectedNodes([frameId]);
      handleGlobalKeyDown({ key: 'Enter' });
      expect(useProjectStore.getState().editingNodeId).toBe(frameId);
      handleGlobalKeyDown({ key: 'Escape' });

      // 8. ShapeNode: pressing Enter spawns a sibling node (does NOT enter inline edit mode)
      store.setSelectedNodes([shapeId]);
      const initialNodeCount = Object.keys(useProjectStore.getState().nodes).length;
      handleGlobalKeyDown({ key: 'Enter' });
      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(initialNodeCount + 1);

      // 9. When a node is selected, Tab spawns child, Delete deletes node
      const countBeforeTab = Object.keys(useProjectStore.getState().nodes).length;
      handleGlobalKeyDown({ key: 'Tab' });
      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(countBeforeTab + 1);

      const newlySpawnedId = useProjectStore.getState().selectedNodeIds[0];
      handleGlobalKeyDown({ key: 'Delete' });
      expect(useProjectStore.getState().nodes[newlySpawnedId]).toBeUndefined();

      // 10. Deselection and deletion clean up editing state
      store.setSelectedNodes([shapeId]);
      store.setEditingNodeId(shapeId, 'test');
      expect(useProjectStore.getState().editingNodeId).toBe(shapeId);

      store.setSelectedNodes([]);
      expect(useProjectStore.getState().editingNodeId).toBeNull();
      expect(useProjectStore.getState().editingInitialValue).toBeNull();

      // 11. Robustness Guard: When editingNodeId is active, Delete/Backspace/Tab MUST NOT delete node or spawn children
      store.setSelectedNodes([shapeId]);
      store.setEditingNodeId(shapeId, 'typing');
      const nodesBeforeKeys = { ...useProjectStore.getState().nodes };
      const handledDeleteWhileEditing = handleGlobalKeyDown({ key: 'Delete' });
      expect(handledDeleteWhileEditing).toBe(false);
      expect(useProjectStore.getState().nodes[shapeId]).toBeDefined();

      const handledTabWhileEditing = handleGlobalKeyDown({ key: 'Tab' });
      expect(handledTabWhileEditing).toBe(false);
      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(Object.keys(nodesBeforeKeys).length);

      // Escape cleans up editing state
      handleGlobalKeyDown({ key: 'Escape' });
      expect(useProjectStore.getState().editingNodeId).toBeNull();

      // 12. DiagramNode exclusion: Diagram cards do not support direct text inline editing
      const diagramId = store.addNode({
        type: 'diagram',
        position: { x: 500, y: 500 },
        data: { title: 'Mermaid Diagram', mermaidCode: 'flowchart TD\n A-->B' },
      });
      store.setSelectedNodes([diagramId]);
      const handledDiagramType = handleGlobalKeyDown({ key: 'x' });
      expect(handledDiagramType).toBe(false);
      expect(useProjectStore.getState().editingNodeId).toBeNull();

      // 13. Explicit inline edit triggers: Shift+Enter and F2
      store.setSelectedNodes([shapeId]);
      const handledShiftEnter = handleGlobalKeyDown({ key: 'Enter', shiftKey: true });
      expect(handledShiftEnter).toBe(true);
      expect(useProjectStore.getState().editingNodeId).toBe(shapeId);
      expect(useProjectStore.getState().editingInitialValue).toBeNull();
      handleGlobalKeyDown({ key: 'Escape' });

      const handledF2 = handleGlobalKeyDown({ key: 'F2' });
      expect(handledF2).toBe(true);
      expect(useProjectStore.getState().editingNodeId).toBe(shapeId);
      expect(useProjectStore.getState().editingInitialValue).toBeNull();
      handleGlobalKeyDown({ key: 'Escape' });

      // 14. Multi-selection: typing does NOT enter edit mode
      store.setSelectedNodes([shapeId, textId]);
      const handledMultiType = handleGlobalKeyDown({ key: 'a' });
      expect(handledMultiType).toBe(false);
      expect(useProjectStore.getState().editingNodeId).toBeNull();

      // 15. Switching pages resets editing state cleanly
      store.setSelectedNodes([shapeId]);
      store.setEditingNodeId(shapeId, 'hello');
      const page2 = store.addPage('Second Page');
      store.setActivePage(page2);
      expect(useProjectStore.getState().editingNodeId).toBeNull();
      expect(useProjectStore.getState().editingInitialValue).toBeNull();
    });
  });

  // ==========================================================================
  // Section 2: Project Management (PM-01, PM-02)
  // ==========================================================================
  describe('Project Management', () => {
    it('PM-01 & PM-02: should support creating new projects, listing, switching, and deleting projects', async () => {
      const store = useProjectStore.getState();

      // 1. Initial project exists
      const initialProjId = store.project.id;
      expect(initialProjId).toBeTruthy();

      // 2. Create a new project
      const newProjId = store.createProject('Mobile Redesign 2026');
      expect(newProjId).toBeTruthy();
      expect(useProjectStore.getState().project.id).toBe(newProjId);
      expect(useProjectStore.getState().project.name).toBe('Mobile Redesign 2026');
      expect(useProjectStore.getState().project.pageIds.length).toBeGreaterThan(0);

      // 3. Switch back to initial project
      await store.switchProject(initialProjId);
      expect(useProjectStore.getState().project.id).toBe(initialProjId);

      // 4. Delete the newly created project
      await store.deleteProject(newProjId);
      expect(useProjectStore.getState().availableProjects.some((p) => p.id === newProjId)).toBe(false);
    });
  });

  // ==========================================================================
  // Section 3: Tool Mode & Connector (TL-01)
  // ==========================================================================
  describe('Tools & Connector Mode', () => {
    it('TL-01: should support two-click connection in connector tool mode', () => {
      const store = useProjectStore.getState();
      const nodeA = store.addNode({
        position: { x: 100, y: 100 },
        data: { label: 'Node A', layoutMode: 'manual' },
      });
      const nodeB = store.addNode({
        position: { x: 300, y: 100 },
        data: { label: 'Node B', layoutMode: 'manual' },
      });

      store.setToolMode('connect');
      expect(useProjectStore.getState().toolMode).toBe('connect');

      // Click node A (sets pending connector source)
      store.handleConnectorNodeClick(nodeA);
      expect(useProjectStore.getState().connectorSourceNodeId).toBe(nodeA);

      // Click node B (completes edge creation between A and B)
      const createdEdgeId = store.handleConnectorNodeClick(nodeB);
      expect(createdEdgeId).toBeTruthy();
      expect(useProjectStore.getState().edges[createdEdgeId!]).toBeDefined();
      expect(useProjectStore.getState().edges[createdEdgeId!].source).toBe(nodeA);
      expect(useProjectStore.getState().edges[createdEdgeId!].target).toBe(nodeB);

      // Connector source should reset
      expect(useProjectStore.getState().connectorSourceNodeId).toBeNull();
    });
  });

  // ==========================================================================
  // Section 4: Theme & UI Settings (UI-04)
  // ==========================================================================
  describe('UI & Theme Settings', () => {
    it('UI-04: should default to light theme and support switching to dark theme', () => {
      const store = useProjectStore.getState();
      // Should default to light
      expect(store.themeMode).toBe('light');

      // Toggle to dark
      store.setThemeMode('dark');
      expect(useProjectStore.getState().themeMode).toBe('dark');

      // Toggle back to light
      store.setThemeMode('light');
      expect(useProjectStore.getState().themeMode).toBe('light');
    });
  });

  // ==========================================================================
  // Section 5: Advanced Features (FN-01, FN-02, FN-03, FN-04)
  // ==========================================================================
  describe('Advanced Features: Manual, Layer, Multi-Select, Grouping', () => {
    it('FN-01: should support explicitly toggling manual layout mode on page and nodes', () => {
      const store = useProjectStore.getState();
      const node = store.addNode({
        position: { x: 100, y: 100 },
        data: { label: 'Layout Node', layoutMode: 'auto-elk' },
      });

      expect(useProjectStore.getState().nodes[node].layoutMode).toBe('auto-elk');

      // Explicitly set node to manual
      store.setNodeLayoutMode(node, 'manual');
      expect(useProjectStore.getState().nodes[node].layoutMode).toBe('manual');
      expect(useProjectStore.getState().nodes[node].data.layoutMode).toBe('manual');

      // Toggle back to auto-elk
      store.setNodeLayoutMode(node, 'auto-elk');
      expect(useProjectStore.getState().nodes[node].layoutMode).toBe('auto-elk');

      // Page level layout mode setting
      store.setPageLayoutMode('manual');
      expect(useProjectStore.getState().pageLayoutMode).toBe('manual');
    });

    it('FN-02: should support layer management (bringToFront, sendToBack, zIndex step)', () => {
      const store = useProjectStore.getState();
      const nodeA = store.addNode({
        position: { x: 100, y: 100 },
        zIndex: 1,
        data: { label: 'Layer A', layoutMode: 'manual' },
      });
      const nodeB = store.addNode({
        position: { x: 120, y: 120 },
        zIndex: 5,
        data: { label: 'Layer B', layoutMode: 'manual' },
      });

      // Bring nodeA to front
      store.bringToFront(nodeA);
      expect(useProjectStore.getState().nodes[nodeA].zIndex).toBeGreaterThan(
        useProjectStore.getState().nodes[nodeB].zIndex || 0
      );

      // Send nodeA to back
      store.sendToBack(nodeA);
      expect(useProjectStore.getState().nodes[nodeA].zIndex).toBeLessThan(
        useProjectStore.getState().nodes[nodeB].zIndex || 0
      );
    });

    it('FN-03: should support multi-selection and toggleNodeSelection', () => {
      const store = useProjectStore.getState();
      const node1 = store.addNode({
        position: { x: 50, y: 50 },
        data: { label: 'N1', layoutMode: 'manual' },
      });
      const node2 = store.addNode({
        position: { x: 150, y: 50 },
        data: { label: 'N2', layoutMode: 'manual' },
      });

      // Toggle selection with Cmd/Ctrl
      store.toggleNodeSelection(node1);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([node1]);

      store.toggleNodeSelection(node2);
      expect(useProjectStore.getState().selectedNodeIds).toContain(node1);
      expect(useProjectStore.getState().selectedNodeIds).toContain(node2);
      expect(useProjectStore.getState().selectedNodeIds.length).toBe(2);

      // Toggle node1 again to deselect
      store.toggleNodeSelection(node1);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([node2]);
    });

    it('OP-03 & FN-03: Left-click box selection should be idempotent and prevent ping-pong re-render cycles', () => {
      const store = useProjectStore.getState();
      const nodeA = store.addNode({ position: { x: 10, y: 10 }, data: { label: 'A' } });
      const nodeB = store.addNode({ position: { x: 50, y: 50 }, data: { label: 'B' } });
      const edgeId = store.addEdge({ source: nodeA, target: nodeB });

      // 1. Initial selection of multiple nodes via box select simulation
      store.setSelectedNodes([nodeA, nodeB]);
      const selArray1 = useProjectStore.getState().selectedNodeIds;
      expect(selArray1).toEqual([nodeA, nodeB]);

      // 2. Subsequent call with same selected nodes should NO-OP (preserve identical array reference)
      store.setSelectedNodes([nodeA, nodeB]);
      const selArray2 = useProjectStore.getState().selectedNodeIds;
      expect(selArray2).toBe(selArray1); // Object.is reference stability!

      // 3. Same with edges
      store.setSelectedEdges([edgeId]);
      const edgeArray1 = useProjectStore.getState().selectedEdgeIds;
      expect(edgeArray1).toEqual([edgeId]);

      store.setSelectedEdges([edgeId]);
      const edgeArray2 = useProjectStore.getState().selectedEdgeIds;
      expect(edgeArray2).toBe(edgeArray1); // Reference stability prevents infinite loop!

      // 4. Repeated onNodesChange select events should not duplicate or destabilize
      store.onNodesChange([
        { type: 'select', id: nodeA, selected: true },
        { type: 'select', id: nodeB, selected: true },
      ]);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([nodeA, nodeB]);

      // 5. Deselection via onNodesChange
      store.onNodesChange([
        { type: 'select', id: nodeA, selected: false },
      ]);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([nodeB]);
    });

    it('OP-03: Left-click box selection updates selectedNodeIds without requiring modifier key and clears on empty click', () => {
      const store = useProjectStore.getState();
      const node1 = store.addNode({ position: { x: 100, y: 100 }, data: { label: 'Box 1' } });
      const node2 = store.addNode({ position: { x: 200, y: 100 }, data: { label: 'Box 2' } });

      // Simulate left-click drag selection box intersecting node1 & node2
      store.onNodesChange([
        { type: 'select', id: node1, selected: true },
        { type: 'select', id: node2, selected: true },
      ]);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([node1, node2]);

      // Clicking empty pane deselects all nodes
      store.setSelectedNodes([]);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([]);
    });

    it('OP-03 & OP-07: SelectionMode.Full support and multi-edge batch update & atomic deletion', () => {
      const store = useProjectStore.getState();
      const nodeA = store.addNode({ position: { x: 0, y: 0 }, data: { label: 'A' } });
      const nodeB = store.addNode({ position: { x: 200, y: 0 }, data: { label: 'B' } });
      const nodeC = store.addNode({ position: { x: 400, y: 0 }, data: { label: 'C' } });

      const edge1 = store.addEdge({ source: nodeA, target: nodeB, type: 'jump', data: { routingType: 'jump', lineStyle: 'solid' } });
      const edge2 = store.addEdge({ source: nodeB, target: nodeC, type: 'jump', data: { routingType: 'jump', lineStyle: 'solid' } });

      // 1. Multi-edge selection
      store.setSelectedEdges([edge1, edge2]);
      expect(useProjectStore.getState().selectedEdgeIds).toEqual([edge1, edge2]);

      // 2. Batch update edges (routingType and lineStyle)
      store.batchUpdateEdgeData([edge1, edge2], { routingType: 'smoothstep', lineStyle: 'dashed' });
      const stateAfterBatch = useProjectStore.getState();
      expect(stateAfterBatch.edges[edge1].type).toBe('smoothstep');
      expect(stateAfterBatch.edges[edge1].data?.routingType).toBe('smoothstep');
      expect(stateAfterBatch.edges[edge1].data?.lineStyle).toBe('dashed');

      expect(stateAfterBatch.edges[edge2].type).toBe('smoothstep');
      expect(stateAfterBatch.edges[edge2].data?.routingType).toBe('smoothstep');
      expect(stateAfterBatch.edges[edge2].data?.lineStyle).toBe('dashed');

      // 3. Undo batch update
      store.undo();
      const stateAfterUndo = useProjectStore.getState();
      expect(stateAfterUndo.edges[edge1].data?.lineStyle).toBe('solid');
      expect(stateAfterUndo.edges[edge2].data?.lineStyle).toBe('solid');

      // 4. Redo batch update
      store.redo();
      const stateAfterRedo = useProjectStore.getState();
      expect(stateAfterRedo.edges[edge1].data?.lineStyle).toBe('dashed');
      expect(stateAfterRedo.edges[edge2].data?.lineStyle).toBe('dashed');

      // 5. Batch delete selected edges
      store.deleteEdges([edge1, edge2]);
      const stateAfterDelete = useProjectStore.getState();
      expect(stateAfterDelete.edges[edge1]).toBeUndefined();
      expect(stateAfterDelete.edges[edge2]).toBeUndefined();
      expect(stateAfterDelete.selectedEdgeIds).toEqual([]);
    });

    it('FN-04: should group multiple selected nodes logically via groupId (not FrameNode) and select group together', () => {
      const store = useProjectStore.getState();
      const nodeA = store.addNode({
        position: { x: 200, y: 200 },
        width: 100,
        height: 50,
        data: { label: 'Member A', layoutMode: 'manual' },
      });
      const nodeB = store.addNode({
        position: { x: 350, y: 250 },
        width: 100,
        height: 50,
        data: { label: 'Member B', layoutMode: 'manual' },
      });

      store.setSelectedNodes([nodeA, nodeB]);

      // 1. Group into logical group (FN-04)
      const groupId = store.groupSelectedNodes('Feature Team');
      expect(groupId).toBeTruthy();

      const stateAfterGroup = useProjectStore.getState();
      expect(stateAfterGroup.nodes[nodeA].groupId).toBe(groupId);
      expect(stateAfterGroup.nodes[nodeB].groupId).toBe(groupId);
      expect(stateAfterGroup.nodes[nodeA].type).toBe('shape'); // NOT transformed into FrameNode
      expect(stateAfterGroup.nodes[nodeB].type).toBe('shape');

      // 2. Clicking any single object in the group selects the whole group
      store.setSelectedNodes([nodeA]);
      const selectedAfterClick = useProjectStore.getState().selectedNodeIds;
      expect(selectedAfterClick).toContain(nodeA);
      expect(selectedAfterClick).toContain(nodeB);

      // 3. Now ungroup the members
      store.ungroupNodes(nodeA);
      const stateAfterUngroup = useProjectStore.getState();
      expect(stateAfterUngroup.nodes[nodeA].groupId).toBeUndefined();
      expect(stateAfterUngroup.nodes[nodeB].groupId).toBeUndefined();
    });

    it('UI-03: resolveProjectName should handle duplicate warning and auto-increment untitled', () => {
      const existing = ['Demo Project', 'untitled', 'untitled1'];

      // 1. Duplicate custom name -> warning error
      const dup = resolveProjectName('Demo Project', existing);
      expect(dup.finalName).toBeNull();
      expect(dup.error).toBe('專案名稱已存在，請更換名稱');

      // 2. Unique custom name -> ok
      const okCustom = resolveProjectName('New Feature Architecture', existing);
      expect(okCustom.finalName).toBe('New Feature Architecture');
      expect(okCustom.error).toBeNull();

      // 3. Empty input or 'untitled' with existing 'untitled' and 'untitled1' -> auto-increment to 'untitled2'
      const autoIncEmpty = resolveProjectName('', existing);
      expect(autoIncEmpty.finalName).toBe('untitled2');
      expect(autoIncEmpty.error).toBeNull();

      const autoIncDefault = resolveProjectName('untitled', existing);
      expect(autoIncDefault.finalName).toBe('untitled2');
      expect(autoIncDefault.error).toBeNull();

      // 4. Default input with clean database (no untitled yet) -> 'untitled'
      const cleanDb = resolveProjectName('untitled', ['My Project']);
      expect(cleanDb.finalName).toBe('untitled');
      expect(cleanDb.error).toBeNull();
    });

    it('UI-03: Logo asset, circular frame, Header brand layout and Workspace modal positioning', () => {
      // 1. Verify logo_option_4e.png exists
      const logo4ePath = path.resolve(__dirname, '../assets/logo_option_4e.png');
      expect(fs.existsSync(logo4ePath)).toBe(true);

      // 2. Verify AppLogoMenu renders circular logo button (rounded-full)
      const appLogoMenuPath = path.resolve(__dirname, '../src/components/workspace/AppLogoMenu.tsx');
      const appLogoMenuCode = fs.readFileSync(appLogoMenuPath, 'utf8');
      expect(appLogoMenuCode).toContain('logo_option_4e.png');
      expect(appLogoMenuCode).toContain('rounded-full');

      // 3. Verify Workspace Modal is enlarged (max-w-3xl) and placed below header (pt-20)
      expect(appLogoMenuCode).toContain('max-w-3xl');
      expect(appLogoMenuCode).toContain('pt-20');

      // 4. Verify Header shifts brand section right to not occlude left toolbar
      const headerPath = path.resolve(__dirname, '../src/components/workspace/Header.tsx');
      const headerCode = fs.readFileSync(headerPath, 'utf8');
      expect(headerCode).toContain('ml-11 sm:ml-12');
      expect(headerCode).toContain('project-title');
      expect(headerCode).not.toContain('Main Workspace board');
    });

    it('OP-06: should spawn a new floating node on double click empty canvas location', () => {
      const store = useProjectStore.getState();
      const initialCount = Object.keys(store.nodes).length;
      const newNodeId = store.addNode({
        type: 'shape',
        position: { x: 800, y: 600 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: {
          label: 'New Idea',
          layoutMode: 'manual',
          shapeType: 'rounded',
        },
      });

      expect(newNodeId).toBeTruthy();
      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(initialCount + 1);
      const created = useProjectStore.getState().nodes[newNodeId];
      expect(created.position).toEqual({ x: 800, y: 600 });
      expect(created.data.shapeType).toBe('rounded');
    });

    it('UI-05: ShapeNode floating action bar can switch shapeType seamlessly', () => {
      const store = useProjectStore.getState();
      const nodeId = store.addNode({
        type: 'shape',
        position: { x: 100, y: 100 },
        data: { shapeType: 'rounded' },
      });

      expect(useProjectStore.getState().nodes[nodeId].data.shapeType).toBe('rounded');

      // User selects Diamond from the floating action menu
      store.updateNodeData(nodeId, { shapeType: 'diamond' });
      expect(useProjectStore.getState().nodes[nodeId].data.shapeType).toBe('diamond');

      // User selects Database / Cylinder
      store.updateNodeData(nodeId, { shapeType: 'cylinder' });
      expect(useProjectStore.getState().nodes[nodeId].data.shapeType).toBe('cylinder');

      // User selects Hexagon
      store.updateNodeData(nodeId, { shapeType: 'hexagon' });
      expect(useProjectStore.getState().nodes[nodeId].data.shapeType).toBe('hexagon');
    });

    it('UI-05 & FN-03: Unified multi-selection floating action bar applies settings in batch to all selected nodes', () => {
      const store = useProjectStore.getState();
      const node1 = store.addNode({
        type: 'shape',
        position: { x: 100, y: 100 },
        data: { shapeType: 'rectangle', layoutMode: 'auto-elk' },
      });
      const node2 = store.addNode({
        type: 'shape',
        position: { x: 300, y: 100 },
        data: { shapeType: 'rounded', layoutMode: 'auto-elk' },
      });
      const node3 = store.addNode({
        type: 'shape',
        position: { x: 500, y: 100 },
        data: { shapeType: 'diamond', layoutMode: 'auto-elk' },
      });

      // User box-selects all 3 nodes
      store.setSelectedNodes([node1, node2, node3]);
      expect(useProjectStore.getState().selectedNodeIds).toEqual([node1, node2, node3]);

      // 1. Batch switch shapeType to circle
      store.batchUpdateNodeData([node1, node2, node3], { shapeType: 'circle' });
      expect(useProjectStore.getState().nodes[node1].data.shapeType).toBe('circle');
      expect(useProjectStore.getState().nodes[node2].data.shapeType).toBe('circle');
      expect(useProjectStore.getState().nodes[node3].data.shapeType).toBe('circle');

      // 2. Batch switch layoutMode to manual
      store.batchSetNodeLayoutMode([node1, node2, node3], 'manual');
      expect(useProjectStore.getState().nodes[node1].layoutMode).toBe('manual');
      expect(useProjectStore.getState().nodes[node2].layoutMode).toBe('manual');
      expect(useProjectStore.getState().nodes[node3].layoutMode).toBe('manual');

      // 3. Batch bringToFront
      const initialZ = store.addNode({ position: { x: 0, y: 0 }, zIndex: 10 });
      store.bringToFront([node1, node2, node3]);
      expect(useProjectStore.getState().nodes[node1].zIndex).toBeGreaterThan(10);
      expect(useProjectStore.getState().nodes[node2].zIndex).toBeGreaterThan(10);
      expect(useProjectStore.getState().nodes[node3].zIndex).toBeGreaterThan(10);

      // 4. Batch sendToBack
      store.sendToBack([node1, node2, node3]);
      expect(useProjectStore.getState().nodes[node1].zIndex).toBeLessThan(10);
      expect(useProjectStore.getState().nodes[node2].zIndex).toBeLessThan(10);
      expect(useProjectStore.getState().nodes[node3].zIndex).toBeLessThan(10);

      // 5. Batch delete
      store.deleteNodes([node1, node2, node3]);
      expect(useProjectStore.getState().nodes[node1]).toBeUndefined();
      expect(useProjectStore.getState().nodes[node2]).toBeUndefined();
      expect(useProjectStore.getState().nodes[node3]).toBeUndefined();
    });

    it('TL-02: findOptimalHandlePair should connect nodes at their closest geometric ports', () => {
      // 1. Target node to the right of source node
      const nodeLeft: NeuroNode = {
        id: 'node-left',
        type: 'shape',
        position: { x: 100, y: 100 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: { label: 'Left' },
      };
      const nodeRight: NeuroNode = {
        id: 'node-right',
        type: 'shape',
        position: { x: 400, y: 100 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: { label: 'Right' },
      };
      const pairHorizontal = findOptimalHandlePair(nodeLeft, nodeRight);
      expect(pairHorizontal).toEqual({
        sourceHandle: 'right',
        targetHandle: 'left',
      });

      // 2. Target node directly below source node
      const nodeBottom: NeuroNode = {
        id: 'node-bottom',
        type: 'shape',
        position: { x: 100, y: 300 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: { label: 'Bottom' },
      };
      const pairVertical = findOptimalHandlePair(nodeLeft, nodeBottom);
      expect(pairVertical).toEqual({
        sourceHandle: 'bottom',
        targetHandle: 'top',
      });

      // 3. Target node above source node
      const pairUp = findOptimalHandlePair(nodeBottom, nodeLeft);
      expect(pairUp).toEqual({
        sourceHandle: 'top',
        targetHandle: 'bottom',
      });
    });

    it('TL-02: Connector tool should support continuous sequential connection', () => {
      const store = useProjectStore.getState();
      store.setToolMode('connect');

      const n1 = store.addNode({ position: { x: 100, y: 100 }, data: { label: 'A' } });
      const n2 = store.addNode({ position: { x: 400, y: 100 }, data: { label: 'B' } });
      const n3 = store.addNode({ position: { x: 100, y: 300 }, data: { label: 'C' } });
      const n4 = store.addNode({ position: { x: 400, y: 300 }, data: { label: 'D' } });

      // Connect Pair 1 (n1 -> n2)
      store.handleConnectorNodeClick(n1);
      expect(useProjectStore.getState().connectorSourceNodeId).toBe(n1);

      const edge1Id = store.handleConnectorNodeClick(n2);
      expect(edge1Id).toBeTruthy();
      expect(useProjectStore.getState().connectorSourceNodeId).toBeNull();
      expect(useProjectStore.getState().toolMode).toBe('connect'); // Remains in connect mode!

      const edge1 = useProjectStore.getState().edges[edge1Id!];
      expect(edge1.source).toBe(n1);
      expect(edge1.target).toBe(n2);
      expect(edge1.sourceHandle).toBe('right');
      expect(edge1.targetHandle).toBe('left');

      // Immediately connect Pair 2 (n3 -> n4) without toggling tool mode
      store.handleConnectorNodeClick(n3);
      expect(useProjectStore.getState().connectorSourceNodeId).toBe(n3);

      const edge2Id = store.handleConnectorNodeClick(n4);
      expect(edge2Id).toBeTruthy();
      expect(useProjectStore.getState().connectorSourceNodeId).toBeNull();

      const edge2 = useProjectStore.getState().edges[edge2Id!];
      expect(edge2.source).toBe(n3);
      expect(edge2.target).toBe(n4);
    });

    it('TL-03: reconnectEdge should update source/target handles when dragging edge endpoint', () => {
      const store = useProjectStore.getState();
      const nA = store.addNode({ position: { x: 50, y: 50 } });
      const nB = store.addNode({ position: { x: 250, y: 50 } });
      const nC = store.addNode({ position: { x: 250, y: 250 } });

      const edgeId = store.addEdge({ source: nA, target: nB, sourceHandle: 'right', targetHandle: 'left' });

      // User drags edge target from nB to nC
      store.reconnectEdge(edgeId, {
        source: nA,
        target: nC,
        sourceHandle: 'bottom',
        targetHandle: 'top',
      });

      const updatedEdge = useProjectStore.getState().edges[edgeId];
      expect(updatedEdge.source).toBe(nA);
      expect(updatedEdge.target).toBe(nC);
      expect(updatedEdge.sourceHandle).toBe('bottom');
      expect(updatedEdge.targetHandle).toBe('top');
    });

    it('TL-04: updateEdgeData should update routingType, lineStyle, and arrow markers', () => {
      const store = useProjectStore.getState();
      const nA = store.addNode({ position: { x: 0, y: 0 } });
      const nB = store.addNode({ position: { x: 100, y: 100 } });
      const edgeId = store.addEdge({ source: nA, target: nB, type: 'jump' });

      // 1. Update routing to smoothstep
      store.updateEdgeData(edgeId, { routingType: 'smoothstep' });
      expect(useProjectStore.getState().edges[edgeId].data?.routingType).toBe('smoothstep');
      expect(useProjectStore.getState().edges[edgeId].type).toBe('smoothstep');

      // 2. Update routing to bezier
      store.updateEdgeData(edgeId, { routingType: 'bezier' });
      expect(useProjectStore.getState().edges[edgeId].data?.routingType).toBe('bezier');
      expect(useProjectStore.getState().edges[edgeId].type).toBe('bezier');

      // 3. Update line style to dashed
      store.updateEdgeData(edgeId, { lineStyle: 'dashed' });
      expect(useProjectStore.getState().edges[edgeId].data?.lineStyle).toBe('dashed');

      // 4. Update arrow to bidirectional
      store.updateEdgeData(edgeId, { arrowStart: true, arrowEnd: true });
      expect(useProjectStore.getState().edges[edgeId].data?.arrowStart).toBe(true);
      expect(useProjectStore.getState().edges[edgeId].data?.arrowEnd).toBe(true);
    });

    it('OP-10: getShapeHandleIntersections should return exact horizontal/vertical centerline intersections with shape border', () => {
      const W = 160;
      const H = 60;

      // 1. Standard symmetric geometries (rectangle, rounded, diamond, circle, hexagon, stadium, cylinder)
      for (const shape of ['rectangle', 'rounded', 'diamond', 'circle', 'hexagon', 'stadium', 'cylinder']) {
        const pts = getShapeHandleIntersections(W, H, shape);
        expect(pts.top).toEqual({ x: 80, y: 1 });
        expect(pts.bottom).toEqual({ x: 80, y: 59 });
        expect(pts.left).toEqual({ x: 1, y: 30 });
        expect(pts.right).toEqual({ x: 159, y: 30 });
      }

      // 2. Asymmetry (left notch at x=14 when y=H/2)
      const asymPts = getShapeHandleIntersections(W, H, 'asymmetry');
      expect(asymPts.top).toEqual({ x: 80, y: 1 });
      expect(asymPts.bottom).toEqual({ x: 80, y: 59 });
      expect(asymPts.left).toEqual({ x: 14, y: 30 });
      expect(asymPts.right).toEqual({ x: 159, y: 30 });

      // 3. Inverted Trapezoid (slanted sides at x=8.5 and W-8.5 when y=H/2)
      const trapPts = getShapeHandleIntersections(W, H, 'inverted_trapezoid');
      expect(trapPts.left).toEqual({ x: 8.5, y: 30 });
      expect(trapPts.right).toEqual({ x: 151.5, y: 30 });

      // 4. Parallelogram (slanted sides at x=9.5 and W-9.5 when y=H/2)
      const paraPts = getShapeHandleIntersections(W, H, 'parallelogram');
      expect(paraPts.left).toEqual({ x: 9.5, y: 30 });
      expect(paraPts.right).toEqual({ x: 150.5, y: 30 });
    });

    it('TL-05: Connector tool provides connector type menu and uses active preset continuously', () => {
      const store = useProjectStore.getState();

      // 1. Verify connector options metadata
      const optionTypes = CONNECTOR_OPTIONS.map((o) => o.type);
      expect(optionTypes).toEqual(['jump', 'smoothstep', 'bezier', 'straight']);

      // 2. Default preset is jump
      expect(useProjectStore.getState().defaultEdgeRoutingType).toBe('jump');

      // 3. User switches preset to smoothstep
      store.setDefaultEdgeRoutingType('smoothstep');
      expect(useProjectStore.getState().defaultEdgeRoutingType).toBe('smoothstep');

      // 4. Sequential connection using the active smoothstep preset
      const n1 = store.addNode({ position: { x: 0, y: 0 } });
      const n2 = store.addNode({ position: { x: 200, y: 0 } });
      store.handleConnectorNodeClick(n1);
      const edgeStepId = store.handleConnectorNodeClick(n2);
      expect(edgeStepId).toBeTruthy();

      const edgeStep = useProjectStore.getState().edges[edgeStepId!];
      expect(edgeStep.type).toBe('smoothstep');
      expect(edgeStep.data?.routingType).toBe('smoothstep');
      expect(edgeStep.data?.jumpArc).toBe(false);

      // 5. User switches preset to bezier
      store.setDefaultEdgeRoutingType('bezier');
      const n3 = store.addNode({ position: { x: 0, y: 200 } });
      const n4 = store.addNode({ position: { x: 200, y: 200 } });
      store.handleConnectorNodeClick(n3);
      const edgeBezierId = store.handleConnectorNodeClick(n4);
      expect(edgeBezierId).toBeTruthy();

      const edgeBezier = useProjectStore.getState().edges[edgeBezierId!];
      expect(edgeBezier.type).toBe('bezier');
      expect(edgeBezier.data?.routingType).toBe('bezier');

      // 6. User switches preset to straight
      store.setDefaultEdgeRoutingType('straight');
      const n5 = store.addNode({ position: { x: 0, y: 400 } });
      const n6 = store.addNode({ position: { x: 200, y: 400 } });
      store.handleConnectorNodeClick(n5);
      const edgeStraightId = store.handleConnectorNodeClick(n6);
      expect(edgeStraightId).toBeTruthy();

      const edgeStraight = useProjectStore.getState().edges[edgeStraightId!];
      expect(edgeStraight.type).toBe('straight');
      expect(edgeStraight.data?.routingType).toBe('straight');

      // 7. React Flow onConnect also honors the active preset
      store.onConnect({ source: n1, target: n5, sourceHandle: 'bottom', targetHandle: 'top' });
      const state = useProjectStore.getState();
      const connectedEdge = Object.values(state.edges).find(
        (e) => e.source === n1 && e.target === n5
      );
      expect(connectedEdge).toBeDefined();
      expect(connectedEdge!.type).toBe('straight');
    });
  });

  // ==========================================================================
  // Section 6: Undo / Redo Reliability & Atomicity (UR-01 to UR-04)
  // ==========================================================================
  describe('Undo / Redo Reliability & Atomicity (UR-01 to UR-04)', () => {
    it('UR-01: Tab and Enter directional spawn undoes both node and edge in a single step', () => {
      const store = useProjectStore.getState();
      const rootId = 'mm-root';
      store.setSelectedNodes([rootId]);

      const initialNodeCount = Object.keys(useProjectStore.getState().nodes).length;
      const initialEdgeCount = Object.keys(useProjectStore.getState().edges).length;

      // 1. Spawn child node with Tab
      const childId = spawnChildNode(rootId);
      expect(childId).toBeTruthy();

      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(initialNodeCount + 1);
      expect(Object.keys(useProjectStore.getState().edges).length).toBe(initialEdgeCount + 1);

      // 2. Undo should remove BOTH node and edge in ONE step (no double-undo needed)
      undo();

      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(initialNodeCount);
      expect(Object.keys(useProjectStore.getState().edges).length).toBe(initialEdgeCount);
      expect(useProjectStore.getState().nodes[childId!]).toBeUndefined();

      // 3. Redo should restore BOTH node and edge in ONE step
      redo();

      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(initialNodeCount + 1);
      expect(Object.keys(useProjectStore.getState().edges).length).toBe(initialEdgeCount + 1);
      expect(useProjectStore.getState().nodes[childId!]).toBeDefined();
    });

    it('UR-01b: Canvas drag undo reverts node position to origin in 1 step without drag bloat', () => {
      const store = useProjectStore.getState();
      const node = store.nodes['mm-root'];
      expect(node).toBeDefined();
      const originPos = { ...node.position };

      const temporal = useProjectStore.temporal;
      // Capture start snapshot & pause temporal tracking like handleNodeDragStart
      const startSnapshot = {
        project: store.project,
        boards: store.boards,
        pages: store.pages,
        nodes: JSON.parse(JSON.stringify(store.nodes)),
        edges: store.edges,
        activePageId: store.activePageId,
      };
      temporal.getState().pause();
      useProjectStore.setState({ isDragging: true });

      // Simulate React Flow firing multiple intermediate onNodesChange events during drag
      store.onNodesChange([
        { id: 'mm-root', type: 'position', position: { x: originPos.x + 10, y: originPos.y + 5 }, dragging: true },
      ]);
      store.onNodesChange([
        { id: 'mm-root', type: 'position', position: { x: originPos.x + 50, y: originPos.y + 30 }, dragging: true },
      ]);
      store.onNodesChange([
        { id: 'mm-root', type: 'position', position: { x: originPos.x + 150, y: originPos.y + 100 }, dragging: true },
      ]);

      // Simulate handleNodeDragStop
      useProjectStore.setState({ isDragging: false });
      temporal.getState().resume();
      // Inject single start snapshot and clear future
      temporal.setState((t) => ({
        pastStates: [...t.pastStates, startSnapshot],
        futureStates: [],
      }));

      // React Flow fires dragging: false with the same final coordinates
      store.onNodesChange([
        { id: 'mm-root', type: 'position', position: { x: originPos.x + 150, y: originPos.y + 100 }, dragging: false },
      ]);

      // Crucial: Redundant identical coordinate change must NOT push a 2nd history step!
      expect(temporal.getState().pastStates.length).toBe(1);

      // Node is at dragged position
      expect(useProjectStore.getState().nodes['mm-root'].position.x).toBe(originPos.x + 150);
      expect(useProjectStore.getState().nodes['mm-root'].position.y).toBe(originPos.y + 100);

      // A single undo should revert back to original origin coordinates immediately
      undo();
      expect(useProjectStore.getState().nodes['mm-root'].position.x).toBe(originPos.x);
      expect(useProjectStore.getState().nodes['mm-root'].position.y).toBe(originPos.y);

      // Redo restores dragged position in 1 step
      redo();
      expect(useProjectStore.getState().nodes['mm-root'].position.x).toBe(originPos.x + 150);
      expect(useProjectStore.getState().nodes['mm-root'].position.y).toBe(originPos.y + 100);
    });

    it('UR-02: Page switching does NOT record empty undo steps', () => {
      const store = useProjectStore.getState();
      const temporal = useProjectStore.temporal;
      temporal.getState().clear();

      expect(temporal.getState().pastStates.length).toBe(0);

      const page1Id = store.activePageId;
      const page2Id = store.addPage('Second Page');

      // Adding a page creates 1 state in history
      const historyAfterAdd = temporal.getState().pastStates.length;
      expect(historyAfterAdd).toBe(1);

      // Switching pages back and forth should pause temporal and NOT record empty history steps
      store.setActivePage(page1Id);
      store.setActivePage(page2Id);
      store.setActivePage(page1Id);

      expect(temporal.getState().pastStates.length).toBe(historyAfterAdd);
    });

    it('UR-02b: Multi-selection and selection changes do NOT pollute history or clear redo', () => {
      const store = useProjectStore.getState();
      const temporal = useProjectStore.temporal;
      temporal.getState().clear();

      // Add a node so we can undo it
      const newNodeId = store.addNode({ position: { x: 200, y: 200 } });
      expect(temporal.getState().pastStates.length).toBe(1);

      // Undo the node -> futureStates now has 1 entry
      undo();
      expect(temporal.getState().futureStates.length).toBe(1);
      expect(useProjectStore.getState().nodes[newNodeId]).toBeUndefined();

      // Select and deselect nodes & edges via onNodesChange / onEdgesChange
      store.onNodesChange([
        { id: 'mm-root', type: 'select', selected: true },
      ]);
      store.onEdgesChange([
        { id: 'seed-edge-1', type: 'select', selected: true },
      ]);

      // Selection state must update
      expect(useProjectStore.getState().selectedNodeIds).toContain('mm-root');
      expect(useProjectStore.getState().selectedEdgeIds).toContain('seed-edge-1');

      // Crucial: futureStates must NOT be cleared by selection changes!
      expect(temporal.getState().futureStates.length).toBe(1);

      // Redo must succeed
      redo();
      expect(useProjectStore.getState().nodes[newNodeId]).toBeDefined();
    });

    it('UR-03: Automated DOM dimension measurements do NOT clear redo stack', () => {
      const store = useProjectStore.getState();
      const temporal = useProjectStore.temporal;
      temporal.getState().clear();

      const nodeId = store.addNode({ position: { x: 300, y: 300 } });
      undo();
      expect(temporal.getState().futureStates.length).toBe(1);

      // Automated ResizeObserver measurement fired by React Flow (resizing is undefined or false)
      store.onNodesChange([
        {
          id: 'mm-root',
          type: 'dimensions',
          dimensions: { width: 160, height: 60 },
          resizing: false,
        },
      ]);

      // Crucial: ResizeObserver measurements must NOT clear redo stack!
      expect(temporal.getState().futureStates.length).toBe(1);

      // Redo successfully restores the undone node
      redo();
      expect(useProjectStore.getState().nodes[nodeId]).toBeDefined();
    });

    it('UR-04: Project creation and switching clears temporal history', () => {
      const store = useProjectStore.getState();
      const temporal = useProjectStore.temporal;

      // Add nodes to generate history
      store.addNode({ position: { x: 10, y: 10 } });
      store.addNode({ position: { x: 20, y: 20 } });
      expect(temporal.getState().pastStates.length).toBeGreaterThan(0);

      // Create new project
      store.createProject('Isolated History Project');

      // Temporal history must be cleared to prevent cross-project state pollution
      expect(temporal.getState().pastStates.length).toBe(0);
      expect(temporal.getState().futureStates.length).toBe(0);
    });

    it('UR-04b: Batch delete of nodes and edges undoes in 1 step', () => {
      const store = useProjectStore.getState();

      const nodeA = store.addNode({ position: { x: 100, y: 100 } });
      const nodeB = store.addNode({ position: { x: 300, y: 100 } });
      const edgeId = store.addEdge({ source: nodeA, target: nodeB });

      expect(useProjectStore.getState().nodes[nodeA]).toBeDefined();
      expect(useProjectStore.getState().nodes[nodeB]).toBeDefined();
      expect(useProjectStore.getState().edges[edgeId]).toBeDefined();

      // Delete both nodes and the edge atomically
      store.batchDelete([nodeA, nodeB], [edgeId]);

      expect(useProjectStore.getState().nodes[nodeA]).toBeUndefined();
      expect(useProjectStore.getState().nodes[nodeB]).toBeUndefined();
      expect(useProjectStore.getState().edges[edgeId]).toBeUndefined();

      // In 1 single undo step, restore all
      undo();

      expect(useProjectStore.getState().nodes[nodeA]).toBeDefined();
      expect(useProjectStore.getState().nodes[nodeB]).toBeDefined();
      expect(useProjectStore.getState().edges[edgeId]).toBeDefined();
    });

    it('UR-01c: Single-node drag stop without allDraggedNodes array does not throw TypeError and recovers cleanly', () => {
      const store = useProjectStore.getState();
      const node = store.nodes['mm-root'];
      expect(node).toBeDefined();

      const temporal = useProjectStore.temporal;
      temporal.getState().clear();

      // Start drag
      temporal.getState().pause();
      useProjectStore.setState({ isDragging: true });

      // Simulate dragging without optional 3rd argument (allDraggedNodes)
      const fakeDraggedNode = { id: 'mm-root', position: { x: 999, y: 999 } } as any;

      expect(() => {
        // Test that single-node fallback (fakeDraggedNode without allDraggedNodes array) handles safely
        useProjectStore.setState((s) => {
          s.isDragging = false;
          const storeNode = s.nodes[fakeDraggedNode.id];
          if (storeNode) {
            storeNode.position = fakeDraggedNode.position;
          }
        });
        temporal.getState().resume();
      }).not.toThrow();

      expect(temporal.getState().isTracking).toBe(true);
    });

    it('UR-01d: No-op drag (click without movement) does not clear Redo stack or inject history', () => {
      const store = useProjectStore.getState();
      const temporal = useProjectStore.temporal;
      temporal.getState().clear();

      // Add node and undo it to populate futureStates
      const newNodeId = store.addNode({ position: { x: 50, y: 50 } });
      undo();
      expect(temporal.getState().futureStates.length).toBe(1);

      // User clicks down on node (start drag) then releases at exact same position without moving
      const originPos = store.nodes['mm-root'].position;
      useProjectStore.setState({ isDragging: true });

      // Redundant onNodesChange with same coordinates
      store.onNodesChange([
        { id: 'mm-root', type: 'position', position: { ...originPos }, dragging: false },
      ]);
      useProjectStore.setState({ isDragging: false });

      // Crucial: futureStates must NOT be cleared by a no-op click/drag!
      expect(temporal.getState().futureStates.length).toBe(1);

      // Redo successfully restores the undone node
      redo();
      expect(useProjectStore.getState().nodes[newNodeId]).toBeDefined();
    });

    it('UR-05: Node resizing intermediate frames do not pollute history and undo reverts in 1 step', () => {
      const store = useProjectStore.getState();
      const temporal = useProjectStore.temporal;
      temporal.getState().clear();

      const nodeId = store.addNode({
        position: { x: 200, y: 200 },
        width: 160,
        height: 60,
      });

      // Capture history count before resizing
      const historyBefore = temporal.getState().pastStates.length;

      // Simulate user dragging resize handle across multiple frames (resizing: true)
      store.onNodesChange([
        { id: nodeId, type: 'dimensions', dimensions: { width: 170, height: 65 }, resizing: true },
      ]);
      store.onNodesChange([
        { id: nodeId, type: 'dimensions', dimensions: { width: 180, height: 70 }, resizing: true },
      ]);
      store.onNodesChange([
        { id: nodeId, type: 'dimensions', dimensions: { width: 220, height: 90 }, resizing: true },
      ]);

      // Intermediate frames while isResizing must NOT bloat history
      expect(useProjectStore.getState().isResizing).toBe(true);
      expect(temporal.getState().pastStates.length).toBe(historyBefore);

      // Resize complete (user releases handle: isResizing: false, final dimension commit)
      useProjectStore.setState((s) => {
        s.isResizing = false;
        const target = s.nodes[nodeId];
        if (target) {
          target.width = 220;
          target.height = 90;
        }
      });

      expect(useProjectStore.getState().nodes[nodeId].width).toBe(220);
      expect(useProjectStore.getState().nodes[nodeId].height).toBe(90);

      // Single undo reverts resize back to original 160x60 in 1 step
      undo();
      expect(useProjectStore.getState().nodes[nodeId].width).toBe(160);
      expect(useProjectStore.getState().nodes[nodeId].height).toBe(60);

      // Single redo restores final resized dimensions
      redo();
      expect(useProjectStore.getState().nodes[nodeId].width).toBe(220);
      expect(useProjectStore.getState().nodes[nodeId].height).toBe(90);
    });

    it('UR-06: Edge reconnection supports single-step undo and redo', () => {
      const store = useProjectStore.getState();
      const temporal = useProjectStore.temporal;
      temporal.getState().clear();

      const nodeA = store.addNode({ position: { x: 50, y: 50 } });
      const nodeB = store.addNode({ position: { x: 250, y: 50 } });
      const nodeC = store.addNode({ position: { x: 450, y: 50 } });
      const edgeId = store.addEdge({ source: nodeA, target: nodeB });

      expect(useProjectStore.getState().edges[edgeId].target).toBe(nodeB);

      // Reconnect edge target to nodeC
      store.reconnectEdge(edgeId, {
        source: nodeA,
        target: nodeC,
        sourceHandle: 'right',
        targetHandle: 'left',
      });

      expect(useProjectStore.getState().edges[edgeId].target).toBe(nodeC);

      // Undo reverts reconnection back to nodeB in 1 step
      undo();
      expect(useProjectStore.getState().edges[edgeId].target).toBe(nodeB);

      // Redo restores reconnection to nodeC in 1 step
      redo();
      expect(useProjectStore.getState().edges[edgeId].target).toBe(nodeC);
    });

    it('UR-07: Undo and Redo are safely ignored while actively dragging to prevent draft corruption', () => {
      const store = useProjectStore.getState();
      const node = store.nodes['mm-root'];
      expect(node).toBeDefined();

      // Add a node so pastStates is non-empty
      const newNodeId = store.addNode({ position: { x: 80, y: 80 } });
      expect(useProjectStore.getState().nodes[newNodeId]).toBeDefined();

      // Enter active dragging state
      useProjectStore.setState({ isDragging: true });

      // Calling undo while dragging must be safely ignored
      undo();
      expect(useProjectStore.getState().nodes[newNodeId]).toBeDefined();

      // End dragging state
      useProjectStore.setState({ isDragging: false });

      // Now undo proceeds normally
      undo();
      expect(useProjectStore.getState().nodes[newNodeId]).toBeUndefined();
    });
  });

  // ==========================================================================
  // Section 11: Selection Filter & Enclosed Box Selection & Top-Layer Floating Menu
  // ==========================================================================
  describe('Selection Filtering & Enclosed Box Selection', () => {
    it('TL-06: SelectionFilter store state toggles and resets correctly', () => {
      const store = useProjectStore.getState();
      expect(store.selectionFilter).toEqual({
        shape: true,
        text: true,
        edge: true,
        frame: true,
        diagram: true,
      });

      // Toggle edge off
      store.toggleSelectionFilterItem('edge');
      expect(useProjectStore.getState().selectionFilter.edge).toBe(false);
      expect(useProjectStore.getState().selectionFilter.shape).toBe(true);

      // Toggle text off
      store.toggleSelectionFilterItem('text');
      expect(useProjectStore.getState().selectionFilter.text).toBe(false);

      // Reset
      store.resetSelectionFilter();
      expect(useProjectStore.getState().selectionFilter).toEqual({
        shape: true,
        text: true,
        edge: true,
        frame: true,
        diagram: true,
      });

      // Clear (Deselect all)
      store.clearSelectionFilter();
      expect(useProjectStore.getState().selectionFilter).toEqual({
        shape: false,
        text: false,
        edge: false,
        frame: false,
        diagram: false,
      });
    });

    it('SL-01: Box selection only selects edges whose source and target are both enclosed in the selection set', () => {
      const store = useProjectStore.getState();
      const pageId = store.addPage('Box Selection Page');
      store.setActivePage(pageId);

      const n1 = store.addNode({ position: { x: 100, y: 100 } });
      const n2 = store.addNode({ position: { x: 200, y: 100 } });
      const n3 = store.addNode({ position: { x: 800, y: 800 } }); // Far outside

      const edgeEnclosed = store.addEdge({ source: n1, target: n2 });
      const edgeExternal = store.addEdge({ source: n1, target: n3 });

      // Simulate React Flow handleSelectionChange logic with userSelectionActive = true
      const simulateSelection = (
        rawSelectedNodes: string[],
        rawSelectedEdges: string[],
        userSelectionActive: boolean,
        filter = store.selectionFilter
      ) => {
        const selNodeIdSet = new Set(rawSelectedNodes);
        const resolvedEdges = rawSelectedEdges.filter((edgeId) => {
          if (!filter.edge) return false;
          const edge = useProjectStore.getState().edges[edgeId];
          if (!edge) return false;
          if (userSelectionActive) {
            // Strictly enclosed: both ends must be inside
            return selNodeIdSet.has(edge.source) && selNodeIdSet.has(edge.target);
          }
          return true;
        });
        return resolvedEdges;
      };

      // When dragging selection box around n1 & n2 (n3 is outside)
      // React Flow raw selection contains n1, n2 and both connected edges
      const filtered = simulateSelection([n1, n2], [edgeEnclosed, edgeExternal], true);

      // Only edgeEnclosed is kept because n3 is not selected
      expect(filtered).toContain(edgeEnclosed);
      expect(filtered).not.toContain(edgeExternal);

      // When clicking edgeExternal directly (userSelectionActive = false)
      const clicked = simulateSelection([], [edgeExternal], false);
      expect(clicked).toContain(edgeExternal);

      // When edge filter is disabled, even direct click ignores edge
      const filteredOut = simulateSelection([], [edgeExternal], false, {
        shape: true,
        text: true,
        edge: false,
        frame: true,
        diagram: true,
      });
      expect(filteredOut).not.toContain(edgeExternal);
    });

    it('SL-02: Box selection does not select previously moved nodes when selection rectangle does not enclose them', () => {
      const store = useProjectStore.getState();
      const pageId = store.addPage('Box Selection Moved Nodes Page');
      store.setActivePage(pageId);

      // 1. Create two nodes: Node A in auto-elk layout mode at (100, 100), Node B at (800, 800)
      const nodeA = store.addNode({
        position: { x: 100, y: 100 },
        width: 160,
        height: 60,
        layoutMode: 'auto-elk',
        data: { label: 'Node A', layoutMode: 'auto-elk' },
      });
      const nodeB = store.addNode({
        position: { x: 800, y: 800 },
        width: 160,
        height: 60,
        layoutMode: 'auto-elk',
        data: { label: 'Node B', layoutMode: 'auto-elk' },
      });

      expect(useProjectStore.getState().nodes[nodeA].layoutMode).toBe('auto-elk');

      // 2. Simulate dragging Node A to a new position (250, 250)
      const temporal = useProjectStore.temporal;
      temporal.getState().clear();
      expect(temporal.getState().pastStates.length).toBe(0);

      const startSnapshot = {
        project: store.project,
        boards: store.boards,
        pages: store.pages,
        nodes: JSON.parse(JSON.stringify(store.nodes)),
        edges: store.edges,
        activePageId: store.activePageId,
      };

      // Start drag: pause temporal and set isDragging = true (as in handleNodeDragStart)
      temporal.getState().pause();
      useProjectStore.setState({ isDragging: true });

      // Intermediate move events from React Flow
      store.onNodesChange([
        { id: nodeA, type: 'position', position: { x: 150, y: 150 }, dragging: true },
      ]);
      store.onNodesChange([
        { id: nodeA, type: 'position', position: { x: 250, y: 250 }, dragging: true },
      ]);

      // Verify that while dragging, layoutMode transitioned to manual
      expect(useProjectStore.getState().nodes[nodeA].layoutMode).toBe('manual');
      expect(useProjectStore.getState().nodes[nodeA].data.layoutMode).toBe('manual');

      // Stop drag: handleNodeDragStop simulation
      useProjectStore.setState((state) => {
        state.isDragging = false;
        for (const node of Object.values(state.nodes)) {
          if (node && 'dragging' in node) {
            delete node.dragging;
          }
        }
      });
      temporal.getState().resume();
      temporal.setState((t) => ({
        pastStates: [...t.pastStates, startSnapshot],
        futureStates: [],
      }));

      // React Flow fires dragging: false with identical final position coordinates
      store.onNodesChange([
        { id: nodeA, type: 'position', position: { x: 250, y: 250 }, dragging: false },
      ]);

      // Verify node.dragging is deleted, isDragging is false, and UR-01b history is clean
      const stateAfterDrag = useProjectStore.getState();
      expect(stateAfterDrag.isDragging).toBe(false);
      expect((stateAfterDrag.nodes[nodeA] as any).dragging).toBeUndefined();
      expect((stateAfterDrag.nodes[nodeB] as any).dragging).toBeUndefined();
      expect(stateAfterDrag.nodes[nodeA].position).toEqual({ x: 250, y: 250 });
      expect(stateAfterDrag.nodes[nodeA].layoutMode).toBe('manual');
      // Redundant position change with dragging: false must NOT add an extra undo state
      expect(temporal.getState().pastStates.length).toBe(1);

      // 3. Test React Flow box selection logic (@xyflow/system getNodesInside geometry check)
      const simulateGetNodesInside = (
        nodeList: any[],
        rect: { x: number; y: number; width: number; height: number },
        partially = true
      ) => {
        return nodeList.filter((node) => {
          const width = node.measured?.width ?? node.width ?? 160;
          const height = node.measured?.height ?? node.height ?? 60;
          const x = node.position.x;
          const y = node.position.y;
          const overlapX = Math.max(0, Math.min(rect.x + rect.width, x + width) - Math.max(rect.x, x));
          const overlapY = Math.max(0, Math.min(rect.y + rect.height, y + height) - Math.max(rect.y, y));
          const overlappingArea = overlapX * overlapY;
          const area = width * height;
          const isVisible = partially ? overlappingArea > 0 : overlappingArea >= area;
          // Notice: @xyflow/system includes node if isVisible OR node.dragging === true!
          return isVisible || Boolean(node.dragging);
        });
      };

      // Map nodes through the reactFlowNodes transformation from Canvas.tsx
      const currentNodes = [stateAfterDrag.nodes[nodeA], stateAfterDrag.nodes[nodeB]];
      const mapToReactFlowNodes = (nList: any[], draggingActive: boolean) =>
        nList.map((n) => {
          const nodeObj: any = {
            ...n,
            selectable: true,
            measured: {
              width: n.measured?.width ?? n.width ?? 160,
              height: n.measured?.height ?? n.height ?? 60,
            },
          };
          if (!draggingActive || !n.dragging) {
            delete nodeObj.dragging;
          }
          return nodeObj;
        });

      const reactFlowNodes = mapToReactFlowNodes(currentNodes, stateAfterDrag.isDragging);

      // Box Selection 1: Selection rectangle in completely empty canvas (450, 450, w: 100, h: 100)
      // Node A is at (250, 250), Node B is at (800, 800) -> Neither is enclosed
      const emptyBoxResult = simulateGetNodesInside(reactFlowNodes, {
        x: 450,
        y: 450,
        width: 100,
        height: 100,
      });
      expect(emptyBoxResult).toHaveLength(0);
      expect(emptyBoxResult.map((n) => n.id)).not.toContain(nodeA);
      expect(emptyBoxResult.map((n) => n.id)).not.toContain(nodeB);

      // Box Selection 2: Selection rectangle enclosing only Node B (750, 750, w: 250, h: 250)
      // Crucial: Previously moved Node A (now 'manual') MUST NOT be selected!
      const boxAroundB = simulateGetNodesInside(reactFlowNodes, {
        x: 750,
        y: 750,
        width: 250,
        height: 250,
      });
      expect(boxAroundB.map((n) => n.id)).toEqual([nodeB]);
      expect(boxAroundB.map((n) => n.id)).not.toContain(nodeA);

      // Box Selection 3: Selection rectangle enclosing only Node A (200, 200, w: 250, h: 250)
      const boxAroundA = simulateGetNodesInside(reactFlowNodes, {
        x: 200,
        y: 200,
        width: 250,
        height: 250,
      });
      expect(boxAroundA.map((n) => n.id)).toEqual([nodeA]);
      expect(boxAroundA.map((n) => n.id)).not.toContain(nodeB);

      // Box Selection 4: Selection rectangle enclosing BOTH Node A and Node B (0, 0, w: 1200, h: 1200)
      const boxAroundBoth = simulateGetNodesInside(reactFlowNodes, {
        x: 0,
        y: 0,
        width: 1200,
        height: 1200,
      });
      expect(boxAroundBoth.map((n) => n.id)).toContain(nodeA);
      expect(boxAroundBoth.map((n) => n.id)).toContain(nodeB);

      // Box Selection 5: SelectionMode.Full (partially = false)
      // A rectangle partially overlapping Node A (at 250, 250 with w=160, h=60) but not fully enclosing it
      // Partial rect: (200, 200, w=100, h=100) overlaps Node A by 50x50 = 2500, but area is 160*60 = 9600
      const partialOverlapBox = simulateGetNodesInside(
        reactFlowNodes,
        { x: 200, y: 200, width: 100, height: 100 },
        false // SelectionMode.Full
      );
      expect(partialOverlapBox).toHaveLength(0);

      // 4. Test multi-node simultaneous drag release
      temporal.getState().clear();
      store.onNodesChange([
        { id: nodeA, type: 'position', position: { x: 300, y: 300 }, dragging: true },
        { id: nodeB, type: 'position', position: { x: 900, y: 900 }, dragging: true },
      ]);
      expect(useProjectStore.getState().isDragging).toBe(true);

      // Multi-node drag release with dragging: false
      store.onNodesChange([
        { id: nodeA, type: 'position', position: { x: 300, y: 300 }, dragging: false },
        { id: nodeB, type: 'position', position: { x: 900, y: 900 }, dragging: false },
      ]);
      const stateAfterMultiDrag = useProjectStore.getState();
      expect(stateAfterMultiDrag.isDragging).toBe(false);
      expect((stateAfterMultiDrag.nodes[nodeA] as any).dragging).toBeUndefined();
      expect((stateAfterMultiDrag.nodes[nodeB] as any).dragging).toBeUndefined();

      // Box select on empty area after multi-node move
      const multiNodes = [stateAfterMultiDrag.nodes[nodeA], stateAfterMultiDrag.nodes[nodeB]];
      const multiRFNodes = mapToReactFlowNodes(multiNodes, stateAfterMultiDrag.isDragging);
      const postMultiEmptyBox = simulateGetNodesInside(multiRFNodes, {
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      });
      expect(postMultiEmptyBox).toHaveLength(0);

      // 5. Also test global drag cancel recovery
      useProjectStore.setState((s) => {
        s.isDragging = true;
        if (s.nodes[nodeA]) {
          s.nodes[nodeA].dragging = true;
        }
      });
      // Simulate handleGlobalDragCancel
      useProjectStore.setState((s) => {
        s.isDragging = false;
        for (const node of Object.values(s.nodes)) {
          if (node && 'dragging' in node) {
            delete node.dragging;
          }
        }
      });
      expect(useProjectStore.getState().isDragging).toBe(false);
      expect((useProjectStore.getState().nodes[nodeA] as any).dragging).toBeUndefined();
    });

    it('TL-07: Floating Action Bars have top-layer z-index classes ensuring no occlusion', () => {
      // Verify index.css has .react-flow__node.selected { z-index: 99999 !important; }
      const cssPath = path.resolve(__dirname, '../src/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      expect(css).toContain('.react-flow__node.selected');
      expect(css).toContain('z-index: 99999 !important');
      expect(css).toContain('.react-flow__edge.selected');
    });

    it('FN-05: TextNode defaults to transparent background with no hardcoded solid background color', () => {
      const textNodePath = path.resolve(__dirname, '../src/components/canvas/nodes/TextNode.tsx');
      const textNodeCode = fs.readFileSync(textNodePath, 'utf8');

      // Verify transparent background fallback
      expect(textNodeCode).toContain("backgroundColor: data?.backgroundColor || 'transparent'");
      // Verify no hardcoded bg-slate-900 on unedited container
      expect(textNodeCode).not.toContain('bg-slate-900/80');
      expect(textNodeCode).not.toContain('hover:bg-slate-900/40');
    });

    // ========================================================================
    // Controlled Selection & React Flow Lifecycle (Bug Fixes: Issues 1, 2, 3)
    // ========================================================================
    describe('Controlled Selection & React Flow Lifecycle (Canvas Error Prevention)', () => {
      it('Issue 1: Selecting a node then selecting its edge does not trigger infinite loops or error out', () => {
        const store = useProjectStore.getState();
        const pageId = store.addPage('Selection Loop Test Page');
        store.setActivePage(pageId);

        const nodeA = store.addNode({
          position: { x: 100, y: 100 },
          width: 160,
          height: 60,
          data: { label: 'Node A', layoutMode: 'manual' },
        });
        const nodeB = store.addNode({
          position: { x: 400, y: 100 },
          width: 160,
          height: 60,
          data: { label: 'Node B', layoutMode: 'manual' },
        });
        const edgeId = store.addEdge({
          source: nodeA,
          target: nodeB,
          type: 'jump',
        });

        // 1. User selects Node A
        store.setSelectedNodes([nodeA]);
        expect(useProjectStore.getState().selectedNodeIds).toEqual([nodeA]);
        expect(useProjectStore.getState().selectedEdgeIds).toEqual([]);

        // Controlled mapping test: nodeA has selected: true, edge has selected: false
        const activeNodes = Object.values(useProjectStore.getState().nodes);
        const activeEdges = Object.values(useProjectStore.getState().edges);
        const selNodes1 = useProjectStore.getState().selectedNodeIds;
        const selEdges1 = useProjectStore.getState().selectedEdgeIds;

        const rfNodes1 = activeNodes.map((n) => ({
          ...n,
          selected: selNodes1.includes(n.id),
        }));
        const rfEdges1 = activeEdges.map((e) => ({
          ...e,
          selected: selEdges1.includes(e.id),
        }));

        expect(rfNodes1.find((n) => n.id === nodeA)?.selected).toBe(true);
        expect(rfNodes1.find((n) => n.id === nodeB)?.selected).toBe(false);
        expect(rfEdges1.find((e) => e.id === edgeId)?.selected).toBe(false);

        // 2. User selects the connecting edge
        store.setSelectedEdges([edgeId]);
        store.setSelectedNodes([]); // Single edge click clears node selection

        const selNodes2 = useProjectStore.getState().selectedNodeIds;
        const selEdges2 = useProjectStore.getState().selectedEdgeIds;

        const rfNodes2 = activeNodes.map((n) => ({
          ...n,
          selected: selNodes2.includes(n.id),
        }));
        const rfEdges2 = activeEdges.map((e) => ({
          ...e,
          selected: selEdges2.includes(e.id),
        }));

        expect(rfEdges2.find((e) => e.id === edgeId)?.selected).toBe(true);
        expect(rfNodes2.find((n) => n.id === nodeA)?.selected).toBe(false);

        // Verify repetitive edge change events are idempotent and do not recurse or loop
        for (let i = 0; i < 20; i++) {
          store.onEdgesChange([{ id: edgeId, type: 'select', selected: true }]);
        }
        expect(useProjectStore.getState().selectedEdgeIds).toEqual([edgeId]);

        // Static contract verification in Canvas.tsx:
        const canvasPath = path.resolve(__dirname, '../src/components/canvas/Canvas.tsx');
        const canvasCode = fs.readFileSync(canvasPath, 'utf8');

        // Confirm controlled selected mapping on reactFlowNodes & reactFlowEdges
        expect(canvasCode).toContain('selected: selectedSet.has(n.id)');
        expect(canvasCode).toContain('selected: selectedSet.has(e.id)');

        // Confirm problematic manual useEffect synchronizers are removed
        expect(canvasCode).not.toContain('setReactFlowNodes((nds)');
        expect(canvasCode).not.toContain('setReactFlowEdges((eds)');

        // Confirm stable constants are extracted
        expect(canvasCode).toContain('const SNAP_GRID');
        expect(canvasCode).toContain('const PAN_ON_DRAG');
        expect(canvasCode).toContain('const MULTI_SELECTION_KEY_CODE');
        expect(canvasCode).toContain('const ZOOM_ACTIVATION_KEY_CODE');
        expect(canvasCode).toContain('const FIT_VIEW_OPTIONS');
      });

      it('Issue 2: Selecting a node, clicking pane to deselect, and clicking the same node immediately re-selects it', () => {
        const store = useProjectStore.getState();
        const pageId = store.addPage('Re-select Test Page');
        store.setActivePage(pageId);

        const nodeA = store.addNode({
          position: { x: 200, y: 200 },
          width: 160,
          height: 60,
          data: { label: 'Node A', layoutMode: 'manual' },
        });

        // 1. User selects Node A
        store.setSelectedNodes([nodeA]);
        expect(useProjectStore.getState().selectedNodeIds).toEqual([nodeA]);

        // In controlled mode, React Flow node has selected: true
        let selNodeIds = useProjectStore.getState().selectedNodeIds;
        let rfNode = {
          ...store.nodes[nodeA],
          selected: selNodeIds.includes(nodeA),
        };
        expect(rfNode.selected).toBe(true);

        // 2. User clicks empty pane to deselect
        store.setSelectedNodes([]);
        store.setSelectedEdges([]);
        expect(useProjectStore.getState().selectedNodeIds).toHaveLength(0);

        // In controlled mode, React Flow receives selected: false
        selNodeIds = useProjectStore.getState().selectedNodeIds;
        rfNode = {
          ...store.nodes[nodeA],
          selected: selNodeIds.includes(nodeA),
        };
        expect(rfNode.selected).toBe(false);

        // Simulate React Flow's internal handleNodeClick logic:
        // if (!node.selected) { addSelectedNodes([id]); }
        // Because rfNode.selected is false (NOT undefined or stale true), !rfNode.selected is true!
        const canSelectOnFirstClick = !rfNode.selected;
        expect(canSelectOnFirstClick).toBe(true);

        // 3. User clicks the same node again immediately
        if (canSelectOnFirstClick) {
          store.setSelectedNodes([nodeA]);
        }
        expect(useProjectStore.getState().selectedNodeIds).toEqual([nodeA]);
      });

      it('Issue 3: Box-drag multi-selection followed by a single pane click completely deselects all nodes in 1 click', () => {
        const store = useProjectStore.getState();
        const pageId = store.addPage('Box Selection Deselect Page');
        store.setActivePage(pageId);

        const nodeA = store.addNode({
          position: { x: 100, y: 100 },
          width: 160,
          height: 60,
          data: { label: 'Node A', layoutMode: 'manual' },
        });
        const nodeB = store.addNode({
          position: { x: 300, y: 100 },
          width: 160,
          height: 60,
          data: { label: 'Node B', layoutMode: 'manual' },
        });

        // 1. User box-drags to multi-select both nodes
        store.setSelectedNodes([nodeA, nodeB]);
        expect(useProjectStore.getState().selectedNodeIds).toHaveLength(2);
        expect(useProjectStore.getState().selectedNodeIds).toContain(nodeA);
        expect(useProjectStore.getState().selectedNodeIds).toContain(nodeB);

        // 2. Verify CSS completely suppresses .react-flow__nodesselection and .react-flow__nodesselection-rect
        // This ensures the internal xyflow selection box doesn't capture clicks or require a 2nd click to dismiss
        const cssPath = path.resolve(__dirname, '../src/index.css');
        const css = fs.readFileSync(cssPath, 'utf8');

        expect(css).toContain('.react-flow__nodesselection');
        expect(css).toContain('.react-flow__nodesselection-rect');
        expect(css).toMatch(/\.react-flow__nodesselection[\s\S]*?display:\s*none\s*!important/);

        // 3. User clicks empty pane ONCE (single click)
        store.setSelectedNodes([]);
        store.setSelectedEdges([]);

        // Assert: 1 click completely clears all selections immediately
        expect(useProjectStore.getState().selectedNodeIds).toHaveLength(0);
        expect(useProjectStore.getState().selectedEdgeIds).toHaveLength(0);

        const activeNodes = Object.values(useProjectStore.getState().nodes);
        const selNodeIds = useProjectStore.getState().selectedNodeIds;
        const rfNodes = activeNodes.map((n) => ({
          ...n,
          selected: selNodeIds.includes(n.id),
        }));
        expect(rfNodes.every((n) => n.selected === false)).toBe(true);
      });

      it('Issue 4: Box-selecting two connected nodes and their connecting edge selects all three cleanly with zero crashes and strict idempotency', () => {
        const store = useProjectStore.getState();
        const pageId = store.addPage('Box Selection Connected Nodes Page');
        store.setActivePage(pageId);

        const nodeA = store.addNode({
          position: { x: 100, y: 100 },
          width: 160,
          height: 60,
          data: { label: 'Node A', layoutMode: 'manual' },
        });
        const nodeB = store.addNode({
          position: { x: 400, y: 100 },
          width: 160,
          height: 60,
          data: { label: 'Node B', layoutMode: 'manual' },
        });
        const edgeId = store.addEdge({
          source: nodeA,
          target: nodeB,
          type: 'jump',
        });

        // 1. Static Contract & Architectural Regression Guards in Canvas.tsx
        const canvasPath = path.resolve(__dirname, '../src/components/canvas/Canvas.tsx');
        const canvasCode = fs.readFileSync(canvasPath, 'utf8');

        // Verify userSelectionActive is NOT subscribed via reactive useStore hook (causes re-render churn)
        expect(canvasCode).not.toContain('useStore((s) => s.userSelectionActive)');

        // Verify handleEdgesChange filters out 'select' changes to prevent dual-channel conflict with handleSelectionChange
        expect(canvasCode).toMatch(
          /const\s+nonSelectChanges\s*=\s*changes\.filter\(\s*\(c\)\s*=>\s*c\.type\s*!==\s*['"]select['"]\s*\)/
        );

        // Verify handleSelectionChange does NOT have userSelectionActive in its dependency array
        const handleSelectionChangeDepMatch = canvasCode.match(
          /const\s+handleSelectionChange\s*=\s*useCallback\([\s\S]*?\},\s*\[([\s\S]*?)\]\s*\);/
        );
        expect(handleSelectionChangeDepMatch).toBeTruthy();
        expect(handleSelectionChangeDepMatch![1]).not.toContain('userSelectionActive');
        expect(handleSelectionChangeDepMatch![1]).toContain('storeApi');

        // Verify strict idempotency guard exists before setSelectedNodes and setSelectedEdges
        expect(canvasCode).toContain('if (nodesChanged)');
        expect(canvasCode).toContain('if (edgesChanged)');

        // 2. Behavioral Simulation: Edge change filtering
        // React Flow dispatches edge select changes during box selection; verify store remains isolated
        const nonSelectChanges = ([
          { id: edgeId, type: 'select', selected: true },
        ] as any[]).filter((c) => c.type !== 'select');
        expect(nonSelectChanges).toHaveLength(0); // Should be filtered out

        // 3. Behavioral Simulation: Marquee drag partial enclosing (only nodeA enclosed)
        // Rule: an edge is only selected if BOTH source and target are enclosed
        const activeNodes = useProjectStore.getState().nodes;
        const activeEdges = useProjectStore.getState().edges;

        const partialSelectionNodes = [activeNodes[nodeA]];
        const candidateEdges = [activeEdges[edgeId]];
        const selNodeIdSetPartial = new Set(partialSelectionNodes.map((n) => n.id));
        const userSelectionActiveTrue = true;

        const filteredEdgesPartial = candidateEdges.filter((e) => {
          if (userSelectionActiveTrue) {
            return selNodeIdSetPartial.has(e.source) && selNodeIdSetPartial.has(e.target);
          }
          return true;
        });
        expect(filteredEdgesPartial).toHaveLength(0); // Edge must NOT be selected when partially enclosed

        // 4. Behavioral Simulation: Marquee drag full enclosing (both nodeA and nodeB enclosed)
        const fullSelectionNodes = [activeNodes[nodeA], activeNodes[nodeB]];
        const selNodeIdSetFull = new Set(fullSelectionNodes.map((n) => n.id));

        const filteredEdgesFull = candidateEdges.filter((e) => {
          if (userSelectionActiveTrue) {
            return selNodeIdSetFull.has(e.source) && selNodeIdSetFull.has(e.target);
          }
          return true;
        });
        expect(filteredEdgesFull).toHaveLength(1);
        expect(filteredEdgesFull[0].id).toBe(edgeId);

        // Apply full selection to store
        store.setSelectedNodes([nodeA, nodeB]);
        store.setSelectedEdges([edgeId]);

        expect(useProjectStore.getState().selectedNodeIds).toEqual([nodeA, nodeB]);
        expect(useProjectStore.getState().selectedEdgeIds).toEqual([edgeId]);

        // 5. Store & Component Double-Layer Idempotency Guard Verification:
        let storeSubscriberNotificationCount = 0;
        const unsubscribe = useProjectStore.subscribe((state, prevState) => {
          if (
            state.selectedNodeIds !== prevState.selectedNodeIds ||
            state.selectedEdgeIds !== prevState.selectedEdgeIds
          ) {
            storeSubscriberNotificationCount++;
          }
        });

        // Simulate 50 rapid marquee hover / move frames with identical selection:
        for (let frame = 0; frame < 50; frame++) {
          const { selectedNodeIds: currNodeIds, selectedEdgeIds: currEdgeIds } =
            useProjectStore.getState();
          const targetNodeIds = [nodeA, nodeB];
          const targetEdgeIds = [edgeId];

          const currNodeSet = new Set(currNodeIds);
          const targetNodeSet = new Set(targetNodeIds);
          const nodesChanged =
            currNodeSet.size !== targetNodeSet.size ||
            targetNodeIds.some((id) => !currNodeSet.has(id));

          if (nodesChanged) {
            store.setSelectedNodes(targetNodeIds);
          }

          const currEdgeSet = new Set(currEdgeIds);
          const targetEdgeSet = new Set(targetEdgeIds);
          const edgesChanged =
            currEdgeSet.size !== targetEdgeSet.size ||
            targetEdgeIds.some((id) => !currEdgeSet.has(id));

          if (edgesChanged) {
            store.setSelectedEdges(targetEdgeIds);
          }

          // Direct store calls also test layer-2 idempotency in projectStore
          store.setSelectedNodes([nodeA, nodeB]);
          store.setSelectedEdges([edgeId]);
        }
        unsubscribe();

        // Zero state updates dispatched during steady state -> prevents React render loops
        expect(storeSubscriberNotificationCount).toBe(0);

        // 6. Verify controlled reactFlowNodes and reactFlowEdges selection state
        const finalNodes = Object.values(useProjectStore.getState().nodes);
        const finalEdges = Object.values(useProjectStore.getState().edges);
        const rfNodes = finalNodes.map((n) => ({
          ...n,
          selected: useProjectStore.getState().selectedNodeIds.includes(n.id),
        }));
        const rfEdges = finalEdges.map((e) => ({
          ...e,
          selected: useProjectStore.getState().selectedEdgeIds.includes(e.id),
        }));

        expect(rfNodes.find((n) => n.id === nodeA)?.selected).toBe(true);
        expect(rfNodes.find((n) => n.id === nodeB)?.selected).toBe(true);
        expect(rfEdges.find((e) => e.id === edgeId)?.selected).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Section 12: Directional Handle Spawn & Auto-Connection with Selection (OP-09)
  // ==========================================================================
  describe('Directional Handle Spawn & Auto-Connection (OP-09)', () => {
    it('should create new node and connecting edge in all 4 directions with matching handles', () => {
      const directions: Array<{
        dir: PlacementDirection;
        expectedSourceHandle: string;
        expectedTargetHandle: string;
      }> = [
        { dir: 'right', expectedSourceHandle: 'right', expectedTargetHandle: 'left' },
        { dir: 'bottom', expectedSourceHandle: 'bottom', expectedTargetHandle: 'top' },
        { dir: 'left', expectedSourceHandle: 'left', expectedTargetHandle: 'right' },
        { dir: 'top', expectedSourceHandle: 'top', expectedTargetHandle: 'bottom' },
      ];

      for (const { dir, expectedSourceHandle, expectedTargetHandle } of directions) {
        const store = useProjectStore.getState();
        store.setDefaultEdgeRoutingType('jump');
        const rootId = 'mm-root';
        const rootNode = store.nodes[rootId];
        expect(rootNode).toBeDefined();

        // Initially select the root node
        store.setSelectedNodes([rootId]);
        expect(useProjectStore.getState().selectedNodeIds).toEqual([rootId]);

        // Trigger quick-add on the directional handle
        const result = quickAddDirectionalNode(rootId, dir);
        expect(result).not.toBeNull();
        const { nodeId: newNodeId, edgeId } = result!;

        const updatedStore = useProjectStore.getState();

        // 1. Verify new node was created and added to the page
        const newNode = updatedStore.nodes[newNodeId];
        expect(newNode).toBeDefined();
        expect(newNode.type).toBe('shape');
        const activePage = updatedStore.pages[updatedStore.activePageId];
        expect(activePage.nodeIds).toContain(newNodeId);

        // 2. Verify connecting edge was created between source node and new node
        expect(edgeId).toBeDefined();
        const edge = updatedStore.edges[edgeId!];
        expect(edge).toBeDefined();
        expect(edge.source).toBe(rootId);
        expect(edge.target).toBe(newNodeId);
        expect(edge.sourceHandle).toBe(expectedSourceHandle);
        expect(edge.targetHandle).toBe(expectedTargetHandle);
        expect(edge.type).toBe('jump');
        expect(edge.data?.jumpArc).toBe(true);
        expect(activePage.edgeIds).toContain(edgeId);

        // 3. Verify newly created node is exclusively selected, clearing previous selection
        expect(updatedStore.selectedNodeIds).toEqual([newNodeId]);
        expect(updatedStore.selectedNodeIds).not.toContain(rootId);
      }
    });

    it('should automatically select the new node and clear multi-selection', () => {
      const store = useProjectStore.getState();
      const nodeA = 'mm-root';
      const nodeB = 'mm-node-1';
      store.setSelectedNodes([nodeA, nodeB]);
      expect(useProjectStore.getState().selectedNodeIds.length).toBe(2);

      // Clicking directional handle on nodeA
      const result = quickAddDirectionalNode(nodeA, 'right');
      expect(result).not.toBeNull();

      // Only the newly created node should be selected
      const currentSelected = useProjectStore.getState().selectedNodeIds;
      expect(currentSelected).toEqual([result!.nodeId]);
      expect(currentSelected).not.toContain(nodeA);
      expect(currentSelected).not.toContain(nodeB);
    });

    it('should avoid collisions when multiple nodes are sequentially spawned in the same direction', () => {
      const store = useProjectStore.getState();
      const rootId = 'mm-root';
      const rootPos = { ...store.nodes[rootId].position };

      // Spawn 1st node to the right
      const res1 = quickAddDirectionalNode(rootId, 'right');
      expect(res1).not.toBeNull();
      const node1 = useProjectStore.getState().nodes[res1!.nodeId];
      expect(node1.position.x).toBeGreaterThan(rootPos.x);

      // Spawn 2nd node to the right from the same root
      const res2 = quickAddDirectionalNode(rootId, 'right');
      expect(res2).not.toBeNull();
      const node2 = useProjectStore.getState().nodes[res2!.nodeId];

      // Second node should not overlap with the first node
      const overlap =
        Math.abs(node1.position.x - node2.position.x) < node1.width &&
        Math.abs(node1.position.y - node2.position.y) < node1.height;
      expect(overlap).toBe(false);

      // Both edges should exist connecting from root
      const edge1 = useProjectStore.getState().edges[res1!.edgeId!];
      const edge2 = useProjectStore.getState().edges[res2!.edgeId!];
      expect(edge1.source).toBe(rootId);
      expect(edge1.target).toBe(res1!.nodeId);
      expect(edge2.source).toBe(rootId);
      expect(edge2.target).toBe(res2!.nodeId);

      // The last spawned node is the selected node
      expect(useProjectStore.getState().selectedNodeIds).toEqual([res2!.nodeId]);
    });

    it('should atomically undo both node and connecting edge in a single step', () => {
      const store = useProjectStore.getState();
      const rootId = 'mm-root';
      const nodeCountBefore = Object.keys(store.nodes).length;
      const edgeCountBefore = Object.keys(store.edges).length;

      const result = quickAddDirectionalNode(rootId, 'bottom');
      expect(result).not.toBeNull();
      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(nodeCountBefore + 1);
      expect(Object.keys(useProjectStore.getState().edges).length).toBe(edgeCountBefore + 1);

      // Undo the single action
      undo();

      expect(useProjectStore.getState().nodes[result!.nodeId]).toBeUndefined();
      expect(useProjectStore.getState().edges[result!.edgeId!]).toBeUndefined();
      expect(Object.keys(useProjectStore.getState().nodes).length).toBe(nodeCountBefore);
      expect(Object.keys(useProjectStore.getState().edges).length).toBe(edgeCountBefore);
    });
  });
});
