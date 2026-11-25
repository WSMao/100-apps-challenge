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
import { Handle, Position, useNodes, useStoreApi, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Frame } from 'lucide-react';

import type { NeuroNode } from '../../../types/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { NodeFloatingActionBar } from '../NodeFloatingActionBar.tsx';
import { resolveNodeStyle } from './nodeStyleUtils.ts';
import {
  spawnChildNode,
  navigateSelectionDirectionally,
} from '../../workspace/ShortcutsHandler.tsx';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const MIN_FRAME_WIDTH = 180;
const MIN_FRAME_HEIGHT = 120;
const MAX_FRAME_WIDTH = 2400;
const MAX_FRAME_HEIGHT = 1800;

export function FrameNode({
  id,
  data: rawData,
  selected,
  width = 360,
  height = 260,
}: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const storeApi = useStoreApi();
  const themeMode = useProjectStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';
  const storeWidth = useProjectStore((s) => s.nodes[id]?.width);
  const storeHeight = useProjectStore((s) => s.nodes[id]?.height);
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
      if (document.activeElement !== inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
      if (editingInitialValue !== null && editingInitialValue !== undefined) {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      } else if (!isEditingLocal) {
        inputRef.current.select();
      }
    } else if (isSingleSelected && inputRef.current) {
      if (document.activeElement !== inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
        inputRef.current.select();
      }
    }
  }, [isEditingStore, isSingleSelected, editingInitialValue, title, isEditingLocal]);

  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  const handleCommit = useCallback(() => {
    setIsEditingLocal(false);
    if (isEditingStore) {
      setEditingNodeId(null);
    }
    const currentTitle = data?.title || data?.label;
    if (title !== currentTitle) {
      updateNodeData(id, { title, label: title });
    }
  }, [id, title, data?.title, data?.label, isEditingStore, setEditingNodeId, updateNodeData]);

  const handleCancel = useCallback(() => {
    setIsEditingLocal(false);
    if (isEditingStore) {
      setEditingNodeId(null);
    }
    setTitle(data?.title || data?.label || 'Container Frame');
    inputRef.current?.blur();
  }, [data?.title, data?.label, isEditingStore, setEditingNodeId]);

  // Count attached children (both in store and in current ReactFlow instance e.g. FocusDiagramModal)
  const storeChildrenCount = useProjectStore(
    useCallback(
      (s) => Object.values(s.nodes).filter((n) => n.parentId === id).length,
      [id]
    )
  );
  const rfNodes = useNodes();
  const rfChildrenCount = rfNodes.filter((n) => n.parentId === id).length;
  const childrenCount = storeChildrenCount > 0 ? storeChildrenCount : rfChildrenCount;

  const handleToggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      useProjectStore.getState().toggleFrameCollapse(id);
    },
    [id]
  );

  const W = storeWidth || width || 360;
  const H = storeHeight || height || 260;

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, dir: ResizeDirection) => {
      if (e.button !== 0 || isCollapsed) return;
      e.stopPropagation();
      e.preventDefault();

      const state = useProjectStore.getState();
      const targetFrame = state.nodes[id];
      if (!targetFrame) return;

      if (!state.selectedNodeIds.includes(id)) {
        state.setSelectedNodes([id]);
        state.setSelectedEdges([]);
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = targetFrame.width || W;
      const startH = targetFrame.height || H;
      const startPosX = targetFrame.position.x;
      const startPosY = targetFrame.position.y;
      let prevPosX = startPosX;
      let prevPosY = startPosY;

      const startSnapshot = {
        project: state.project,
        boards: state.boards,
        pages: state.pages,
        nodes: JSON.parse(JSON.stringify(state.nodes)),
        edges: state.edges,
        activePageId: state.activePageId,
      };

      useProjectStore.temporal.getState().pause();
      useProjectStore.setState({ isResizing: true });

      const onMouseMove = (moveEvent: MouseEvent) => {
        const rfTransform = storeApi.getState().transform;
        const zoom = rfTransform && rfTransform[2] ? rfTransform[2] : 1;
        const dx = (moveEvent.clientX - startX) / zoom;
        const dy = (moveEvent.clientY - startY) / zoom;

        let nextW = startW;
        let nextH = startH;
        let nextPosX = startPosX;
        let nextPosY = startPosY;

        if (dir.includes('e')) {
          nextW = Math.min(MAX_FRAME_WIDTH, Math.max(MIN_FRAME_WIDTH, Math.round(startW + dx)));
        }
        if (dir.includes('s')) {
          nextH = Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, Math.round(startH + dy)));
        }
        if (dir.includes('w')) {
          nextW = Math.min(MAX_FRAME_WIDTH, Math.max(MIN_FRAME_WIDTH, Math.round(startW - dx)));
          nextPosX = Math.round(startPosX + (startW - nextW));
        }
        if (dir.includes('n')) {
          nextH = Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, Math.round(startH - dy)));
          nextPosY = Math.round(startPosY + (startH - nextH));
        }

        const deltaPosX = nextPosX - prevPosX;
        const deltaPosY = nextPosY - prevPosY;
        prevPosX = nextPosX;
        prevPosY = nextPosY;

        useProjectStore.setState((s) => {
          const n = s.nodes[id];
          if (!n) return;
          n.width = nextW;
          n.height = nextH;
          n.position = { x: nextPosX, y: nextPosY };
          n.measured = { width: nextW, height: nextH };

          // Keep existing children at same absolute coordinates when top/left border moves
          if (deltaPosX !== 0 || deltaPosY !== 0) {
            for (const child of Object.values(s.nodes)) {
              if (child.parentId === id) {
                child.position = {
                  x: child.position.x - deltaPosX,
                  y: child.position.y - deltaPosY,
                };
              }
            }
          }
        });
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        useProjectStore.setState((s) => {
          s.isResizing = false;
          const page = s.pages[s.activePageId];
          if (page) page.updatedAt = Date.now();
          s.project.updatedAt = Date.now();
        });

        // Auto-capture any enclosed root objects inside the resized Frame
        useProjectStore.getState().captureNodesInFrame(id);

        const endState = useProjectStore.getState();
        const endNode = endState.nodes[id];
        const hasResized =
          endNode &&
          (endNode.width !== startW ||
            endNode.height !== startH ||
            endNode.position.x !== startPosX ||
            endNode.position.y !== startPosY);

        useProjectStore.temporal.getState().resume();
        if (hasResized) {
          useProjectStore.temporal.setState((t) => {
            const pastStates = [...t.pastStates, startSnapshot];
            if (pastStates.length > 100) pastStates.shift();
            return {
              pastStates,
              futureStates: [],
            };
          });
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [id, isCollapsed, W, H, storeApi]
  );

  const frameBg =
    data?.backgroundColor ||
    (isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(226, 232, 240, 0.55)');
  const frameBorderColor =
    data?.borderColor || (isDark ? '#475569' : '#94a3b8');
  const frameBorderWidth = data?.borderWidth ?? 1.5;
  const frameTextColor =
    data?.color || (isDark ? '#e2e8f0' : '#0f172a');
  const resolvedStyle = resolveNodeStyle(data, { fontSize: 12, textAlign: 'left' });

  if (isCollapsed) {
    return (
      <div
        style={{
          width: 180,
          height: 44,
          backgroundColor: frameBg,
          borderColor: frameBorderColor,
          borderWidth: frameBorderWidth,
          opacity: resolvedStyle.opacity,
        }}
        data-testid={`frame-node-${id}`}
        data-collapsed="true"
        className={`group relative rounded-xl px-3 flex items-center justify-between shadow-xl backdrop-blur-sm cursor-grab active:cursor-grabbing ${
          isNodeSelected ? 'ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)]' : ''
        }`}
        onDoubleClick={handleToggleCollapse}
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
          <Frame className="w-4 h-4 text-indigo-400 shrink-0" />
          <span
            className="text-xs font-semibold truncate max-w-[85px]"
            style={{
              color: frameTextColor,
              fontSize: resolvedStyle.fontSize,
              textAlign: resolvedStyle.textAlign,
            }}
          >
            {data?.title || data?.label || 'Container Frame'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-mono px-1.5 py-0.5 rounded-full border border-indigo-500/30">
            {childrenCount}
          </span>
          <button
            type="button"
            onClick={handleToggleCollapse}
            title="Unfold Frame"
            data-testid="frame-fold-toggle"
            className="p-0.5 rounded hover:bg-indigo-500/20 cursor-pointer transition"
          >
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  return (
      <div
        style={{
          width: W,
          height: H,
          backgroundColor: frameBg,
          borderColor: isNodeSelected ? '#06b6d4' : frameBorderColor,
          borderWidth: frameBorderWidth,
          opacity: resolvedStyle.opacity,
        }}
      data-testid={`frame-node-${id}`}
      data-collapsed="false"
      className={`group relative border-dashed rounded-2xl p-3 flex flex-col transition-shadow ${
        isNodeSelected
          ? 'shadow-2xl shadow-cyan-500/10 ring-2 ring-cyan-400'
          : ''
      }`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingNodeId(id, null);
      }}
    >
      {/* 4 Border Resize Strips (n, s, e, w) */}
      <div
        data-testid="frame-resize-n"
        onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
        className="nodrag nopan absolute -top-1.5 left-3 right-3 h-3 cursor-ns-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />
      <div
        data-testid="frame-resize-s"
        onMouseDown={(e) => handleResizeMouseDown(e, 's')}
        className="nodrag nopan absolute -bottom-1.5 left-3 right-3 h-3 cursor-ns-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />
      <div
        data-testid="frame-resize-w"
        onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
        className="nodrag nopan absolute -left-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />
      <div
        data-testid="frame-resize-e"
        onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
        className="nodrag nopan absolute -right-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />

      {/* 4 Corner Resize Handles (nw, ne, sw, se) */}
      <div
        data-testid="frame-resize-nw"
        onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
        className={`nodrag nopan absolute -top-2 -left-2 w-4 h-4 cursor-nwse-resize z-30 flex items-center justify-center transition-opacity ${
          isNodeSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-cyan-400 shadow" />
      </div>
      <div
        data-testid="frame-resize-ne"
        onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
        className={`nodrag nopan absolute -top-2 -right-2 w-4 h-4 cursor-nesw-resize z-30 flex items-center justify-center transition-opacity ${
          isNodeSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-cyan-400 shadow" />
      </div>
      <div
        data-testid="frame-resize-sw"
        onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
        className={`nodrag nopan absolute -bottom-2 -left-2 w-4 h-4 cursor-nesw-resize z-30 flex items-center justify-center transition-opacity ${
          isNodeSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-cyan-400 shadow" />
      </div>
      <div
        data-testid="frame-resize-se"
        onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
        className={`nodrag nopan absolute -bottom-2 -right-2 w-4 h-4 cursor-nwse-resize z-30 flex items-center justify-center transition-opacity ${
          isNodeSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-cyan-400 shadow" />
      </div>
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
      <div className={`h-8 flex items-center justify-between pb-2 border-b pointer-events-auto gap-2 ${isDark ? 'border-slate-700/80' : 'border-slate-300/80'}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Frame className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            size={Math.max(20, Math.min(80, (title || '').length + 8))}
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
            style={{
              color: frameTextColor,
              fontSize: resolvedStyle.fontSize,
              textAlign: resolvedStyle.textAlign,
            }}
            className={`text-xs font-semibold px-1.5 py-0.5 rounded outline-none border transition-colors truncate ${
              isEditingStore
                ? 'border-indigo-500 bg-transparent pointer-events-auto caret-cyan-400 selection:bg-indigo-500/30'
                : 'border-transparent bg-transparent hover:bg-slate-500/15 focus:border-indigo-500 selection:bg-transparent selection:text-inherit'
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
          data-testid="frame-fold-toggle"
          className="p-1 hover:bg-slate-500/20 rounded text-slate-400 hover:text-slate-200 cursor-pointer transition shrink-0"
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
