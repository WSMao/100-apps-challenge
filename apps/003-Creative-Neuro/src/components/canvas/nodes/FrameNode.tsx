/**
 * Creative-Neuro Canvas Subsystem - Custom Frame / Container Node
 * Path: src/components/canvas/nodes/FrameNode.tsx
 *
 * Implements:
 * - Visual container & subgraph grouping with editable header title
 * - Fold / Collapse toggle snapping to 180x44 summary bar and hiding child nodes
 * - Automatic ELK layout recalculation around folded/expanded frame bounds
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Folder, Layers } from 'lucide-react';

import type { NeuroEdge, NeuroNode } from '../../../types/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { calculateElkLayout } from '../../../engine/index.ts';
import { NodeFloatingActionBar } from '../NodeFloatingActionBar.tsx';
import {
  spawnChildNode,
  navigateSelectionDirectionally,
} from '../../workspace/ShortcutsHandler.tsx';

export function FrameNode({
  id,
  data: rawData,
  selected,
  width = 360,
  height = 260,
}: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const isEditingStore = useProjectStore((s) => s.editingNodeId === id);
  const editingInitialValue = useProjectStore((s) => s.editingInitialValue);
  const setEditingNodeId = useProjectStore((s) => s.setEditingNodeId);

  const [title, setTitle] = useState(data?.title || data?.label || 'Container Frame');
  const [isEditingLocal, setIsEditingLocal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingStore) {
      setTitle(data?.title || data?.label || 'Container Frame');
    }
  }, [data?.title, data?.label, isEditingStore]);

  useEffect(() => {
    if (isEditingStore) {
      const currentText = data?.title || data?.label || 'Container Frame';
      const raw = currentText.trim().toLowerCase();
      const isPlaceholder = !raw || raw === 'container frame' || raw === 'container';

      if (editingInitialValue !== null && editingInitialValue !== undefined) {
        if (editingInitialValue === ' ') {
          // Space: Append from the last character!
          setTitle(isPlaceholder ? ' ' : currentText + ' ');
        } else if (editingInitialValue === '') {
          // IME composition start or clear: replace with empty string
          setTitle('');
        } else {
          // Direct type-to-edit: REPLACE content with typed character!
          setTitle(editingInitialValue);
        }
      } else if (!isEditingLocal) {
        // Explicit edit mode: keep existing title
        setTitle(currentText);
      }
    }
  }, [isEditingStore, editingInitialValue, data?.title, data?.label, isEditingLocal]);

  const isStoreSelected = useProjectStore((s) => s.selectedNodeIds.includes(id));
  const selectedNodeCount = useProjectStore((s) => s.selectedNodeIds.length);
  const isNodeSelected = selected || isStoreSelected;
  const isSingleSelected = isNodeSelected && selectedNodeCount === 1;
  const isCollapsed = Boolean(data?.collapsed);

  useEffect(() => {
    if (isEditingStore && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
      if (editingInitialValue !== null && editingInitialValue !== undefined) {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      } else if (!isEditingLocal) {
        inputRef.current.select();
      }
    } else if (isSingleSelected && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
      inputRef.current.select();
    }
  }, [isEditingStore, isSingleSelected, editingInitialValue, title, isEditingLocal]);

  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  const handleCommit = useCallback(() => {
    setIsEditingLocal(false);
    if (isEditingStore) {
      setEditingNodeId(null);
    }
    updateNodeData(id, { title, label: title });
  }, [id, title, isEditingStore, setEditingNodeId, updateNodeData]);

  const handleCancel = useCallback(() => {
    setIsEditingLocal(false);
    if (isEditingStore) {
      setEditingNodeId(null);
    }
    setTitle(data?.title || data?.label || 'Container Frame');
    inputRef.current?.blur();
  }, [data?.title, data?.label, isEditingStore, setEditingNodeId]);

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
        className={`group relative bg-slate-900/95 border border-indigo-500/60 rounded-xl px-3 flex items-center justify-between shadow-xl cursor-pointer ${
          isNodeSelected ? 'ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)]' : ''
        }`}
        onClick={handleToggleCollapse}
      >
        {/* Horizontal Floating Quick-Action Menu directly above frame when single frame is selected */}
        {isNodeSelected && selectedNodeCount <= 1 && <NodeFloatingActionBar nodeId={id} />}

        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{ left: '50%', top: 0, right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', translate: 'none' }}
          className="!w-2 !h-2 !bg-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={{ left: '100%', top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', translate: 'none' }}
          className="!w-2 !h-2 !bg-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{ left: '50%', top: '100%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', translate: 'none' }}
          className="!w-2 !h-2 !bg-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{ left: 0, top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', translate: 'none' }}
          className="!w-2 !h-2 !bg-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
      className={`group relative bg-slate-900/30 border-2 border-dashed rounded-2xl p-3 flex flex-col transition-all ${
        isNodeSelected
          ? 'border-indigo-500 shadow-2xl shadow-indigo-500/10 ring-2 ring-cyan-400'
          : 'border-slate-700/80'
      }`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingNodeId(id, null);
      }}
    >
      {/* Horizontal Floating Quick-Action Menu directly above frame when single frame is selected */}
      {isNodeSelected && selectedNodeCount <= 1 && <NodeFloatingActionBar nodeId={id} />}

      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ left: '50%', top: 0, right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', translate: 'none' }}
        className="!w-2.5 !h-2.5 !bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ left: '100%', top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', translate: 'none' }}
        className="!w-2.5 !h-2.5 !bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ left: '50%', top: '100%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', translate: 'none' }}
        className="!w-2.5 !h-2.5 !bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ left: 0, top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', translate: 'none' }}
        className="!w-2.5 !h-2.5 !bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
      />

      {/* Frame Header Bar */}
      <div className="h-8 flex items-center justify-between pb-2 border-b border-slate-800/80 pointer-events-auto">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => {
              setIsEditingLocal(true);
              if (!isEditingStore) {
                setEditingNodeId(id, e.target.value);
              }
              setTitle(e.target.value);
            }}
            onCompositionStart={() => {
              if (!isEditingStore) {
                setEditingNodeId(id, '');
              }
            }}
            onCompositionEnd={(e) => {
              setTitle(e.currentTarget.value);
            }}
            onFocus={() => {
              if (!isEditingStore) {
                setEditingNodeId(id, null);
              }
            }}
            onBlur={handleCommit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.nativeEvent.isComposing) return;

              // Space key when single selected: append space
              if (e.key === ' ' && !isEditingStore) {
                e.preventDefault();
                setEditingNodeId(id, ' ');
                const newTitle = (title || '') + ' ';
                setTitle(newTitle);
                requestAnimationFrame(() => {
                  if (inputRef.current) {
                    inputRef.current.focus({ preventScroll: true });
                    inputRef.current.setSelectionRange(newTitle.length, newTitle.length);
                  }
                });
                return;
              }

              // Printable single character when not editing: DIRECTLY REPLACE CONTENT!
              if (e.key.length === 1 && !isEditingStore && !e.metaKey && !e.ctrlKey && !e.altKey) {
                const isIme =
                  e.key === 'Process' ||
                  Boolean((e as any).isComposing) ||
                  (e as any).keyCode === 229 ||
                  e.nativeEvent.isComposing;
                if (!isIme) {
                  e.preventDefault();
                  setIsEditingLocal(true);
                  setEditingNodeId(id, e.key);
                  setTitle(e.key);
                  requestAnimationFrame(() => {
                    if (inputRef.current) {
                      inputRef.current.focus({ preventScroll: true });
                      inputRef.current.setSelectionRange(1, 1);
                    }
                  });
                  return;
                }
              }

              // Tab: Spawn child node
              if (e.key === 'Tab') {
                e.preventDefault();
                handleCommit();
                spawnChildNode(id);
                return;
              }

              // Enter key: commit if editing, activate if not
              if (e.key === 'Enter') {
                e.preventDefault();
                if (isEditingStore) {
                  handleCommit();
                  inputRef.current?.blur();
                } else {
                  setEditingNodeId(id, null);
                }
                return;
              }

              // Escape
              if (e.key === 'Escape') {
                e.preventDefault();
                if (isEditingStore) {
                  handleCancel();
                } else {
                  useProjectStore.getState().setSelectedNodes([]);
                }
                return;
              }

              // Delete / Backspace when not editing
              if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingStore) {
                e.preventDefault();
                useProjectStore.getState().batchDelete([id], []);
                return;
              }

              // Arrow navigation when not editing
              if (!isEditingStore && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                  e.preventDefault();
                  navigateSelectionDirectionally(
                    e.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
                  );
                  return;
                }
              }

              // Undo / Redo
              if ((e.metaKey || e.ctrlKey) && !e.altKey) {
                const lowerKey = e.key.toLowerCase();
                if (lowerKey === 'z') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    useProjectStore.getState().redo();
                  } else {
                    useProjectStore.getState().undo();
                  }
                  return;
                }
                if (lowerKey === 'y') {
                  e.preventDefault();
                  useProjectStore.getState().redo();
                  return;
                }
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingNodeId(id, null);
            }}
            className={`text-xs font-semibold text-slate-200 px-1.5 py-0.5 rounded outline-none border transition-colors truncate ${
              isEditingStore
                ? 'border-indigo-500 bg-transparent pointer-events-auto caret-cyan-400 selection:bg-indigo-500/30'
                : 'border-transparent bg-transparent hover:bg-slate-800/50 focus:border-indigo-500 selection:bg-transparent selection:text-inherit'
            }`}
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
