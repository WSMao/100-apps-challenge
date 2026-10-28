import React from 'react';
import {
  X,
  Sliders,
  Sun,
  Moon,
  Info,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore.ts';
import type { ThemeMode } from '../../types/index.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = React.useState<'general' | 'about'>('general');

  const themeMode = useProjectStore((s) => s.themeMode);
  const setThemeMode = useProjectStore((s) => s.setThemeMode);
  const pageLayoutMode = useProjectStore((s) => s.pageLayoutMode);
  const setPageLayoutMode = useProjectStore((s) => s.setPageLayoutMode);

  if (!isOpen) return null;

  const isDark = themeMode === 'dark';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[85vh] transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-base tracking-tight">Settings & Workspace</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex items-center border-b px-6 gap-6 text-sm font-medium ${
            isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 border-b-2 cursor-pointer transition ${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-500 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            General & Theme
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`py-3 border-b-2 cursor-pointer transition ${
              activeTab === 'about'
                ? 'border-indigo-500 text-indigo-500 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            About
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Theme Settings */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Appearance / Theme
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left cursor-pointer transition ${
                      themeMode === 'light'
                        ? 'border-indigo-500 bg-indigo-500/10 font-semibold text-indigo-600'
                        : isDark
                        ? 'border-slate-800 hover:border-slate-700 bg-slate-800/40 text-slate-300'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Sun className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="text-sm">Light Style (Default)</div>
                      <div className="text-xs text-slate-400 font-normal">Clean light-gray canvas background</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left cursor-pointer transition ${
                      themeMode === 'dark'
                        ? 'border-indigo-500 bg-indigo-500/10 font-semibold text-indigo-400'
                        : isDark
                        ? 'border-slate-800 hover:border-slate-700 bg-slate-800/40 text-slate-300'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Moon className="w-5 h-5 text-indigo-400" />
                    <div>
                      <div className="text-sm">Dark Style</div>
                      <div className="text-xs text-slate-400 font-normal">Classic dark slate canvas</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Layout Mode */}
              <div className="pt-4 border-t border-slate-800/60">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Default Layout Behavior
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPageLayoutMode('auto-elk')}
                    className={`px-4 py-2 rounded-xl border text-xs font-medium cursor-pointer transition ${
                      pageLayoutMode === 'auto-elk'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                        : isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Auto-ELK Hierarchical
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageLayoutMode('manual')}
                    className={`px-4 py-2 rounded-xl border text-xs font-medium cursor-pointer transition ${
                      pageLayoutMode === 'manual'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                        : isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Manual Whiteboard Mode
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  In Manual mode, node dragging and keyboard shortcuts never trigger automatic graph re-layout.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
              <div className="flex items-center gap-2 text-sm text-slate-200 font-semibold">
                <Info className="w-4 h-4 text-cyan-400" />
                Creative-Neuro (003)
              </div>
              <p>
                An all-in-one visual thinking tool unifying Mind Maps, Mermaid Flowcharts, and Infinite Whiteboard
                Canvases into a single cohesive Scene Graph.
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                React 19 • React Flow v12 • CodeMirror 6 • ELKjs • Dexie.js v4 • Pako
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

