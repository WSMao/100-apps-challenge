import React, { useMemo } from 'react';
import { useEdges, useReactFlow } from '@xyflow/react';
import {
  Spline,
  CornerDownRight,
  Minus,
  ArrowRight,
  ArrowLeftRight,
  Trash2,
  GitCommit,
} from 'lucide-react';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import type { EdgeRoutingType, NeuroEdge, NeuroEdgeData } from '../../../types/index.ts';

export interface EdgeFloatingActionBarProps {
  edgeId?: string;
  edgeIds?: string[];
}

export const EdgeFloatingActionBar: React.FC<EdgeFloatingActionBarProps> = ({ edgeId, edgeIds }) => {
  const edges = useProjectStore((s) => s.edges);
  const updateEdgeData = useProjectStore((s) => s.updateEdgeData);
  const batchUpdateEdgeData = useProjectStore((s) => s.batchUpdateEdgeData);
  const deleteEdges = useProjectStore((s) => s.deleteEdges);
  const themeMode = useProjectStore((s) => s.themeMode);
  const rfEdges = useEdges();
  const rfInstance = useReactFlow();

  const targetIds = useMemo(() => {
    if (edgeIds && edgeIds.length > 0) return edgeIds;
    if (edgeId) return [edgeId];
    return [];
  }, [edgeId, edgeIds]);

  const isStoreEdge = useMemo(
    () => targetIds.some((id) => Boolean(edges[id])),
    [targetIds, edges]
  );

  const targetEdges = useMemo(() => {
    if (isStoreEdge) {
      return targetIds.map((id) => edges[id]).filter(Boolean);
    }
    return targetIds
      .map((id) => rfEdges.find((e) => e.id === id) as unknown as NeuroEdge | undefined)
      .filter((e): e is NeuroEdge => Boolean(e));
  }, [targetIds, edges, isStoreEdge, rfEdges]);

  if (targetEdges.length === 0) return null;

  const isDark = themeMode === 'dark';
  const isMulti = targetEdges.length > 1;
  const primaryEdge = targetEdges[0];
  const data = primaryEdge.data || {};
  const rawRouting = (data.routingType || primaryEdge.type || 'smoothstep') as string;
  const currentRouting: EdgeRoutingType =
    rawRouting === 'jump' || rawRouting === 'default'
      ? 'straight'
      : (rawRouting as EdgeRoutingType);
  const currentLineStyle = data.lineStyle || 'solid';
  const currentStrokeWidth = data.strokeWidth || 1.5;
  const currentColor = data.color || '#64748b';
  const currentArrowStart = Boolean(data.arrowStart);
  const currentArrowEnd = data.arrowEnd !== false;

  const STROKE_WIDTH_OPTIONS = [
    { value: 1.5, label: '細', title: 'Thin (1.5px)', testId: 'edge-width-thin' },
    { value: 2.5, label: '中', title: 'Medium (2.5px)', testId: 'edge-width-medium' },
    { value: 4, label: '粗', title: 'Thick (4px)', testId: 'edge-width-thick' },
  ];

  const STROKE_COLOR_OPTIONS = [
    { value: '#64748b', name: 'slate', title: 'Slate (#64748b)' },
    { value: '#6366f1', name: 'indigo', title: 'Indigo (#6366f1)' },
    { value: '#06b6d4', name: 'cyan', title: 'Cyan (#06b6d4)' },
    { value: '#10b981', name: 'emerald', title: 'Emerald (#10b981)' },
    { value: '#f59e0b', name: 'amber', title: 'Amber (#f59e0b)' },
    { value: '#f43f5e', name: 'rose', title: 'Rose (#f43f5e)' },
  ];

  const handleUpdate = (patch: Partial<NeuroEdgeData>) => {
    if (isStoreEdge) {
      if (isMulti) {
        batchUpdateEdgeData(targetIds, patch);
      } else {
        updateEdgeData(targetIds[0], patch);
      }
    } else {
      rfInstance.setEdges((eds) =>
        eds.map((ed) =>
          targetIds.includes(ed.id)
            ? {
                ...ed,
                data: {
                  ...(ed.data || {}),
                  ...patch,
                },
              }
            : ed
        )
      );
    }
  };

  const handleDelete = () => {
    if (isStoreEdge) {
      deleteEdges(targetIds);
    } else {
      rfInstance.setEdges((eds) => eds.filter((ed) => !targetIds.includes(ed.id)));
    }
  };

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded-xl shadow-2xl border text-xs select-none transition-all z-[999999] pointer-events-auto ${
        isDark
          ? 'bg-slate-900 border-slate-700 text-slate-100'
          : 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50'
      }`}
      style={{ zIndex: 999999 }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid="edge-floating-action-bar"
    >
      {/* Multi-Selection Counter Indicator */}
      {isMulti && (
        <>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold text-[10px]">
            <GitCommit className="w-3 h-3 text-cyan-400" />
            <span>{targetEdges.length} 連線</span>
          </div>
          <div className={`w-[1px] h-3.5 mx-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        </>
      )}

      {/* 1. Routing Type Options (Straight, Smoothstep, Bezier) */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => handleUpdate({ routingType: 'smoothstep' })}
          title="Smoothstep (直角折線)"
          className={`px-1.5 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
            currentRouting === 'smoothstep'
              ? 'bg-indigo-600 text-white font-semibold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-300'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-route-smoothstep"
        >
          <CornerDownRight className="w-3.5 h-3.5 text-indigo-400" />
          <span>Step</span>
        </button>

        <button
          type="button"
          onClick={() => handleUpdate({ routingType: 'bezier' })}
          title="Curved (貝茲平滑曲線)"
          className={`px-1.5 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
            currentRouting === 'bezier'
              ? 'bg-indigo-600 text-white font-semibold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-300'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-route-bezier"
        >
          <Spline className="w-3.5 h-3.5 text-purple-400" />
          <span>Curve</span>
        </button>

        <button
          type="button"
          onClick={() => handleUpdate({ routingType: 'straight' })}
          title="Straight (直線)"
          className={`px-1.5 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
            currentRouting === 'straight'
              ? 'bg-indigo-600 text-white font-semibold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-300'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-route-straight"
        >
          <Minus className="w-3.5 h-3.5 text-amber-400" />
          <span>Line</span>
        </button>
      </div>

      <div className={`w-[1px] h-3.5 mx-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

      {/* 1.5 Stroke Width Options */}
      <div className="flex items-center gap-0.5">
        {STROKE_WIDTH_OPTIONS.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => handleUpdate({ strokeWidth: w.value })}
            title={w.title}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
              currentStrokeWidth === w.value
                ? 'bg-indigo-500/20 text-indigo-400 font-bold'
                : isDark
                ? 'hover:bg-slate-800 text-slate-400'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
            data-testid={w.testId}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className={`w-[1px] h-3.5 mx-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

      {/* 1.75 Stroke Color Swatches */}
      <div className="flex items-center gap-1 px-0.5">
        {STROKE_COLOR_OPTIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => handleUpdate({ color: c.value })}
            title={c.title}
            aria-label={c.title}
            className={`w-3.5 h-3.5 rounded-full transition cursor-pointer border ${
              currentColor === c.value
                ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-900 scale-110 border-white'
                : 'border-slate-500/40 hover:scale-110'
            }`}
            style={{ backgroundColor: c.value }}
            data-testid={`edge-color-${c.name}`}
          />
        ))}
      </div>

      <div className={`w-[1px] h-3.5 mx-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

      {/* 2. Line Pattern Options */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => handleUpdate({ lineStyle: 'solid' })}
          title="Solid (實線)"
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
            currentLineStyle === 'solid'
              ? 'bg-indigo-500/20 text-indigo-400 font-bold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-400'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-style-solid"
        >
          — 實線
        </button>
        <button
          type="button"
          onClick={() => handleUpdate({ lineStyle: 'dashed' })}
          title="Dashed (虛線)"
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
            currentLineStyle === 'dashed'
              ? 'bg-indigo-500/20 text-indigo-400 font-bold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-400'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-style-dashed"
        >
          ┄ 虛線
        </button>
        <button
          type="button"
          onClick={() => handleUpdate({ lineStyle: 'dotted' })}
          title="Dotted (點線)"
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
            currentLineStyle === 'dotted'
              ? 'bg-indigo-500/20 text-indigo-400 font-bold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-400'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-style-dotted"
        >
          ┈ 點線
        </button>
      </div>

      <div className={`w-[1px] h-3.5 mx-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

      {/* 3. Arrow Head Toggle */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => handleUpdate({ arrowEnd: true, arrowStart: false })}
          title="Forward Arrow (單向)"
          className={`p-1 rounded transition cursor-pointer ${
            currentArrowEnd && !currentArrowStart
              ? 'bg-indigo-500/20 text-indigo-400 font-bold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-400'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-arrow-forward"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleUpdate({ arrowEnd: true, arrowStart: true })}
          title="Bidirectional Arrow (雙向)"
          className={`p-1 rounded transition cursor-pointer ${
            currentArrowEnd && currentArrowStart
              ? 'bg-indigo-500/20 text-indigo-400 font-bold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-400'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-arrow-bidirectional"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleUpdate({ arrowEnd: false, arrowStart: false })}
          title="No Arrow (無箭頭)"
          className={`p-1 rounded text-xs transition cursor-pointer ${
            !currentArrowEnd && !currentArrowStart
              ? 'bg-indigo-500/20 text-indigo-400 font-bold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-400'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-arrow-none"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className={`w-[1px] h-3.5 mx-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

      {/* 4. Delete Edge Button */}
      <button
        type="button"
        onClick={handleDelete}
        title={isMulti ? `Delete All (${targetIds.length}) Connections` : 'Delete Connection'}
        className="p-1 rounded hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
        data-testid="edge-delete-button"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
