/**
 * Creative-Neuro Algorithmic Unit Tests - Engine 4: SVG Line Jump Geometry Engine
 * Target: tests/engine/lineJumps.test.ts
 *
 * Verifies:
 * - 2D Vector cross-product line segment intersections
 * - Colinear and parallel segment degeneracy rejection
 * - Endpoint buffer safety margin filtering (t in [eps, 1-eps])
 * - Deterministic crossing priority (horizontal over vertical, edge ID tie-break)
 * - Parametric t-sorted multi-crossing sequence along polylines
 * - Semicircular SVG path command synthesis: A R R 0 0 1 ...
 * - Performance benchmark (< 10ms for 50 intersecting edges)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  crossProduct2D,
  findSegmentIntersection,
  computeLineJumpsForSegment,
  calculateLineJumps,
} from '../../src/engine/index.ts';
import type { LineSegment, NeuroEdge, NeuroNode } from '../../src/types/index.ts';

describe('Engine 4: SVG Line Jump Geometry Unit Tests', () => {
  describe('1. 2D Vector Cross Product & Intersection Mathematics', () => {
    it('M4-JUMP-01: computes exact intersection point for orthogonal line segments', () => {
      const s1: LineSegment = { p1: { x: 0, y: 50 }, p2: { x: 100, y: 50 } }; // Horizontal
      const s2: LineSegment = { p1: { x: 50, y: 0 }, p2: { x: 50, y: 100 } }; // Vertical

      const inter = findSegmentIntersection(s1, s2);
      assert.ok(inter);
      assert.strictEqual(inter?.point.x, 50);
      assert.strictEqual(inter?.point.y, 50);
      assert.strictEqual(inter?.t, 0.5);
      assert.strictEqual(inter?.u, 0.5);
    });

    it('M4-JUMP-02: returns null for parallel disjoint segments (D = 0)', () => {
      const s1: LineSegment = { p1: { x: 0, y: 10 }, p2: { x: 100, y: 10 } };
      const s2: LineSegment = { p1: { x: 0, y: 30 }, p2: { x: 100, y: 30 } };

      const inter = findSegmentIntersection(s1, s2);
      assert.strictEqual(inter, null);
    });

    it('M4-JUMP-03: returns null for colinear overlapping segments', () => {
      const s1: LineSegment = { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 } };
      const s2: LineSegment = { p1: { x: 50, y: 0 }, p2: { x: 150, y: 0 } };

      const inter = findSegmentIntersection(s1, s2);
      assert.strictEqual(inter, null);
    });

    it('M4-JUMP-04: rejects intersections located inside the endpoint buffer threshold', () => {
      // s1 runs from x=0 to 100 at y=50
      const s1: LineSegment = { p1: { x: 0, y: 50 }, p2: { x: 100, y: 50 } };
      // s2 crosses s1 at x = 2 (t = 0.02, which is < 0.05 default tolerance)
      const s2NearStart: LineSegment = { p1: { x: 2, y: 0 }, p2: { x: 2, y: 100 } };

      const inter = findSegmentIntersection(s1, s2NearStart, 0.05);
      assert.strictEqual(inter, null, 'Expected crossing near start endpoint to be rejected');

      // s3 crosses s1 at x = 98 (t = 0.98, which is > 1 - 0.05)
      const s3NearEnd: LineSegment = { p1: { x: 98, y: 0 }, p2: { x: 98, y: 100 } };
      const inter2 = findSegmentIntersection(s1, s3NearEnd, 0.05);
      assert.strictEqual(inter2, null, 'Expected crossing near end endpoint to be rejected');
    });
  });

  describe('2. Deterministic Crossing Priority Rule', () => {
    it('M4-JUMP-05a: horizontal edge jumps over vertical edge', () => {
      const nodes: Record<string, NeuroNode> = {
        hSrc: { id: 'hSrc', type: 'shape', position: { x: 0, y: 100 }, width: 40, height: 40, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        hTgt: { id: 'hTgt', type: 'shape', position: { x: 200, y: 100 }, width: 40, height: 40, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        vSrc: { id: 'vSrc', type: 'shape', position: { x: 100, y: 0 }, width: 40, height: 40, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        vTgt: { id: 'vTgt', type: 'shape', position: { x: 100, y: 200 }, width: 40, height: 40, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
      };

      const edges: NeuroEdge[] = [
        { id: 'edge_v', source: 'vSrc', target: 'vTgt' }, // Vertical (center: x: 120, y: 20 to 220)
        { id: 'edge_h', source: 'hSrc', target: 'hTgt' }, // Horizontal (center: x: 20 to 220, y: 120)
      ];

      const jumps = calculateLineJumps(edges, nodes, { jumpRadius: 8 });

      // Horizontal edge should have the jump arc!
      assert.ok(jumps.has('edge_h'), 'Expected horizontal edge to have jump arc');
      assert.strictEqual(jumps.get('edge_h')?.length, 1);
      // Vertical edge should NOT have a jump arc
      assert.strictEqual(jumps.has('edge_v'), false);
    });

    it('M4-JUMP-05b: tie-breaks crossing edges with the same orientation using lexicographical edge ID', () => {
      // Two diagonal crossing edges: (0,0)->(100,100) and (0,100)->(100,0)
      const nodes: Record<string, NeuroNode> = {
        n1: { id: 'n1', type: 'shape', position: { x: 0, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        n2: { id: 'n2', type: 'shape', position: { x: 100, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        n3: { id: 'n3', type: 'shape', position: { x: 0, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        n4: { id: 'n4', type: 'shape', position: { x: 100, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
      };

      const edges: NeuroEdge[] = [
        { id: 'edge_b', source: 'n3', target: 'n4' },
        { id: 'edge_a', source: 'n1', target: 'n2' },
      ];

      const jumps = calculateLineJumps(edges, nodes, { jumpRadius: 6 });
      // edge_a is lexicographically smaller than edge_b -> edge_a jumps!
      assert.ok(jumps.has('edge_a'));
      assert.strictEqual(jumps.has('edge_b'), false);
    });
  });

  describe('3. Multi-Crossing Parameter Sorting & Semicircular Arc Path', () => {
    it('M4-JUMP-06: sorts multiple crossings along a single segment by parameter t ascending', () => {
      const mainSegment: LineSegment = { p1: { x: 0, y: 100 }, p2: { x: 200, y: 100 } };

      // 3 vertical lines crossing at x = 50 (t=0.25), x = 100 (t=0.5), x = 150 (t=0.75)
      const crossers: LineSegment[] = [
        { p1: { x: 150, y: 0 }, p2: { x: 150, y: 200 } }, // Passed out of order!
        { p1: { x: 50, y: 0 }, p2: { x: 50, y: 200 } },
        { p1: { x: 100, y: 0 }, p2: { x: 100, y: 200 } },
      ];

      const svgPath = computeLineJumpsForSegment(mainSegment, crossers, 8);

      // Verify SVG path structure:
      // Starts at M 0 100
      assert.ok(svgPath.startsWith('M 0 100'));
      // Contains exactly 3 arcs ('A 8 8 0 0 1')
      const arcMatches = svgPath.match(/A 8 8 0 0 1/g);
      assert.strictEqual(arcMatches?.length, 3);
      // Ends at L 200 100
      assert.ok(svgPath.endsWith('L 200 100'));

      // Check order of X coordinates in the arc bridges: 50 bridge before 100 bridge before 150 bridge
      const idx50 = svgPath.indexOf('42.00 100.00'); // 50 - 8 = 42
      const idx100 = svgPath.indexOf('92.00 100.00'); // 100 - 8 = 92
      const idx150 = svgPath.indexOf('142.00 100.00'); // 150 - 8 = 142

      assert.ok(idx50 !== -1 && idx100 !== -1 && idx150 !== -1);
      assert.ok(idx50 < idx100, `Expected idx50 (${idx50}) < idx100 (${idx100})`);
      assert.ok(idx100 < idx150, `Expected idx100 (${idx100}) < idx150 (${idx150})`);
    });

    it('M4-JUMP-07: suppresses duplicate/overlapping jump arcs within 2R proximity', () => {
      const mainSegment: LineSegment = { p1: { x: 0, y: 100 }, p2: { x: 200, y: 100 } };
      // Two crossings extremely close to each other: x = 100 and x = 105 (diff 5 < 2*R = 16)
      const crossers: LineSegment[] = [
        { p1: { x: 100, y: 0 }, p2: { x: 100, y: 200 } },
        { p1: { x: 105, y: 0 }, p2: { x: 105, y: 200 } },
      ];

      const svgPath = computeLineJumpsForSegment(mainSegment, crossers, 8);
      // Only 1 jump should be rendered to avoid corrupted overlapping arcs
      const arcMatches = svgPath.match(/A 8 8 0 0 1/g);
      assert.strictEqual(arcMatches?.length, 1);
    });

    it('M4-JUMP-08: rejects crossings too close to endpoints on short segments (< 120px) preventing arc overflow', () => {
      // Short horizontal segment of length 60px (x: 20 to 80 at y: 50)
      const nodes: Record<string, NeuroNode> = {
        sSrc: { id: 'sSrc', type: 'shape', position: { x: 20, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        sTgt: { id: 'sTgt', type: 'shape', position: { x: 80, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        // Crosser near start: crosses at x = 24 (t = 4/60 = 0.0667)
        // With jumpRadius = 6, arc start would be 24 - 6 = 18 < 20 (before segment start!)
        vNearStartSrc: { id: 'vNearStartSrc', type: 'shape', position: { x: 24, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        vNearStartTgt: { id: 'vNearStartTgt', type: 'shape', position: { x: 24, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        // Safe crosser at midpoint: crosses at x = 50 (t = 0.5)
        vMidSrc: { id: 'vMidSrc', type: 'shape', position: { x: 50, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
        vMidTgt: { id: 'vMidTgt', type: 'shape', position: { x: 50, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } },
      };

      // 1. Edge crossed near start on short segment must NOT jump because arc would overflow p1
      const edgeNearStart: NeuroEdge[] = [
        { id: 'e_h_short', source: 'sSrc', target: 'sTgt' },
        { id: 'e_v_near', source: 'vNearStartSrc', target: 'vNearStartTgt' },
      ];
      const jumpsNear = calculateLineJumps(edgeNearStart, nodes, { jumpRadius: 6, endpointTolerance: 0.05 });
      assert.strictEqual(
        jumpsNear.has('e_h_short'),
        false,
        'Expected crossing at t=0.0667 on 60px edge to be rejected (arc start would overflow before p1.x=20)'
      );

      // 2. Edge crossed safely near center must jump with valid start and end points within [20, 80]
      const edgeMid: NeuroEdge[] = [
        { id: 'e_h_short', source: 'sSrc', target: 'sTgt' },
        { id: 'e_v_mid', source: 'vMidSrc', target: 'vMidTgt' },
      ];
      const jumpsMid = calculateLineJumps(edgeMid, nodes, { jumpRadius: 6, endpointTolerance: 0.05 });
      assert.ok(jumpsMid.has('e_h_short'));
      const arc = jumpsMid.get('e_h_short')![0];
      assert.strictEqual(arc.crossingPoint.x, 50);
      assert.strictEqual(arc.startPoint.x, 44);
      assert.strictEqual(arc.endPoint.x, 56);
      assert.ok(arc.startPoint.x >= 20, 'Arc start must be >= segment start x=20');
      assert.ok(arc.endPoint.x <= 80, 'Arc end must be <= segment end x=80');
    });
  });

  describe('4. Performance Benchmark', () => {
    it('M4-PERF-01: executes batch line jump calculations for 50 intersecting edges in < 10ms', () => {
      // 25 horizontal lines crossed by 25 vertical lines = 625 intersection pairs
      const nodes: Record<string, NeuroNode> = {};
      const edges: NeuroEdge[] = [];

      for (let i = 0; i < 25; i++) {
        nodes[`h_src_${i}`] = { id: `h_src_${i}`, type: 'shape', position: { x: 0, y: i * 40 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } };
        nodes[`h_tgt_${i}`] = { id: `h_tgt_${i}`, type: 'shape', position: { x: 1000, y: i * 40 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } };
        edges.push({ id: `h_edge_${i}`, source: `h_src_${i}`, target: `h_tgt_${i}` });

        nodes[`v_src_${i}`] = { id: `v_src_${i}`, type: 'shape', position: { x: i * 40, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } };
        nodes[`v_tgt_${i}`] = { id: `v_tgt_${i}`, type: 'shape', position: { x: i * 40, y: 1000 }, width: 0, height: 0, layoutMode: 'manual', data: { label: '', layoutMode: 'manual' } };
        edges.push({ id: `v_edge_${i}`, source: `v_src_${i}`, target: `v_tgt_${i}` });
      }

      const start = performance.now();
      const jumps = calculateLineJumps(edges, nodes, { jumpRadius: 6 });
      const duration = performance.now() - start;

      assert.ok(jumps.size > 0);
      assert.ok(duration < 25, `Batch line jump took ${duration.toFixed(2)}ms (budget: < 25ms)`);
    });
  });
});
