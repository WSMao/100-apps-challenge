/**
 * Creative-Neuro Layer 2 Pure Alignment & Snapping Engine
 * Path: src/engine/geometry/alignmentEngine.ts
 *
 * Provides:
 * 1. Manual multi-object alignment & distribution (`calculateAlignmentPositions`)
 *    - Excludes locked objects (`locked === true` or `data?.locked === true`) from movement.
 * 2. Live drag & resize auto-snapping with visual alignment guides (`computeDragSnap`, `computeResizeSnap`).
 */

import type { NeuroNode, Point } from '../../types/index.ts';

export type AlignmentActionType =
  | 'align-left'
  | 'align-center-h'
  | 'align-right'
  | 'align-top'
  | 'align-center-v'
  | 'align-bottom'
  | 'distribute-h'
  | 'distribute-v';

export interface AlignmentGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
  kind: 'edge' | 'center';
}

export interface SnapRect {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapOptions {
  snapThreshold?: number;
  gridSize?: number;
  snapToGrid?: boolean;
  snapToObjects?: boolean;
}

export interface DragSnapResult {
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export interface ResizeSnapConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface ResizeSnapResult {
  bounds: { x: number; y: number; width: number; height: number };
  guides: AlignmentGuide[];
}

function getNodeSize(node: Pick<NeuroNode, 'width' | 'height' | 'measured'>): {
  width: number;
  height: number;
} {
  return {
    width: node.width ?? node.measured?.width ?? 160,
    height: node.height ?? node.measured?.height ?? 60,
  };
}

function isNodeLocked(node: Pick<NeuroNode, 'locked' | 'data'>): boolean {
  return Boolean(node.locked || node.data?.locked);
}

/**
 * Computes new positions for unlocked nodes in a multi-selection alignment or distribution action.
 * Locked nodes (`locked: true` or `data.locked: true`) are never included in the returned updates.
 */
export function calculateAlignmentPositions(
  nodes: NeuroNode[],
  action: AlignmentActionType
): Record<string, Point> {
  if (nodes.length < 2) return {};
  if ((action === 'distribute-h' || action === 'distribute-v') && nodes.length < 3) {
    return {};
  }

  const unlockedNodes = nodes.filter((n) => !isNodeLocked(n));
  if (unlockedNodes.length === 0) return {};

  const rects = nodes.map((n) => {
    const { width, height } = getNodeSize(n);
    return {
      node: n,
      locked: isNodeLocked(n),
      x: n.position.x,
      y: n.position.y,
      width,
      height,
      right: n.position.x + width,
      bottom: n.position.y + height,
    };
  });

  const minX = Math.min(...rects.map((r) => r.x));
  const maxRight = Math.max(...rects.map((r) => r.right));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxBottom = Math.max(...rects.map((r) => r.bottom));
  const centerX = (minX + maxRight) / 2;
  const centerY = (minY + maxBottom) / 2;

  const updates: Record<string, Point> = {};

  if (action === 'distribute-h') {
    const sorted = [...rects].sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = last.right - first.x;
    const totalWidths = sorted.reduce((sum, r) => sum + r.width, 0);
    const gap = (totalSpan - totalWidths) / (sorted.length - 1);

    let cursor = first.x + first.width + gap;
    for (let i = 1; i < sorted.length - 1; i++) {
      const item = sorted[i];
      if (!item.locked && Math.round(cursor) !== item.x) {
        updates[item.node.id] = { x: Math.round(cursor), y: item.y };
      }
      cursor += item.width + gap;
    }
    return updates;
  }

  if (action === 'distribute-v') {
    const sorted = [...rects].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = last.bottom - first.y;
    const totalHeights = sorted.reduce((sum, r) => sum + r.height, 0);
    const gap = (totalSpan - totalHeights) / (sorted.length - 1);

    let cursor = first.y + first.height + gap;
    for (let i = 1; i < sorted.length - 1; i++) {
      const item = sorted[i];
      if (!item.locked && Math.round(cursor) !== item.y) {
        updates[item.node.id] = { x: item.x, y: Math.round(cursor) };
      }
      cursor += item.height + gap;
    }
    return updates;
  }

  for (const r of rects) {
    if (r.locked) continue;
    let nextX = r.x;
    let nextY = r.y;

    switch (action) {
      case 'align-left':
        nextX = minX;
        break;
      case 'align-right':
        nextX = maxRight - r.width;
        break;
      case 'align-center-h':
        nextX = Math.round(centerX - r.width / 2);
        break;
      case 'align-top':
        nextY = minY;
        break;
      case 'align-bottom':
        nextY = maxBottom - r.height;
        break;
      case 'align-center-v':
        nextY = Math.round(centerY - r.height / 2);
        break;
    }

    if (nextX !== r.x || nextY !== r.y) {
      updates[r.node.id] = { x: nextX, y: nextY };
    }
  }

  return updates;
}

interface AxisCandidate {
  value: number;
  kind: 'edge' | 'center';
  rect: SnapRect;
}

function getAxisCandidates(rects: SnapRect[], axis: 'x' | 'y'): AxisCandidate[] {
  const candidates: AxisCandidate[] = [];
  for (const r of rects) {
    if (axis === 'x') {
      candidates.push({ value: r.x, kind: 'edge', rect: r });
      candidates.push({ value: r.x + r.width / 2, kind: 'center', rect: r });
      candidates.push({ value: r.x + r.width, kind: 'edge', rect: r });
    } else {
      candidates.push({ value: r.y, kind: 'edge', rect: r });
      candidates.push({ value: r.y + r.height / 2, kind: 'center', rect: r });
      candidates.push({ value: r.y + r.height, kind: 'edge', rect: r });
    }
  }
  return candidates;
}

function findBestAxisSnap(
  activeAnchors: Array<{ value: number; offset: number; kind: 'edge' | 'center' }>,
  candidates: AxisCandidate[],
  threshold: number
): { delta: number; snappedPos: number; kind: 'edge' | 'center'; matchedRects: SnapRect[] } | null {
  let bestDist = Infinity;
  let bestDelta = 0;
  let bestPos = 0;
  let bestKind: 'edge' | 'center' = 'edge';

  for (const anchor of activeAnchors) {
    for (const cand of candidates) {
      const dist = Math.abs(anchor.value - cand.value);
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        bestDelta = cand.value - anchor.value;
        bestPos = cand.value;
        bestKind = anchor.kind === 'center' || cand.kind === 'center' ? 'center' : 'edge';
      }
    }
  }

  if (bestDist > threshold) return null;

  const matchedRects = candidates
    .filter((c) => Math.abs(c.value - bestPos) < 0.5)
    .map((c) => c.rect);

  return { delta: bestDelta, snappedPos: bestPos, kind: bestKind, matchedRects };
}

/**
 * Computes snapped position and alignment guides during node drag.
 * Prioritizes object edge/centerline snapping within `snapThreshold`,
 * falling back to `gridSize` grid snapping when no object aligns.
 */
export function computeDragSnap(
  activeRect: SnapRect,
  otherRects: SnapRect[],
  options: SnapOptions = {}
): DragSnapResult {
  const threshold = options.snapThreshold ?? 6;
  const gridSize = options.gridSize ?? 16;
  const snapToGrid = options.snapToGrid ?? true;
  const snapToObjects = options.snapToObjects ?? true;

  let nextX = activeRect.x;
  let nextY = activeRect.y;

  const xMatch = snapToObjects
    ? findBestAxisSnap(
        [
          { value: activeRect.x, offset: 0, kind: 'edge' },
          { value: activeRect.x + activeRect.width / 2, offset: activeRect.width / 2, kind: 'center' },
          { value: activeRect.x + activeRect.width, offset: activeRect.width, kind: 'edge' },
        ],
        getAxisCandidates(otherRects, 'x'),
        threshold
      )
    : null;

  if (xMatch) {
    nextX = Math.round((activeRect.x + xMatch.delta) * 100) / 100;
  } else if (snapToGrid) {
    nextX = Math.round(activeRect.x / gridSize) * gridSize;
  }

  const yMatch = snapToObjects
    ? findBestAxisSnap(
        [
          { value: activeRect.y, offset: 0, kind: 'edge' },
          { value: activeRect.y + activeRect.height / 2, offset: activeRect.height / 2, kind: 'center' },
          { value: activeRect.y + activeRect.height, offset: activeRect.height, kind: 'edge' },
        ],
        getAxisCandidates(otherRects, 'y'),
        threshold
      )
    : null;

  if (yMatch) {
    nextY = Math.round((activeRect.y + yMatch.delta) * 100) / 100;
  } else if (snapToGrid) {
    nextY = Math.round(activeRect.y / gridSize) * gridSize;
  }

  const guides: AlignmentGuide[] = [];
  if (xMatch) {
    const start = Math.min(nextY, ...xMatch.matchedRects.map((r) => r.y));
    const end = Math.max(
      nextY + activeRect.height,
      ...xMatch.matchedRects.map((r) => r.y + r.height)
    );
    guides.push({
      orientation: 'vertical',
      position: xMatch.snappedPos,
      start,
      end,
      kind: xMatch.kind,
    });
  }
  if (yMatch) {
    const start = Math.min(nextX, ...yMatch.matchedRects.map((r) => r.x));
    const end = Math.max(
      nextX + activeRect.width,
      ...yMatch.matchedRects.map((r) => r.x + r.width)
    );
    guides.push({
      orientation: 'horizontal',
      position: yMatch.snappedPos,
      start,
      end,
      kind: yMatch.kind,
    });
  }

  return { x: nextX, y: nextY, guides };
}

/**
 * Computes snapped resize bounds and alignment guides during node resize.
 * Snaps moving edges (w/e/n/s) to nearby object edges/centerlines or falls back to grid.
 */
export function computeResizeSnap(
  proposedBounds: { x: number; y: number; width: number; height: number },
  dir: ResizeDirection,
  otherRects: SnapRect[],
  constraints: ResizeSnapConstraints = {},
  options: SnapOptions = {}
): ResizeSnapResult {
  const threshold = options.snapThreshold ?? 6;
  const gridSize = options.gridSize ?? 16;
  const snapToGrid = options.snapToGrid ?? true;
  const snapToObjects = options.snapToObjects ?? true;
  const minW = constraints.minWidth ?? 60;
  const minH = constraints.minHeight ?? 36;
  const maxW = constraints.maxWidth ?? 4000;
  const maxH = constraints.maxHeight ?? 4000;

  let { x, y, width, height } = proposedBounds;
  const guides: AlignmentGuide[] = [];

  const xCandidates = snapToObjects ? getAxisCandidates(otherRects, 'x') : [];
  const yCandidates = snapToObjects ? getAxisCandidates(otherRects, 'y') : [];

  let xMatchRects: SnapRect[] = [];
  let xGuidePos: number | null = null;
  let xGuideKind: 'edge' | 'center' = 'edge';

  if (dir.includes('w')) {
    const rightAnchor = x + width;
    const match = snapToObjects
      ? findBestAxisSnap([{ value: x, offset: 0, kind: 'edge' }], xCandidates, threshold)
      : null;
    if (match) {
      const candidateW = rightAnchor - match.snappedPos;
      if (candidateW >= minW && candidateW <= maxW) {
        x = match.snappedPos;
        width = candidateW;
        xMatchRects = match.matchedRects;
        xGuidePos = match.snappedPos;
        xGuideKind = match.kind;
      }
    } else if (snapToGrid) {
      const snappedX = Math.round(x / gridSize) * gridSize;
      const candidateW = rightAnchor - snappedX;
      if (candidateW >= minW && candidateW <= maxW) {
        x = snappedX;
        width = candidateW;
      }
    }
  } else if (dir.includes('e')) {
    const rightEdge = x + width;
    const match = snapToObjects
      ? findBestAxisSnap([{ value: rightEdge, offset: width, kind: 'edge' }], xCandidates, threshold)
      : null;
    if (match) {
      const candidateW = match.snappedPos - x;
      if (candidateW >= minW && candidateW <= maxW) {
        width = candidateW;
        xMatchRects = match.matchedRects;
        xGuidePos = match.snappedPos;
        xGuideKind = match.kind;
      }
    } else if (snapToGrid) {
      const snappedRight = Math.round(rightEdge / gridSize) * gridSize;
      const candidateW = snappedRight - x;
      if (candidateW >= minW && candidateW <= maxW) {
        width = candidateW;
      }
    }
  }

  let yMatchRects: SnapRect[] = [];
  let yGuidePos: number | null = null;
  let yGuideKind: 'edge' | 'center' = 'edge';

  if (dir.includes('n')) {
    const bottomAnchor = y + height;
    const match = snapToObjects
      ? findBestAxisSnap([{ value: y, offset: 0, kind: 'edge' }], yCandidates, threshold)
      : null;
    if (match) {
      const candidateH = bottomAnchor - match.snappedPos;
      if (candidateH >= minH && candidateH <= maxH) {
        y = match.snappedPos;
        height = candidateH;
        yMatchRects = match.matchedRects;
        yGuidePos = match.snappedPos;
        yGuideKind = match.kind;
      }
    } else if (snapToGrid) {
      const snappedY = Math.round(y / gridSize) * gridSize;
      const candidateH = bottomAnchor - snappedY;
      if (candidateH >= minH && candidateH <= maxH) {
        y = snappedY;
        height = candidateH;
      }
    }
  } else if (dir.includes('s')) {
    const bottomEdge = y + height;
    const match = snapToObjects
      ? findBestAxisSnap([{ value: bottomEdge, offset: height, kind: 'edge' }], yCandidates, threshold)
      : null;
    if (match) {
      const candidateH = match.snappedPos - y;
      if (candidateH >= minH && candidateH <= maxH) {
        height = candidateH;
        yMatchRects = match.matchedRects;
        yGuidePos = match.snappedPos;
        yGuideKind = match.kind;
      }
    } else if (snapToGrid) {
      const snappedBottom = Math.round(bottomEdge / gridSize) * gridSize;
      const candidateH = snappedBottom - y;
      if (candidateH >= minH && candidateH <= maxH) {
        height = candidateH;
      }
    }
  }

  if (xGuidePos !== null) {
    guides.push({
      orientation: 'vertical',
      position: xGuidePos,
      start: Math.min(y, ...xMatchRects.map((r) => r.y)),
      end: Math.max(y + height, ...xMatchRects.map((r) => r.y + r.height)),
      kind: xGuideKind,
    });
  }
  if (yGuidePos !== null) {
    guides.push({
      orientation: 'horizontal',
      position: yGuidePos,
      start: Math.min(x, ...yMatchRects.map((r) => r.x)),
      end: Math.max(x + width, ...yMatchRects.map((r) => r.x + r.width)),
      kind: yGuideKind,
    });
  }

  return { bounds: { x, y, width, height }, guides };
}
