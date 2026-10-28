/**
 * Creative-Neuro Canvas Subsystem - Custom Text Note Node
 * Path: src/components/canvas/nodes/TextNode.tsx
 *
 * Implements:
 * - Auto-resizing inline textarea for whiteboard commentary and annotations
 * - Typography styling (fontSize, fontWeight, textAlign, color)
 * - Double-click edit workflow with Cmd/Ctrl+Enter commit and Escape cancel
 * - Subtle 4-way connection handles
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NeuroNode } from '../../../types/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { NodeFloatingActionBar } from '../NodeFloatingActionBar.tsx';
import {
  spawnChildNode,
  navigateSelectionDirectionally,
} from '../../workspace/ShortcutsHandler.tsx';

export function TextNode({ id, data: rawData, selected, width }: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const isEditingStore = useProjectStore((s) => s.editingNodeId === id);
  const editingInitialValue = useProjectStore((s) => s.editingInitialValue);
  const setEditingNodeId = useProjectStore((s) => s.setEditingNodeId);

  const [isEditingLocal, setIsEditingLocal] = useState(false);
  const isEditing = isEditingLocal || isEditingStore;
  const [text, setText] = useState(data?.label || 'Double-click to edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const themeMode = useProjectStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';
  const isStoreSelected = useProjectStore((s) => s.selectedNodeIds.includes(id));
  const selectedNodeCount = useProjectStore((s) => s.selectedNodeIds.length);
  const isNodeSelected = selected || isStoreSelected;
  const isSingleSelected = isNodeSelected && selectedNodeCount === 1;
  const shouldRenderInput = isSingleSelected || isEditing;

  useEffect(() => {
    if (!isEditing) {
      setText(data?.label || '');
    }
  }, [data?.label, isEditing]);

  useEffect(() => {
    if (isEditingStore) {
      setIsEditingLocal(true);
      const currentText = data?.label || '';
      const raw = currentText.trim().toLowerCase();
      const isPlaceholder =
        !raw ||
        raw === 'double-click to edit' ||
        raw === 'type text note...' ||
        raw === 'type text here...' ||
        raw === 'text';

      if (editingInitialValue !== null && editingInitialValue !== undefined) {
        if (editingInitialValue === ' ') {
          // Space: Append from the last character!
          setText(isPlaceholder ? ' ' : currentText + ' ');
        } else if (editingInitialValue === '') {
          // IME composition start or clear: replace with empty string
          setText('');
        } else {
          // Direct type-to-edit: REPLACE content with typed character!
          setText(editingInitialValue);
        }
      } else if (!isEditingLocal) {
        // Explicit edit mode (F2 / Shift+Enter / double click): keep existing text
        setText(currentText);
      }
    }
  }, [isEditingStore, editingInitialValue, data?.label, isEditingLocal]);

  useEffect(() => {
    if (shouldRenderInput && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(36, textareaRef.current.scrollHeight)}px`;
      if (isEditing) {
        if (document.activeElement !== textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
        }
        if (editingInitialValue !== null && editingInitialValue !== undefined) {
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        } else if (!isEditingLocal) {
          textareaRef.current.select();
        }
      } else if (isSingleSelected) {
        if (document.activeElement !== textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.select();
        }
      }
    }
  }, [shouldRenderInput, isEditing, isSingleSelected, editingInitialValue, text, isEditingLocal]);

  const handleCommit = useCallback(() => {
    setIsEditingLocal(false);
    if (isEditingStore) {
      setEditingNodeId(null);
    }
    if (text !== data?.label) {
      updateNodeData(id, { label: text });
    }
  }, [id, text, data?.label, isEditingStore, setEditingNodeId, updateNodeData]);

  return (
    <div
      style={{
        minWidth: 100,
        minHeight: 32,
        width: width ? Math.max(100, width) : undefined,
        backgroundColor: data?.backgroundColor || 'transparent',
        borderColor: data?.borderColor || 'transparent',
        borderWidth: data?.borderWidth || 0,
      }}
      className={`relative group px-3 py-2 rounded-lg transition-all ${
        isNodeSelected
          ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.6)]'
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

      {shouldRenderInput ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setIsEditingLocal(true);
            if (!isEditingStore) {
              setEditingNodeId(id, e.target.value);
            }
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onCompositionStart={() => {
            setIsEditingLocal(true);
            if (!isEditingStore) {
              setEditingNodeId(id, '');
            }
          }}
          onCompositionEnd={(e) => {
            setText(e.currentTarget.value);
          }}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.nativeEvent.isComposing) return;

            // Space key when single selected: append space
            if (e.key === ' ' && !isEditing) {
              e.preventDefault();
              setIsEditingLocal(true);
              setEditingNodeId(id, ' ');
              const newText = (text || '') + ' ';
              setText(newText);
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.focus({ preventScroll: true });
                  textareaRef.current.setSelectionRange(newText.length, newText.length);
                }
              });
              return;
            }

            // Printable single character when not editing: DIRECTLY REPLACE CONTENT!
            if (e.key.length === 1 && !isEditing && !e.metaKey && !e.ctrlKey && !e.altKey) {
              const isIme =
                e.key === 'Process' ||
                Boolean((e as any).isComposing) ||
                (e as any).keyCode === 229 ||
                e.nativeEvent.isComposing;
              if (!isIme) {
                e.preventDefault();
                setIsEditingLocal(true);
                setEditingNodeId(id, e.key);
                setText(e.key);
                requestAnimationFrame(() => {
                  if (textareaRef.current) {
                    textareaRef.current.focus({ preventScroll: true });
                    textareaRef.current.setSelectionRange(1, 1);
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

            // Enter key: on TextNode, Enter activates edit mode if !isEditing; Cmd/Ctrl+Enter commits if isEditing
            if (e.key === 'Enter') {
              if (!isEditing) {
                e.preventDefault();
                setIsEditingLocal(true);
                setEditingNodeId(id, null);
                return;
              }
              if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                handleCommit();
                return;
              }
            }

            // Escape
            if (e.key === 'Escape') {
              e.preventDefault();
              if (isEditing) {
                setText(data?.label || '');
                setIsEditingLocal(false);
                setEditingNodeId(null);
              } else {
                useProjectStore.getState().setSelectedNodes([]);
              }
              return;
            }

            // Delete / Backspace when not editing
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing) {
              e.preventDefault();
              useProjectStore.getState().batchDelete([id], []);
              return;
            }

            // Arrows navigation when not editing
            if (!isEditing && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
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
          style={{
            color: data?.color || (isDark ? '#f1f5f9' : '#0f172a'),
            fontSize: data?.fontSize || 14,
            fontWeight: data?.fontWeight || 'normal',
            textAlign: data?.textAlign || 'left',
          }}
          className={`w-full text-sm px-1.5 py-0.5 rounded outline-none resize-none overflow-hidden leading-relaxed bg-transparent transition-all ${
            isEditing
              ? 'border border-indigo-500/70 pointer-events-auto caret-cyan-400 selection:bg-indigo-500/30'
              : 'border-none pointer-events-none caret-transparent select-none ring-0 focus:ring-0 focus:outline-none selection:bg-transparent selection:text-inherit'
          }`}
        />
      ) : (
        <p
          style={{
            color: data?.color || (isDark ? '#f1f5f9' : '#0f172a'),
            fontSize: data?.fontSize || 14,
            fontWeight: data?.fontWeight || 'normal',
            textAlign: data?.textAlign || 'left',
          }}
          className="whitespace-pre-wrap break-words leading-relaxed select-none"
        >
          {text || 'Type text note...'}
        </p>
      )}

      {/* Subtle 4-Way Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="opacity-0 group-hover:opacity-100 !w-2 !h-2 !bg-indigo-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="opacity-0 group-hover:opacity-100 !w-2 !h-2 !bg-indigo-400"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="opacity-0 group-hover:opacity-100 !w-2 !h-2 !bg-indigo-400"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="opacity-0 group-hover:opacity-100 !w-2 !h-2 !bg-indigo-400"
      />
    </div>
  );
}

export default React.memo(TextNode);
