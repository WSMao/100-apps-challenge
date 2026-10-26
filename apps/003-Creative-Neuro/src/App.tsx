/**
 * Creative-Neuro — Phase 1 All-in-One Web MVP
 * Root Application Shell assembling all 5 Architectural Layers:
 * - Layer 1: Zustand + Immer + Zundo Store & Dexie.js v4 IndexedDB Persistence
 * - Layer 2: Mermaid AST Reconciliation, ELKjs Hybrid Layout, AABB Smart Placement & SVG Line Jumps
 * - Layer 3: @xyflow/react v12 Infinite Canvas, Shape/Text/Frame/Diagram Nodes, FreehandOverlay & JumpConnectorEdge
 * - Layer 4: CodeMirror 6 Mermaid Editor & Split-Screen FocusDiagramModal
 * - Layer 5: Workspace Header, Multi-Page Tabs, Floating Toolbar, Global Shortcuts & Multi-Format Pako Exporter
 */

import React, { useEffect, useState } from 'react';
import type { ShapeType } from './types/index.ts';
import { initializeDatabase } from './db/index.ts';
import { useProjectStore } from './store/projectStore.ts';
import { Canvas } from './components/canvas/Canvas.tsx';
import { Header } from './components/workspace/Header.tsx';
import { Toolbar } from './components/workspace/Toolbar.tsx';
import { ShortcutsHandler } from './components/workspace/ShortcutsHandler.tsx';
import { ExportModal } from './components/workspace/ExportModal.tsx';

export default function App() {
  const [activeShapeType, setActiveShapeType] = useState<ShapeType>('rectangle');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const toolMode = useProjectStore((s) => s.toolMode);
  const activePageId = useProjectStore((s) => s.activePageId);
  const pages = useProjectStore((s) => s.pages);
  const activePage = pages[activePageId];

  useEffect(() => {
    let mounted = true;
    void initializeDatabase(useProjectStore).finally(() => {
      if (mounted) {
        setDbInitialized(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 font-sans select-none overflow-hidden"
      data-testid="creative-neuro-app"
      data-db-ready={dbInitialized ? 'true' : 'false'}
    >
      {/* Global Keyboard Shortcuts Controller */}
      <ShortcutsHandler />

      {/* Top Workspace Bar with Multi-Page Tabs, Undo/Redo, Auto-ELK, Import & Export */}
      <Header
        showPageTabs={true}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Main Interactive Canvas & Floating Toolbars */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Floating Tool Mode Sidebar */}
        <Toolbar
          activeShapeType={activeShapeType}
          onShapeTypeChange={setActiveShapeType}
        />

        {/* Infinite Hybrid Canvas (React Flow v12 + FreehandOverlay + FocusDiagramModal) */}
        <main className="flex-1 h-full relative overflow-hidden bg-slate-950">
          <Canvas />

          {/* Bottom-Right Quick Shortcut HUD */}
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 border border-slate-800/90 backdrop-blur-md text-[11px] text-slate-400 shadow-lg">
            <span>
              Mode: <strong className="text-indigo-300 uppercase">{toolMode}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">Tab</kbd> Child
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">Enter</kbd> Sibling
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">⌥+↑↓←→</kbd> 4-Way
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">⌘Z</kbd> Undo
            </span>
            {selectedNodeIds.length > 0 && (
              <>
                <span className="text-slate-700">|</span>
                <span className="text-emerald-400 font-medium">
                  {selectedNodeIds.length} selected
                </span>
              </>
            )}
            {activePage && (
              <>
                <span className="text-slate-700">|</span>
                <span className="text-slate-400">
                  {activePage.nodeIds.length} nodes • {activePage.edgeIds.length} edges
                </span>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Multi-Format Export & Drag-and-Drop Lossless Import Modal */}
      {isExportOpen && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
        />
      )}
    </div>
  );
}
