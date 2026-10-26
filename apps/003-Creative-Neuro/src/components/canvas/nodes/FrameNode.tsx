/**
 * Creative-Neuro Canvas Subsystem - Custom Frame / Container Node
 * Path: src/components/canvas/nodes/FrameNode.tsx
 *
 * Implements:
 * - Visual container & subgraph grouping with editable header title
 * - Fold / Collapse toggle snapping to 180x44 summary bar and hiding child nodes
 * - Automatic ELK layout recalculation around folded/expanded frame bounds
 */

import React, { useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Folder, Layers } from 'lucide-react';

import type { NeuroEdge, NeuroNode } from '../../../types/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { calculateElkLayout } from '../../../engine/index.ts';

export function FrameNode({
  id,
  data: rawData,
  selected,
  width = 360,
  height = 260,
}: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const isCollapsed = Boolean(data?.collapsed);

  // Count attached children
  const childrenCount = useProjectStore(
    useCallback(
      (s) => Object.values(s.nodes).filter((n) => n.parentId === id).length,
      [id]
    )
  );

  const handleToggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const nextCollapsed = !isCollapsed;

      useProjectStore.setState((state) => {
        const frameNode = state.nodes[id];
        if (!frameNode) return;

        if (nextCollapsed) {
          // 1. Collapse to 180x44 summary bar
          frameNode.data = {
            ...frameNode.data,
            collapsed: true,
            minWidth: width || frameNode.width || 360,
            minHeight: height || frameNode.height || 260,
          };
          frameNode.width = 180;
          frameNode.height = 44;

          // 2. Hide child nodes
          for (const node of Object.values(state.nodes)) {
            if (node.parentId === id) {
              node.hidden = true;
            }
          }
        } else {
          // 1. Restore expanded bounds
          const restoredW = frameNode.data.minWidth || 360;
          const restoredH = frameNode.data.minHeight || 260;
          frameNode.data = {
            ...frameNode.data,
            collapsed: false,
          };
          frameNode.width = restoredW;
          frameNode.height = restoredH;

          // 2. Unhide child nodes
          for (const node of Object.values(state.nodes)) {
            if (node.parentId === id) {
              node.hidden = false;
            }
          }
        }

        const page = state.pages[state.activePageId];
        if (page) page.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });

      // 3. Recalculate global layout to adjust auto-elk root nodes around folded frame
      const currentStore = useProjectStore.getState();
      const activePage = currentStore.pages[currentStore.activePageId];
      const activeNodes = activePage
        ? activePage.nodeIds
            .map((nid) => currentStore.nodes[nid])
            .filter((n): n is NeuroNode => Boolean(n))
        : Object.values(currentStore.nodes);
      const activeEdges = activePage
        ? activePage.edgeIds
            .map((eid) => currentStore.edges[eid])
            .filter((ed): ed is NeuroEdge => Boolean(ed))
        : Object.values(currentStore.edges);

      calculateElkLayout(activeNodes, activeEdges).then(({ nodes: updatedNodes }) => {
        useProjectStore.setState((state) => {
          for (const u of updatedNodes) {
            const existing = state.nodes[u.id];
            if (existing && existing.layoutMode === 'auto-elk') {
              existing.position = u.position;
            }
          }
        });
      });
    },
    [id, isCollapsed, width, height]
  );

  if (isCollapsed) {
    return (
      <div
        style={{ width: 180, height: 44 }}
        className={`relative bg-slate-900/95 border border-indigo-500/60 rounded-xl px-3 flex items-center justify-between shadow-xl cursor-pointer ${
          selected ? 'ring-2 ring-indigo-400' : ''
        }`}
        onClick={handleToggleCollapse}
      >
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="!w-2 !h-2 !bg-indigo-400"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-2 !h-2 !bg-indigo-400"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!w-2 !h-2 !bg-indigo-400"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-2 !h-2 !bg-indigo-400"
        />

        <div className="flex items-center gap-2 overflow-hidden">
          <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-white truncate max-w-[95px]">
            {data?.title || data?.label || 'Container'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.5 rounded-full border border-indigo-500/30">
            {childrenCount}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    );
  }

  const W = width || 360;
  const H = height || 260;

  return (
    <div
      style={{ width: W, height: H }}
      className={`relative bg-slate-900/30 border-2 border-dashed rounded-2xl p-3 flex flex-col transition-all ${
        selected
          ? 'border-indigo-500 shadow-2xl shadow-indigo-500/10'
          : 'border-slate-700/80'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2.5 !h-2.5 !bg-slate-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2.5 !h-2.5 !bg-slate-600"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2.5 !h-2.5 !bg-slate-600"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2.5 !h-2.5 !bg-slate-600"
      />

      {/* Frame Header Bar */}
      <div className="h-8 flex items-center justify-between pb-2 border-b border-slate-800/80 pointer-events-auto">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            type="text"
            value={data?.title || data?.label || 'Container Frame'}
            onChange={(e) =>
              updateNodeData(id, { title: e.target.value, label: e.target.value })
            }
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-slate-200 bg-transparent hover:bg-slate-800/50 px-1.5 py-0.5 rounded outline-none border border-transparent focus:border-indigo-500 truncate"
          />
          {data?.direction && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
              {data.direction}
            </span>
          )}
          <span className="text-[10px] text-slate-500 font-mono shrink-0">
            ({childrenCount} items)
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleCollapse}
          title="Fold Frame"
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer transition shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Frame Interior Drop Area */}
      <div className="flex-1 w-full pointer-events-none" />
    </div>
  );
}

export default React.memo(FrameNode);
