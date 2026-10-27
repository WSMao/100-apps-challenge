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

import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NeuroNode } from '../../../types/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { NodeFloatingActionBar } from '../NodeFloatingActionBar.tsx';

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

  useEffect(() => {
    if (!isEditing) {
      setText(data?.label || '');
    }
  }, [data?.label, isEditing]);

  useEffect(() => {
    if (isEditingStore) {
      const currentText = data?.label || '';
      const raw = currentText.trim().toLowerCase();
      const isPlaceholder =
        !raw ||
        raw === 'double-click to edit' ||
        raw === 'type text note...' ||
        raw === 'type text here...' ||
        raw === 'text';

      if (editingInitialValue !== null && editingInitialValue !== undefined) {
        if (editingInitialValue === '') {
          setText(isPlaceholder ? '' : currentText);
        } else if (isPlaceholder) {
          setText(editingInitialValue);
        } else {
          setText(currentText + editingInitialValue);
        }
      } else {
        setText(currentText);
      }
    }
  }, [isEditingStore, editingInitialValue, data?.label]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(36, textareaRef.current.scrollHeight)}px`;
      textareaRef.current.focus();
      if (editingInitialValue !== null && editingInitialValue !== undefined) {
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      } else {
        textareaRef.current.select();
      }
    }
  }, [isEditing, editingInitialValue, text]);

  const handleCommit = () => {
    setIsEditingLocal(false);
    if (isEditingStore) {
      setEditingNodeId(null);
    }
    updateNodeData(id, { label: text });
  };

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

      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleCommit();
            }
            if (e.key === 'Escape') {
              setText(data?.label || '');
              setIsEditingLocal(false);
              setEditingNodeId(null);
            }
          }}
          style={{
            color: data?.color || (isDark ? '#f1f5f9' : '#0f172a'),
            fontSize: data?.fontSize || 14,
            fontWeight: data?.fontWeight || 'normal',
            textAlign: data?.textAlign || 'left',
          }}
          className="w-full text-sm px-1.5 py-0.5 rounded border border-indigo-500/70 outline-none resize-none overflow-hidden leading-relaxed bg-transparent"
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
