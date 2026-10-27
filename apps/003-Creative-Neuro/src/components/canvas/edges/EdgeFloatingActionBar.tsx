import React, { useMemo } from 'react';
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
import type { EdgeRoutingType, NeuroEdgeData } from '../../../types/index.ts';

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

  const targetIds = useMemo(() => {
    if (edgeIds && edgeIds.length > 0) return edgeIds;
    if (edgeId) return [edgeId];
    return [];
  }, [edgeId, edgeIds]);

  const targetEdges = useMemo(() => {
    return targetIds.map((id) => edges[id]).filter(Boolean);
  }, [targetIds, edges]);

  if (targetEdges.length === 0) return null;

  const isDark = themeMode === 'dark';
  const isMulti = targetEdges.length > 1;
  const primaryEdge = targetEdges[0];
  const data = primaryEdge.data || {};
  const currentRouting: EdgeRoutingType = data.routingType || (primaryEdge.type as EdgeRoutingType) || 'jump';
  const currentLineStyle = data.lineStyle || 'solid';
  const currentArrowStart = Boolean(data.arrowStart);
  const currentArrowEnd = data.arrowEnd !== false;

  const handleUpdate = (patch: Partial<NeuroEdgeData>) => {
    if (isMulti) {
      batchUpdateEdgeData(targetIds, patch);
    } else {
      updateEdgeData(targetIds[0], patch);
    }
  };

  const handleDelete = () => {
    deleteEdges(targetIds);
  };

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded-xl shadow-2xl border text-xs select-none transition-all z-[99999] pointer-events-auto ${
        isDark
          ? 'bg-slate-900 border-slate-700 text-slate-100'
          : 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50'
      }`}
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

      {/* 1. Routing Type Options */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => handleUpdate({ routingType: 'jump' })}
          title="Jump Arc (避障跳線)"
          className={`px-1.5 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
            currentRouting === 'jump'
              ? 'bg-indigo-600 text-white font-semibold'
              : isDark
              ? 'hover:bg-slate-800 text-slate-300'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="edge-route-jump"
        >
          <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
          <span>Jump</span>
        </button>

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
