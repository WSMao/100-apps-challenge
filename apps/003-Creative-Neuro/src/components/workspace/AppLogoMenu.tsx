import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderPlus,
  FolderKanban,
  FilePlus,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Check,
  ChevronDown,
  Upload,
} from 'lucide-react';
import logoImg from '../../../assets/logo_option_4e.png';
import { useProjectStore } from '../../store/projectStore.ts';
import {
  importFromPngOrSvgMetadata,
  applyImportedProjectToStore,
} from '../../utils/exportUtils.ts';

/**
 * Resolves a new project name:
 * - If user typed a custom name and it's a duplicate -> returns error
 * - If user left empty or "untitled": auto-increments if "untitled" already exists
 */
export function resolveProjectName(
  input: string,
  existingNames: string[]
): { finalName: string | null; error: string | null } {
  const trimmed = input.trim();
  const lowerExisting = new Set(existingNames.map((n) => n.trim().toLowerCase()));

  // 1. If user typed a custom non-default name
  if (trimmed && trimmed.toLowerCase() !== 'untitled') {
    if (lowerExisting.has(trimmed.toLowerCase())) {
      return {
        finalName: null,
        error: '專案名稱已存在，請更換名稱',
      };
    }
    return { finalName: trimmed, error: null };
  }

  // 2. Default or empty input -> "untitled", auto-increment if duplicate
  if (!lowerExisting.has('untitled')) {
    return { finalName: 'untitled', error: null };
  }

  let counter = 1;
  while (lowerExisting.has(`untitled${counter}`)) {
    counter++;
  }
  return { finalName: `untitled${counter}`, error: null };
}

export interface AppLogoMenuProps {
  onOpenImport?: () => void;
}

export const AppLogoMenu: React.FC<AppLogoMenuProps> = ({ onOpenImport }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  const [projectNameInput, setProjectNameInput] = useState('untitled');
  const [inputError, setInputError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const themeMode = useProjectStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';

  const availableProjects = useProjectStore((s) => s.availableProjects);
  const currentProjectId = useProjectStore((s) => s.project.id);
  const createProject = useProjectStore((s) => s.createProject);
  const switchProject = useProjectStore((s) => s.switchProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const addPage = useProjectStore((s) => s.addPage);

  const existingProjectNames = useMemo(
    () => availableProjects.map((p) => p.name),
    [availableProjects]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Validate on input change
  const handleInputChange = (val: string) => {
    setProjectNameInput(val);
    const trimmed = val.trim();
    if (trimmed && trimmed.toLowerCase() !== 'untitled') {
      const isDup = existingProjectNames.some(
        (n) => n.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (isDup) {
        setInputError('專案名稱已存在，請更換名稱');
      } else {
        setInputError(null);
      }
    } else {
      setInputError(null);
    }
  };

  const handleOpenNewProject = () => {
    setIsMenuOpen(false);
    setProjectNameInput('untitled');
    setInputError(null);
    setIsNewProjectModalOpen(true);
  };

  const handleOpenWorkspace = () => {
    setIsMenuOpen(false);
    setIsWorkspaceModalOpen(true);
  };

  const handleCreateNewPage = () => {
    setIsMenuOpen(false);
    addPage();
  };

  const handleTriggerImport = () => {
    setIsMenuOpen(false);
    if (onOpenImport) {
      onOpenImport();
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileName = file.name.toLowerCase();
      let importedProject: any = null;

      if (fileName.endsWith('.neuro.json') || fileName.endsWith('.json')) {
        const text = await file.text();
        importedProject = JSON.parse(text);
      } else if (
        fileName.endsWith('.neuro.svg') ||
        fileName.endsWith('.svg') ||
        fileName.endsWith('.neuro.png') ||
        fileName.endsWith('.png')
      ) {
        importedProject = await importFromPngOrSvgMetadata(file);
      } else {
        alert('Unsupported file format. Please upload .neuro.json, .neuro.svg, or .neuro.png');
        return;
      }

      if (importedProject) {
        applyImportedProjectToStore(importedProject);
      }
    } catch (err) {
      console.error('[AppLogoMenu] Failed to import project file:', err);
      alert('Failed to parse project file. Ensure it is a valid Creative-Neuro export.');
    }
  };

  const handleConfirmCreateProject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const { finalName, error } = resolveProjectName(
      projectNameInput,
      existingProjectNames
    );
    if (error || !finalName) {
      setInputError(error || '專案名稱無效');
      return;
    }

    createProject(finalName);
    setIsNewProjectModalOpen(false);
    setProjectNameInput('untitled');
    setInputError(null);
  };

  return (
    <div className="relative inline-block ml-1" ref={menuRef}>
      {/* Top-Left Logo Button */}
      <button
        type="button"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        title="Application Menu (Click to open)"
        aria-label="Application Menu"
        aria-expanded={isMenuOpen}
        className={`w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center p-0.5 shadow-lg transition cursor-pointer select-none ${
          isMenuOpen
            ? 'ring-2 ring-indigo-500 border-indigo-400'
            : isDark
            ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
        data-testid="top-left-logo-btn"
      >
        <img
          src={logoImg}
          alt="Creative-Neuro Logo"
          className="w-full h-full object-cover rounded-full pointer-events-none drop-shadow-md scale-105"
        />
      </button>

      {/* Hidden File Import Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.neuro.json,.svg,.neuro.svg,.png,.neuro.png"
        onChange={handleFileImport}
        className="hidden"
        data-testid="header-import-input"
      />

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div
          className={`absolute left-0 top-12 w-52 py-1.5 rounded-2xl shadow-2xl backdrop-blur-md border z-[100] transition-all select-none ${
            isDark
              ? 'bg-slate-900/95 border-slate-800 text-slate-100'
              : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/40'
          }`}
          data-testid="logo-dropdown-menu"
        >
          {/* 1. New Project */}
          <button
            type="button"
            onClick={handleOpenNewProject}
            className={`w-full px-3.5 py-2 flex items-center gap-2.5 text-xs font-medium cursor-pointer transition text-left ${
              isDark
                ? 'hover:bg-slate-800 text-slate-200 hover:text-white'
                : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
            data-testid="menu-new-project-btn"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>New Project</span>
          </button>

          {/* 2. Workspace */}
          <button
            type="button"
            onClick={handleOpenWorkspace}
            className={`w-full px-3.5 py-2 flex items-center gap-2.5 text-xs font-medium cursor-pointer transition text-left ${
              isDark
                ? 'hover:bg-slate-800 text-slate-200 hover:text-white'
                : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
            data-testid="menu-workspace-btn"
          >
            <FolderKanban className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Workspace</span>
          </button>

          <div
            className={`my-1 h-px ${
              isDark ? 'bg-slate-800/80' : 'bg-slate-100'
            }`}
          />

          {/* 3. New Page */}
          <button
            type="button"
            onClick={handleCreateNewPage}
            className={`w-full px-3.5 py-2 flex items-center gap-2.5 text-xs font-medium cursor-pointer transition text-left ${
              isDark
                ? 'hover:bg-slate-800 text-slate-200 hover:text-white'
                : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
            data-testid="menu-new-page-btn"
          >
            <FilePlus className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>New Page</span>
          </button>

          {/* 4. Import Project */}
          <button
            type="button"
            onClick={handleTriggerImport}
            className={`w-full px-3.5 py-2 flex items-center gap-2.5 text-xs font-medium cursor-pointer transition text-left ${
              isDark
                ? 'hover:bg-slate-800 text-slate-200 hover:text-white'
                : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
            data-testid="menu-import-project-btn"
          >
            <Upload className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Import Project</span>
          </button>
        </div>
      )}

      {/* Modal 1: New Project Modal */}
      {isNewProjectModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[999999] flex flex-col items-center justify-start pt-24 pb-8 px-4 bg-black/60 backdrop-blur-sm select-none overflow-y-auto"
            onClick={() => setIsNewProjectModalOpen(false)}
          >
            <div
              className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden p-6 sm:p-7 space-y-4 transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
              onClick={(e) => e.stopPropagation()}
              data-testid="new-project-modal"
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-800/60">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-semibold text-base">Create New Project</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectNameInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="untitled"
                    autoFocus
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 ${
                      inputError
                        ? 'border-rose-500 focus:ring-rose-500/30'
                        : 'border-slate-700 focus:ring-indigo-500'
                    } ${
                      isDark
                        ? 'bg-slate-950 text-slate-100'
                        : 'bg-slate-50 text-slate-900'
                    }`}
                    data-testid="new-project-name-input"
                  />
                  {inputError && (
                    <div
                      className="flex items-center gap-1.5 text-xs text-rose-400 mt-2 font-medium"
                      data-testid="project-name-warning"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{inputError}</span>
                    </div>
                  )}
                  {!inputError && (
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      預設為 &quot;untitled&quot;。若已有同名專案且未自訂名稱，將自動遞增命名（如 &quot;untitled1&quot;）。
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(inputError)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 cursor-pointer transition"
                    data-testid="create-project-confirm-btn"
                  >
                    <Plus className="w-4 h-4" />
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal 2: Workspace Projects Modal */}
      {isWorkspaceModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[999999] flex flex-col items-center justify-start pt-20 pb-8 px-4 overflow-y-auto bg-black/60 backdrop-blur-sm select-none"
            onClick={() => setIsWorkspaceModalOpen(false)}
          >
            <div
              className={`w-full max-w-3xl rounded-3xl shadow-2xl border overflow-hidden p-6 sm:p-8 space-y-5 max-h-[calc(100vh-110px)] flex flex-col transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-black/80'
                  : 'bg-white border-slate-200 text-slate-800 shadow-slate-400/30'
              }`}
              onClick={(e) => e.stopPropagation()}
              data-testid="workspace-projects-modal"
            >
              <div className="flex items-center justify-between border-b pb-4 border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <FolderKanban className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg">
                      Workspace Projects
                    </h3>
                    <p className="text-xs text-slate-400">
                      管理與快速切換現有的所有專案畫布
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {availableProjects.length} 個專案
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsWorkspaceModalOpen(false)}
                    className={`p-2 rounded-xl transition cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto space-y-2.5 flex-1 pr-1.5 py-1">
                <div className="divide-y divide-slate-800/60 rounded-2xl border border-slate-800/80 overflow-hidden">
                  {availableProjects.map((p) => {
                    const isCurrent = p.id === currentProjectId;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between p-4 sm:p-4.5 transition ${
                          isCurrent
                            ? isDark
                              ? 'bg-indigo-500/15'
                              : 'bg-indigo-50/80'
                            : isDark
                            ? 'hover:bg-slate-800/50'
                            : 'hover:bg-slate-50'
                        }`}
                        data-testid={`workspace-project-item-${p.id}`}
                      >
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-sm sm:text-base truncate">{p.name}</span>
                            {isCurrent && (
                              <span className="text-xs bg-indigo-600 text-white font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                            <span>{p.pageCount} page(s)</span>
                            <span>•</span>
                            <span>Last modified {new Date(p.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => {
                                void switchProject(p.id);
                                setIsWorkspaceModalOpen(false);
                              }}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl cursor-pointer shadow-md transition"
                              data-testid={`switch-project-${p.id}`}
                            >
                              Switch
                            </button>
                          )}
                          {availableProjects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => void deleteProject(p.id)}
                              title="Delete Project"
                              className="p-2 text-rose-400 hover:bg-rose-500/15 rounded-xl cursor-pointer transition"
                              data-testid={`delete-project-${p.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800/60 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsWorkspaceModalOpen(false);
                    handleOpenNewProject();
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </button>
                <button
                  type="button"
                  onClick={() => setIsWorkspaceModalOpen(false)}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium cursor-pointer transition ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

