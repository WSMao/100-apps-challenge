/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Multi-Page Tab Bar Component
 *
 * Features:
 * - Switch between pages on active board
 * - Add new page (`+`)
 * - Double-click tab label to rename page inline
 * - Delete page with guard preventing deletion of the last remaining page
 */

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, FileText } from 'lucide-react';
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
  const deletePage = useProjectStore((s) => s.deletePage);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const orderedPageIds =
    Array.isArray(project.pageIds) && project.pageIds.length > 0
      ? project.pageIds.filter((id) => Boolean(pages[id]))
      : Object.keys(pages);

  const isSinglePageRemaining = orderedPageIds.length <= 1;

  useEffect(() => {
    if (editingPageId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingPageId]);

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

  const handleDeletePage = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    if (isSinglePageRemaining) {
      return;
    }
    deletePage(pageId);
  };

  return (
    <div
      className={`flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full ${className}`}
      role="tablist"
      aria-label="Project pages"
      data-testid="page-tabs-bar"
    >
      {orderedPageIds.map((pageId) => {
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
              onClick={(e) => handleDeletePage(e, pageId)}
              disabled={isSinglePageRemaining}
              title={
                isSinglePageRemaining
                  ? 'A project must contain at least one page'
                  : `Delete ${displayTitle}`
              }
              aria-label={`Delete ${displayTitle}`}
              className={`p-0.5 rounded transition ${
                isSinglePageRemaining
                  ? 'opacity-30 cursor-not-allowed'
                  : isActive
                    ? 'hover:bg-indigo-500 text-indigo-200 hover:text-white'
                    : 'opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-400 hover:text-rose-400'
              }`}
              data-testid={`delete-page-btn-${pageId}`}
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
  );
};

export default PageTabs;
