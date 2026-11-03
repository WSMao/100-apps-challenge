/**
 * Creative-Neuro Algorithmic Subsystem - Graph Geometry & Edge Routing Engine
 * Path: src/engine/geometry/graphRoutingEngine.ts
 *
 * Deep module encapsulating:
 * 1. 2D Vector Cross-Products & Segment Intersection
 * 2. Marquee Box Selection Intersections (Point-in-Rect, Segment-in-Rect)
 * 3. Line Jump Arc Geometry (deterministic priority, multi-crossing t-sorting & suppression)
 * 4. Smart Edge Label Positioning avoiding node and label collisions
 */

import type { Point, NeuroNode, NeuroEdge, EdgeRoutingType } from '../../types/index.ts';
import { crossProduct2D } from './lineIntersection.ts';

export interface BoundingRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface JumpArcData {
  t: number;
  crossingPoint: Point;
  startPoint: Point;
  endPoint: Point;
  radius: number;
}

export interface LeafRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Checks if a point lies within a bounding rectangle.
 */
export function isPointInRect(pt: Point, rect: BoundingRect): boolean {
  return (
    pt.x >= rect.minX &&
    pt.x <= rect.maxX &&
    pt.y >= rect.minY &&
    pt.y <= rect.maxY
  );
}

/**
 * Determines whether two 2D line segments cross each other.
 */
export function lineSegmentsCross(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point
): boolean {
  const d1 = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
  const d2 = (b2.x - b1.x) * (a2.y - b1.y) - (b2.y - b1.y) * (a2.x - b1.x);
  const d3 = (a2.x - a1.x) * (b1.y - a1.y) - (a2.y - a1.y) * (b1.x - a1.x);
  const d4 = (a2.x - a1.x) * (b2.y - a1.y) - (a2.y - a1.y) * (b2.x - a1.x);

  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * Determines if a line segment crosses or is contained by a bounding rectangle.
 */
export function isSegmentIntersectingRect(
  p1: Point,
  p2: Point,
  rect: BoundingRect
): boolean {
  if (isPointInRect(p1, rect) || isPointInRect(p2, rect)) return true;
  if (Math.max(p1.x, p2.x) < rect.minX || Math.min(p1.x, p2.x) > rect.maxX)
    return false;
  if (Math.max(p1.y, p2.y) < rect.minY || Math.min(p1.y, p2.y) > rect.maxY)
    return false;

  const rTL = { x: rect.minX, y: rect.minY };
  const rTR = { x: rect.maxX, y: rect.minY };
  const rBR = { x: rect.maxX, y: rect.maxY };
  const rBL = { x: rect.minX, y: rect.maxY };

  return (
    lineSegmentsCross(p1, p2, rTL, rTR) ||
    lineSegmentsCross(p1, p2, rTR, rBR) ||
    lineSegmentsCross(p1, p2, rBR, rBL) ||
    lineSegmentsCross(p1, p2, rBL, rTL)
  );
}

/**
 * Calculates endpoint coordinates on a node given its handle ID or default orientation.
 */
export function getNodeEndpoint(
  node: { position: Point; width?: number; height?: number },
  handleId?: string | null,
  isSource = false
): Point {
  const x = node.position.x;
  const y = node.position.y;
  const w = node.width ?? 160;
  const h = node.height ?? 60;
  const side = handleId
    ? handleId.replace('-plus', '')
    : isSource
    ? 'bottom'
    : 'top';

  switch (side) {
    case 'top':
      return { x: x + w / 2, y };
    case 'bottom':
      return { x: x + w / 2, y: y + h };
    case 'left':
      return { x, y: y + h / 2 };
    case 'right':
      return { x: x + w, y: y + h / 2 };
    default:
      return { x: x + w / 2, y: y + h / 2 };
  }
}

/**
 * Checks if an edge (straight, stepped, or curved) intersects a marquee selection box.
 */
export function isEdgeInSelectionRect(
  edge: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
  nodeMap: Map<string, NeuroNode>,
  rect: BoundingRect
): boolean {
  const src = nodeMap.get(edge.source);
  const tgt = nodeMap.get(edge.target);
  if (!src || !tgt) return false;

  const p1 = getNodeEndpoint(src, edge.sourceHandle, true);
  const p2 = getNodeEndpoint(tgt, edge.targetHandle, false);

  const midX = (p1.x + p2.x) / 2;
  const pMid1 = { x: midX, y: p1.y };
  const pMid2 = { x: midX, y: p2.y };

  return (
    isSegmentIntersectingRect(p1, p2, rect) ||
    isSegmentIntersectingRect(p1, pMid1, rect) ||
    isSegmentIntersectingRect(pMid1, pMid2, rect) ||
    isSegmentIntersectingRect(pMid2, p2, rect)
  );
}

/**
 * Finds all edges intersecting a selection rectangle.
 */
export function findEdgesInSelectionRect(
  edges: Iterable<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>,
  nodeMap: Map<string, NeuroNode>,
  rect: BoundingRect
): string[] {
  const results: string[] = [];
  for (const edge of edges) {
    if (isEdgeInSelectionRect(edge, nodeMap, rect)) {
      results.push(edge.id);
    }
  }
  return results;
}

/**
 * Computes deterministic line jump arcs along segment p1 -> p2 crossing other edges.
 */
export function computeJumpArcsForEdge(
  edgeId: string,
  p1: Point,
  p2: Point,
  allEdges: Iterable<any>,
  getHandlePoint: (
    nodeId: string,
    handleId?: string | null,
    defaultSide?: 'top' | 'right' | 'bottom' | 'left'
  ) => Point | null,
  jumpRadius = 6
): JumpArcData[] {
  const u = { x: p2.x - p1.x, y: p2.y - p1.y };
  const uLen = Math.hypot(u.x, u.y);

  if (uLen < jumpRadius * 2.5) {
    return [];
  }

  const normU = { x: u.x / uLen, y: u.y / uLen };
  const minT = Math.max(0.05, (jumpRadius + 2) / uLen);
  const maxT = 1 - minT;

  const jumps: JumpArcData[] = [];

  for (const other of allEdges) {
    if (other.id === edgeId) continue;

    const q1: Point | null =
      typeof other.sourceX === 'number' && typeof other.sourceY === 'number'
        ? { x: other.sourceX, y: other.sourceY }
        : getHandlePoint(other.source, other.sourceHandle, 'bottom');

    const q2: Point | null =
      typeof other.targetX === 'number' && typeof other.targetY === 'number'
        ? { x: other.targetX, y: other.targetY }
        : getHandlePoint(other.target, other.targetHandle, 'top');

    if (!q1 || !q2) continue;

    const v = { x: q2.x - q1.x, y: q2.y - q1.y };
    const vLen = Math.hypot(v.x, v.y);
    if (vLen < 1e-4) continue;

    const D = crossProduct2D(u, v);
    if (Math.abs(D) < 1e-6) continue; // Parallel or collinear

    const w = { x: q1.x - p1.x, y: q1.y - p1.y };
    const t = crossProduct2D(w, v) / D;
    const s = crossProduct2D(w, u) / D;

    const minS = Math.max(0.05, (jumpRadius + 2) / vLen);
    const maxS = 1 - minS;

    if (t >= minT && t <= maxT && s >= minS && s <= maxS) {
      // Deterministic priority: horizontal jumps over vertical, then lexicographical edge ID
      const s1IsHorizontal = Math.abs(u.y) < 1e-3;
      const s2IsVertical = Math.abs(v.x) < 1e-3;

      let s1ShouldJump = false;
      if (s1IsHorizontal && s2IsVertical) {
        s1ShouldJump = true;
      } else if (Math.abs(u.x) < 1e-3 && Math.abs(v.y) < 1e-3) {
        s1ShouldJump = false;
      } else {
        s1ShouldJump = edgeId < other.id;
      }

      if (s1ShouldJump) {
        const crossing: Point = {
          x: p1.x + t * u.x,
          y: p1.y + t * u.y,
        };

        const arcStart: Point = {
          x: crossing.x - normU.x * jumpRadius,
          y: crossing.y - normU.y * jumpRadius,
        };
        const arcEnd: Point = {
          x: crossing.x + normU.x * jumpRadius,
          y: crossing.y + normU.y * jumpRadius,
        };

        jumps.push({
          t,
          crossingPoint: crossing,
          startPoint: arcStart,
          endPoint: arcEnd,
          radius: jumpRadius,
        });
      }
    }
  }

  // Sort jumps along segment direction (t ascending)
  jumps.sort((a, b) => a.t - b.t);

  // Suppress overlapping arcs closer than 2.2 * radius
  const filteredJumps: JumpArcData[] = [];
  let lastT = 0;
  for (let i = 0; i < jumps.length; i++) {
    const jump = jumps[i];
    if (i > 0 && (jump.t - lastT) * uLen < jumpRadius * 2.2) {
      continue;
    }
    lastT = jump.t;
    filteredJumps.push(jump);
  }

  return filteredJumps;
}

/**
 * Builds SVG path string with semicircular arcs for jumps.
 */
export function buildJumpSvgPath(
  p1: Point,
  p2: Point,
  jumps: JumpArcData[]
): string {
  if (jumps.length === 0) {
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  let pathD = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  for (const jump of jumps) {
    pathD += ` L ${jump.startPoint.x.toFixed(2)} ${jump.startPoint.y.toFixed(2)}`;
    pathD += ` A ${jump.radius} ${jump.radius} 0 0 1 ${jump.endPoint.x.toFixed(2)} ${jump.endPoint.y.toFixed(2)}`;
  }
  pathD += ` L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  return pathD;
}

/**
 * Computes an optimal collision-free label position along an edge.
 */
export function computeSmartLabelPosition(params: {
  p1: Point;
  p2: Point;
  edgeId: string;
  allEdges: Iterable<any>;
  leafRects: LeafRect[];
  getHandlePoint: (
    nodeId: string,
    handleId?: string | null,
    defaultSide?: 'top' | 'right' | 'bottom' | 'left'
  ) => Point | null;
}): Point {
  const { p1, p2, edgeId, allEdges, leafRects, getHandlePoint } = params;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const uLen = Math.hypot(dx, dy);

  if (uLen <= 20) {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  const absDy = Math.abs(dy);
  const preferredTs =
    absDy > 250
      ? [
          Math.min(0.42, 88 / absDy),
          1 - Math.min(0.42, 88 / absDy),
          Math.min(0.45, 118 / absDy),
          1 - Math.min(0.45, 118 / absDy),
          0.5,
          0.32,
          0.68,
        ]
      : absDy < 40
      ? [0.5, 0.42, 0.58]
      : [0.5, 0.34, 0.66, 0.25, 0.75, 0.42, 0.58];

  const labelW = 205;
  const labelH = 40;

  const placedLabels: LeafRect[] = [];
  for (const other of allEdges) {
    if (other.id === edgeId) break;
    const itemData = other.data as NeuroEdge['data'] | undefined;
    const hasLabel = Boolean(other.label || itemData?.label);
    if (!hasLabel) continue;

    const q1 =
      typeof other.sourceX === 'number' && typeof other.sourceY === 'number'
        ? { x: other.sourceX, y: other.sourceY }
        : getHandlePoint(other.source, other.sourceHandle, 'bottom');
    const q2 =
      typeof other.targetX === 'number' && typeof other.targetY === 'number'
        ? { x: other.targetX, y: other.targetY }
        : getHandlePoint(other.target, other.targetHandle, 'top');

    if (q1 && q2) {
      placedLabels.push({
        x: (q1.x + q2.x) / 2,
        y: (q1.y + q2.y) / 2,
        w: labelW,
        h: labelH,
      });
    }
  }

  let bestPt = { x: p1.x + 0.5 * dx, y: p1.y + 0.5 * dy };
  let bestPenalty = Infinity;

  for (const tCand of preferredTs) {
    for (const yShift of [0, -28, 28]) {
      const cx = p1.x + tCand * dx;
      const cy = p1.y + tCand * dy + (absDy >= 40 ? yShift : 0);

      let penalty = 0;
      for (const nr of leafRects) {
        const nCx = nr.x + nr.w / 2;
        const nCy = nr.y + nr.h / 2;
        if (
          Math.abs(cx - nCx) < (nr.w + labelW) / 2 - 8 &&
          Math.abs(cy - nCy) < (nr.h + labelH) / 2 - 4
        ) {
          penalty += 1000;
        }
      }

      for (const pl of placedLabels) {
        if (
          Math.abs(cx - pl.x) < (pl.w + labelW) / 2 + 6 &&
          Math.abs(cy - pl.y) < (pl.h + labelH) / 2 + 4
        ) {
          penalty += 500;
        }
      }

      if (penalty === 0) {
        return { x: cx, y: cy };
      }
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestPt = { x: cx, y: cy };
      }
    }
  }

  return bestPt;
}

export const GraphRoutingEngine = {
  isPointInRect,
  lineSegmentsCross,
  isSegmentIntersectingRect,
  getNodeEndpoint,
  isEdgeInSelectionRect,
  findEdgesInSelectionRect,
  computeJumpArcsForEdge,
  buildJumpSvgPath,
  computeSmartLabelPosition,
};
