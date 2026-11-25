/**
 * Creative-Neuro TDD Test Suite — Issue #43
 * Covers:
 * - Logical Group: ⌘G toggle, member selection/move/style, customizable group border & background Style (transparent by default)
 * - Z-Order: bringToFront, sendToBack, bringForward (up), sendBackward (down)
 * - Frame: distinct default background, auto-capture enclosed objects on resize, relative child movement, fold/unfold
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/store/projectStore.ts';
import { handleGlobalKeyDown } from '../src/components/workspace/ShortcutsHandler.tsx';
import { resolveNodeStyle } from '../src/components/canvas/nodes/nodeStyleUtils.ts';

describe('Issue #43: Logical Group, Frame Auto-Capture & Fold, Style & Z-Order', () => {
  beforeEach(() => {
    useProjectStore.getState().resetToSeed();
  });

  describe('Slice 1: Logical Group ⌘G toggle & customizable Group Style', () => {
    it('⌘G toggles Logical Group membership (groups multi-selected nodes, then ungroups when already grouped)', () => {
      const store = useProjectStore.getState();
      const n1 = store.addNode({ position: { x: 100, y: 100 }, data: { label: 'G1', layoutMode: 'manual' } });
      const n2 = store.addNode({ position: { x: 300, y: 100 }, data: { label: 'G2', layoutMode: 'manual' } });

      store.setSelectedNodes([n1, n2]);

      // First ⌘G creates Logical Group
      const handledGroup = handleGlobalKeyDown({ key: 'g', metaKey: true });
      expect(handledGroup).toBe(true);

      const afterGroup = useProjectStore.getState();
      const gid = afterGroup.nodes[n1].groupId;
      expect(gid).toBeTruthy();
      expect(afterGroup.nodes[n2].groupId).toBe(gid);

      // Clicking/selecting any single member selects the whole group
      afterGroup.setSelectedNodes([]);
      useProjectStore.getState().setSelectedNodes([n1]);
      expect(useProjectStore.getState().selectedNodeIds).toEqual(expect.arrayContaining([n1, n2]));

      // Second ⌘G on the grouped selection ungroups them
      const handledUngroup = handleGlobalKeyDown({ key: 'g', metaKey: true });
      expect(handledUngroup).toBe(true);

      const afterUngroup = useProjectStore.getState();
      expect(afterUngroup.nodes[n1].groupId).toBeUndefined();
      expect(afterUngroup.nodes[n2].groupId).toBeUndefined();
    });

    it('Logical Group supports customizable border & background Style (transparent by default) and clears on ungroup', () => {
      const store = useProjectStore.getState();
      const n1 = store.addNode({ position: { x: 100, y: 100 }, data: { label: 'S1', layoutMode: 'manual' } });
      const n2 = store.addNode({ position: { x: 250, y: 100 }, data: { label: 'S2', layoutMode: 'manual' } });
      store.setSelectedNodes([n1, n2]);

      const gid = store.groupSelectedNodes();
      expect(gid).toBeTruthy();

      const activePageId = useProjectStore.getState().activePageId;
      // Transparent / unstyled by default
      expect(useProjectStore.getState().pages[activePageId].groupStyles?.[gid!]).toBeUndefined();

      // Apply custom group style
      useProjectStore.getState().setGroupStyle(gid!, {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: '#3b82f6',
        borderWidth: 2,
      });

      const styled = useProjectStore.getState().pages[activePageId].groupStyles?.[gid!];
      expect(styled).toEqual({
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: '#3b82f6',
        borderWidth: 2,
      });

      // Ungrouping cleans up groupStyles entry
      useProjectStore.getState().ungroupNodes(gid!);
      expect(useProjectStore.getState().pages[activePageId].groupStyles?.[gid!]).toBeUndefined();
    });
  });

  describe('Slice 2: Z-Order controls (bringToFront, sendToBack, bringForward, sendBackward)', () => {
    it('bringForward and sendBackward step zIndex one layer at a time among page nodes', () => {
      const store = useProjectStore.getState();
      const n1 = store.addNode({ position: { x: 0, y: 0 }, zIndex: 1, data: { label: 'N1', layoutMode: 'manual' } });
      const n2 = store.addNode({ position: { x: 20, y: 20 }, zIndex: 2, data: { label: 'N2', layoutMode: 'manual' } });
      const n3 = store.addNode({ position: { x: 40, y: 40 }, zIndex: 3, data: { label: 'N3', layoutMode: 'manual' } });

      // Step n1 forward once: should be above n2, but still below n3
      store.bringForward(n1);
      let nodes = useProjectStore.getState().nodes;
      expect(nodes[n1].zIndex!).toBeGreaterThan(nodes[n2].zIndex!);
      expect(nodes[n1].zIndex!).toBeLessThan(nodes[n3].zIndex!);

      // Step n1 backward once: should be below n2 again
      useProjectStore.getState().sendBackward(n1);
      nodes = useProjectStore.getState().nodes;
      expect(nodes[n1].zIndex!).toBeLessThan(nodes[n2].zIndex!);
      expect(nodes[n2].zIndex!).toBeLessThan(nodes[n3].zIndex!);
    });

    it('bringForward works even when multiple nodes start with equal zIndex', () => {
      const store = useProjectStore.getState();
      const n1 = store.addNode({ position: { x: 0, y: 0 }, zIndex: 1, data: { label: 'N1', layoutMode: 'manual' } });
      const n2 = store.addNode({ position: { x: 20, y: 20 }, zIndex: 1, data: { label: 'N2', layoutMode: 'manual' } });

      store.bringForward(n1);
      const nodes = useProjectStore.getState().nodes;
      expect(nodes[n1].zIndex!).toBeGreaterThan(nodes[n2].zIndex!);
    });
  });

  describe('Slice 3: Frame distinct default background, auto-capture on resize & Fold/Unfold', () => {
    it('Frame has a distinct non-transparent default backgroundColor and zIndex 0', () => {
      const store = useProjectStore.getState();
      const frameId = store.addNode({
        type: 'frame',
        position: { x: 100, y: 100 },
        width: 360,
        height: 260,
        data: { title: 'My Frame', layoutMode: 'manual' },
      });

      const frame = useProjectStore.getState().nodes[frameId];
      expect(frame.data.backgroundColor).toBeTruthy();
      expect(frame.data.backgroundColor).not.toBe('transparent');
      expect(frame.data.backgroundColor).not.toBe('#ffffff');
      expect(frame.zIndex).toBe(0);
    });

    it('captureNodesInFrame automatically captures enclosed root objects and converts coordinates to relative', () => {
      const store = useProjectStore.getState();
      const frameId = store.addNode({
        type: 'frame',
        position: { x: 1000, y: 1000 },
        width: 400,
        height: 300,
        data: { title: 'Capture Frame', layoutMode: 'manual' },
      });
      const insideId = store.addNode({
        type: 'shape',
        position: { x: 1080, y: 1060 },
        width: 120,
        height: 60,
        data: { label: 'Inside', layoutMode: 'manual' },
      });
      const outsideId = store.addNode({
        type: 'shape',
        position: { x: 1700, y: 1700 },
        width: 120,
        height: 60,
        data: { label: 'Outside', layoutMode: 'manual' },
      });

      const capturedIds = useProjectStore.getState().captureNodesInFrame(frameId);
      expect(capturedIds).toEqual([insideId]);

      const state = useProjectStore.getState();
      expect(state.nodes[insideId].parentId).toBe(frameId);
      // Relative to frame (1000, 1000) -> (80, 60)
      expect(state.nodes[insideId].position).toEqual({ x: 80, y: 60 });
      expect(state.nodes[outsideId].parentId).toBeUndefined();
    });

    it('toggleFrameCollapse folds Frame to 180x44, hides children, and unfolds cleanly', () => {
      const store = useProjectStore.getState();
      const frameId = store.addNode({
        type: 'frame',
        position: { x: 100, y: 100 },
        width: 380,
        height: 280,
        data: { title: 'Foldable Frame', layoutMode: 'manual' },
      });
      const childId = store.addNode({
        type: 'shape',
        position: { x: 40, y: 60 },
        parentId: frameId,
        data: { label: 'Child', layoutMode: 'manual' },
      });

      useProjectStore.getState().toggleFrameCollapse(frameId);
      let state = useProjectStore.getState();
      expect(state.nodes[frameId].data.collapsed).toBe(true);
      expect(state.nodes[frameId].width).toBe(180);
      expect(state.nodes[frameId].height).toBe(44);
      expect(state.nodes[childId].hidden).toBe(true);

      useProjectStore.getState().toggleFrameCollapse(frameId);
      state = useProjectStore.getState();
      expect(state.nodes[frameId].data.collapsed).toBe(false);
      expect(state.nodes[frameId].width).toBe(380);
      expect(state.nodes[frameId].height).toBe(280);
      expect(state.nodes[childId].hidden).toBe(false);
    });
  });

  describe('Slice 4: Node Style (fontSize, textAlign, opacity)', () => {
    it('updates fontSize, textAlign, and opacity via store actions and resolves them for node renderers', () => {
      const store = useProjectStore.getState();
      const shapeId = store.addNode({
        type: 'shape',
        position: { x: 100, y: 100 },
        data: { label: 'Styled Shape' },
      });
      const textId = store.addNode({
        type: 'text',
        position: { x: 300, y: 100 },
        data: { label: 'Styled Text' },
      });
      const frameId = store.addNode({
        type: 'frame',
        position: { x: 500, y: 100 },
        data: { label: 'Styled Frame', title: 'Styled Frame' },
      });
      const imageId = store.addNode({
        type: 'image',
        position: { x: 700, y: 100 },
        data: { label: 'Styled Image' },
      });

      // Single-node style update
      store.updateNodeData(shapeId, {
        fontSize: 18,
        textAlign: 'right',
        opacity: 0.5,
      });

      // Batch style update across multiple node types
      store.batchUpdateNodeData([textId, frameId, imageId], {
        fontSize: 24,
        textAlign: 'center',
        opacity: 0.75,
      });

      const state = useProjectStore.getState();
      expect(resolveNodeStyle(state.nodes[shapeId].data, { fontSize: 12, textAlign: 'center' })).toEqual({
        fontSize: 18,
        textAlign: 'right',
        opacity: 0.5,
      });
      expect(resolveNodeStyle(state.nodes[textId].data, { fontSize: 14, textAlign: 'left' })).toEqual({
        fontSize: 24,
        textAlign: 'center',
        opacity: 0.75,
      });
      expect(resolveNodeStyle(state.nodes[frameId].data, { fontSize: 12, textAlign: 'left' })).toEqual({
        fontSize: 24,
        textAlign: 'center',
        opacity: 0.75,
      });
      expect(resolveNodeStyle(state.nodes[imageId].data, { fontSize: 12, textAlign: 'center' })).toEqual({
        fontSize: 24,
        textAlign: 'center',
        opacity: 0.75,
      });

      // Falls back to nested data.style when top-level keys are absent, and clamps/defaults opacity
      expect(
        resolveNodeStyle(
          { label: 'Nested', style: { fontSize: 16, textAlign: 'left', opacity: 0.25 } },
          { fontSize: 12, textAlign: 'center' }
        )
      ).toEqual({
        fontSize: 16,
        textAlign: 'left',
        opacity: 0.25,
      });

      expect(resolveNodeStyle({ label: 'Default' }, { fontSize: 12, textAlign: 'center' })).toEqual({
        fontSize: 12,
        textAlign: 'center',
        opacity: 1,
      });
    });
  });
});
