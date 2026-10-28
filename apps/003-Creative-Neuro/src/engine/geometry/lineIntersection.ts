/**
 * Creative-Neuro Algorithmic Engine - 2D Vector Cross-Product Line Intersection
 * Layer 2 Zero-DOM Pure TypeScript Geometry Engine
 *
 * Conforms to specifications in algorithms.md §5.2 - §5.3.
 * Computes exact 2D line segment intersections using vector cross-products:
 * r = P2 - P1, s = Q2 - Q1, D = r x s.
 * Handles parallel, colinear, and endpoint degeneracy filters.
 */

import type { LineSegment, Point } from '../../types/index.ts';

export interface SegmentIntersection {
  point: Point;
  t: number; // Parameter along segment 1 (in [0, 1])
  u: number; // Parameter along segment 2 (in [0, 1])
}

/**
 * 2D Vector Cross Product: Cross(A, B) = A.x * B.y - A.y * B.x
 */
export function crossProduct2D(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

/**
 * Finds intersection point between two line segments using 2D vector cross-product.
 * Returns null if segments are parallel, colinear, or intersect outside the endpoint tolerance buffer.
 */
export function findSegmentIntersection(
  s1: LineSegment,
  s2: LineSegment,
  endpointTolerance: number = 0.05
): SegmentIntersection | null {
  const rx = s1.p2.x - s1.p1.x;
  const ry = s1.p2.y - s1.p1.y;
  const sx = s2.p2.x - s2.p1.x;
  const sy = s2.p2.y - s2.p1.y;

  const len1 = Math.hypot(rx, ry);
  const len2 = Math.hypot(sx, sy);

  if (len1 < 1e-6 || len2 < 1e-6) {
    return null;
  }

  // Cross product of direction vectors
  const denom = rx * sy - ry * sx;

  // If denominator is near zero, segments are parallel or colinear
  if (Math.abs(denom) < 1e-6) {
    return null;
  }

  const qpX = s2.p1.x - s1.p1.x;
  const qpY = s2.p1.y - s1.p1.y;

  const t = (qpX * sy - qpY * sx) / denom;
  const u = (qpX * ry - qpY * rx) / denom;

  // Endpoint buffer check: intersection must occur strictly away from endpoints
  if (
    t >= endpointTolerance &&
    t <= 1 - endpointTolerance &&
    u >= endpointTolerance &&
    u <= 1 - endpointTolerance
  ) {
    return {
      point: {
        x: s1.p1.x + t * rx,
        y: s1.p1.y + t * ry,
      },
      t,
      u,
    };
  }

  return null;
}
