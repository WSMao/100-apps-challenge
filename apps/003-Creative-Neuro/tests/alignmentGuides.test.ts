import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/store/useProjectStore.ts';

describe('Store Integration: Multi-Object Alignment & Alignment Guides', () => {
  beforeEach(() => {
    useProjectStore.getState().resetToSeed();
    useProjectStore.temporal.getState().clear();
  });

  it('alignSelectedNodes aligns unlocked nodes atomically in a single undo step and skips locked nodes', () => {
    const store = useProjectStore.getState();
    const id1 = store.addNode({
      type: 'shape',
      position: { x: 100, y: 100 },
      width: 100,
      height: 50,
      locked: true,
      data: { label: 'Locked Anchor', locked: true },
    });
    const id2 = store.addNode({
      type: 'shape',
      position: { x: 260, y: 200 },
      width: 120,
      height: 60,
      data: { label: 'Unlocked 1' },
    });
    const id3 = store.addNode({
      type: 'shape',
      position: { x: 400, y: 320 },
      width: 80,
      height: 40,
      data: { label: 'Unlocked 2' },
    });

    store.setSelectedNodes([id1, id2, id3]);
    const pastBefore = useProjectStore.temporal.getState().pastStates.length;

    useProjectStore.getState().alignSelectedNodes('align-left');

    const after = useProjectStore.getState();
    // Locked anchor stays at x=100; unlocked nodes align to x=100
    expect(after.nodes[id1].position).toEqual({ x: 100, y: 100 });
    expect(after.nodes[id2].position).toEqual({ x: 100, y: 200 });
    expect(after.nodes[id3].position).toEqual({ x: 100, y: 320 });

    // Single atomic undo entry
    const pastAfter = useProjectStore.temporal.getState().pastStates.length;
    expect(pastAfter).toBe(pastBefore + 1);

    // Undo restores both unlocked nodes simultaneously
    useProjectStore.getState().undo();
    const undone = useProjectStore.getState();
    expect(undone.nodes[id2].position).toEqual({ x: 260, y: 200 });
    expect(undone.nodes[id3].position).toEqual({ x: 400, y: 320 });

    // Redo reapplies alignment
    useProjectStore.getState().redo();
    const redone = useProjectStore.getState();
    expect(redone.nodes[id2].position).toEqual({ x: 100, y: 200 });
    expect(redone.nodes[id3].position).toEqual({ x: 100, y: 320 });
  });

  it('setAlignmentGuides and clearAlignmentGuides are ephemeral and do not pollute Zundo history', () => {
    const pastBefore = useProjectStore.temporal.getState().pastStates.length;
    const futureBefore = useProjectStore.temporal.getState().futureStates.length;

    useProjectStore.getState().setAlignmentGuides([
      { orientation: 'vertical', position: 100, start: 50, end: 250, kind: 'edge' },
    ]);
    expect(useProjectStore.getState().alignmentGuides).toHaveLength(1);

    useProjectStore.getState().clearAlignmentGuides();
    expect(useProjectStore.getState().alignmentGuides).toEqual([]);

    expect(useProjectStore.temporal.getState().pastStates.length).toBe(pastBefore);
    expect(useProjectStore.temporal.getState().futureStates.length).toBe(futureBefore);
  });
});
