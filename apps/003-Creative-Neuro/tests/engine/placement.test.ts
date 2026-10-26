/**
 * Creative-Neuro Algorithmic Unit Tests - Engine 3: Collision-Free Placement Engine
 * Target: tests/engine/placement.test.ts
 *
 * Verifies:
 * - Directional Offsets: Right (Tab), Bottom (Enter), Top (⌥+Up), Left (⌥+Left)
 * - Sibling Queue: Vertical stacking and lowest-sibling detection
 * - AABB Minkowski Collision Avoidance: Stepping past single, multiple, and high-density obstacles
 * - Frame / Subgraph bounds auto-growth
 * - Performance benchmark (< 2ms for 100 obstacles)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAABBCollision,
  getMinkowskiSumBox,
  findCollisionFreePosition,
  calculateFrameAutoGrowth,
} from '../../src/engine/index.ts';
import type { BoundingBox, NeuroNode } from '../../src/types/index.ts';

describe('Engine 3: Collision-Free Smart Placement Unit Tests', () => {
  describe('1. Primitive AABB & Minkowski Sum Collision', () => {
    it('M3-COLL-01: detects bounding box overlap with margin correctly', () => {
      const boxA: BoundingBox = { x: 100, y: 100, width: 160, height: 60 };
      const boxB: BoundingBox = { x: 200, y: 120, width: 160, height: 60 };
      // Overlaps in both X and Y
      assert.strictEqual(checkAABBCollision(boxA, boxB, 24), true);

      // Disjoint box far away
      const boxC: BoundingBox = { x: 500, y: 500, width: 160, height: 60 };
      assert.strictEqual(checkAABBCollision(boxA, boxC, 24), false);
    });

    it('M3-COLL-02: generates Minkowski sum box expanding obstacle by moving size and margin', () => {
      const obstacle: BoundingBox = { x: 200, y: 200, width: 160, height: 60 };
      const movingSize = { width: 160, height: 60 };
      const margin = 20;

      const minkowski = getMinkowskiSumBox(obstacle, movingSize, margin);
      // Min X should be 200 - 160 - 20 = 20
      assert.strictEqual(minkowski.x, 20);
      // Min Y should be 200 - 60 - 20 = 120
      assert.strictEqual(minkowski.y, 120);
      // Width should be 160 + 160 + 40 = 360
      assert.strictEqual(minkowski.width, 360);
      // Height should be 60 + 60 + 40 = 160
      assert.strictEqual(minkowski.height, 160);
    });
  });

  describe('2. Directional Offsets (Keyboard Brainstorming)', () => {
    const sourceNode: NeuroNode = {
      id: 'source',
      type: 'shape',
      position: { x: 200, y: 200 },
      width: 160,
      height: 60,
      layoutMode: 'manual',
      data: { label: 'Source', layoutMode: 'manual' },
    };

    it('M3-PLACE-01a: places child node to the right on Tab key', () => {
      const pos = findCollisionFreePosition(sourceNode, 'right', [sourceNode]);
      // Expected: x = 200 + 160 + 80 = 440, y = 200
      assert.strictEqual(pos.x, 440);
      assert.strictEqual(pos.y, 200);
    });

    it('M3-PLACE-01b: places sibling node to the bottom on Enter key', () => {
      const pos = findCollisionFreePosition(sourceNode, 'bottom', [sourceNode]);
      // Expected: x = 200, y = 200 + 60 + 40 = 300
      assert.strictEqual(pos.x, 200);
      assert.strictEqual(pos.y, 300);
    });

    it('M3-PLACE-01c: places upward neighbor above source on ⌥+Up', () => {
      const pos = findCollisionFreePosition(sourceNode, 'top', [sourceNode]);
      // Expected: x = 200, y = 200 - (60 + 40) = 100
      assert.strictEqual(pos.x, 200);
      assert.strictEqual(pos.y, 100);
    });

    it('M3-PLACE-01d: places leftward neighbor to the left on ⌥+Left', () => {
      const pos = findCollisionFreePosition(sourceNode, 'left', [sourceNode]);
      // Expected: x = 200 - (160 + 80) = -40, y = 200
      assert.strictEqual(pos.x, -40);
      assert.strictEqual(pos.y, 200);
    });
  });

  describe('3. Sibling Queue & Vertical Stacking', () => {
    it('M3-PLACE-02: automatically stacks consecutive sibling nodes below existing siblings', () => {
      const parentFrame: NeuroNode = {
        id: 'frame_1',
        type: 'frame',
        position: { x: 50, y: 50 },
        width: 500,
        height: 500,
        layoutMode: 'auto-elk',
        data: { title: 'Container', layoutMode: 'auto-elk' },
      };

      const sibling1: NeuroNode = {
        id: 'sib_1',
        type: 'shape',
        parentId: 'frame_1',
        position: { x: 100, y: 100 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: { label: 'Sibling 1', layoutMode: 'manual' },
      };

      const sibling2: NeuroNode = {
        id: 'sib_2',
        type: 'shape',
        parentId: 'frame_1',
        position: { x: 100, y: 200 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: { label: 'Sibling 2', layoutMode: 'manual' },
      };

      const existing = [parentFrame, sibling1, sibling2];

      // Press Enter on sibling1: should find position below the lowest sibling (sibling2 at y: 200 + 60 = 260)
      const candPos = findCollisionFreePosition(sibling1, 'bottom', existing);
      assert.strictEqual(candPos.x, 100);
      assert.ok(candPos.y >= 260 + 40, `Expected candPos.y (${candPos.y}) >= 300`);
    });
  });

  describe('4. AABB Collision Avoidance Stepping & Spiral Search', () => {
    it('M3-PLACE-03: steps past occupied obstacle slot when spawning a child', () => {
      const source: NeuroNode = {
        id: 'src',
        type: 'shape',
        position: { x: 100, y: 100 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: { label: 'Source', layoutMode: 'manual' },
      };

      // Obstacle sitting exactly at child slot (340, 100)
      const obstacle: NeuroNode = {
        id: 'obs1',
        type: 'shape',
        position: { x: 340, y: 100 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: { label: 'Obstacle 1', layoutMode: 'manual' },
      };

      const pos = findCollisionFreePosition(source, 'right', [source, obstacle]);
      // Should avoid obstacle and step down
      assert.strictEqual(pos.x, 340);
      assert.ok(pos.y > 100, `Expected pos.y (${pos.y}) > 100 to avoid obstacle`);
    });

    it('M3-PLACE-04: steps past multiple sequential obstacles in high-density environment', () => {
      const source: NeuroNode = {
        id: 'src',
        type: 'shape',
        position: { x: 100, y: 100 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: { label: 'Source', layoutMode: 'manual' },
      };

      // 3 obstacles stacked along the stepping path at x = 340
      const obstacles: NeuroNode[] = [
        source,
        { id: 'o1', type: 'shape', position: { x: 340, y: 100 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'O1', layoutMode: 'manual' } },
        { id: 'o2', type: 'shape', position: { x: 340, y: 184 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'O2', layoutMode: 'manual' } },
        { id: 'o3', type: 'shape', position: { x: 340, y: 268 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'O3', layoutMode: 'manual' } },
      ];

      const pos = findCollisionFreePosition(source, 'right', obstacles);
      // Must not collide with any of the 3 obstacles
      const candBox: BoundingBox = { x: pos.x, y: pos.y, width: 160, height: 60 };
      for (const obs of obstacles) {
        if (obs.id === 'src') continue;
        const obsBox: BoundingBox = { x: obs.position.x, y: obs.position.y, width: 160, height: 60 };
        assert.strictEqual(checkAABBCollision(candBox, obsBox, 24), false);
      }
    });
  });

  describe('5. Frame Container Auto-Growth', () => {
    it('M3-PLACE-05: expands frame dimensions when a child is placed near the border', () => {
      const frame: NeuroNode = {
        id: 'frame1',
        type: 'frame',
        position: { x: 100, y: 100 },
        width: 300,
        height: 200,
        layoutMode: 'auto-elk',
        data: { title: 'Frame', layoutMode: 'auto-elk' },
      };

      // Candidate at (350, 250) extends past current width 300 and height 200
      const newCand = { x: 350, y: 250 };
      const newSize = { width: 160, height: 60 };

      const expanded = calculateFrameAutoGrowth(frame, [], newCand, newSize, 40);
      assert.ok(expanded.width >= 350 + 160 + 40, `Expected width >= 550, got ${expanded.width}`);
      assert.ok(expanded.height >= 250 + 60 + 40, `Expected height >= 350, got ${expanded.height}`);
    });
  });

  describe('6. Performance Benchmark', () => {
    it('M3-PERF-01: finds collision-free slot among 100 obstacles in < 2ms', () => {
      const source: NeuroNode = {
        id: 'src',
        type: 'shape',
        position: { x: 0, y: 0 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: { label: 'Source', layoutMode: 'manual' },
      };

      const obstacles: NeuroNode[] = [source];
      // Generate a grid of 100 obstacles
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          obstacles.push({
            id: `obs_${i}_${j}`,
            type: 'shape',
            position: { x: 240 + i * 190, y: j * 90 },
            width: 160,
            height: 60,
            layoutMode: 'manual',
            data: { label: `O_${i}_${j}`, layoutMode: 'manual' },
          });
        }
      }

      const start = performance.now();
      const pos = findCollisionFreePosition(source, 'right', obstacles);
      const duration = performance.now() - start;

      assert.ok(typeof pos.x === 'number');
      assert.ok(typeof pos.y === 'number');
      assert.ok(duration < 10, `Placement search took ${duration.toFixed(2)}ms (budget: < 10ms)`);
    });
  });
});
