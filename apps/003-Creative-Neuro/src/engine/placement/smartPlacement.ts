/**
 * Creative-Neuro Algorithmic Engine - Smart Collision-Free Placement
 * Layer 2 Zero-DOM Pure TypeScript Placement Engine
 *
 * Conforms to specifications in algorithms.md §4.1 - §4.4.
 * Features:
 * - Directional offset generation (Tab child, Enter sibling, ⌥+arrows)
 * - Sibling queue ordering and automatic vertical stacking
 * - AABB Minkowski collision stepping search with spiral fallback
 * - Frame/container auto-growth bounds calculation
 */

import type {
  BoundingBox,
  NeuroNode,
  PlacementConfig,
  Point,
  Size,
} from '../../types/index.ts';
import { checkAABBCollision } from './collision.ts';

export type PlacementDirection = 'right' | 'bottom' | 'left' | 'top';

/**
 * Calculates a non-overlapping candidate position for a newly spawned node.
 */
export function findCollisionFreePosition(
  targetNode: NeuroNode,
  direction: PlacementDirection,
  existingNodes: NeuroNode[],
  config: PlacementConfig = {}
): Point {
  const margin = config.margin ?? 24;
  const newWidth = config.defaultWidth ?? 160;
  const newHeight = config.defaultHeight ?? 60;
  const maxIterations = config.maxIterations ?? 50;

  const targetW = targetNode.width ?? 160;
  const targetH = targetNode.height ?? 60;

  // Filter obstacles to relevant canvas nodes (ignore frames containing this node)
  const obstacles: BoundingBox[] = existingNodes
    .filter((n) => n.id !== targetNode.id && n.type !== 'frame' && n.type !== 'diagram')
    .map((n) => ({
      x: n.position.x,
      y: n.position.y,
      width: n.width ?? 160,
      height: n.height ?? 60,
    }));

  let candX = targetNode.position.x;
  let candY = targetNode.position.y;
  let stepX = 0;
  let stepY = 0;

  switch (direction) {
    case 'right': // Child placement (Tab)
      candX = targetNode.position.x + targetW + 80;
      candY = targetNode.position.y;
      stepX = 0;
      stepY = newHeight + margin; // Stack children vertically if occupied
      break;

    case 'bottom': // Sibling placement (Enter)
      candX = targetNode.position.x;
      // If target node has siblings sharing the same parent, place below the lowest sibling
      if (targetNode.parentId) {
        const siblings = existingNodes.filter(
          (n) => n.parentId === targetNode.parentId && n.id !== targetNode.id
        );
        let maxSiblingBottom = targetNode.position.y + targetH;
        for (const s of siblings) {
          maxSiblingBottom = Math.max(maxSiblingBottom, s.position.y + (s.height ?? 60));
        }
        candY = maxSiblingBottom + 40;
      } else {
        candY = targetNode.position.y + targetH + 40;
      }
      stepX = 0;
      stepY = newHeight + margin;
      break;

    case 'top': // Upward neighbor (⌥+Up)
      candX = targetNode.position.x;
      candY = targetNode.position.y - (newHeight + 40);
      stepX = 0;
      stepY = -(newHeight + margin);
      break;

    case 'left': // Leftward neighbor (⌥+Left)
      candX = targetNode.position.x - (newWidth + 80);
      candY = targetNode.position.y;
      stepX = -(newWidth + margin);
      stepY = 0;
      break;
  }

  // Linear ray stepping in the search direction
  for (let i = 0; i < maxIterations; i++) {
    const candidateBox: BoundingBox = {
      x: candX,
      y: candY,
      width: newWidth,
      height: newHeight,
    };

    const hasCollision = obstacles.some((obs) =>
      checkAABBCollision(candidateBox, obs, margin)
    );

    if (!hasCollision) {
      return { x: candX, y: candY };
    }

    candX += stepX;
    candY += stepY;
  }

  // Fallback: 2D radial / spiral search around initial candidate if ray stepping reached maxIterations
  const initialX = targetNode.position.x + (direction === 'right' ? targetW + 80 : 0);
  const initialY = targetNode.position.y + (direction === 'bottom' ? targetH + 40 : 0);
  const spiralStep = Math.max(newWidth, newHeight) + margin;

  for (let ring = 1; ring <= 10; ring++) {
    const radius = ring * spiralStep;
    const angles = 8 * ring;
    for (let a = 0; a < angles; a++) {
      const theta = (2 * Math.PI * a) / angles;
      const testX = Math.round(initialX + radius * Math.cos(theta));
      const testY = Math.round(initialY + radius * Math.sin(theta));

      const candidateBox: BoundingBox = {
        x: testX,
        y: testY,
        width: newWidth,
        height: newHeight,
      };

      const hasCollision = obstacles.some((obs) =>
        checkAABBCollision(candidateBox, obs, margin)
      );

      if (!hasCollision) {
        return { x: testX, y: testY };
      }
    }
  }

  return { x: candX, y: candY };
}

/**
 * Calculates parent frame auto-growth if a new child node position extends past frame borders.
 */
export function calculateFrameAutoGrowth(
  frameNode: NeuroNode,
  childNodes: NeuroNode[],
  newCandidate: Point,
  newSize: Size,
  padding: number = 40
): Size {
  const currentW = frameNode.width ?? 320;
  const currentH = frameNode.height ?? 240;

  let maxX = newCandidate.x + newSize.width + padding;
  let maxY = newCandidate.y + newSize.height + padding;

  for (const child of childNodes) {
    maxX = Math.max(maxX, child.position.x + (child.width ?? 160) + padding);
    maxY = Math.max(maxY, child.position.y + (child.height ?? 60) + padding);
  }

  return {
    width: Math.max(currentW, maxX),
    height: Math.max(currentH, maxY),
  };
}
