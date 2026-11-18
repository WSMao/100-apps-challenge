/**
 * Creative-Neuro Algorithmic Engine - SVG Line Jump Arc Calculation
 * Layer 2 Zero-DOM Pure TypeScript Geometry Engine
 *
 * Conforms to specifications in algorithms.md §5.1 - §5.4.
 * Computes SVG semicircular bridge arcs for intersecting line segments.
 * Features:
 * - Deterministic crossing priority (horizontal jumps over vertical, tie-broken by edge ID)
 * - Parametric t-sorted multi-crossing sequence along polylines
 * - Semicircular SVG path command synthesis: A R R 0 0 1 ...
 * - Endpoint buffer safety margins preventing port collisions
 */

import type {
  JumpArc,
  LineJumpConfig,
  LineSegment,
  NeuroEdge,
  NeuroNode,
  Point,
} from '../../types/index.ts';
import { crossProduct2D } from './lineIntersection.ts';

/**
 * Computes the complete SVG path string with semicircular jump arcs for a single segment
 * crossed by one or more other segments.
 */
export function computeLineJumpsForSegment(
  segment: LineSegment,
  intersectingSegments: LineSegment[],
  radius: number = 8
): string {
  const { p1, p2 } = segment;
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const len = Math.hypot(rx, ry);

  if (len < radius * 2.5) {
    // Segment too short for an arc jump; render straight line
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  }

  const intersections: { t: number; point: Point }[] = [];
  const minT = (radius + 2) / len;
  const maxT = 1 - minT;

  for (const other of intersectingSegments) {
    const sx = other.p2.x - other.p1.x;
    const sy = other.p2.y - other.p1.y;
    const denom = crossProduct2D({ x: rx, y: ry }, { x: sx, y: sy });

    if (Math.abs(denom) < 1e-6) continue; // Parallel or colinear

    const qpX = other.p1.x - p1.x;
    const qpY = other.p1.y - p1.y;

    const t = crossProduct2D({ x: qpX, y: qpY }, { x: sx, y: sy }) / denom;
    const u = crossProduct2D({ x: qpX, y: qpY }, { x: rx, y: ry }) / denom;

    const otherLen = Math.hypot(sx, sy);
    const minU = (radius + 2) / otherLen;
    const maxU = 1 - minU;

    if (t >= minT && t <= maxT && u >= minU && u <= maxU) {
      intersections.push({
        t,
        point: { x: p1.x + t * rx, y: p1.y + t * ry },
      });
    }
  }

  if (intersections.length === 0) {
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  }

  // Sort intersections by parameter t ascending along line direction
  intersections.sort((a, b) => a.t - b.t);

  const ux = rx / len;
  const uy = ry / len;

  let path = `M ${p1.x} ${p1.y}`;
  let lastT = 0;

  for (let i = 0; i < intersections.length; i++) {
    const { t, point } = intersections[i];

    // De-duplicate / skip overlapping jumps within 2.2 * radius
    if (i > 0 && (t - lastT) * len < radius * 2.2) {
      continue;
    }
    lastT = t;

    const ax = point.x - radius * ux;
    const ay = point.y - radius * uy;
    const bx = point.x + radius * ux;
    const by = point.y + radius * uy;

    path += ` L ${ax.toFixed(2)} ${ay.toFixed(2)}`;
    // Semicircular arc from A to B
    path += ` A ${radius} ${radius} 0 0 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;
  }

  path += ` L ${p2.x} ${p2.y}`;
  return path;
}

/**
 * Calculates line jump arcs for an array of edges across the scene graph.
 * Returns a map of edgeId -> JumpArc[] sorted by parameter t ascending.
 */
export function calculateLineJumps(
  edges: NeuroEdge[],
  nodes: Record<string, NeuroNode> | Map<string, NeuroNode>,
  config: LineJumpConfig = {}
): Map<string, JumpArc[]> {
  const jumpRadius = config.jumpRadius ?? 6;
  const endpointTol = config.endpointTolerance ?? 0.05;
  const results = new Map<string, JumpArc[]>();

  const getNode = (id: string): NeuroNode | undefined => {
    if (nodes instanceof Map) {
      return nodes.get(id);
    }
    return nodes[id];
  };

  interface EdgeSegment {
    p1: Point;
    p2: Point;
    edgeId: string;
  }

  const segments: EdgeSegment[] = [];

  for (const e of edges) {
    const src = getNode(e.source);
    const tgt = getNode(e.target);
    if (!src || !tgt) continue;

    const p1: Point = {
      x: src.position.x + (src.width ?? 160) / 2,
      y: src.position.y + (src.height ?? 60) / 2,
    };
    const p2: Point = {
      x: tgt.position.x + (tgt.width ?? 160) / 2,
      y: tgt.position.y + (tgt.height ?? 60) / 2,
    };

    segments.push({ p1, p2, edgeId: e.id });
  }

  for (let i = 0; i < segments.length; i++) {
    const s1 = segments[i];
    const u = { x: s1.p2.x - s1.p1.x, y: s1.p2.y - s1.p1.y };
    const uLen = Math.hypot(u.x, u.y);
    if (uLen < 1e-6) continue;

    for (let j = 0; j < segments.length; j++) {
      if (i === j) continue;
      const s2 = segments[j];
      const v = { x: s2.p2.x - s2.p1.x, y: s2.p2.y - s2.p1.y };
      const vLen = Math.hypot(v.x, v.y);
      if (vLen < 1e-6) continue;

      const D = crossProduct2D(u, v);
      // Skip parallel or colinear segments
      if (Math.abs(D) < 1e-6) continue;

      const w = { x: s2.p1.x - s1.p1.x, y: s2.p1.y - s1.p1.y };
      const t = crossProduct2D(w, v) / D;
      const s = crossProduct2D(w, u) / D;

      // Dynamic endpoint buffer: dimensionless ratio or physical clearance (radius + 2px), whichever is larger
      const minT = Math.max(endpointTol, (jumpRadius + 2) / uLen);
      const maxT = 1 - minT;
      const minS = Math.max(endpointTol, (jumpRadius + 2) / vLen);
      const maxS = 1 - minS;

      if (t >= minT && t <= maxT && s >= minS && s <= maxS) {
        // Deterministic priority rule:
        // Horizontal jumps over vertical; otherwise lexicographical edge ID comparison
        const s1IsHorizontal = Math.abs(u.y) < 1e-3;
        const s2IsVertical = Math.abs(v.x) < 1e-3;

        let s1ShouldJump = false;
        if (s1IsHorizontal && s2IsVertical) {
          s1ShouldJump = true;
        } else if (Math.abs(u.x) < 1e-3 && Math.abs(v.y) < 1e-3) {
          s1ShouldJump = false; // s2 is horizontal, s1 is vertical
        } else {
          s1ShouldJump = s1.edgeId < s2.edgeId;
        }

        if (s1ShouldJump) {
          const crossX = s1.p1.x + t * u.x;
          const crossY = s1.p1.y + t * u.y;
          const normU = { x: u.x / uLen, y: u.y / uLen };

          const startPt: Point = {
            x: crossX - jumpRadius * normU.x,
            y: crossY - jumpRadius * normU.y,
          };
          const endPt: Point = {
            x: crossX + jumpRadius * normU.x,
            y: crossY + jumpRadius * normU.y,
          };

          const arcCmd = `L ${startPt.x.toFixed(2)} ${startPt.y.toFixed(2)} A ${jumpRadius} ${jumpRadius} 0 0 1 ${endPt.x.toFixed(2)} ${endPt.y.toFixed(2)}`;

          const jump: JumpArc = {
            crossingPoint: { x: crossX, y: crossY },
            startPoint: startPt,
            endPoint: endPt,
            t,
            radius: jumpRadius,
            svgArcCommand: arcCmd,
          };

          if (!results.has(s1.edgeId)) {
            results.set(s1.edgeId, []);
          }
          results.get(s1.edgeId)!.push(jump);
        }
      }
    }
  }

  // Sort jump arcs on each edge by parameter t ascending and remove duplicates
  for (const [edgeId, arcs] of results.entries()) {
    arcs.sort((a, b) => a.t - b.t);

    // Merge or prune close duplicates
    const pruned: JumpArc[] = [];
    for (let k = 0; k < arcs.length; k++) {
      if (
        k > 0 &&
        Math.hypot(
          arcs[k].crossingPoint.x - arcs[k - 1].crossingPoint.x,
          arcs[k].crossingPoint.y - arcs[k - 1].crossingPoint.y
        ) < jumpRadius * 1.5
      ) {
        continue;
      }
      pruned.push(arcs[k]);
    }
    results.set(edgeId, pruned);
  }

  return results;
}
