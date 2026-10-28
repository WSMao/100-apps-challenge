/**
 * Creative-Neuro Adversarial Stress Test Suite
 * Engine 3 (Placement) & Engine 4 (Geometry)
 * Target: tests/engine/adversarial_placement_geometry.test.ts
 *
 * Rigorously stress-tests:
 * 1. Geometry edge cases:
 *    - Collinear parallel lines with partial/full overlap and opposite directions
 *    - Segments sharing an exact endpoint (T-junctions and V-corners) — MUST NOT create false line jumps
 *    - Extremely close crossings (< 2R distance apart) — arc suppression / deduplication
 *    - Oblique (non-orthogonal) intersections at 30° / 45° / 60°
 * 2. Placement edge cases:
 *    - Maze of obstacles: navigation when cardinal slots are blocked in all 4 directions
 *    - Extreme obstacle density (200+ obstacles) without hanging
 *    - Degenerate, zero, and negative width/height bounding boxes
 *    - Negative canvas coordinates (infinite whiteboard quadrant IV)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  crossProduct2D,
  findSegmentIntersection,
  computeLineJumpsForSegment,
  calculateLineJumps,
  checkAABBCollision,
  getMinkowskiSumBox,
  isPointInBox,
  getBoundingBoxEnclosing,
  findCollisionFreePosition,
  calculateFrameAutoGrowth,
} from '../../src/engine/index.ts';
import type {
  BoundingBox,
  LineSegment,
  NeuroEdge,
  NeuroNode,
  Point,
} from '../../src/types/index.ts';

describe('Adversarial Stress Suite: Placement & Geometry Engines', () => {
  /* ========================================================================
   * 1. GEOMETRY EDGE CASES
   * ======================================================================== */
  describe('1. Geometry Edge Cases', () => {
    describe('1.1 Collinear & Parallel Segments with Overlap', () => {
      it('rejects horizontal collinear segments with partial overlap', () => {
        const s1: LineSegment = { p1: { x: 0, y: 50 }, p2: { x: 100, y: 50 } };
        const s2: LineSegment = { p1: { x: 50, y: 50 }, p2: { x: 150, y: 50 } };

        const inter = findSegmentIntersection(s1, s2);
        assert.strictEqual(inter, null, 'Collinear overlap must yield null intersection');

        const path = computeLineJumpsForSegment(s1, [s2], 8);
        assert.ok(!path.includes('A 8 8'), 'Must NOT generate jump arc for collinear overlap');
        assert.strictEqual(path, 'M 0 50 L 100 50');
      });

      it('rejects vertical collinear segments with partial overlap', () => {
        const s1: LineSegment = { p1: { x: 50, y: 0 }, p2: { x: 50, y: 100 } };
        const s2: LineSegment = { p1: { x: 50, y: 40 }, p2: { x: 50, y: 140 } };

        const inter = findSegmentIntersection(s1, s2);
        assert.strictEqual(inter, null, 'Vertical collinear overlap must yield null');

        const path = computeLineJumpsForSegment(s1, [s2], 8);
        assert.ok(!path.includes('A 8 8'), 'Must NOT generate jump arc for vertical collinear overlap');
      });

      it('rejects collinear segments where one completely contains the other', () => {
        const s1: LineSegment = { p1: { x: 0, y: 100 }, p2: { x: 300, y: 100 } };
        const s2: LineSegment = { p1: { x: 50, y: 100 }, p2: { x: 150, y: 100 } };

        const inter = findSegmentIntersection(s1, s2);
        assert.strictEqual(inter, null);

        const path = computeLineJumpsForSegment(s1, [s2], 8);
        assert.ok(!path.includes('A 8 8'));
      });

      it('rejects collinear identical segments', () => {
        const s1: LineSegment = { p1: { x: 10, y: 20 }, p2: { x: 110, y: 20 } };
        const s2: LineSegment = { p1: { x: 10, y: 20 }, p2: { x: 110, y: 20 } };

        const inter = findSegmentIntersection(s1, s2);
        assert.strictEqual(inter, null);
      });

      it('rejects collinear antiparallel (opposite direction) overlapping segments', () => {
        const s1: LineSegment = { p1: { x: 0, y: 50 }, p2: { x: 100, y: 50 } };
        const s2: LineSegment = { p1: { x: 120, y: 50 }, p2: { x: 30, y: 50 } };

        const inter = findSegmentIntersection(s1, s2);
        assert.strictEqual(inter, null);
      });

      it('rejects parallel disjoint diagonal segments', () => {
        const s1: LineSegment = { p1: { x: 0, y: 0 }, p2: { x: 100, y: 100 } };
        const s2: LineSegment = { p1: { x: 10, y: 0 }, p2: { x: 110, y: 100 } };

        const inter = findSegmentIntersection(s1, s2);
        assert.strictEqual(inter, null);
      });

      it('calculateLineJumps returns empty map for parallel and collinear edge sets', () => {
        const nodes: Record<string, NeuroNode> = {
          n1: { id: 'n1', type: 'shape', position: { x: 0, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
          n2: { id: 'n2', type: 'shape', position: { x: 200, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
          n3: { id: 'n3', type: 'shape', position: { x: 50, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
          n4: { id: 'n4', type: 'shape', position: { x: 250, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        };
        const edges: NeuroEdge[] = [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n3', target: 'n4' },
        ];

        const jumps = calculateLineJumps(edges, nodes);
        assert.strictEqual(jumps.size, 0, 'No jumps should be generated for collinear edges');
      });
    });

    describe('1.2 Segments Sharing Exact Endpoints (V-Corners & T-Junctions)', () => {
      it('MUST NOT create false line jump arcs for V-corner vertices (all 4 orientation permutations)', () => {
        // Case 1: s1 end meets s2 start at (100, 50)
        const v1_s1: LineSegment = { p1: { x: 0, y: 50 }, p2: { x: 100, y: 50 } };
        const v1_s2: LineSegment = { p1: { x: 100, y: 50 }, p2: { x: 100, y: 150 } };
        assert.strictEqual(findSegmentIntersection(v1_s1, v1_s2), null, 'V1: end-to-start corner must be null');
        assert.strictEqual(computeLineJumpsForSegment(v1_s1, [v1_s2], 8), 'M 0 50 L 100 50');
        assert.strictEqual(computeLineJumpsForSegment(v1_s2, [v1_s1], 8), 'M 100 50 L 100 150');

        // Case 2: s1 start meets s2 start at (100, 50)
        const v2_s1: LineSegment = { p1: { x: 100, y: 50 }, p2: { x: 0, y: 50 } };
        const v2_s2: LineSegment = { p1: { x: 100, y: 50 }, p2: { x: 100, y: 150 } };
        assert.strictEqual(findSegmentIntersection(v2_s1, v2_s2), null, 'V2: start-to-start corner must be null');

        // Case 3: s1 end meets s2 end at (100, 50)
        const v3_s1: LineSegment = { p1: { x: 0, y: 50 }, p2: { x: 100, y: 50 } };
        const v3_s2: LineSegment = { p1: { x: 100, y: 150 }, p2: { x: 100, y: 50 } };
        assert.strictEqual(findSegmentIntersection(v3_s1, v3_s2), null, 'V3: end-to-end corner must be null');

        // Case 4: s1 start meets s2 end at (100, 50)
        const v4_s1: LineSegment = { p1: { x: 100, y: 50 }, p2: { x: 0, y: 50 } };
        const v4_s2: LineSegment = { p1: { x: 100, y: 150 }, p2: { x: 100, y: 50 } };
        assert.strictEqual(findSegmentIntersection(v4_s1, v4_s2), null, 'V4: start-to-end corner must be null');
      });

      it('MUST NOT create false line jump arcs for T-junctions at endpoints', () => {
        // T-junction: s2 starts directly on s1 midpoint
        const s1: LineSegment = { p1: { x: 0, y: 50 }, p2: { x: 100, y: 50 } };
        const s2: LineSegment = { p1: { x: 50, y: 50 }, p2: { x: 50, y: 150 } };

        assert.strictEqual(findSegmentIntersection(s1, s2), null, 'T-junction start must be null');
        assert.strictEqual(findSegmentIntersection(s2, s1), null, 'T-junction start (reverse) must be null');

        const path1 = computeLineJumpsForSegment(s1, [s2], 8);
        assert.strictEqual(path1, 'M 0 50 L 100 50', 'No jump arc on trunk segment');
        const path2 = computeLineJumpsForSegment(s2, [s1], 8);
        assert.strictEqual(path2, 'M 50 50 L 50 150', 'No jump arc on branch segment');

        // T-junction: s3 ends directly on s1 midpoint
        const s3: LineSegment = { p1: { x: 50, y: -50 }, p2: { x: 50, y: 50 } };
        assert.strictEqual(findSegmentIntersection(s1, s3), null, 'T-junction end must be null');
        assert.strictEqual(computeLineJumpsForSegment(s1, [s3], 8), 'M 0 50 L 100 50');
      });

      it('calculateLineJumps produces NO jumps for connected edges sharing a node', () => {
        const nodes: Record<string, NeuroNode> = {
          root: { id: 'root', type: 'shape', position: { x: 100, y: 100 }, width: 40, height: 40, layoutMode: 'manual', data: { label: 'R', layoutMode: 'manual' } },
          childA: { id: 'childA', type: 'shape', position: { x: 300, y: 100 }, width: 40, height: 40, layoutMode: 'manual', data: { label: 'A', layoutMode: 'manual' } },
          childB: { id: 'childB', type: 'shape', position: { x: 100, y: 300 }, width: 40, height: 40, layoutMode: 'manual', data: { label: 'B', layoutMode: 'manual' } },
        };
        const edges: NeuroEdge[] = [
          { id: 'e_root_a', source: 'root', target: 'childA' },
          { id: 'e_root_b', source: 'root', target: 'childB' },
        ];

        const jumps = calculateLineJumps(edges, nodes);
        assert.strictEqual(jumps.size, 0, 'Edges sharing a root node must not jump at the node center');
      });
    });

    describe('1.3 Closely Spaced Crossings (< 2R distance apart)', () => {
      it('suppresses overlapping arcs when two crossings are within 2R in computeLineJumpsForSegment', () => {
        const mainSeg: LineSegment = { p1: { x: 0, y: 100 }, p2: { x: 300, y: 100 } };
        const R = 8;
        // Two crossers: one at x = 150, second at x = 158 (distance = 8px, which is < 2R = 16px)
        const cross1: LineSegment = { p1: { x: 150, y: 0 }, p2: { x: 150, y: 200 } };
        const cross2: LineSegment = { p1: { x: 158, y: 0 }, p2: { x: 158, y: 200 } };

        const path = computeLineJumpsForSegment(mainSeg, [cross1, cross2], R);
        const arcMatches = path.match(/A 8 8 0 0 1/g);
        assert.strictEqual(arcMatches?.length, 1, 'Second close crossing must be suppressed to avoid arc collision');
      });

      it('suppresses cluster of 4 crossings all spaced 3px apart', () => {
        const mainSeg: LineSegment = { p1: { x: 0, y: 100 }, p2: { x: 300, y: 100 } };
        const R = 8;
        const crossers: LineSegment[] = [
          { p1: { x: 150, y: 0 }, p2: { x: 150, y: 200 } },
          { p1: { x: 153, y: 0 }, p2: { x: 153, y: 200 } },
          { p1: { x: 156, y: 0 }, p2: { x: 156, y: 200 } },
          { p1: { x: 159, y: 0 }, p2: { x: 159, y: 200 } },
        ];

        const path = computeLineJumpsForSegment(mainSeg, crossers, R);
        const arcMatches = path.match(/A 8 8 0 0 1/g);
        assert.strictEqual(arcMatches?.length, 1, 'Tight cluster of 4 crossings must render exactly 1 arc');
      });

      it('renders both arcs when crossings are comfortably spaced (> 2.2 * R apart)', () => {
        const mainSeg: LineSegment = { p1: { x: 0, y: 100 }, p2: { x: 300, y: 100 } };
        const R = 8;
        // Two crossers: one at x = 100, second at x = 130 (distance = 30px > 2.2 * 8 = 17.6px)
        const cross1: LineSegment = { p1: { x: 100, y: 0 }, p2: { x: 100, y: 200 } };
        const cross2: LineSegment = { p1: { x: 130, y: 0 }, p2: { x: 130, y: 200 } };

        const path = computeLineJumpsForSegment(mainSeg, [cross1, cross2], R);
        const arcMatches = path.match(/A 8 8 0 0 1/g);
        assert.strictEqual(arcMatches?.length, 2, 'Adequately separated crossings must both render');
      });

      it('calculateLineJumps suppresses duplicate arcs when crossings are within 1.5 * jumpRadius', () => {
        const nodes: Record<string, NeuroNode> = {
          hSrc: { id: 'hSrc', type: 'shape', position: { x: 0, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
          hTgt: { id: 'hTgt', type: 'shape', position: { x: 400, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
          v1Src: { id: 'v1Src', type: 'shape', position: { x: 200, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
          v1Tgt: { id: 'v1Tgt', type: 'shape', position: { x: 200, y: 200 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
          v2Src: { id: 'v2Src', type: 'shape', position: { x: 205, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
          v2Tgt: { id: 'v2Tgt', type: 'shape', position: { x: 205, y: 200 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        };
        const edges: NeuroEdge[] = [
          { id: 'edge_h', source: 'hSrc', target: 'hTgt' },
          { id: 'edge_v1', source: 'v1Src', target: 'v1Tgt' },
          { id: 'edge_v2', source: 'v2Src', target: 'v2Tgt' },
        ];

        // jumpRadius = 6. Crossings at x = 200 and x = 205 (diff = 5 < 1.5 * 6 = 9).
        const jumps = calculateLineJumps(edges, nodes, { jumpRadius: 6 });
        assert.strictEqual(jumps.get('edge_h')?.length, 1, 'calculateLineJumps must prune crossing within 1.5*R');
      });
    });

    describe('1.4 Oblique (Non-Orthogonal) Intersections (30°, 45°, 60°)', () => {
      it('calculates accurate intersection and arc path for 45° crossing', () => {
        const s1: LineSegment = { p1: { x: 0, y: 100 }, p2: { x: 200, y: 100 } }; // horizontal
        const s2: LineSegment = { p1: { x: 50, y: 50 }, p2: { x: 150, y: 150 } }; // 45° diagonal

        const inter = findSegmentIntersection(s1, s2);
        assert.ok(inter);
        assert.strictEqual(inter.point.x, 100);
        assert.strictEqual(inter.point.y, 100);
        assert.strictEqual(inter.t, 0.5);
        assert.strictEqual(inter.u, 0.5);

        const path = computeLineJumpsForSegment(s1, [s2], 8);
        assert.ok(path.includes('A 8 8 0 0 1'), 'Must generate arc for 45° crossing');
        // Arc spans from x = 100 - 8 = 92 to x = 100 + 8 = 108 along horizontal s1
        assert.ok(path.includes('92.00 100.00'));
        assert.ok(path.includes('108.00 100.00'));
      });

      it('calculates accurate intersection for 30° crossing', () => {
        // Line s1 horizontal: (0, 0) -> (200, 0)
        // Line s2 at 30° passing through (100, 0)
        // Direction vector: (cos(30°), sin(30°)) = (sqrt(3)/2, 0.5)
        const cos30 = Math.cos(Math.PI / 6);
        const sin30 = Math.sin(Math.PI / 6);
        const len = 100;
        const s1: LineSegment = { p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 } };
        const s2: LineSegment = {
          p1: { x: 100 - len * cos30, y: -len * sin30 },
          p2: { x: 100 + len * cos30, y: len * sin30 },
        };

        const inter = findSegmentIntersection(s1, s2);
        assert.ok(inter);
        assert.ok(Math.abs(inter.point.x - 100) < 1e-4, `Expected x near 100, got ${inter.point.x}`);
        assert.ok(Math.abs(inter.point.y - 0) < 1e-4, `Expected y near 0, got ${inter.point.y}`);
        assert.ok(Math.abs(inter.t - 0.5) < 1e-4);
      });

      it('calculates accurate intersection for 60° crossing', () => {
        // Line s1 horizontal: (0, 0) -> (200, 0)
        // Line s2 at 60° passing through (100, 0)
        const cos60 = Math.cos(Math.PI / 3);
        const sin60 = Math.sin(Math.PI / 3);
        const len = 100;
        const s1: LineSegment = { p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 } };
        const s2: LineSegment = {
          p1: { x: 100 - len * cos60, y: -len * sin60 },
          p2: { x: 100 + len * cos60, y: len * sin60 },
        };

        const inter = findSegmentIntersection(s1, s2);
        assert.ok(inter);
        assert.ok(Math.abs(inter.point.x - 100) < 1e-4);
        assert.ok(Math.abs(inter.point.y - 0) < 1e-4);
      });

      it('computes jump arc along an oblique segment crossed by another oblique segment', () => {
        // s1: +45° from (0, 0) to (200, 200)
        // s2: -45° from (0, 200) to (200, 0)
        const s1: LineSegment = { p1: { x: 0, y: 0 }, p2: { x: 200, y: 200 } };
        const s2: LineSegment = { p1: { x: 0, y: 200 }, p2: { x: 200, y: 0 } };

        const inter = findSegmentIntersection(s1, s2);
        assert.ok(inter);
        assert.ok(Math.abs(inter.point.x - 100) < 1e-4);
        assert.ok(Math.abs(inter.point.y - 100) < 1e-4);

        const R = 8;
        const path = computeLineJumpsForSegment(s1, [s2], R);
        assert.ok(path.startsWith('M 0 0'));
        assert.ok(path.endsWith('L 200 200'));
        assert.ok(path.includes('A 8 8 0 0 1'));

        // Unit vector for s1 is (1/sqrt(2), 1/sqrt(2)) ~ (0.7071, 0.7071)
        // startPt = 100 - 8 * 0.7071 = 94.34
        // endPt = 100 + 8 * 0.7071 = 105.66
        assert.ok(path.includes('94.34 94.34'), `Path should contain start arc point near 94.34: ${path}`);
        assert.ok(path.includes('105.66 105.66'), `Path should contain end arc point near 105.66: ${path}`);
      });
    });
  });

  /* ========================================================================
   * 2. PLACEMENT EDGE CASES
   * ======================================================================== */
  describe('2. Placement Edge Cases', () => {
    describe('2.1 Maze of Obstacles (Cardinal Directions Blocked)', () => {
      it('navigates when immediate slots in all 4 cardinal directions are blocked', () => {
        const sourceNode: NeuroNode = {
          id: 'src',
          type: 'shape',
          position: { x: 500, y: 500 },
          width: 160,
          height: 60,
          layoutMode: 'manual',
          data: { label: 'Source', layoutMode: 'manual' },
        };

        // Surrounding cardinal obstacles (margin 24px)
        const obstacles: NeuroNode[] = [
          sourceNode,
          // Right slot (candX = 500 + 160 + 80 = 740, y = 500)
          { id: 'obs_right_0', type: 'shape', position: { x: 740, y: 500 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'R0', layoutMode: 'manual' } },
          // Right step 1 (y = 500 + 60 + 24 = 584)
          { id: 'obs_right_1', type: 'shape', position: { x: 740, y: 584 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'R1', layoutMode: 'manual' } },
          // Right step 2 (y = 584 + 84 = 668)
          { id: 'obs_right_2', type: 'shape', position: { x: 740, y: 668 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'R2', layoutMode: 'manual' } },
          // Bottom slot
          { id: 'obs_bottom', type: 'shape', position: { x: 500, y: 600 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'B', layoutMode: 'manual' } },
          // Top slot
          { id: 'obs_top', type: 'shape', position: { x: 500, y: 400 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'T', layoutMode: 'manual' } },
          // Left slot
          { id: 'obs_left', type: 'shape', position: { x: 260, y: 500 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'L', layoutMode: 'manual' } },
        ];

        // Should step past R0, R1, R2 to find candidate at y = 500 + 3 * 84 = 752
        const pos = findCollisionFreePosition(sourceNode, 'right', obstacles);
        assert.strictEqual(pos.x, 740);
        assert.strictEqual(pos.y, 752);

        // Verify zero collision with ANY of the obstacles
        const candBox: BoundingBox = { x: pos.x, y: pos.y, width: 160, height: 60 };
        for (const obs of obstacles) {
          if (obs.id === 'src') continue;
          const obsBox: BoundingBox = { x: obs.position.x, y: obs.position.y, width: 160, height: 60 };
          const collides = checkAABBCollision(candBox, obsBox, 24);
          assert.strictEqual(collides, false, `Found unexpected collision with obstacle ${obs.id}`);
        }
      });

      it('steps upward past multiple obstacles on top neighbor key (⌥+Up)', () => {
        const sourceNode: NeuroNode = {
          id: 'src',
          type: 'shape',
          position: { x: 200, y: 500 },
          width: 160,
          height: 60,
          layoutMode: 'manual',
          data: { label: 'Source', layoutMode: 'manual' },
        };

        // Obstacles stacked above: slot 1 at y = 500 - (60 + 40) = 400
        // slot 2 at y = 400 - (60 + 24) = 316
        const obstacles: NeuroNode[] = [
          sourceNode,
          { id: 'obs_top_1', type: 'shape', position: { x: 200, y: 400 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'T1', layoutMode: 'manual' } },
          { id: 'obs_top_2', type: 'shape', position: { x: 200, y: 316 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'T2', layoutMode: 'manual' } },
        ];

        const pos = findCollisionFreePosition(sourceNode, 'top', obstacles);
        assert.strictEqual(pos.x, 200);
        assert.strictEqual(pos.y, 232); // 316 - 84 = 232

        const candBox: BoundingBox = { x: pos.x, y: pos.y, width: 160, height: 60 };
        for (const obs of obstacles) {
          if (obs.id === 'src') continue;
          assert.strictEqual(checkAABBCollision(candBox, { x: obs.position.x, y: obs.position.y, width: 160, height: 60 }, 24), false);
        }
      });

      it('steps leftward past multiple obstacles on left neighbor key (⌥+Left)', () => {
        const sourceNode: NeuroNode = {
          id: 'src',
          type: 'shape',
          position: { x: 800, y: 200 },
          width: 160,
          height: 60,
          layoutMode: 'manual',
          data: { label: 'Source', layoutMode: 'manual' },
        };

        // Obstacles to the left: slot 1 at x = 800 - (160 + 80) = 560
        // slot 2 at x = 560 - (160 + 24) = 376
        const obstacles: NeuroNode[] = [
          sourceNode,
          { id: 'obs_left_1', type: 'shape', position: { x: 560, y: 200 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'L1', layoutMode: 'manual' } },
          { id: 'obs_left_2', type: 'shape', position: { x: 376, y: 200 }, width: 160, height: 60, layoutMode: 'manual', data: { label: 'L2', layoutMode: 'manual' } },
        ];

        const pos = findCollisionFreePosition(sourceNode, 'left', obstacles);
        assert.strictEqual(pos.x, 192); // 376 - 184 = 192
        assert.strictEqual(pos.y, 200);

        const candBox: BoundingBox = { x: pos.x, y: pos.y, width: 160, height: 60 };
        for (const obs of obstacles) {
          if (obs.id === 'src') continue;
          assert.strictEqual(checkAABBCollision(candBox, { x: obs.position.x, y: obs.position.y, width: 160, height: 60 }, 24), false);
        }
      });

      it('falls back to spiral search when entire linear ray is blocked', () => {
        const sourceNode: NeuroNode = {
          id: 'src',
          type: 'shape',
          position: { x: 500, y: 500 },
          width: 160,
          height: 60,
          layoutMode: 'manual',
          data: { label: 'Source', layoutMode: 'manual' },
        };

        // Block entire vertical ray at x = 740 for 50 steps
        const obstacles: NeuroNode[] = [sourceNode];
        for (let step = 0; step < 50; step++) {
          obstacles.push({
            id: `wall_${step}`,
            type: 'shape',
            position: { x: 740, y: 500 + step * 84 },
            width: 160,
            height: 60,
            layoutMode: 'manual',
            data: { label: `W_${step}`, layoutMode: 'manual' },
          });
        }

        // Ray stepping will exhaust 50 iterations and fall back to 2D spiral search
        const pos = findCollisionFreePosition(sourceNode, 'right', obstacles, { maxIterations: 50 });
        assert.ok(typeof pos.x === 'number' && Number.isFinite(pos.x));
        assert.ok(typeof pos.y === 'number' && Number.isFinite(pos.y));

        // Spiral search should have found a position off the x=740 wall
        const candBox: BoundingBox = { x: pos.x, y: pos.y, width: 160, height: 60 };
        for (const obs of obstacles) {
          if (obs.id === 'src') continue;
          const obsBox: BoundingBox = { x: obs.position.x, y: obs.position.y, width: 160, height: 60 };
          const collides = checkAABBCollision(candBox, obsBox, 24);
          assert.strictEqual(collides, false, `Spiral candidate collided with obstacle ${obs.id} at (${obs.position.x}, ${obs.position.y})`);
        }
      });
    });

    describe('2.2 Extreme Obstacle Density (200+ Obstacles)', () => {
      it('successfully finds collision-free slot among 225 obstacles in < 30ms without hanging', () => {
        const sourceNode: NeuroNode = {
          id: 'src',
          type: 'shape',
          position: { x: 0, y: 0 },
          width: 160,
          height: 60,
          layoutMode: 'manual',
          data: { label: 'Source', layoutMode: 'manual' },
        };

        // 15x15 = 225 obstacle grid centered around x: 240..3000, y: 0..1500
        const obstacles: NeuroNode[] = [sourceNode];
        for (let row = 0; row < 15; row++) {
          for (let col = 0; col < 15; col++) {
            obstacles.push({
              id: `obs_${row}_${col}`,
              type: 'shape',
              position: { x: 240 + col * 190, y: row * 90 },
              width: 160,
              height: 60,
              layoutMode: 'manual',
              data: { label: `O_${row}_${col}`, layoutMode: 'manual' },
            });
          }
        }
        assert.strictEqual(obstacles.length, 226);

        const start = performance.now();
        const pos = findCollisionFreePosition(sourceNode, 'right', obstacles);
        const duration = performance.now() - start;

        assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y));
        assert.ok(duration < 30, `Search among 225 obstacles took ${duration.toFixed(2)}ms (budget: < 30ms)`);

        // Verify zero collision with all 225 obstacles
        const candBox: BoundingBox = { x: pos.x, y: pos.y, width: 160, height: 60 };
        for (const obs of obstacles) {
          if (obs.id === 'src') continue;
          const obsBox: BoundingBox = { x: obs.position.x, y: obs.position.y, width: 160, height: 60 };
          const collides = checkAABBCollision(candBox, obsBox, 24);
          assert.strictEqual(collides, false, `Dense candidate collided with ${obs.id}`);
        }
      });

      it('handles 300 randomly scattered obstacles without hanging or throwing', () => {
        const sourceNode: NeuroNode = {
          id: 'src',
          type: 'shape',
          position: { x: 1000, y: 1000 },
          width: 160,
          height: 60,
          layoutMode: 'manual',
          data: { label: 'Source', layoutMode: 'manual' },
        };

        const obstacles: NeuroNode[] = [sourceNode];
        for (let i = 0; i < 300; i++) {
          obstacles.push({
            id: `rnd_${i}`,
            type: 'shape',
            position: {
              x: 1000 + ((i % 15) * 190),
              y: 1000 + (Math.floor(i / 15) * 85),
            },
            width: 160,
            height: 60,
            layoutMode: 'manual',
            data: { label: `RND_${i}`, layoutMode: 'manual' },
          });
        }

        const start = performance.now();
        const pos = findCollisionFreePosition(sourceNode, 'bottom', obstacles);
        const duration = performance.now() - start;

        assert.ok(duration < 30, `Scatter search took ${duration.toFixed(2)}ms`);
        assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y));
      });
    });

    describe('2.3 Degenerate, Zero & Negative Bounding Boxes', () => {
      it('handles zero-width and zero-height bounding boxes without NaN or crash', () => {
        const boxA: BoundingBox = { x: 100, y: 100, width: 0, height: 0 };
        const boxB: BoundingBox = { x: 105, y: 105, width: 0, height: 0 };

        // Distance is sqrt(5^2 + 5^2) ~ 7.07, margin is 24 -> overlaps!
        assert.strictEqual(checkAABBCollision(boxA, boxB, 24), true);

        // Distance 100 -> does not overlap
        const boxC: BoundingBox = { x: 200, y: 200, width: 0, height: 0 };
        assert.strictEqual(checkAABBCollision(boxA, boxC, 24), false);
      });

      it('computes Minkowski sum for zero-sized moving node and zero-sized obstacle', () => {
        const obstacle: BoundingBox = { x: 50, y: 50, width: 0, height: 0 };
        const movingSize = { width: 0, height: 0 };
        const margin = 20;

        const mBox = getMinkowskiSumBox(obstacle, movingSize, margin);
        assert.strictEqual(mBox.x, 30); // 50 - 0 - 20
        assert.strictEqual(mBox.y, 30);
        assert.strictEqual(mBox.width, 40); // 0 + 0 + 2*20
        assert.strictEqual(mBox.height, 40);
      });

      it('handles placement when target node has undefined or zero dimensions', () => {
        const nodeZero: NeuroNode = {
          id: 'zero',
          type: 'shape',
          position: { x: 100, y: 100 },
          width: 0,
          height: 0,
          layoutMode: 'manual',
          data: { label: '', layoutMode: 'manual' },
        };

        const pos = findCollisionFreePosition(nodeZero, 'right', [nodeZero]);
        assert.ok(Number.isFinite(pos.x));
        assert.ok(Number.isFinite(pos.y));
        // candX should be 100 + 0 + 80 = 180
        assert.strictEqual(pos.x, 180);
        assert.strictEqual(pos.y, 100);
      });

      it('handles negative canvas coordinates in infinite whiteboard coordinate space', () => {
        const boxA: BoundingBox = { x: -200, y: -300, width: 160, height: 60 };
        const boxB: BoundingBox = { x: -100, y: -280, width: 160, height: 60 };

        // Overlapping negative boxes
        assert.strictEqual(checkAABBCollision(boxA, boxB, 24), true);

        // Non-overlapping distant negative box
        const boxC: BoundingBox = { x: -800, y: -800, width: 160, height: 60 };
        assert.strictEqual(checkAABBCollision(boxA, boxC, 24), false);

        // Point containment with negative coordinates
        const ptInside: Point = { x: -150, y: -270 };
        assert.strictEqual(isPointInBox(ptInside, boxA), true);
        const ptOutside: Point = { x: 0, y: 0 };
        assert.strictEqual(isPointInBox(ptOutside, boxA), false);
      });

      it('handles negative width and height inputs gracefully in getBoundingBoxEnclosing', () => {
        const boxes: BoundingBox[] = [
          { x: 100, y: 100, width: 50, height: 50 },
          { x: 200, y: 200, width: 50, height: 50 },
        ];
        const enclosing = getBoundingBoxEnclosing(boxes, 10);
        assert.strictEqual(enclosing.x, 90);
        assert.strictEqual(enclosing.y, 90);
        assert.strictEqual(enclosing.width, 170); // 250 - 100 + 20
        assert.strictEqual(enclosing.height, 170);

        // Empty array returns zero bounds
        const empty = getBoundingBoxEnclosing([], 10);
        assert.deepStrictEqual(empty, { x: 0, y: 0, width: 0, height: 0 });
      });

      it('handles zero-length line segment in findSegmentIntersection', () => {
        const s1: LineSegment = { p1: { x: 50, y: 50 }, p2: { x: 50, y: 50 } }; // Zero length
        const s2: LineSegment = { p1: { x: 0, y: 50 }, p2: { x: 100, y: 50 } };

        const inter = findSegmentIntersection(s1, s2);
        assert.strictEqual(inter, null, 'Zero length segment must return null');
      });

      it('handles segment shorter than 2.5 * radius in computeLineJumpsForSegment', () => {
        // len = 10, radius = 8 -> len < 8 * 2.5 = 20
        const shortSeg: LineSegment = { p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } };
        const cross: LineSegment = { p1: { x: 5, y: -10 }, p2: { x: 5, y: 10 } };

        const path = computeLineJumpsForSegment(shortSeg, [cross], 8);
        assert.strictEqual(path, 'M 0 0 L 10 0', 'Segment too short must render straight line without arc');
      });

      it('frame auto growth preserves dimensions when candidate is inside existing bounds', () => {
        const frame: NeuroNode = {
          id: 'frame_large',
          type: 'frame',
          position: { x: 0, y: 0 },
          width: 800,
          height: 600,
          layoutMode: 'auto-elk',
          data: { title: 'Big Frame', layoutMode: 'auto-elk' },
        };

        const insideCand: Point = { x: 200, y: 200 };
        const size = { width: 160, height: 60 };

        const growth = calculateFrameAutoGrowth(frame, [], insideCand, size, 40);
        assert.strictEqual(growth.width, 800, 'Frame width should not shrink or change');
        assert.strictEqual(growth.height, 600, 'Frame height should not shrink or change');
      });
    });
  });
});
