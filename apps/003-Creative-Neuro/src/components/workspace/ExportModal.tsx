/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Multi-Format Export & Drag-and-Drop Lossless Import Modal
 *
 * Supports:
 * - Mermaid Flowchart DSL (.mmd) preview, copy & download
 * - Full Project JSON (.neuro.json) preview, copy & download
 * - Standalone Vector SVG (.neuro.svg) with `data-neuro-payload` compressed metadata
 * - High-Resolution PNG (.neuro.png) with zlib/pako `tEXt` chunk metadata
 * - Drag-and-drop import of `.neuro.json`, `.neuro.svg`, and `.neuro.png`
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileJson,
  FileCode2,
  Image as ImageIcon,
  FileType2,
  UploadCloud,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { FlowDirection } from '../../types/index.ts';
import { useProjectStore } from '../../store/projectStore.ts';
import {
  exportProjectAsJson,
  exportPageAsMermaid,
  exportCanvasAsSvg,
  exportCanvasAsPngWithMetadata,
  exportPngWithPako,
  importFromPngOrSvgMetadata,
  applyImportedProjectToStore,
  downloadTextFile,
  downloadDataUrl,
  registerExportStore,
} from '../../utils/exportUtils.ts';

registerExportStore(useProjectStore);

export interface ExportModalProps {
  isOpen?: boolean;
  onClose: () => void;
  canvasElement?: HTMLElement | null;
}

type ExportFormatTab = 'mermaid' | 'json' | 'svg' | 'png' | 'import';

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen = true,
  onClose,
  canvasElement,
}) => {
  const project = useProjectStore((s) => s.project);
  const activePageId = useProjectStore((s) => s.activePageId);
  const pages = useProjectStore((s) => s.pages);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);

  const [activeTab, setActiveTab] = useState<ExportFormatTab>('mermaid');
  const [mermaidDirection, setMermaidDirection] = useState<FlowDirection>('TB');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activePage = pages[activePageId];
  const safeSlug = useMemo(
    () =>
      (project.name || 'creative-neuro')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'creative-neuro',
    [project.name]
  );

  const mermaidDsl = useMemo(
    () => exportPageAsMermaid(mermaidDirection, activePageId),
    [mermaidDirection, activePageId, pages, nodes, edges]
  );

  const jsonPayload = useMemo(
    () => exportProjectAsJson(),
    [project, pages, nodes, edges, activePageId]
  );

  const svgPayload = useMemo(
    () => exportCanvasAsSvg(activePage, true),
    [activePage, nodes, edges, project]
  );

  const pakoPreview = useMemo(() => {
    const result = exportPngWithPako();
    return {
      rawBytes: new TextEncoder().encode(jsonPayload).length,
      compressedBytes: result.compressedPayload.length,
      base64Preview: result.base64Payload.slice(0, 120) + '...',
    };
  }, [jsonPayload]);

  if (!isOpen) return null;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(label);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      // Fallback copy via temporary textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedFormat(label);
      setTimeout(() => setCopiedFormat(null), 2000);
    }
  };

  const handleDownloadMermaid = () => {
    downloadTextFile(
      mermaidDsl,
      `${safeSlug}-${activePage?.title || 'flow'}.mmd`,
      'text/plain;charset=utf-8'
    );
  };

  const handleDownloadJson = () => {
    downloadTextFile(
      jsonPayload,
      `${safeSlug}.neuro.json`,
      'application/json;charset=utf-8'
    );
  };

  const handleDownloadSvg = () => {
    downloadTextFile(
      svgPayload,
      `${safeSlug}.neuro.svg`,
      'image/svg+xml;charset=utf-8'
    );
  };

  const handleDownloadPng = async () => {
    setIsExportingPng(true);
    try {
      const targetEl =
        canvasElement ||
        (typeof document !== 'undefined'
          ? (document.querySelector('.react-flow__viewport') as HTMLElement | null) ||
            (document.querySelector('.react-flow') as HTMLElement | null)
          : null);

      const pngResult = await exportCanvasAsPngWithMetadata(targetEl);
      downloadDataUrl(pngResult.dataUrl, `${safeSlug}.neuro.png`);
    } finally {
      setIsExportingPng(false);
    }
  };

  const processImportedFile = async (file: File) => {
    setImportStatus(null);
    try {
      const restored = await importFromPngOrSvgMetadata(file);
      applyImportedProjectToStore(restored);
      const pageCount = Object.keys(restored.pages).length;
      const nodeCount = Object.keys(restored.nodes).length;
      setImportStatus({
        type: 'success',
        message: `Restored "${restored.project.name}" (${pageCount} page${pageCount === 1 ? '' : 's'}, ${nodeCount} node${nodeCount === 1 ? '' : 's'}) from ${file.name}`,
      });
    } catch (err) {
      setImportStatus({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to import file. Ensure it is a valid .neuro.json, .neuro.svg, or .neuro.png.',
      });
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processImportedFile(file);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImportedFile(file);
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="export-modal-backdrop"
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
        data-testid="export-modal"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Multi-Format Export & Lossless Import
              </h2>
              <p className="text-xs text-slate-400">
                Export diagrams or re-hydrate editable projects from embedded Pako metadata
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close modal"
            data-testid="close-export-modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-800 flex items-center gap-1 bg-slate-950/40 overflow-x-auto">
          <button
            onClick={() => setActiveTab('mermaid')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'mermaid'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="export-tab-mermaid"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Mermaid DSL</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'json'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="export-tab-json"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>.neuro.json</span>
          </button>

          <button
            onClick={() => setActiveTab('svg')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'svg'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="export-tab-svg"
          >
            <FileType2 className="w-3.5 h-3.5" />
            <span>.neuro.svg</span>
          </button>

          <button
            onClick={() => setActiveTab('png')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'png'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="export-tab-png"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>.neuro.png (Pako)</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'import'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="export-tab-import"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import / Restore</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'mermaid' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Active Page: {activePage?.title || 'Current Page'}
                  </span>
                  <select
                    value={mermaidDirection}
                    onChange={(e) => setMermaidDirection(e.target.value as FlowDirection)}
                    className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    aria-label="Mermaid flow direction"
                  >
                    <option value="TB">Direction: TB (Top-Bottom)</option>
                    <option value="LR">Direction: LR (Left-Right)</option>
                    <option value="BT">Direction: BT (Bottom-Top)</option>
                    <option value="RL">Direction: RL (Right-Left)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(mermaidDsl, 'mermaid')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    data-testid="copy-mermaid-btn"
                  >
                    {copiedFormat === 'mermaid' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy DSL</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadMermaid}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
                    data-testid="download-mermaid-btn"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .mmd</span>
                  </button>
                </div>
              </div>
              <pre
                className="w-full h-64 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-200 overflow-auto"
                data-testid="mermaid-export-preview"
              >
                {mermaidDsl}
              </pre>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Complete normalized scene graph including all pages, custom styles, and layout modes.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(jsonPayload, 'json')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    data-testid="copy-json-btn"
                  >
                    {copiedFormat === 'json' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
                    data-testid="download-json-btn"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .neuro.json</span>
                  </button>
                </div>
              </div>
              <pre
                className="w-full h-64 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-auto"
                data-testid="json-export-preview"
              >
                {jsonPayload}
              </pre>
            </div>
          )}

          {activeTab === 'svg' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Standalone vector SVG with line jumps and embedded{' '}
                  <code className="text-indigo-300">data-neuro-payload</code> metadata.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(svgPayload, 'svg')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    data-testid="copy-svg-btn"
                  >
                    {copiedFormat === 'svg' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy SVG</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadSvg}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
                    data-testid="download-svg-btn"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .neuro.svg</span>
                  </button>
                </div>
              </div>
              <pre
                className="w-full h-64 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-300 overflow-auto"
                data-testid="svg-export-preview"
              >
                {svgPayload}
              </pre>
            </div>
          )}

          {activeTab === 'png' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Lossless PNG with Embedded Zlib (Pako) Chunk
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Embeds compressed project state inside PNG <code className="text-indigo-300">tEXt</code> chunk (<code className="text-indigo-300">CreativeNeuro</code>).
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadPng}
                    disabled={isExportingPng}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md transition"
                    data-testid="download-png-btn"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isExportingPng ? 'Encoding PNG...' : 'Download .neuro.png'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Uncompressed JSON</span>
                    <span className="text-sm font-bold text-slate-200">
                      {pakoPreview.rawBytes.toLocaleString()} B
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Pako Deflated Size</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {pakoPreview.compressedBytes.toLocaleString()} B
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Compression Ratio</span>
                    <span className="text-sm font-bold text-indigo-400">
                      {pakoPreview.rawBytes > 0
                        ? `${Math.round((1 - pakoPreview.compressedBytes / pakoPreview.rawBytes) * 100)}% saved`
                        : '0%'}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[11px] text-slate-500 block mb-1">
                    Deflated Base64 Chunk Preview:
                  </span>
                  <code className="block p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono break-all">
                    {pakoPreview.base64Preview}
                  </code>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  isDraggingOver
                    ? 'border-indigo-400 bg-indigo-500/10'
                    : 'border-slate-700 hover:border-indigo-500/60 bg-slate-950/60 hover:bg-slate-950'
                }`}
                data-testid="import-dropzone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.neuro.json,.svg,.neuro.svg,.png,.neuro.png"
                  onChange={handleFileInputChange}
                  className="hidden"
                  data-testid="import-file-input"
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Drop a <span className="text-indigo-400">.neuro.png</span>,{' '}
                    <span className="text-sky-400">.neuro.svg</span>, or{' '}
                    <span className="text-emerald-400">.neuro.json</span> file here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Or click to browse local files — embedded Pako zlib chunks are extracted automatically
                  </p>
                </div>
              </div>

              {importStatus && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                    importStatus.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                  data-testid="import-status-banner"
                >
                  {importStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
