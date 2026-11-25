/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Multi-Page Tab Bar & Pages Manager Component
 *
 * Features:
 * - Switch between visible pages on active board
 * - Add new page (`+`)
 * - Double-click tab label to rename page inline
 * - Close page tab (`X`) hides it from the tab bar without deleting data or polluting Undo/Redo
 * - Pages manager popover lists all project pages (visible & hidden), allows reopening hidden pages,
 *   and allows deleting pages with an explicit confirmation prompt (preserving the last-page guard)
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  FileText,
  List,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore.ts';

export interface PageTabsProps {
  className?: string;
}

export const PageTabs: React.FC<PageTabsProps> = ({ className = '' }) => {
  const project = useProjectStore((s) => s.project);
  const pages = useProjectStore((s) => s.pages);
  const activePageId = useProjectStore((s) => s.activePageId);
  const setActivePage = useProjectStore((s) => s.setActivePage);
  const addPage = useProjectStore((s) => s.addPage);
  const updatePageTitle = useProjectStore((s) => s.updatePageTitle);
  const hidePage = useProjectStore((s) => s.hidePage);
  const reopenPage = useProjectStore((s) => s.reopenPage);
  const deletePage = useProjectStore((s) => s.deletePage);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [pendingDeletePageId, setPendingDeletePageId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const managerRef = useRef<HTMLDivElement | null>(null);

  const orderedPageIds =
    Array.isArray(project.pageIds) && project.pageIds.length > 0
      ? project.pageIds.filter((id) => Boolean(pages[id]))
      : Object.keys(pages);

  const visiblePageIds = orderedPageIds.filter((id) => !pages[id]?.hidden);
  const hiddenCount = orderedPageIds.length - visiblePageIds.length;
  const isSingleVisiblePage = visiblePageIds.length <= 1;
  const isSingleTotalPage = orderedPageIds.length <= 1;

  useEffect(() => {
    if (editingPageId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingPageId]);

  useEffect(() => {
    if (!isManagerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (managerRef.current && !managerRef.current.contains(e.target as HTMLElement)) {
        setIsManagerOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isManagerOpen]);

  const startEditing = (pageId: string, currentTitle: string) => {
    setEditingPageId(pageId);
    setDraftTitle(currentTitle);
  };

  const commitRename = () => {
    if (editingPageId) {
      const trimmed = draftTitle.trim();
      if (trimmed.length > 0) {
        updatePageTitle(editingPageId, trimmed);
      }
      setEditingPageId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingPageId(null);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    if (isSingleVisiblePage) return;
    hidePage(pageId);
  };

  const handleRequestDelete = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    if (isSingleTotalPage) return;
    setPendingDeletePageId(pageId);
    setIsManagerOpen(false);
  };

  const handleConfirmDelete = () => {
    if (pendingDeletePageId && !isSingleTotalPage) {
      deletePage(pendingDeletePageId);
    }
    setPendingDeletePageId(null);
  };

  const pendingDeletePage = pendingDeletePageId ? pages[pendingDeletePageId] : null;

  return (
    <div className={`relative flex items-center gap-1 max-w-full ${className}`}>
      <div
        className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full"
        role="tablist"
        aria-label="Project pages"
        data-testid="page-tabs-bar"
      >
        {visiblePageIds.map((pageId) => {
          const page = pages[pageId];
          if (!page) return null;

          const isActive = pageId === activePageId;
          const isEditing = pageId === editingPageId;
          const displayTitle = page.title || page.name || 'Untitled Page';
          const nodeCount = page.nodeIds?.length ?? 0;

          return (
            <div
              key={pageId}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActivePage(pageId)}
              onDoubleClick={() => startEditing(pageId, displayTitle)}
              title="Click to switch page, double-click to rename"
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all select-none shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
              data-testid={`page-tab-${pageId}`}
            >
              <FileText
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive ? 'text-indigo-200' : 'text-slate-500 group-hover:text-slate-400'
                }`}
              />

              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="w-28 bg-slate-900 text-white px-1.5 py-0.5 rounded border border-indigo-400 text-xs focus:outline-none"
                  data-testid={`page-tab-rename-input-${pageId}`}
                />
              ) : (
                <span className="truncate max-w-[140px]">{displayTitle}</span>
              )}

              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-indigo-700/80 text-indigo-100'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {nodeCount}
              </span>

              <button
                type="button"
                onClick={(e) => handleCloseTab(e, pageId)}
                disabled={isSingleVisiblePage}
                title={
                  isSingleVisiblePage
                    ? 'At least one page tab must remain visible'
                    : `Close ${displayTitle} tab`
                }
                aria-label={`Close ${displayTitle}`}
                className={`p-0.5 rounded transition ${
                  isSingleVisiblePage
                    ? 'opacity-30 cursor-not-allowed'
                    : isActive
                      ? 'hover:bg-indigo-500 text-indigo-200 hover:text-white'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                data-testid={`close-page-tab-btn-${pageId}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => addPage()}
          title="Add new page"
          aria-label="Add new page"
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
          data-testid="add-page-btn"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Pages Manager Button & Popover */}
      <div className="relative shrink-0" ref={managerRef}>
        <button
          type="button"
          onClick={() => setIsManagerOpen((prev) => !prev)}
          title="Manage all pages (reopen hidden or delete)"
          aria-label="Manage pages"
          aria-expanded={isManagerOpen}
          className={`flex items-center gap-1 px-2 h-8 rounded-xl border text-xs font-medium transition cursor-pointer ${
            isManagerOpen
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
              : 'bg-slate-950/90 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
          data-testid="pages-manager-btn"
        >
          <List className="w-3.5 h-3.5" />
          {hiddenCount > 0 && (
            <span
              className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30"
              data-testid="hidden-pages-count"
            >
              +{hiddenCount}
            </span>
          )}
        </button>

        {isManagerOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md z-[120] overflow-hidden"
            data-testid="pages-manager-popover"
          >
            <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                All Pages ({orderedPageIds.length})
              </span>
              {hiddenCount > 0 && (
                <span className="text-[11px] text-amber-400">
                  {hiddenCount} hidden
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
              {orderedPageIds.map((pageId) => {
                const page = pages[pageId];
                if (!page) return null;
                const displayTitle = page.title || page.name || 'Untitled Page';
                const isHidden = Boolean(page.hidden);
                const isActive = pageId === activePageId;
                const nodeCount = page.nodeIds?.length ?? 0;

                return (
                  <div
                    key={pageId}
                    onClick={() => {
                      if (isHidden) {
                        reopenPage(pageId);
                      } else {
                        setActivePage(pageId);
                      }
                      setIsManagerOpen(false);
                    }}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition ${
                      isActive
                        ? 'bg-indigo-600/15 text-white'
                        : 'hover:bg-slate-800/70 text-slate-300'
                    }`}
                    data-testid={`pages-manager-item-${pageId}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">
                          {displayTitle}
                        </span>
                        {isHidden && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                            Hidden
                          </span>
                        )}
                        {isActive && !isHidden && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {nodeCount} {nodeCount === 1 ? 'object' : 'objects'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isHidden ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            reopenPage(pageId);
                            setIsManagerOpen(false);
                          }}
                          title={`Reopen ${displayTitle}`}
                          aria-label={`Reopen ${displayTitle}`}
                          className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition cursor-pointer"
                          data-testid={`reopen-page-btn-${pageId}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isSingleVisiblePage) {
                              hidePage(pageId);
                            }
                          }}
                          disabled={isSingleVisiblePage}
                          title={
                            isSingleVisiblePage
                              ? 'At least one page tab must remain visible'
                              : `Hide ${displayTitle} from tab bar`
                          }
                          aria-label={`Hide ${displayTitle}`}
                          className={`p-1.5 rounded-lg transition ${
                            isSingleVisiblePage
                              ? 'opacity-30 cursor-not-allowed text-slate-500'
                              : 'hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer'
                          }`}
                          data-testid={`hide-page-btn-${pageId}`}
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleRequestDelete(e, pageId)}
                        disabled={isSingleTotalPage}
                        title={
                          isSingleTotalPage
                            ? 'Cannot delete the last remaining page'
                            : `Delete ${displayTitle}`
                        }
                        aria-label={`Delete ${displayTitle}`}
                        className={`p-1.5 rounded-lg transition ${
                          isSingleTotalPage
                            ? 'opacity-30 cursor-not-allowed text-slate-500'
                            : 'hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer'
                        }`}
                        data-testid={`delete-page-btn-${pageId}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Explicit Delete Page Confirmation Dialog */}
      {pendingDeletePage &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none"
            onClick={() => setPendingDeletePageId(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4 text-slate-100"
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-page-dialog-title"
              data-testid="confirm-delete-page-dialog"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="delete-page-dialog-title" className="text-sm font-bold text-white">
                    Delete Page &ldquo;{pendingDeletePage.title || pendingDeletePage.name || 'Untitled Page'}&rdquo;?
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    This permanently removes the page and all {pendingDeletePage.nodeIds?.length ?? 0} objects on it. To just remove it from the tab bar, close the tab instead.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingDeletePageId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  data-testid="cancel-delete-page-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
                  data-testid="confirm-delete-page-btn"
                >
                  Delete Page
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default PageTabs;
