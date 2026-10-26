/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Workspace Top Application Bar (Header)
 *
 * Features:
 * - Project & Active Board title display with inline project rename
 * - Undo / Redo controls (`Cmd+Z` / `Cmd+Shift+Z`) powered by Zundo temporal store
 * - Auto-ELK Layered Layout trigger (with direction selector TB / LR)
 * - Reset to Seed Demo button (restores rich 3-page seed dataset)
 * - Direct File Import button (`.neuro.json`, `.neuro.svg`, `.neuro.png`)
 * - Export Modal trigger button
 */

import React, { useState, useRef } from 'react';
import {
  Brain,
  Undo2,
  Redo2,
  Workflow,
  RotateCcw,
  Upload,
  Download,
  Check,
} from 'lucide-react';
import {
  useProjectStore,
  useTemporal,
} from '../../store/projectStore.ts';
import { calculateElkLayout } from '../../engine/index.ts';
import { resetDatabaseToSeed } from '../../db/index.ts';
import {
  importFromPngOrSvgMetadata,
  applyImportedProjectToStore,
  registerExportStore,
} from '../../utils/exportUtils.ts';
import { ExportModal } from './ExportModal.tsx';
import { PageTabs } from './PageTabs.tsx';

registerExportStore(useProjectStore);

export interface HeaderProps {
  onOpenExport?: () => void;
  onExportClick?: () => void;
  onOpenImport?: () => void;
  showPageTabs?: boolean;
  children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenExport,
  onExportClick,
  onOpenImport,
  showPageTabs = false,
  children,
}) => {
  const project = useProjectStore((s) => s.project);
  const boards = useProjectStore((s) => s.boards);
  const pages = useProjectStore((s) => s.pages);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const activePageId = useProjectStore((s) => s.activePageId);
  const undoAction = useProjectStore((s) => s.undo);
  const redoAction = useProjectStore((s) => s.redo);
  const resetToSeed = useProjectStore((s) => s.resetToSeed);

  const { canUndo, canRedo } = useTemporal();

  const [layoutDirection, setLayoutDirection] = useState<'DOWN' | 'RIGHT'>('DOWN');
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [isInternalExportOpen, setIsInternalExportOpen] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeBoard = boards[project.activeBoardId];
  const activePage = pages[activePageId];

  const handleAutoElkLayout = async () => {
    if (!activePage || isLayoutRunning) return;
    setIsLayoutRunning(true);

    try {
      const pageNodes = activePage.nodeIds
        .map((id) => nodes[id])
        .filter((n): n is NonNullable<typeof n> => Boolean(n));

      const pageEdges = activePage.edgeIds
        .map((id) => edges[id])
        .filter((e): e is NonNullable<typeof e> => Boolean(e));

      if (pageNodes.length === 0) return;

      // If no nodes are in 'auto-elk' mode, promote non-fixed nodes to 'auto-elk' for this layout pass
      const hasAutoElkNode = pageNodes.some((n) => n.layoutMode === 'auto-elk');
      const inputNodes = hasAutoElkNode
        ? pageNodes
        : pageNodes.map((n) =>
            n.layoutMode === 'fixed'
              ? n
              : {
                  ...n,
                  layoutMode: 'auto-elk' as const,
                  data: { ...n.data, layoutMode: 'auto-elk' as const },
                }
          );

      const result = await calculateElkLayout(inputNodes, pageEdges, {
        direction: layoutDirection,
      });

      useProjectStore.setState((state) => {
        for (const laidOutNode of result.nodes) {
          const target = state.nodes[laidOutNode.id];
          if (target) {
            target.position = { ...laidOutNode.position };
            if (laidOutNode.width) target.width = laidOutNode.width;
            if (laidOutNode.height) target.height = laidOutNode.height;
          }
        }
        const pg = state.pages[state.activePageId];
        if (pg) {
          pg.updatedAt = Date.now();
        }
        state.project.updatedAt = Date.now();
      });
    } finally {
      setIsLayoutRunning(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      await resetDatabaseToSeed();
    } catch {
      resetToSeed();
    }
  };

  const handleTriggerImport = () => {
    if (onOpenImport) {
      onOpenImport();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const restored = await importFromPngOrSvgMetadata(file);
      applyImportedProjectToStore(restored);
      setImportFeedback(`Loaded ${restored.project.name}`);
      setTimeout(() => setImportFeedback(null), 2500);
    } catch (err) {
      console.error('[Header] Failed to import project file:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleTriggerExport = () => {
    if (onOpenExport) {
      onOpenExport();
    } else if (onExportClick) {
      onExportClick();
    } else {
      setIsInternalExportOpen(true);
    }
  };

  return (
    <>
      <header
        className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between gap-3 z-20 shrink-0 select-none"
        data-testid="workspace-header"
      >
        {/* Left: Brand Identity & Project / Board Metadata */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1
                className="font-bold text-sm sm:text-base tracking-tight text-white truncate"
                data-testid="project-title"
              >
                {project.name}
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {activeBoard?.name || 'Main Board'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {activePage?.title || 'Visual Thinking Canvas'} • Hybrid ELK + Mermaid Sync
            </p>
          </div>
        </div>

        {/* Center: Optional Embedded PageTabs or Custom Children */}
        {children ? (
          <div className="flex items-center min-w-0">{children}</div>
        ) : showPageTabs ? (
          <PageTabs />
        ) : null}

        {/* Right: Undo/Redo, Auto-ELK Layout, Reset Seed, Import & Export */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Zundo Undo / Redo */}
          <div className="flex items-center gap-0.5 border border-slate-800 rounded-lg p-0.5 bg-slate-950">
            <button
              type="button"
              onClick={undoAction}
              disabled={!canUndo}
              title="Undo (Cmd/Ctrl+Z)"
              aria-label="Undo"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition"
              data-testid="undo-btn"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={redoAction}
              disabled={!canRedo}
              title="Redo (Cmd/Ctrl+Shift+Z)"
              aria-label="Redo"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition"
              data-testid="redo-btn"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Auto-ELK Layout Group */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5">
            <select
              value={layoutDirection}
              onChange={(e) => setLayoutDirection(e.target.value as 'DOWN' | 'RIGHT')}
              title="Auto-ELK Layout Direction"
              aria-label="Auto-ELK Layout Direction"
              className="bg-transparent text-[11px] font-medium text-slate-300 px-1.5 py-1 focus:outline-none cursor-pointer"
              data-testid="elk-direction-select"
            >
              <option value="DOWN" className="bg-slate-900">
                TB
              </option>
              <option value="RIGHT" className="bg-slate-900">
                LR
              </option>
            </select>
            <button
              type="button"
              onClick={handleAutoElkLayout}
              disabled={isLayoutRunning}
              title="Run Hybrid Auto-ELK Layout (preserves Fixed nodes)"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition"
              data-testid="auto-elk-layout-btn"
            >
              <Workflow className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isLayoutRunning ? 'Layout...' : 'Auto-ELK'}
              </span>
            </button>
          </div>

          {/* Reset to Seed Demo */}
          <button
            type="button"
            onClick={handleResetDemo}
            title="Reset workspace to default Seed Demo Project"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition"
            data-testid="reset-seed-btn"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Reset Demo</span>
          </button>

          {/* Direct File Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.neuro.json,.svg,.neuro.svg,.png,.neuro.png"
            onChange={handleFileImport}
            className="hidden"
            data-testid="header-import-input"
          />
          <button
            type="button"
            onClick={handleTriggerImport}
            title="Import .neuro.json, .neuro.svg, or .neuro.png"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition"
            data-testid="import-project-btn"
          >
            {importFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline text-emerald-300">Imported</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Import</span>
              </>
            )}
          </button>

          {/* Export Modal Trigger */}
          <button
            type="button"
            onClick={handleTriggerExport}
            title="Export to Mermaid, JSON, SVG, or Pako PNG"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 transition"
            data-testid="export-modal-trigger-btn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {isInternalExportOpen && (
        <ExportModal
          isOpen={isInternalExportOpen}
          onClose={() => setIsInternalExportOpen(false)}
        />
      )}
    </>
  );
};

export default Header;
