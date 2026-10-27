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

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CanvasErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Canvas Error Boundary Caught Error:', error, errorInfo);
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        }),
      });
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full p-8 bg-slate-900 text-rose-400 font-mono text-sm overflow-auto z-50 flex flex-col items-center justify-center text-center">
          <div className="max-w-2xl bg-slate-950 p-6 rounded-2xl border border-rose-500/30 shadow-2xl">
            <h2 className="text-xl font-bold text-rose-500 mb-2">
              ⚠️ Canvas Error Intercepted (Black Screen Prevented)
            </h2>
            <div className="text-slate-300 text-xs mb-4">
              <strong>Error Message:</strong> {this.state.error?.message}
            </div>
            <pre className="text-[11px] text-slate-400 bg-slate-900 p-3 rounded-lg overflow-x-auto text-left max-h-60 whitespace-pre-wrap mb-4">
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium cursor-pointer transition"
            >
              Click to Recover Canvas
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeShapeType, setActiveShapeType] = useState<ShapeType>('rectangle');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const toolMode = useProjectStore((s) => s.toolMode);
  const activePageId = useProjectStore((s) => s.activePageId);
  const pages = useProjectStore((s) => s.pages);
  const themeMode = useProjectStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';
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
      className={`flex flex-col w-screen h-screen font-sans select-none overflow-hidden transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
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
        <main
          className={`flex-1 h-full relative overflow-hidden transition-colors duration-200 ${
            isDark ? 'bg-slate-950' : 'bg-slate-100'
          }`}
        >
          <CanvasErrorBoundary>
            <Canvas />
          </CanvasErrorBoundary>

          {/* UI-02: Bottom-Left Quick Shortcut HUD (moved from Bottom-Right) */}
          <div
            className={`pointer-events-none absolute bottom-3 left-16 md:left-20 z-10 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md text-[11px] shadow-lg transition-colors duration-200 ${
              isDark
                ? 'bg-slate-900/85 border-slate-800/90 text-slate-400'
                : 'bg-white/90 border-slate-200 text-slate-600 shadow-slate-200/50'
            }`}
          >
            <span>
              Mode: <strong className="text-indigo-500 uppercase">{toolMode}</strong>
            </span>
            <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>|</span>
            <span>
              <kbd
                className={`px-1 py-0.5 rounded font-mono text-[10px] ${
                  isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                Tab
              </kbd>{' '}
              Child
            </span>
            <span>
              <kbd
                className={`px-1 py-0.5 rounded font-mono text-[10px] ${
                  isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                Enter
              </kbd>{' '}
              Sibling
            </span>
            <span>
              <kbd
                className={`px-1 py-0.5 rounded font-mono text-[10px] ${
                  isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                ⌥+↑↓←→
              </kbd>{' '}
              4-Way
            </span>
            <span>
              <kbd
                className={`px-1 py-0.5 rounded font-mono text-[10px] ${
                  isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                ⌘Z
              </kbd>{' '}
              Undo
            </span>
            {selectedNodeIds.length > 0 && (
              <>
                <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>|</span>
                <span className="text-emerald-500 font-medium">
                  {selectedNodeIds.length} selected
                </span>
              </>
            )}
            {activePage && (
              <>
                <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>|</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
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
