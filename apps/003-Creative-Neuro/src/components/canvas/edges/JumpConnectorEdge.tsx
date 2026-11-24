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
  useReactFlow,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
} from '@xyflow/react';
import type { NeuroEdge, Point } from '../../../types/index.ts';
import {
  crossProduct2D,
  GraphRoutingEngine,
  computeSmartLabelPosition,
  computeJumpArcsForEdge,
  buildJumpSvgPath,
  type JumpArcData,
  type LeafRect,
} from '../../../engine/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { EdgeFloatingActionBar } from './EdgeFloatingActionBar.tsx';

export type { JumpArcData };

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
  const rf = useReactFlow();
  const isInStore = useProjectStore((s) => Boolean(s.edges[id]));
  const storeSelectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);
  const storeSelectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const themeMode = useProjectStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';

  const effectiveSelectedEdgeIds = isInStore
    ? storeSelectedEdgeIds
    : allEdges.filter((e) => e.selected).map((e) => e.id);
  const effectiveSelectedNodeIds = isInStore
    ? storeSelectedNodeIds
    : allNodes.filter((n) => n.selected).map((n) => n.id);

  const isSelectedInStore = storeSelectedEdgeIds.includes(id);
  const isEdgeSelected = Boolean(selected || isSelectedInStore);
  const isMultiEdge = effectiveSelectedEdgeIds.length > 1;
  const activeMenuEdgeId = isMultiEdge
    ? effectiveSelectedEdgeIds[effectiveSelectedEdgeIds.length - 1]
    : id;
  const hasMultiNodeSelection = effectiveSelectedNodeIds.length > 1;
  const shouldShowActionBar =
    isEdgeSelected &&
    (!isMultiEdge || id === activeMenuEdgeId) &&
    !hasMultiNodeSelection;

  const jumpRadius = data?.strokeWidth ? Math.max(6, data.strokeWidth * 2.5) : 6;
  const isJumpEnabled = data?.jumpArc !== false;
  const routingType = data?.routingType;

  // Build quick lookup for node centers/handles to resolve other edges' endpoints (resolving parentId relative coordinates)
  const nodeMap = useMemo(() => {
    const rawMap = new Map(allNodes.map((n) => [n.id, n]));
    const map = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();
    for (const n of allNodes) {
      let absX = n.position.x;
      let absY = n.position.y;
      let currParent = n.parentId;
      const seen = new Set<string>();
      while (currParent && !seen.has(currParent)) {
        seen.add(currParent);
        const parent = rawMap.get(currParent);
        if (!parent) break;
        absX += parent.position.x;
        absY += parent.position.y;
        currParent = parent.parentId;
      }
      map.set(n.id, {
        x: absX,
        y: absY,
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
    const p1: Point = { x: sourceX, y: sourceY };
    const p2: Point = { x: targetX, y: targetY };

    // Smart label placement that avoids leaf nodes and other edge labels across all routing types
    let midX = (sourceX + targetX) / 2;
    let midY = (sourceY + targetY) / 2;

    const hasLabel = Boolean(label || data?.label);
    if (hasLabel) {
      const leafRects: LeafRect[] = [];
      for (const n of allNodes) {
        if (n.type === 'frame') continue;
        const b = nodeMap.get(n.id);
        if (b) {
          leafRects.push({ x: b.x, y: b.y, w: b.width, h: b.height });
        }
      }

      const labelPt = computeSmartLabelPosition({
        p1,
        p2,
        edgeId: id,
        allEdges,
        leafRects,
        getHandlePoint,
      });
      midX = labelPt.x;
      midY = labelPt.y;
    }

    // 1. Smoothstep (Orthogonal Step Line)
    if (routingType === 'smoothstep') {
      const [path] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8,
      });
      return { path, labelX: midX, labelY: midY };
    }

    // 2. Bezier (Curved Smooth Line)
    if (routingType === 'bezier') {
      const [path] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      return { path, labelX: midX, labelY: midY };
    }

    // 3. Straight Line
    if (routingType === 'straight') {
      const [path] = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      });
      return { path, labelX: midX, labelY: midY };
    }

    // 4. Default: Jump Arc Intersection Path
    if (!isJumpEnabled) {
      return {
        path: `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
        labelX: midX,
        labelY: midY,
      };
    }

    const jumps = computeJumpArcsForEdge(
      id,
      p1,
      p2,
      allEdges,
      getHandlePoint,
      jumpRadius
    );

    const path = buildJumpSvgPath(p1, p2, jumps);
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

  // Resolved Arrow Markers with resilient SVG marker fallbacks
  const fallbackMarkerEndId = `neuro-marker-end-${id}`;
  const fallbackMarkerStartId = `neuro-marker-start-${id}`;
  const needsFallbackMarkerEnd = data?.arrowEnd !== false && !markerEnd;
  const needsFallbackMarkerStart = Boolean(data?.arrowStart) && !markerStart && !markerEnd;

  const resolvedMarkerEnd =
    data?.arrowEnd === false
      ? undefined
      : markerEnd || `url(#${fallbackMarkerEndId})`;

  const resolvedMarkerStart =
    data?.arrowStart
      ? markerStart || markerEnd || `url(#${fallbackMarkerStartId})`
      : undefined;

  return (
    <>
      {(needsFallbackMarkerEnd || needsFallbackMarkerStart) && (
        <defs>
          {needsFallbackMarkerEnd && (
            <marker
              id={fallbackMarkerEndId}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <polyline
                points="0 1, 10 5, 0 9, 2 5"
                fill={strokeColor}
                stroke={strokeColor}
                strokeLinejoin="round"
              />
            </marker>
          )}
          {needsFallbackMarkerStart && (
            <marker
              id={fallbackMarkerStartId}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <polyline
                points="0 1, 10 5, 0 9, 2 5"
                fill={strokeColor}
                stroke={strokeColor}
                strokeLinejoin="round"
              />
            </marker>
          )}
        </defs>
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={resolvedMarkerEnd}
        markerStart={resolvedMarkerStart}
        interactionWidth={24}
      />

      {/* Endpoints hollow circles when edge is selected indicating reconnectable handles */}
      {isEdgeSelected && (
        <g className="react-flow__edge-endpoints" data-testid={`edge-endpoints-${id}`}>
          {/* Source endpoint hollow circle */}
          <circle
            cx={sourceX}
            cy={sourceY}
            r={5}
            fill={isDark ? '#0f172a' : '#ffffff'}
            stroke="#06b6d4"
            strokeWidth={2}
            className="react-flow__edge-endpoint react-flow__edge-endpoint-source pointer-events-none"
            data-testid={`edge-endpoint-source-${id}`}
            style={{
              filter: 'drop-shadow(0 0 3px rgba(6, 182, 212, 0.4))',
            }}
          />
          {/* Target endpoint hollow circle */}
          <circle
            cx={targetX}
            cy={targetY}
            r={5}
            fill={isDark ? '#0f172a' : '#ffffff'}
            stroke="#06b6d4"
            strokeWidth={2}
            className="react-flow__edge-endpoint react-flow__edge-endpoint-target pointer-events-none"
            data-testid={`edge-endpoint-target-${id}`}
            style={{
              filter: 'drop-shadow(0 0 3px rgba(6, 182, 212, 0.4))',
            }}
          />
        </g>
      )}

      <EdgeLabelRenderer>
        {/* Floating Quick Setting Menu when edge is selected */}
        {shouldShowActionBar && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 10}px)`,
              pointerEvents: 'all',
              zIndex: 999999,
            }}
          >
            <EdgeFloatingActionBar
              edgeId={id}
              edgeIds={isMultiEdge ? effectiveSelectedEdgeIds : undefined}
            />
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
              if (!store.edges[id]) {
                const isMulti = e.metaKey || e.ctrlKey || e.shiftKey;
                rf.setEdges((eds) =>
                  eds.map((edge) => ({
                    ...edge,
                    selected: isMulti
                      ? edge.id === id
                        ? !edge.selected
                        : edge.selected
                      : edge.id === id,
                  }))
                );
                if (!isMulti) {
                  rf.setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
                }
                return;
              }
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
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-900/95 text-slate-200 border border-slate-700/80 shadow-md backdrop-blur select-none cursor-pointer hover:border-indigo-500 transition-colors whitespace-pre-line text-center max-w-[260px] leading-snug"
          >
            {edgeLabel}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export default React.memo(JumpConnectorEdge);
