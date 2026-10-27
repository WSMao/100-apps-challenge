import React, { useMemo, useState } from 'react';
import {
  Square,
  Circle,
  Diamond,
  Database,
  Hexagon,
  RectangleHorizontal,
  Pill,
  Columns3,
  ArrowUp,
  ArrowDown,
  Trash2,
  Ungroup,
  Group,
  Workflow,
  Hand,
  Shapes,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore.ts';
import type { NeuroNode, ShapeType } from '../../types/index.ts';

export interface NodeFloatingActionBarProps {
  nodeId?: string;
  nodeIds?: string[];
}

const SHAPE_ITEMS: { type: ShapeType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'rectangle', label: 'Rectangle', icon: Square },
  { type: 'rounded', label: 'Rounded Box', icon: RectangleHorizontal },
  { type: 'circle', label: 'Circle', icon: Circle },
  { type: 'diamond', label: 'Diamond', icon: Diamond },
  { type: 'cylinder', label: 'Database', icon: Database },
  { type: 'hexagon', label: 'Hexagon', icon: Hexagon },
  { type: 'pill', label: 'Pill / Stadium', icon: Pill },
  { type: 'subroutine', label: 'Subroutine', icon: Columns3 },
];

export const NodeFloatingActionBar: React.FC<NodeFloatingActionBarProps> = ({ nodeId, nodeIds }) => {
  const nodes = useProjectStore((s) => s.nodes);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const batchUpdateNodeData = useProjectStore((s) => s.batchUpdateNodeData);
  const bringToFront = useProjectStore((s) => s.bringToFront);
  const sendToBack = useProjectStore((s) => s.sendToBack);
  const deleteNodes = useProjectStore((s) => s.deleteNodes);
  const setNodeLayoutMode = useProjectStore((s) => s.setNodeLayoutMode);
  const batchSetNodeLayoutMode = useProjectStore((s) => s.batchSetNodeLayoutMode);
  const groupSelectedNodes = useProjectStore((s) => s.groupSelectedNodes);
  const ungroupNodes = useProjectStore((s) => s.ungroupNodes);
  const themeMode = useProjectStore((s) => s.themeMode);

  const [showShapeMenu, setShowShapeMenu] = useState(false);

  // Resolve target nodes (either from multi-selection nodeIds or single nodeId)
  const targetIds = useMemo(() => {
    if (nodeIds && nodeIds.length > 0) return nodeIds;
    if (nodeId) return [nodeId];
    return [];
  }, [nodeId, nodeIds]);

  const targetNodes = useMemo(() => {
    return targetIds.map((id) => nodes[id]).filter((n): n is NeuroNode => Boolean(n));
  }, [targetIds, nodes]);

  if (targetNodes.length === 0) return null;

  const isMulti = targetNodes.length > 1;
  const isDark = themeMode === 'dark';

  // Layout mode resolution
  const isAllAuto = targetNodes.every((n) => n.layoutMode === 'auto-elk');
  const nextLayoutMode = isAllAuto ? 'manual' : 'auto-elk';

  // Group status resolution
  const firstGid = targetNodes[0]?.groupId || targetNodes[0]?.data?.groupId;
  const isAllGrouped = Boolean(firstGid) && targetNodes.every((n) => (n.groupId || n.data?.groupId) === firstGid);

  // Shape resolution
  const shapeNodes = targetNodes.filter((n) => n.type === 'shape' || !n.type);
  const hasShapeNodes = shapeNodes.length > 0;
  const firstShape = shapeNodes[0]?.data?.shapeType || 'rounded';
  const isUniformShape = shapeNodes.every((n) => (n.data?.shapeType || 'rounded') === firstShape);
  const currentShape = isUniformShape ? firstShape : 'shapes';

  return (
    <div
      className={`absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-xl shadow-2xl border z-[99999] transition-all select-none pointer-events-auto ${
        isDark
          ? 'bg-slate-900 border-slate-700 text-slate-100'
          : 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50'
      }`}
      onClick={(e) => e.stopPropagation()}
      data-testid="node-floating-action-bar"
      data-is-multi={isMulti ? 'true' : 'false'}
    >
      {/* 0. Layout Mode Toggle (FN-01) - Single or Batch */}
      <button
        type="button"
        onClick={() => {
          if (isMulti) {
            batchSetNodeLayoutMode(targetIds, nextLayoutMode);
          } else {
            setNodeLayoutMode(targetIds[0], nextLayoutMode);
          }
        }}
        title={`Layout Mode: ${isAllAuto ? 'Auto-ELK' : 'Manual'} (點擊全部切換為 ${nextLayoutMode})`}
        className={`px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-medium cursor-pointer transition ${
          isAllAuto
            ? 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/30'
            : isDark
            ? 'bg-slate-800 text-amber-400 hover:bg-slate-700 border border-amber-500/30'
            : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-300'
        }`}
        data-testid="toggle-node-layout-mode"
      >
        {isAllAuto ? (
          <>
            <Workflow className="w-3.5 h-3.5 text-cyan-400" />
            <span>Auto</span>
          </>
        ) : (
          <>
            <Hand className="w-3.5 h-3.5 text-amber-500" />
            <span>Manual</span>
          </>
        )}
      </button>

      <div className={`w-[1px] h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* 1. Shape Switcher - Batch applies to all selected nodes */}
      {hasShapeNodes && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowShapeMenu((p) => !p)}
            title={isMulti ? `Switch Shape (${targetNodes.length} items)` : 'Switch Shape'}
            className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-medium cursor-pointer transition ${
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
            }`}
            data-testid="action-switch-shape"
          >
            {isUniformShape ? (
              <Square className="w-3.5 h-3.5 text-cyan-500" />
            ) : (
              <Shapes className="w-3.5 h-3.5 text-cyan-500" />
            )}
            <span className="capitalize text-[11px]">{currentShape}</span>
          </button>

          {showShapeMenu && (
            <div
              className={`absolute top-full left-0 mt-1 py-1 w-36 rounded-lg shadow-xl border z-[100000] grid grid-cols-1 gap-0.5 ${
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              {SHAPE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      if (isMulti) {
                        batchUpdateNodeData(targetIds, { shapeType: item.type });
                      } else {
                        updateNodeData(targetIds[0], { shapeType: item.type });
                      }
                      setShowShapeMenu(false);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1 text-xs text-left cursor-pointer transition ${
                      currentShape === item.type
                        ? 'bg-cyan-500/15 text-cyan-500 font-semibold'
                        : isDark
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    data-testid={`shape-option-${item.type}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className={`w-[1px] h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* 2. Layer Controls (zIndex) - Batch applies to all selected nodes */}
      <button
        type="button"
        onClick={() => bringToFront(targetIds)}
        title={isMulti ? `Bring ${targetNodes.length} items to Front` : 'Bring to Front'}
        className={`p-1.5 rounded-lg cursor-pointer transition ${
          isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
        }`}
        data-testid="action-bring-to-front"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => sendToBack(targetIds)}
        title={isMulti ? `Send ${targetNodes.length} items to Back` : 'Send to Back'}
        className={`p-1.5 rounded-lg cursor-pointer transition ${
          isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
        }`}
        data-testid="action-send-to-back"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>

      {/* 3. Group / Ungroup (FN-04) */}
      {isMulti && !isAllGrouped && (
        <button
          type="button"
          onClick={() => groupSelectedNodes()}
          title="Group Selected (⌘G)"
          className={`p-1.5 rounded-lg cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="action-group-nodes"
        >
          <Group className="w-3.5 h-3.5 text-indigo-400" />
        </button>
      )}

      {(isAllGrouped || (!isMulti && (firstGid || targetNodes[0]?.type === 'frame'))) && (
        <button
          type="button"
          onClick={() => {
            const targetGroupId = firstGid || targetIds[0];
            ungroupNodes(targetGroupId);
          }}
          title="Ungroup (⌘⇧G)"
          className={`p-1.5 rounded-lg cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="action-ungroup-nodes"
        >
          <Ungroup className="w-3.5 h-3.5 text-amber-500" />
        </button>
      )}

      <div className={`w-[1px] h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* 4. Delete - Batch deletes all target nodes */}
      <button
        type="button"
        onClick={() => deleteNodes(targetIds)}
        title={isMulti ? `Delete ${targetNodes.length} Selected Nodes` : 'Delete Node'}
        className="p-1.5 rounded-lg cursor-pointer hover:bg-rose-500/15 text-rose-500 transition"
        data-testid="action-delete-nodes"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
