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

export function TextNode({ id, data: rawData, selected, width }: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data?.label || 'Double-click to edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  useEffect(() => {
    setText(data?.label || '');
  }, [data?.label]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(36, textareaRef.current.scrollHeight)}px`;
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleCommit = () => {
    setIsEditing(false);
    updateNodeData(id, { label: text });
  };

  return (
    <div
      style={{
        minWidth: 100,
        minHeight: 32,
        width: width ? Math.max(100, width) : undefined,
        backgroundColor: data?.backgroundColor || undefined,
        borderColor: data?.borderColor || undefined,
        borderWidth: data?.borderWidth || undefined,
      }}
      className={`relative group px-3 py-2 rounded-lg transition-all ${
        selected
          ? 'ring-2 ring-indigo-500 bg-slate-900/70 shadow-lg'
          : 'hover:bg-slate-900/40'
      }`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
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
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleCommit();
            }
            if (e.key === 'Escape') {
              setText(data?.label || '');
              setIsEditing(false);
            }
          }}
          className="w-full bg-slate-950 text-slate-100 text-sm px-2 py-1 rounded border border-indigo-500 outline-none resize-none overflow-hidden leading-relaxed"
        />
      ) : (
        <p
          style={{
            color: data?.color || '#f1f5f9',
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
