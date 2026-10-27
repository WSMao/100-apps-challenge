/**
 * Creative-Neuro Canvas Subsystem - Custom Shape Node
 * Path: src/components/canvas/nodes/ShapeNode.tsx
 *
 * Implements:
 * - 10+ pure SVG shape geometries (rectangle, rounded, stadium/pill, diamond,
 *   circle, cylinder/database, subroutine, asymmetry/note, inverted_trapezoid,
 *   parallelogram, hexagon)
 * - 4-direction hover quick-add (+) buttons powered by findCollisionFreePosition
 * - 4-way connection handles (top, right, bottom, left)
 * - Double-click inline label editing
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';

import type { NeuroNode, ShapeType } from '../../../types/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import {
  findCollisionFreePosition,
  type PlacementDirection,
} from '../../../engine/index.ts';
import { NodeFloatingActionBar } from '../NodeFloatingActionBar.tsx';

export type NormalizedShape =
  | 'rectangle'
  | 'rounded'
  | 'stadium'
  | 'diamond'
  | 'circle'
  | 'cylinder'
  | 'subroutine'
  | 'asymmetry'
  | 'inverted_trapezoid'
  | 'parallelogram'
  | 'hexagon';

export function normalizeShapeType(raw?: ShapeType | string): NormalizedShape {
  const s = raw?.toLowerCase().replace(/[-_ ]/g, '') || 'rectangle';
  if (s === 'rect' || s === 'rectangle') return 'rectangle';
  if (s === 'round' || s === 'rounded') return 'rounded';
  if (s === 'stadium' || s === 'pill') return 'stadium';
  if (s === 'diamond') return 'diamond';
  if (s === 'circle') return 'circle';
  if (s === 'cylinder' || s === 'database') return 'cylinder';
  if (s === 'subroutine') return 'subroutine';
  if (s === 'asymmetry' || s === 'asymmetric' || s === 'note' || s === 'flag') return 'asymmetry';
  if (s.includes('trapezoid')) return 'inverted_trapezoid';
  if (s === 'parallelogram') return 'parallelogram';
  if (s === 'hexagon') return 'hexagon';
  return 'rectangle';
}

/**
 * Computes the exact intersection coordinates of the node's horizontal centerline (y = H / 2)
 * and vertical centerline (x = W / 2) with the rendered SVG boundary of the shape.
 */
export function getShapeHandleIntersections(
  W: number,
  H: number,
  rawShapeType?: ShapeType | string
): {
  top: { x: number; y: number };
  right: { x: number; y: number };
  bottom: { x: number; y: number };
  left: { x: number; y: number };
} {
  const shapeType = normalizeShapeType(rawShapeType);
  let leftX = 1;
  let rightX = W - 1;
  const topY = 1;
  const bottomY = H - 1;

  if (shapeType === 'asymmetry') {
    leftX = 14;
    rightX = W - 1;
  } else if (shapeType === 'inverted_trapezoid') {
    leftX = 8.5;
    rightX = W - 8.5;
  } else if (shapeType === 'parallelogram') {
    leftX = 9.5;
    rightX = W - 9.5;
  }

  return {
    top: { x: W / 2, y: topY },
    right: { x: rightX, y: H / 2 },
    bottom: { x: W / 2, y: bottomY },
    left: { x: leftX, y: H / 2 },
  };
}

/**
 * Spawns a new shape node in one of the 4 peripheral directions (top, right, bottom, left)
 * relative to the source node, creates a connecting edge between them, and immediately selects
 * the newly spawned node (clearing selection on the previous node).
 */
export function quickAddDirectionalNode(
  sourceNodeId: string,
  direction: PlacementDirection
): { nodeId: string; edgeId?: string } | null {
  const store = useProjectStore.getState();
  const activePage = store.pages[store.activePageId];
  const existingNodes = activePage
    ? activePage.nodeIds
        .map((nid) => store.nodes[nid])
        .filter((n): n is NeuroNode => Boolean(n))
    : Object.values(store.nodes);

  const targetNode = store.nodes[sourceNodeId];
  if (!targetNode) return null;

  const W = targetNode.width || 160;
  const H = targetNode.height || 60;

  const candidatePos = findCollisionFreePosition(targetNode, direction, existingNodes, {
    defaultWidth: W,
    defaultHeight: H,
    margin: 30,
  });

  const opposites: Record<PlacementDirection, { sourceHandle: string; targetHandle: string }> = {
    top: { sourceHandle: 'top', targetHandle: 'bottom' },
    right: { sourceHandle: 'right', targetHandle: 'left' },
    bottom: { sourceHandle: 'bottom', targetHandle: 'top' },
    left: { sourceHandle: 'left', targetHandle: 'right' },
  };

  const { sourceHandle, targetHandle } = opposites[direction];
  const defaultRouting = store.defaultEdgeRoutingType || 'jump';

  // Atomically create the connected node and edge
  const result = store.addConnectedNode(
    {
      type: 'shape',
      position: candidatePos,
      width: W,
      height: H,
      parentId: targetNode.parentId,
      extent: targetNode.extent,
      layoutMode: 'manual',
      data: {
        label: 'New Node',
        layoutMode: 'manual',
        shapeType: targetNode.data?.shapeType || 'rounded',
        backgroundColor: targetNode.data?.backgroundColor || '#1e293b',
        borderColor: targetNode.data?.borderColor || '#475569',
        color: targetNode.data?.color || '#f8fafc',
      },
    },
    {
      source: targetNode.id,
      target: '',
      sourceHandle,
      targetHandle,
      type: defaultRouting,
      data: {
        routingType: defaultRouting,
        jumpArc: defaultRouting === 'jump',
      },
    }
  );

  // Update directional spawn memory context for subsequent shortcuts
  store.setLastDirection(direction);

  // Immediately select the newly created node, clearing selection on previous node
  store.setSelectedNodes([result.nodeId]);

  return result;
}

export function ShapeNode({
  id,
  data: rawData,
  selected,
  width = 160,
  height = 60,
}: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const isEditingStore = useProjectStore((s) => s.editingNodeId === id);
  const editingInitialValue = useProjectStore((s) => s.editingInitialValue);
  const setEditingNodeId = useProjectStore((s) => s.setEditingNodeId);

  const [isEditingLocal, setIsEditingLocal] = useState(false);
  const isEditing = isEditingLocal || isEditingStore;
  const [label, setLabel] = useState(data?.label || 'New Node');
  const inputRef = useRef<HTMLInputElement>(null);

  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const connectorSourceNodeId = useProjectStore((s) => s.connectorSourceNodeId);
  const selectedNodeCount = useProjectStore((s) => s.selectedNodeIds.length);
  const isStoreSelected = useProjectStore((s) => s.selectedNodeIds.includes(id));
  const isConnectorSource = connectorSourceNodeId === id;
  const isNodeSelected = selected || isStoreSelected;

  useEffect(() => {
    if (!isEditing) {
      setLabel(data?.label || '');
    }
  }, [data?.label, isEditing]);

  useEffect(() => {
    if (isEditingStore) {
      const currentText = data?.label || '';
      const raw = currentText.trim().toLowerCase();
      const isPlaceholder =
        !raw ||
        raw === 'new node' ||
        raw === 'empty node' ||
        raw === 'child node' ||
        raw === 'sibling node';

      if (editingInitialValue !== null && editingInitialValue !== undefined) {
        if (editingInitialValue === '') {
          setLabel(isPlaceholder ? '' : currentText);
        } else if (isPlaceholder) {
          setLabel(editingInitialValue);
        } else {
          setLabel(currentText + editingInitialValue);
        }
      } else {
        setLabel(currentText);
      }
    }
  }, [isEditingStore, editingInitialValue, data?.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (editingInitialValue !== null && editingInitialValue !== undefined) {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      } else {
        inputRef.current.select();
      }
    }
  }, [isEditing, editingInitialValue, label]);

  const shapeType = normalizeShapeType(data?.shapeType);
  const W = width || 160;
  const H = height || 60;

  // Exact intersection coordinates of horizontal/vertical centerlines with the SVG shape boundary
  const handlePositions = useMemo(
    () => getShapeHandleIntersections(W, H, shapeType),
    [W, H, shapeType]
  );

  // Pure SVG Geometry Generator
  const shapeSvg = useMemo(() => {
    const strokeWidth = data?.borderWidth ?? 1.5;
    const fill = data?.backgroundColor || '#1e293b';
    const stroke = data?.borderColor || '#475569';
    const strokeDasharray =
      data?.borderStyle === 'dashed'
        ? '6 4'
        : data?.borderStyle === 'dotted'
        ? '2 3'
        : data?.style?.strokeDasharray;

    const commonProps = {
      fill,
      stroke,
      strokeWidth,
      strokeDasharray,
    };

    switch (shapeType) {
      case 'rounded':
        return (
          <rect
            x={1}
            y={1}
            width={W - 2}
            height={H - 2}
            rx={16}
            ry={16}
            {...commonProps}
          />
        );
      case 'stadium':
        return (
          <rect
            x={1}
            y={1}
            width={W - 2}
            height={H - 2}
            rx={(H - 2) / 2}
            ry={(H - 2) / 2}
            {...commonProps}
          />
        );
      case 'diamond':
        return (
          <polygon
            points={`${W / 2},1 ${W - 1},${H / 2} ${W / 2},${H - 1} 1,${H / 2}`}
            {...commonProps}
          />
        );
      case 'circle':
        return (
          <ellipse
            cx={W / 2}
            cy={H / 2}
            rx={(W - 2) / 2}
            ry={(H - 2) / 2}
            {...commonProps}
          />
        );
      case 'cylinder': {
        const ry = Math.min(10, H / 5);
        return (
          <g {...commonProps}>
            <path
              d={`M 1,${ry} L 1,${H - ry} A ${(W - 2) / 2} ${ry} 0 0 0 ${W - 1},${H - ry} L ${W - 1},${ry}`}
            />
            <ellipse cx={W / 2} cy={ry} rx={(W - 2) / 2} ry={ry} />
            <path
              d={`M 1,${ry} A ${(W - 2) / 2} ${ry} 0 0 0 ${W - 1},${ry}`}
              fill="none"
            />
          </g>
        );
      }
      case 'subroutine':
        return (
          <g {...commonProps}>
            <rect x={1} y={1} width={W - 2} height={H - 2} rx={2} />
            <line x1={12} y1={1} x2={12} y2={H - 1} />
            <line x1={W - 12} y1={1} x2={W - 12} y2={H - 1} />
          </g>
        );
      case 'asymmetry': {
        const notch = 14;
        return (
          <polygon
            points={`1,1 ${W - notch},1 ${W - 1},${H / 2} ${W - notch},${H - 1} 1,${H - 1} ${notch},${H / 2}`}
            {...commonProps}
          />
        );
      }
      case 'inverted_trapezoid': {
        const inset = 16;
        return (
          <polygon
            points={`1,1 ${W - 1},1 ${W - inset},${H - 1} ${inset},${H - 1}`}
            {...commonProps}
          />
        );
      }
      case 'parallelogram': {
        const skew = 18;
        return (
          <polygon
            points={`${skew},1 ${W - 1},1 ${W - skew},${H - 1} 1,${H - 1}`}
            {...commonProps}
          />
        );
      }
      case 'hexagon': {
        const off = 16;
        return (
          <polygon
            points={`${off},1 ${W - off},1 ${W - 1},${H / 2} ${W - off},${H - 1} ${off},${H - 1} 1,${H / 2}`}
            {...commonProps}
          />
        );
      }
      case 'rectangle':
      default:
        return (
          <rect
            x={1}
            y={1}
            width={W - 2}
            height={H - 2}
            rx={4}
            ry={4}
            {...commonProps}
          />
        );
    }
  }, [W, H, shapeType, data]);

  // 4-Direction Quick-Add handler
  const handleQuickAdd = useCallback(
    (direction: PlacementDirection) => {
      quickAddDirectionalNode(id, direction);
    },
    [id]
  );

  const handleCommit = () => {
    setIsEditingLocal(false);
    if (isEditingStore) {
      setEditingNodeId(null);
    }
    updateNodeData(id, { label });
  };

  return (
    <div
      style={{ width: W, height: H }}
      className={`relative group flex items-center justify-center cursor-pointer transition-shadow ${
        isConnectorSource
          ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_15px_rgba(52,211,153,0.7)] animate-pulse rounded-lg'
          : isNodeSelected
          ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.6)] rounded-lg'
          : ''
      }`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditingLocal(true);
        setEditingNodeId(id, null);
      }}
    >
      {/* Horizontal Floating Quick-Action Menu directly above node when single node is selected */}
      {isNodeSelected && selectedNodeCount <= 1 && <NodeFloatingActionBar nodeId={id} />}

      {/* Connector Source Selection Badge */}
      {isConnectorSource && (
        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-slate-950 shadow-md whitespace-nowrap z-40 pointer-events-none">
          Connecting source (click target node)
        </div>
      )}

      {/* SVG Shape Geometry */}
      <svg
        width={W}
        height={H}
        className="absolute inset-0 pointer-events-none drop-shadow-sm"
      >
        {shapeSvg}
      </svg>

      {/* Label / Inline Input */}
      <div className="relative z-10 px-3 text-center pointer-events-auto max-w-[90%]">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') handleCommit();
              if (e.key === 'Escape') {
                setLabel(data?.label || '');
                setIsEditingLocal(false);
                setEditingNodeId(null);
              }
            }}
            className="w-full bg-slate-950/90 text-white text-xs px-1.5 py-0.5 rounded border border-cyan-400 text-center outline-none"
          />
        ) : (
          <span
            style={{
              color: data?.color || '#f8fafc',
              fontSize: data?.fontSize || 13,
              fontWeight: data?.fontWeight || 'normal',
            }}
            className="select-none line-clamp-2 leading-tight block"
          >
            {label || 'Empty Node'}
          </span>
        )}
      </div>

      {/* 4-Way Inward Target Connection Handles (Centered on border intersections) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{
          left: `${handlePositions.top.x}px`,
          top: `${handlePositions.top.y}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          translate: 'none',
        }}
        className="!w-6 !h-6 !bg-transparent !border-0 !opacity-0 !z-10"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        style={{
          left: `${handlePositions.right.x}px`,
          top: `${handlePositions.right.y}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          translate: 'none',
        }}
        className="!w-6 !h-6 !bg-transparent !border-0 !opacity-0 !z-10"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        style={{
          left: `${handlePositions.bottom.x}px`,
          top: `${handlePositions.bottom.y}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          translate: 'none',
        }}
        className="!w-6 !h-6 !bg-transparent !border-0 !opacity-0 !z-10"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          left: `${handlePositions.left.x}px`,
          top: `${handlePositions.left.y}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          translate: 'none',
        }}
        className="!w-6 !h-6 !bg-transparent !border-0 !opacity-0 !z-10"
      />

      {/* Unified 4-Direction Connection Handles — Centered precisely at horizontal/vertical centerline border intersections */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        onClick={(e) => {
          e.stopPropagation();
          handleQuickAdd('top');
        }}
        title="Click to add up, or drag to connect"
        style={{
          left: `${handlePositions.top.x}px`,
          top: `${handlePositions.top.y}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          translate: 'none',
        }}
        className="!w-5 !h-5 !bg-indigo-600 hover:!bg-indigo-500 !text-white !rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md z-30 cursor-crosshair !border !border-white/30"
      >
        <Plus className="w-3.5 h-3.5 pointer-events-none" />
      </Handle>

      <Handle
        type="source"
        position={Position.Right}
        id="right"
        onClick={(e) => {
          e.stopPropagation();
          handleQuickAdd('right');
        }}
        title="Click to add right, or drag to connect"
        style={{
          left: `${handlePositions.right.x}px`,
          top: `${handlePositions.right.y}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          translate: 'none',
        }}
        className="!w-5 !h-5 !bg-indigo-600 hover:!bg-indigo-500 !text-white !rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md z-30 cursor-crosshair !border !border-white/30"
      >
        <Plus className="w-3.5 h-3.5 pointer-events-none" />
      </Handle>

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        onClick={(e) => {
          e.stopPropagation();
          handleQuickAdd('bottom');
        }}
        title="Click to add down, or drag to connect"
        style={{
          left: `${handlePositions.bottom.x}px`,
          top: `${handlePositions.bottom.y}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          translate: 'none',
        }}
        className="!w-5 !h-5 !bg-indigo-600 hover:!bg-indigo-500 !text-white !rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md z-30 cursor-crosshair !border !border-white/30"
      >
        <Plus className="w-3.5 h-3.5 pointer-events-none" />
      </Handle>

      <Handle
        type="source"
        position={Position.Left}
        id="left"
        onClick={(e) => {
          e.stopPropagation();
          handleQuickAdd('left');
        }}
        title="Click to add left, or drag to connect"
        style={{
          left: `${handlePositions.left.x}px`,
          top: `${handlePositions.left.y}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          translate: 'none',
        }}
        className="!w-5 !h-5 !bg-indigo-600 hover:!bg-indigo-500 !text-white !rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md z-30 cursor-crosshair !border !border-white/30"
      >
        <Plus className="w-3.5 h-3.5 pointer-events-none" />
      </Handle>
    </div>
  );
}

export default React.memo(ShapeNode);
