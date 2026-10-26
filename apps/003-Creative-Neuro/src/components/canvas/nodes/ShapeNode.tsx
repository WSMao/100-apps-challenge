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

export function ShapeNode({
  id,
  data: rawData,
  selected,
  width = 160,
  height = 60,
}: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data?.label || 'New Node');
  const inputRef = useRef<HTMLInputElement>(null);

  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  useEffect(() => {
    setLabel(data?.label || '');
  }, [data?.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const shapeType = normalizeShapeType(data?.shapeType);
  const W = width || 160;
  const H = height || 60;

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
      const store = useProjectStore.getState();
      const activePage = store.pages[store.activePageId];
      const existingNodes = activePage
        ? activePage.nodeIds
            .map((nid) => store.nodes[nid])
            .filter((n): n is NeuroNode => Boolean(n))
        : Object.values(store.nodes);

      const targetNode = store.nodes[id];
      if (!targetNode) return;

      const candidatePos = findCollisionFreePosition(targetNode, direction, existingNodes, {
        defaultWidth: W,
        defaultHeight: H,
        margin: 30,
      });

      const newNodeId = store.addNode({
        type: 'shape',
        position: candidatePos,
        width: W,
        height: H,
        layoutMode: 'manual',
        data: {
          label: 'New Node',
          layoutMode: 'manual',
          shapeType: data?.shapeType || 'rounded',
          backgroundColor: data?.backgroundColor || '#1e293b',
          borderColor: data?.borderColor || '#475569',
          color: data?.color || '#f8fafc',
        },
      });

      const opposites: Record<PlacementDirection, string> = {
        top: 'bottom',
        right: 'left',
        bottom: 'top',
        left: 'right',
      };

      store.addEdge({
        source: id,
        target: newNodeId,
        sourceHandle: direction,
        targetHandle: opposites[direction],
        type: 'jump',
      });
    },
    [id, W, H, data]
  );

  const handleCommit = () => {
    setIsEditing(false);
    updateNodeData(id, { label });
  };

  return (
    <div
      style={{ width: W, height: H }}
      className={`relative group flex items-center justify-center cursor-pointer transition-shadow ${
        selected ? 'ring-2 ring-indigo-500 rounded-lg shadow-lg shadow-indigo-500/25' : ''
      }`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
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
              if (e.key === 'Enter') handleCommit();
              if (e.key === 'Escape') {
                setLabel(data?.label || '');
                setIsEditing(false);
              }
            }}
            className="w-full bg-slate-950/90 text-white text-xs px-1.5 py-0.5 rounded border border-indigo-500 text-center outline-none"
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

      {/* 4-Way Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-2.5 h-2.5 !bg-indigo-500 !border-2 !border-slate-900"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-2.5 h-2.5 !bg-indigo-500 !border-2 !border-slate-900"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-2.5 h-2.5 !bg-indigo-500 !border-2 !border-slate-900"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-2.5 h-2.5 !bg-indigo-500 !border-2 !border-slate-900"
      />

      {/* 4-Direction Hover Quick-Add Arrows */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleQuickAdd('top');
        }}
        title="Quick Add Up"
        className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md z-20 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleQuickAdd('right');
        }}
        title="Quick Add Right (Child)"
        className="absolute top-1/2 -right-3 -translate-y-1/2 w-5 h-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md z-20 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleQuickAdd('bottom');
        }}
        title="Quick Add Down (Sibling)"
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md z-20 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleQuickAdd('left');
        }}
        title="Quick Add Left"
        className="absolute top-1/2 -left-3 -translate-y-1/2 w-5 h-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md z-20 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default React.memo(ShapeNode);
