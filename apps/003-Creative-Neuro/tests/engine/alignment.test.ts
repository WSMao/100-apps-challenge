import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAlignmentPositions,
  computeDragSnap,
  computeResizeSnap,
  type AlignmentActionType,
} from '../../src/engine/index.ts';
import type { NeuroNode } from '../../src/types/index.ts';

function makeNode(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 50,
  locked = false
): NeuroNode {
  return {
    id,
    type: 'shape',
    position: { x, y },
    width,
    height,
    locked,
    data: { label: id, locked },
  };
}

describe('Alignment Engine: Manual Multi-Object Alignment & Distribution', () => {
  it('align-left aligns all unlocked nodes to the leftmost X edge', () => {
    const nodes = [
      makeNode('a', 100, 50, 80, 40),
      makeNode('b', 220, 120, 120, 60),
      makeNode('c', 160, 200, 100, 50),
    ];

    const updates = calculateAlignmentPositions(nodes, 'align-left');
    assert.deepEqual(updates, {
      b: { x: 100, y: 120 },
      c: { x: 100, y: 200 },
    });
  });

  it('align-right aligns all unlocked nodes to the rightmost X edge', () => {
    const nodes = [
      makeNode('a', 100, 50, 80, 40), // right = 180
      makeNode('b', 220, 120, 120, 60), // right = 340 (max)
      makeNode('c', 160, 200, 100, 50), // right = 260
    ];

    const updates = calculateAlignmentPositions(nodes, 'align-right');
    assert.deepEqual(updates, {
      a: { x: 260, y: 50 }, // 340 - 80
      c: { x: 240, y: 200 }, // 340 - 100
    });
  });

  it('align-center-h aligns horizontal centers to the selection horizontal midpoint', () => {
    const nodes = [
      makeNode('a', 100, 50, 100, 40), // left=100, right=200
      makeNode('b', 220, 120, 80, 60), // left=220, right=300 -> span [100, 300], center = 200
    ];

    const updates = calculateAlignmentPositions(nodes, 'align-center-h');
    assert.deepEqual(updates, {
      a: { x: 150, y: 50 }, // 200 - 100/2
      b: { x: 160, y: 120 }, // 200 - 80/2
    });
  });

  it('align-top, align-center-v, and align-bottom align along Y axis', () => {
    const nodes = [
      makeNode('a', 10, 40, 80, 40), // top=40, bottom=80
      makeNode('b', 120, 100, 80, 100), // top=100, bottom=200 -> span [40, 200], centerY=120
    ];

    assert.deepEqual(calculateAlignmentPositions(nodes, 'align-top'), {
      b: { x: 120, y: 40 },
    });
    assert.deepEqual(calculateAlignmentPositions(nodes, 'align-bottom'), {
      a: { x: 10, y: 160 }, // 200 - 40
    });
    assert.deepEqual(calculateAlignmentPositions(nodes, 'align-center-v'), {
      a: { x: 10, y: 100 }, // 120 - 20
      b: { x: 120, y: 70 }, // 120 - 50
    });
  });

  it('distribute-h spaces 3+ nodes with equal horizontal gaps between outer bounds', () => {
    const nodes = [
      makeNode('a', 0, 50, 100, 40), // [0, 100]
      makeNode('b', 110, 50, 50, 40), // middle node
      makeNode('c', 300, 50, 100, 40), // [300, 400]
    ];
    // Total span = 400 - 0 = 400; total widths = 100 + 50 + 100 = 250; gap = 150 / 2 = 75
    // b should be at 0 + 100 + 75 = 175
    const updates = calculateAlignmentPositions(nodes, 'distribute-h');
    assert.deepEqual(updates, {
      b: { x: 175, y: 50 },
    });
  });

  it('distribute-v spaces 3+ nodes with equal vertical gaps between outer bounds', () => {
    const nodes = [
      makeNode('a', 50, 0, 80, 40), // [0, 40]
      makeNode('b', 50, 200, 80, 60), // middle node
      makeNode('c', 50, 260, 80, 40), // [260, 300]
    ];
    // Total span = 300; total heights = 40 + 60 + 40 = 140; gap = 160 / 2 = 80
    // b should be at 0 + 40 + 80 = 120
    const updates = calculateAlignmentPositions(nodes, 'distribute-v');
    assert.deepEqual(updates, {
      b: { x: 50, y: 120 },
    });
  });

  it('excludes locked nodes (locked=true or data.locked=true) from movement', () => {
    const lockedAnchor = makeNode('locked-anchor', 50, 50, 100, 40, true);
    const unlocked1 = makeNode('u1', 200, 120, 100, 40, false);
    const unlocked2 = {
      ...makeNode('u2', 300, 180, 100, 40, false),
      locked: false,
      data: { label: 'u2', locked: true },
    };

    const updates = calculateAlignmentPositions(
      [lockedAnchor, unlocked1, unlocked2],
      'align-left'
    );
    assert.equal(updates['locked-anchor'], undefined);
    assert.equal(updates['u2'], undefined);
    assert.deepEqual(updates['u1'], { x: 50, y: 120 });
  });

  it('returns empty map when fewer than 2 nodes for align or fewer than 3 for distribute', () => {
    const single = [makeNode('a', 10, 20)];
    assert.deepEqual(calculateAlignmentPositions(single, 'align-left'), {});
    const two = [makeNode('a', 10, 20), makeNode('b', 100, 20)];
    assert.deepEqual(calculateAlignmentPositions(two, 'distribute-h'), {});
    assert.deepEqual(calculateAlignmentPositions(two, 'distribute-v'), {});
  });
});

describe('Alignment Engine: Live Drag & Resize Auto-Snapping + Guides', () => {
  it('computeDragSnap snaps to nearby object left/right/center edge and emits vertical guide', () => {
    const other = { id: 'other', x: 105, y: 200, width: 100, height: 60 }; // left=105, center=155, right=205
    // Dragging node near x=102 (within 6px of 105), y=53 (not near other y)
    const res = computeDragSnap(
      { x: 102, y: 53, width: 80, height: 40 },
      [other],
      { snapThreshold: 6, gridSize: 16 }
    );

    assert.equal(res.x, 105);
    // y=53 falls back to 16px grid -> 48
    assert.equal(res.y, 48);
    assert.equal(res.guides.length, 1);
    assert.equal(res.guides[0].orientation, 'vertical');
    assert.equal(res.guides[0].position, 105);
    assert.equal(res.guides[0].start, 48);
    assert.equal(res.guides[0].end, 260);
    assert.equal(res.guides[0].kind, 'edge');
  });

  it('computeDragSnap snaps center-to-center and emits center guide', () => {
    const other = { id: 'other', x: 100, y: 300, width: 100, height: 60 }; // centerX=150, centerY=330
    // Dragging node width=80 -> centerX at x + 40; if x = 108, centerX = 148 (within 6px of 150)
    const res = computeDragSnap(
      { x: 108, y: 307, width: 80, height: 40 }, // centerY = 327 (within 6px of 330)
      [other],
      { snapThreshold: 6, gridSize: 16 }
    );

    assert.equal(res.x, 110); // 150 - 40
    assert.equal(res.y, 310); // 330 - 20
    assert.equal(res.guides.length, 2);
    const vGuide = res.guides.find((g) => g.orientation === 'vertical');
    const hGuide = res.guides.find((g) => g.orientation === 'horizontal');
    assert.ok(vGuide);
    assert.equal(vGuide.position, 150);
    assert.equal(vGuide.kind, 'center');
    assert.ok(hGuide);
    assert.equal(hGuide.position, 330);
    assert.equal(hGuide.kind, 'center');
  });

  it('computeDragSnap falls back to 16px grid when no object is within threshold', () => {
    const other = { id: 'other', x: 500, y: 500, width: 100, height: 60 };
    const res = computeDragSnap(
      { x: 38, y: 74, width: 80, height: 40 },
      [other],
      { snapThreshold: 6, gridSize: 16 }
    );

    assert.equal(res.x, 32);
    assert.equal(res.y, 80);
    assert.deepEqual(res.guides, []);
  });

  it('computeResizeSnap snaps east/south edges to nearby object edges and emits guides', () => {
    const other = { id: 'other', x: 305, y: 215, width: 100, height: 60 };
    // Resizing 'se' corner: x=100, y=100, width=202 (right=302, within 6px of 305), height=113 (bottom=213, within 6px of 215)
    const res = computeResizeSnap(
      { x: 100, y: 100, width: 202, height: 113 },
      'se',
      [other],
      { minWidth: 60, minHeight: 36 },
      { snapThreshold: 6, gridSize: 16 }
    );

    assert.deepEqual(res.bounds, { x: 100, y: 100, width: 205, height: 115 });
    assert.equal(res.guides.length, 2);
    assert.ok(res.guides.some((g) => g.orientation === 'vertical' && g.position === 305));
    assert.ok(res.guides.some((g) => g.orientation === 'horizontal' && g.position === 215));
  });

  it('computeResizeSnap snaps west/north edges while keeping opposite anchor fixed', () => {
    const other = { id: 'other', x: 53, y: 45, width: 100, height: 60 };
    // Resizing 'nw': proposed x=55 (within 6px of 53), right anchor = 55+100=155 -> new width = 102
    // proposed y=48 (within 6px of 45), bottom anchor = 48+80=128 -> new height = 83
    const res = computeResizeSnap(
      { x: 55, y: 48, width: 100, height: 80 },
      'nw',
      [other],
      { minWidth: 60, minHeight: 36 },
      { snapThreshold: 6, gridSize: 16 }
    );

    assert.deepEqual(res.bounds, { x: 53, y: 45, width: 102, height: 83 });
    assert.equal(res.guides.length, 2);
  });
});
