/**
 * Creative-Neuro Canvas Subsystem - Custom Image Node
 * Path: src/components/canvas/nodes/ImageNode.tsx
 *
 * Implements:
 * - IndexedDB Asset resolution (`assetId`) & external URL (`src`) rendering
 * - Inline file-picker / URL input when spawned as an empty Image placeholder
 * - 8-direction corner and edge resizing via ResizeHandles
 * - 4-way Connector handles (top, right, bottom, left)
 * - NodeFloatingActionBar when single-selected
 */
import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Image as ImageIcon, Upload, Link2 } from 'lucide-react';
import type { NeuroNode } from '../../../types/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { saveAsset } from '../../../db/index.ts';
import {
  resolveAssetPreviewUrl,
  cacheAssetPreviewUrl,
  measureImageBlobDimensions,
  isImageFile,
  isImageUrlCandidate,
} from '../../../utils/imageImport.ts';
import { NodeFloatingActionBar } from '../NodeFloatingActionBar.tsx';
import { resolveNodeStyle } from './nodeStyleUtils.ts';
import { ResizeHandles, useNodeResize } from './ResizeHandles.tsx';

export function ImageNode({ id, data: rawData, selected, width, height }: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const storeWidth = useProjectStore((s) => s.nodes[id]?.width);
  const storeHeight = useProjectStore((s) => s.nodes[id]?.height);
  const projectId = useProjectStore((s) => s.project.id);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const themeMode = useProjectStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';

  const isStoreSelected = useProjectStore((s) => s.selectedNodeIds.includes(id));
  const selectedNodeCount = useProjectStore((s) => s.selectedNodeIds.length);
  const isNodeSelected = Boolean(selected || isStoreSelected);

  const W = storeWidth || width || 240;
  const H = storeHeight || height || 180;

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(data?.src || null);
  const [loadError, setLoadError] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlPrompt, setShowUrlPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);

    if (data?.assetId) {
      void resolveAssetPreviewUrl(data.assetId).then((url) => {
        if (!cancelled) {
          setResolvedUrl(url || data?.src || null);
        }
      });
    } else {
      setResolvedUrl(data?.src || null);
    }

    return () => {
      cancelled = true;
    };
  }, [data?.assetId, data?.src]);

  const handleResizeMouseDown = useNodeResize({
    id,
    defaultWidth: W,
    defaultHeight: H,
    minWidth: 60,
    minHeight: 48,
  });

  const handleFileUpload = async (file: File) => {
    if (!isImageFile(file)) return;
    const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const dims = await measureImageBlobDimensions(file);
    await saveAsset({
      id: assetId,
      projectId,
      mimeType: file.type || 'image/png',
      blob: file,
      fileName: file.name,
      width: dims.width,
      height: dims.height,
      createdAt: Date.now(),
    });
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objUrl = URL.createObjectURL(file);
      cacheAssetPreviewUrl(assetId, objUrl);
      setResolvedUrl(objUrl);
    }
    updateNodeData(id, {
      assetId,
      src: undefined,
      fileName: file.name,
      label: file.name,
      naturalWidth: dims.width,
      naturalHeight: dims.height,
    });
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isImageUrlCandidate(urlInput)) return;
    const trimmed = urlInput.trim();
    setLoadError(false);
    setResolvedUrl(trimmed);
    setShowUrlPrompt(false);
    updateNodeData(id, {
      src: trimmed,
      assetId: undefined,
    });
  };

  const handleClasses =
    '!w-3 !h-3 !bg-cyan-400 !border-2 !border-slate-900 opacity-0 group-hover:opacity-100 transition-opacity z-20';

  const resolvedStyle = resolveNodeStyle(data, { fontSize: 12, textAlign: 'center' });

  return (
    <div
      style={{
        width: W,
        height: H,
        opacity: resolvedStyle.opacity,
        borderColor: isNodeSelected
          ? '#22d3ee'
          : data?.borderColor || (isDark ? '#334155' : '#cbd5e1'),
        borderWidth: data?.borderWidth ?? 1.5,
        backgroundColor:
          data?.backgroundColor && data.backgroundColor !== 'transparent'
            ? data.backgroundColor
            : isDark
            ? 'rgba(15, 23, 42, 0.8)'
            : 'rgba(255, 255, 255, 0.9)',
      }}
      className={`relative group rounded-xl border transition-shadow overflow-visible flex items-center justify-center ${
        isNodeSelected
          ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_18px_rgba(6,182,212,0.45)]'
          : 'shadow-sm'
      }`}
      data-testid={`image-node-${id}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
      }}
    >
      {isNodeSelected && selectedNodeCount <= 1 && <NodeFloatingActionBar nodeId={id} />}

      {/* 8-Direction Resize Handles */}
      <ResizeHandles
        isSelected={isNodeSelected}
        testIdPrefix="image"
        onResizeMouseDown={handleResizeMouseDown}
      />

      {/* 4-Way Connector Handles */}
      <Handle id="top" type="source" position={Position.Top} className={handleClasses} />
      <Handle id="top" type="target" position={Position.Top} className={handleClasses} />
      <Handle id="right" type="source" position={Position.Right} className={handleClasses} />
      <Handle id="right" type="target" position={Position.Right} className={handleClasses} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={handleClasses} />
      <Handle id="bottom" type="target" position={Position.Bottom} className={handleClasses} />
      <Handle id="left" type="source" position={Position.Left} className={handleClasses} />
      <Handle id="left" type="target" position={Position.Left} className={handleClasses} />

      <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center">
        {resolvedUrl && !loadError ? (
          <img
            src={resolvedUrl}
            alt={data?.alt || data?.fileName || data?.label || 'Canvas image'}
            draggable={false}
            onError={() => setLoadError(true)}
            style={{ objectFit: data?.objectFit || 'contain' }}
            className="w-full h-full select-none pointer-events-none"
          />
        ) : (
          <div
            className={`nodrag nopan flex flex-col items-center justify-center gap-2 p-3 text-center w-full h-full ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            <ImageIcon className="w-7 h-7 text-indigo-400 opacity-80" />
            <span
              className="w-full font-medium"
              style={{
                color: data?.color ?? data?.style?.color,
                fontSize: resolvedStyle.fontSize,
                textAlign: resolvedStyle.textAlign,
              }}
            >
              {loadError ? 'Failed to load image' : 'No image selected'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                Upload
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUrlPrompt((v) => !v);
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1 cursor-pointer ${
                  isDark
                    ? 'border-slate-700 hover:bg-slate-800'
                    : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Link2 className="w-3 h-3" />
                URL
              </button>
            </div>
            {showUrlPrompt && (
              <form onSubmit={handleApplyUrl} className="flex items-center gap-1 w-full max-w-[200px]">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="https://..."
                  className={`flex-1 min-w-0 px-2 py-1 rounded text-[11px] border outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-100'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  type="submit"
                  className="px-2 py-1 rounded text-[11px] bg-cyan-500 text-slate-950 font-semibold cursor-pointer"
                >
                  OK
                </button>
              </form>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileUpload(file);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageNode;
