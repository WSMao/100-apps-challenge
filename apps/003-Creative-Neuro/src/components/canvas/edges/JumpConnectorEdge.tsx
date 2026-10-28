/**
 * Creative-Neuro Canvas Subsystem - Custom Jump Connector Edge
 * Path: src/components/canvas/edges/JumpConnectorEdge.tsx
 *
 * Implements:
 * - 2D vector cross-product line jump arc calculation (R = 6px)
 * - Deterministic crossing priority (horizontal over vertical, edge ID tie-break)
 * - Multi-crossing t-sorting and overlap suppression
 * - EdgeLabelRenderer for inline edge labels
 * - Selection highlighting and custom styling
 */

import React, { useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  useEdges,
  useNodes,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
} from '@xyflow/react';
import type { NeuroEdge, Point } from '../../../types/index.ts';
import { crossProduct2D } from '../../../engine/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { EdgeFloatingActionBar } from './EdgeFloatingActionBar.tsx';

export interface JumpArcData {
  t: number;
  crossingPoint: Point;
  startPoint: Point;
  endPoint: Point;
  radius: number;
}

export function JumpConnectorEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style = {},
  markerEnd,
  markerStart,
  label,
  data: rawData,
}: EdgeProps) {
  const data = rawData as unknown as NeuroEdge['data'];
  const allEdges = useEdges();
  const allNodes = useNodes();
  const selectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);
  const isSelectedInStore = selectedEdgeIds.includes(id);
  const isEdgeSelected = Boolean(selected || isSelectedInStore);
  const isMultiEdge = selectedEdgeIds.length > 1;
  const activeMenuEdgeId = isMultiEdge ? selectedEdgeIds[selectedEdgeIds.length - 1] : id;
  const shouldShowActionBar = isEdgeSelected && (!isMultiEdge || id === activeMenuEdgeId);

  const jumpRadius = data?.strokeWidth ? Math.max(6, data.strokeWidth * 2.5) : 6;
  const isJumpEnabled = data?.jumpArc !== false;
  const routingType = data?.routingType;

  // Build quick lookup for node centers/handles to resolve other edges' endpoints
  const nodeMap = useMemo(() => {
    const map = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();
    for (const n of allNodes) {
      map.set(n.id, {
        x: n.position.x,
        y: n.position.y,
        width: n.width ?? n.measured?.width ?? 160,
        height: n.height ?? n.measured?.height ?? 60,
      });
    }
    return map;
  }, [allNodes]);

  // Helper to resolve handle coordinates of another edge
  const getHandlePoint = (
    nodeId: string,
    handleId?: string | null,
    defaultSide: 'top' | 'right' | 'bottom' | 'left' = 'bottom'
  ): Point | null => {
    const n = nodeMap.get(nodeId);
    if (!n) return null;
    const rawSide = handleId || defaultSide;
    const side = (rawSide ? rawSide.replace('-plus', '') : defaultSide) as 'top' | 'right' | 'bottom' | 'left';
    switch (side) {
      case 'top':
        return { x: n.x + n.width / 2, y: n.y };
      case 'bottom':
        return { x: n.x + n.width / 2, y: n.y + n.height };
      case 'left':
        return { x: n.x, y: n.y + n.height / 2 };
      case 'right':
        return { x: n.x + n.width, y: n.y + n.height / 2 };
      default:
        return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
    }
  };

  // Compute edge path according to routingType
  const { path: edgePath, labelX, labelY } = useMemo(() => {
    // 1. Smoothstep (Orthogonal Step Line)
    if (routingType === 'smoothstep') {
      const [path, lx, ly] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8,
      });
      return { path, labelX: lx, labelY: ly };
    }

    // 2. Bezier (Curved Smooth Line)
    if (routingType === 'bezier') {
      const [path, lx, ly] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      return { path, labelX: lx, labelY: ly };
    }

    // 3. Straight Line
    if (routingType === 'straight') {
      const [path, lx, ly] = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      });
      return { path, labelX: lx, labelY: ly };
    }

    // 4. Default: Jump Arc Intersection Path
    const p1: Point = { x: sourceX, y: sourceY };
    const p2: Point = { x: targetX, y: targetY };

    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    const u = { x: p2.x - p1.x, y: p2.y - p1.y };
    const uLen = Math.hypot(u.x, u.y);

    // Degenerate short edge or jump disabled
    if (uLen < jumpRadius * 2.5 || !isJumpEnabled) {
      return {
        path: `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
        labelX: midX,
        labelY: midY,
      };
    }

    const normU = { x: u.x / uLen, y: u.y / uLen };
    const minT = Math.max(0.05, (jumpRadius + 2) / uLen);
    const maxT = 1 - minT;

    const jumps: JumpArcData[] = [];

    // Compare against other visible edges
    for (const other of allEdges) {
      if (other.id === id) continue;

      const otherAny = other as unknown as {
        sourceX?: number;
        sourceY?: number;
        targetX?: number;
        targetY?: number;
        source: string;
        target: string;
        sourceHandle?: string | null;
        targetHandle?: string | null;
      };

      const q1: Point | null =
        typeof otherAny.sourceX === 'number' && typeof otherAny.sourceY === 'number'
          ? { x: otherAny.sourceX, y: otherAny.sourceY }
          : getHandlePoint(otherAny.source, otherAny.sourceHandle, 'bottom');

      const q2: Point | null =
        typeof otherAny.targetX === 'number' && typeof otherAny.targetY === 'number'
          ? { x: otherAny.targetX, y: otherAny.targetY }
          : getHandlePoint(otherAny.target, otherAny.targetHandle, 'top');

      if (!q1 || !q2) continue;

      const v = { x: q2.x - q1.x, y: q2.y - q1.y };
      const vLen = Math.hypot(v.x, v.y);
      if (vLen < 1e-4) continue;

      const D = crossProduct2D(u, v);
      if (Math.abs(D) < 1e-6) continue; // Parallel or colinear

      const w = { x: q1.x - p1.x, y: q1.y - p1.y };
      const t = crossProduct2D(w, v) / D;
      const s = crossProduct2D(w, u) / D;

      const minS = Math.max(0.05, (jumpRadius + 2) / vLen);
      const maxS = 1 - minS;

      if (t >= minT && t <= maxT && s >= minS && s <= maxS) {
        // Priority check: horizontal jumps over vertical, otherwise lexicographical edge ID
        const s1IsHorizontal = Math.abs(u.y) < 1e-3;
        const s2IsVertical = Math.abs(v.x) < 1e-3;

        let s1ShouldJump = false;
        if (s1IsHorizontal && s2IsVertical) {
          s1ShouldJump = true;
        } else if (Math.abs(u.x) < 1e-3 && Math.abs(v.y) < 1e-3) {
          s1ShouldJump = false;
        } else {
          s1ShouldJump = id < other.id;
        }

        if (s1ShouldJump) {
          const crossX = p1.x + t * u.x;
          const crossY = p1.y + t * u.y;

          jumps.push({
            t,
            crossingPoint: { x: crossX, y: crossY },
            startPoint: {
              x: crossX - jumpRadius * normU.x,
              y: crossY - jumpRadius * normU.y,
            },
            endPoint: {
              x: crossX + jumpRadius * normU.x,
              y: crossY + jumpRadius * normU.y,
            },
            radius: jumpRadius,
          });
        }
      }
    }

    if (jumps.length === 0) {
      return {
        path: `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
        labelX: midX,
        labelY: midY,
      };
    }

    // Sort by parameter t ascending
    jumps.sort((a, b) => a.t - b.t);

    // Build SVG path with arc bridges
    let path = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
    let lastT = 0;

    for (let i = 0; i < jumps.length; i++) {
      const jump = jumps[i];

      // Suppress overlapping arcs closer than 2.2 * radius
      if (i > 0 && (jump.t - lastT) * uLen < jumpRadius * 2.2) {
        continue;
      }
      lastT = jump.t;

      path += ` L ${jump.startPoint.x.toFixed(2)} ${jump.startPoint.y.toFixed(2)}`;
      path += ` A ${jump.radius} ${jump.radius} 0 0 1 ${jump.endPoint.x.toFixed(2)} ${jump.endPoint.y.toFixed(2)}`;
    }

    path += ` L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;

    return { path, labelX: midX, labelY: midY };
  }, [
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    routingType,
    allEdges,
    nodeMap,
    jumpRadius,
    isJumpEnabled,
  ]);

  // Visual styling
  const strokeColor = isEdgeSelected
    ? '#06b6d4'
    : data?.color || (style?.stroke as string) || '#64748b';

  const strokeWidth = isEdgeSelected
    ? Math.max(2.5, (data?.strokeWidth || 1.5) + 1)
    : data?.strokeWidth || (style?.strokeWidth as number) || 1.5;

  const strokeDasharray =
    data?.lineStyle === 'dashed'
      ? '6 6'
      : data?.lineStyle === 'dotted'
      ? '2 4'
      : undefined;

  const edgeStyle: React.CSSProperties = {
    ...style,
    stroke: strokeColor,
    strokeWidth,
    strokeDasharray,
    filter: isEdgeSelected ? 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.5))' : undefined,
    transition: 'stroke 0.2s, stroke-width 0.2s',
  };

  const edgeLabel = label || data?.label;

  // Resolved Arrow Markers
  const resolvedMarkerEnd = data?.arrowEnd === false ? undefined : markerEnd;
  const resolvedMarkerStart = data?.arrowStart ? markerStart || markerEnd : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={resolvedMarkerEnd}
        markerStart={resolvedMarkerStart}
        interactionWidth={24}
      />

      <EdgeLabelRenderer>
        {/* Floating Quick Setting Menu when edge is selected */}
        {shouldShowActionBar && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 10}px)`,
              pointerEvents: 'all',
              zIndex: 99999,
            }}
          >
            <EdgeFloatingActionBar edgeId={id} edgeIds={isMultiEdge ? selectedEdgeIds : undefined} />
          </div>
        )}

        {edgeLabel && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onClick={(e) => {
              e.stopPropagation();
              const store = useProjectStore.getState();
              if (store.toolMode === 'select') {
                const isMulti = e.metaKey || e.ctrlKey || e.shiftKey;
                if (isMulti) {
                  const next = store.selectedEdgeIds.includes(id)
                    ? store.selectedEdgeIds.filter((eid) => eid !== id)
                    : [...store.selectedEdgeIds, id];
                  store.setSelectedEdges(next);
                } else {
                  store.setSelectedEdges([id]);
                  store.setSelectedNodes([]);
                }
              }
            }}
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-900/90 text-slate-200 border border-slate-700/80 shadow-md backdrop-blur select-none cursor-pointer hover:border-indigo-500 transition-colors"
          >
            {edgeLabel}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export default React.memo(JumpConnectorEdge);
