/**
 * Creative-Neuro Canvas Subsystem - Freehand Vector Drawing Overlay
 * Path: src/components/canvas/freehand/FreehandOverlay.tsx
 *
 * Implements:
 * - perfect-freehand outline Bézier curve synthesis
 * - React Flow v12 coordinate transformation (screenToFlowPosition)
 * - ViewportPortal integration for seamless pan/zoom synchronization
 * - Spatial hit-testing Eraser mode
 * - Full Zustand store & Zundo undo/redo integration
 * - Floating brush & color palette toolbar
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useReactFlow, ViewportPortal } from '@xyflow/react';
import { getStroke } from 'perfect-freehand';
import { Pen, Eraser, Trash2, Check } from 'lucide-react';
import {
  useProjectStore,
  useActivePageNodes,
} from '../../../store/useProjectStore.ts';

export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}

const PALETTE_COLORS = [
  { id: 'slate', value: '#f8fafc', label: 'White' },
  { id: 'indigo', value: '#6366f1', label: 'Indigo' },
  { id: 'emerald', value: '#10b981', label: 'Emerald' },
  { id: 'crimson', value: '#ef4444', label: 'Red' },
  { id: 'amber', value: '#f59e0b', label: 'Amber' },
  { id: 'sky', value: '#0ea5e9', label: 'Sky' },
];

const STROKE_WIDTHS = [
  { label: 'S', value: 3 },
  { label: 'M', value: 6 },
  { label: 'L', value: 12 },
];

export function FreehandOverlay() {
  const { screenToFlowPosition } = useReactFlow();

  const toolMode = useProjectStore((s) => s.toolMode);
  const setToolMode = useProjectStore((s) => s.setToolMode);
  const addNode = useProjectStore((s) => s.addNode);
  const deleteNodes = useProjectStore((s) => s.deleteNodes);

  // Active page freehand stroke nodes
  const allNodes = useActivePageNodes();
  const strokeNodes = useMemo(
    () => allNodes.filter((n) => n.type === 'freehand'),
    [allNodes]
  );

  // Brush settings
  const [strokeColor, setStrokeColor] = useState('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [isEraser, setIsEraser] = useState(false);

  // Active in-progress stroke
  const [currentPoints, setCurrentPoints] = useState<Array<[number, number, number]>>(
    []
  );
  const isDrawingRef = useRef(false);
  const erasedIdsRef = useRef<Set<string>>(new Set());
  const [erasedCount, setErasedCount] = useState(0);

  const isDrawMode = toolMode === 'draw';

  // Spatial Eraser check: accumulates any stroke node whose points are within distance
  const accumulateEraserAt = useCallback(
    (flowPos: { x: number; y: number }) => {
      const radius = 24;
      let newlyErased = false;

      for (const node of strokeNodes) {
        if (erasedIdsRef.current.has(node.id)) continue;
        const pts = node.data?.points || [];
        for (const [px, py] of pts) {
          if (Math.hypot(px - flowPos.x, py - flowPos.y) <= radius) {
            erasedIdsRef.current.add(node.id);
            newlyErased = true;
            break;
          }
        }
      }

      if (newlyErased) {
        setErasedCount((c) => c + 1);
      }
    },
    [strokeNodes]
  );

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawMode) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (isEraser) {
      isDrawingRef.current = true;
      erasedIdsRef.current.clear();
      setErasedCount(0);
      accumulateEraserAt(flowPos);
    } else {
      isDrawingRef.current = true;
      setCurrentPoints([[flowPos.x, flowPos.y, pressure]]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current || !isDrawMode) return;
    e.stopPropagation();

    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (isEraser) {
      accumulateEraserAt(flowPos);
    } else {
      setCurrentPoints((prev) => [...prev, [flowPos.x, flowPos.y, pressure]]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    e.stopPropagation();

    if (isEraser) {
      const toDelete = Array.from(erasedIdsRef.current);
      if (toDelete.length > 0) {
        deleteNodes(toDelete);
      }
      erasedIdsRef.current.clear();
      setErasedCount(0);
    } else if (currentPoints.length > 1) {
      // Calculate stroke bounding box
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const [x, y] of currentPoints) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }

      // Add stroke as a durable NeuroNode
      addNode({
        type: 'freehand',
        position: { x: minX, y: minY },
        width: Math.max(20, maxX - minX),
        height: Math.max(20, maxY - minY),
        layoutMode: 'manual',
        data: {
          label: 'Freehand Stroke',
          layoutMode: 'manual',
          points: currentPoints,
          color: strokeColor,
          strokeColor,
          strokeWidth,
        },
      });
    }

    setCurrentPoints([]);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isDrawingRef.current = false;
    e.stopPropagation();
    setCurrentPoints([]);
    erasedIdsRef.current.clear();
    setErasedCount(0);
  };

  // Convert active points into perfect-freehand outline
  const activeStrokeOutline = useMemo(() => {
    if (currentPoints.length === 0) return '';
    const stroke = getStroke(currentPoints, {
      size: strokeWidth,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: true,
    });
    return getSvgPathFromStroke(stroke);
  }, [currentPoints, strokeWidth]);

  return (
    <>
      {/* 1. Viewport-Portaled Vector Stroke Rendering Layer */}
      <ViewportPortal>
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none"
          style={{ width: '100%', height: '100%', zIndex: 5 }}
        >
          {/* Render Committed Strokes */}
          {strokeNodes
            .filter((node) => !erasedIdsRef.current.has(node.id))
            .map((node) => {
            const pts = (node.data?.points || []) as Array<
              [number, number, number?]
            >;
            if (pts.length === 0) return null;

            const size =
              node.data?.strokeWidth ||
              (node.data?.customData?.size as number | undefined) ||
              6;
            const stroke = getStroke(pts as unknown as number[][], {
              size,
              thinning: 0.5,
              smoothing: 0.5,
              streamline: 0.5,
              simulatePressure: true,
            });
            const pathData = getSvgPathFromStroke(stroke);
            const color =
              node.data?.color || node.data?.strokeColor || '#6366f1';

            return (
              <path key={node.id} d={pathData} fill={color} opacity={0.9} />
            );
          })}

          {/* Render In-Progress Active Stroke */}
          {activeStrokeOutline && (
            <path d={activeStrokeOutline} fill={strokeColor} opacity={0.9} />
          )}
        </svg>
      </ViewportPortal>

      {/* 2. Interactive Pointer Event Capture Layer (active only in 'draw' mode) */}
      {isDrawMode && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="absolute inset-0 z-20 cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
      )}

      {/* 3. Floating Brush Toolbar when in Draw Mode */}
      {isDrawMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md select-none">
          {/* Mode: Pen vs Eraser */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setIsEraser(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                !isEraser
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Pen className="w-3.5 h-3.5" />
              <span>Pen</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEraser(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isEraser
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Eraser</span>
            </button>
          </div>

          {!isEraser && (
            <>
              <div className="w-px h-6 bg-slate-800" />

              {/* Color Swatches */}
              <div className="flex items-center gap-1.5">
                {PALETTE_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    title={c.label}
                    onClick={() => setStrokeColor(c.value)}
                    className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c.value }}
                  >
                    {strokeColor === c.value && (
                      <Check
                        className={`w-3 h-3 ${
                          c.value === '#f8fafc' ? 'text-slate-900' : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="w-px h-6 bg-slate-800" />

              {/* Stroke Width Selector */}
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                {STROKE_WIDTHS.map((w) => (
                  <button
                    type="button"
                    key={w.label}
                    onClick={() => setStrokeWidth(w.value)}
                    className={`w-6 h-6 rounded text-[11px] font-bold flex items-center justify-center transition ${
                      strokeWidth === w.value
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="w-px h-6 bg-slate-800" />

          {/* Clear All Doodles */}
          {strokeNodes.length > 0 && (
            <button
              type="button"
              onClick={() => deleteNodes(strokeNodes.map((n) => n.id))}
              title="Clear all hand-drawn doodles"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Exit Drawing Mode */}
          <button
            type="button"
            onClick={() => setToolMode('select')}
            className="px-3 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Done
          </button>
        </div>
      )}
    </>
  );
}

export default React.memo(FreehandOverlay);
