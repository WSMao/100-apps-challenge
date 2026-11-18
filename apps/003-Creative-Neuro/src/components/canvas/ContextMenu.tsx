import React from 'react';
import {
  Square,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Minimize2,
  FileCode2,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore.ts';
import { spawnChildNode, spawnSiblingNode } from '../workspace/ShortcutsHandler.tsx';

interface ContextMenuProps {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  targetNodeId: string | null;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  flowX,
  flowY,
  targetNodeId,
  onClose,
}) => {
  const addNode = useProjectStore((s) => s.addNode);
  const deleteNodes = useProjectStore((s) => s.deleteNodes);
  const bringToFront = useProjectStore((s) => s.bringToFront);
  const sendToBack = useProjectStore((s) => s.sendToBack);
  const groupSelectedNodes = useProjectStore((s) => s.groupSelectedNodes);
  const ungroupNodes = useProjectStore((s) => s.ungroupNodes);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const themeMode = useProjectStore((s) => s.themeMode);
  const targetNode = useProjectStore((s) => (targetNodeId ? s.nodes[targetNodeId] : null));

  const isDark = themeMode === 'dark';

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className={`absolute rounded-xl shadow-2xl border py-1.5 min-w-48 text-xs select-none transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800 shadow-slate-300/40'
        }`}
        style={{ left: Math.min(x, window.innerWidth - 210), top: Math.min(y, window.innerHeight - 260) }}
        onClick={(e) => e.stopPropagation()}
      >
        {targetNode ? (
          <>
            <div className="px-3 py-1 font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
              Node: {targetNode.data?.label || targetNode.id}
            </div>

            <button
              type="button"
              onClick={() => {
                spawnChildNode(targetNode.id);
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-indigo-500" />
              <span>Add Child Node</span>
              <kbd className="ml-auto text-[10px] opacity-60">Tab</kbd>
            </button>

            <button
              type="button"
              onClick={() => {
                spawnSiblingNode(targetNode.id);
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-cyan-500" />
              <span>Add Sibling Node</span>
              <kbd className="ml-auto text-[10px] opacity-60">Enter</kbd>
            </button>

            <div className={`my-1 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`} />

            <button
              type="button"
              onClick={() => {
                bringToFront(targetNode.id);
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
              }`}
            >
              <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
              <span>Bring to Front</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sendToBack(targetNode.id);
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Send to Back</span>
            </button>

            {selectedNodeIds.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  groupSelectedNodes('Group');
                  onClose();
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <span>Group Selected</span>
                <kbd className="ml-auto text-[10px] opacity-60">⌘G</kbd>
              </button>
            )}

            {targetNode.type === 'frame' && (
              <button
                type="button"
                onClick={() => {
                  ungroupNodes(targetNode.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition text-amber-500 ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <span>Ungroup</span>
              </button>
            )}

            <div className={`my-1 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`} />

            <button
              type="button"
              onClick={() => {
                deleteNodes([targetNode.id]);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-rose-500 hover:bg-rose-500/10 cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Node</span>
              <kbd className="ml-auto text-[10px] opacity-60">Del</kbd>
            </button>
          </>
        ) : (
          <>
            <div className="px-3 py-1 font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
              Canvas Actions
            </div>

            <button
              type="button"
              onClick={() => {
                addNode({
                  type: 'shape',
                  position: { x: flowX, y: flowY },
                  data: { label: 'New Idea', shapeType: 'rounded', layoutMode: 'manual' },
                });
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
              }`}
            >
              <Square className="w-3.5 h-3.5 text-cyan-500" />
              <span>Create Shape Node</span>
            </button>

            <button
              type="button"
              onClick={() => {
                addNode({
                  type: 'frame',
                  position: { x: flowX, y: flowY },
                  width: 360,
                  height: 260,
                  data: { title: 'Container Frame', layoutMode: 'manual' },
                });
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
              }`}
            >
              <span>Create Frame Container</span>
            </button>

            <button
              type="button"
              onClick={() => {
                addNode({
                  type: 'diagram',
                  position: { x: flowX, y: flowY },
                  width: 320,
                  height: 240,
                  data: {
                    title: 'Mermaid Sub-Flow',
                    mermaidCode: 'flowchart TD\n  A[Step 1] --> B[Step 2]',
                    layoutMode: 'manual',
                  },
                });
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer transition ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Create Mermaid Diagram</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
