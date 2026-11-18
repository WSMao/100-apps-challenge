/**
 * Creative-Neuro Algorithmic Engine - Collision Geometry
 * Layer 2 Zero-DOM Pure TypeScript Collision Engine
 *
 * Conforms to specifications in algorithms.md §4.3.
 * Provides Minkowski Sum & AABB spatial overlap tests with configurable safety margins.
 */

import type { BoundingBox, Point, Size } from '../../types/index.ts';

/**
 * Checks AABB collision between two bounding boxes with a safety margin m.
 * Uses center-to-center half-extent overlap check.
 */
export function checkAABBCollision(
  boxA: BoundingBox,
  boxB: BoundingBox,
  margin: number = 24
): boolean {
  const centerAX = boxA.x + boxA.width / 2;
  const centerAY = boxA.y + boxA.height / 2;
  const centerBX = boxB.x + boxB.width / 2;
  const centerBY = boxB.y + boxB.height / 2;

  const overlapX =
    Math.abs(centerAX - centerBX) < (boxA.width + boxB.width) / 2 + margin;
  const overlapY =
    Math.abs(centerAY - centerBY) < (boxA.height + boxB.height) / 2 + margin;

  return overlapX && overlapY;
}

/**
 * Computes Minkowski sum bounding box of an obstacle with a moving node size and safety margin.
 * A point candidate (x, y) collides with obstacle iff (x, y) is inside the Minkowski box.
 */
export function getMinkowskiSumBox(
  obstacle: BoundingBox,
  movingSize: Size,
  margin: number = 24
): BoundingBox {
  return {
    x: obstacle.x - movingSize.width - margin,
    y: obstacle.y - movingSize.height - margin,
    width: obstacle.width + movingSize.width + 2 * margin,
    height: obstacle.height + movingSize.height + 2 * margin,
  };
}

/**
 * Checks whether a 2D point lies within a bounding box.
 */
export function isPointInBox(point: Point, box: BoundingBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

/**
 * Computes the minimum bounding box enclosing an array of bounding boxes with optional padding.
 */
export function getBoundingBoxEnclosing(
  boxes: BoundingBox[],
  padding: number = 20
): BoundingBox {
  if (boxes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding,
  };
}
