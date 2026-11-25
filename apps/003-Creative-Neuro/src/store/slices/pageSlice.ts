/**
 * Creative-Neuro Store Subsystem - Page & Board Slice
 * Path: src/store/slices/pageSlice.ts
 */

import type { TemporalState } from 'zundo';
import type { Page, Viewport } from '../../types/index.ts';
import type { ProjectStore, StoreSet, StoreGet } from './types.ts';

export const createPageSlice = (
  set: StoreSet,
  get: StoreGet,
  getTemporal?: () => TemporalState<unknown> | undefined
) => ({
  addPage: (name?: string): string => {
    const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const title = name || `Page ${get().project.pageIds.length + 1}`;

    set((state) => {
      const newPage: Page = {
        id,
        projectId: state.project.id,
        boardId:
          state.project.activeBoardId ||
          Object.keys(state.boards)[0] ||
          'board-1',
        title,
        name: title,
        order: state.project.pageIds.length,
        viewport: { x: 0, y: 0, zoom: 1 },
        lineJump: true,
        nodeIds: [],
        edgeIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      state.pages[id] = newPage;
      state.project.pageIds.push(id);
      state.activePageId = id;
      state.project.activePageId = id;

      const board = state.boards[newPage.boardId];
      if (board && !board.pageIds.includes(id)) {
        board.pageIds.push(id);
        board.activePageId = id;
      }

      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
      state.focusedDiagramId = null;
      state.project.updatedAt = Date.now();
    });

    return id;
  },

  setActivePage: (pageId: string) => {
    const temporal = getTemporal?.();
    temporal?.pause();
    try {
      set((state) => {
        if (state.pages[pageId]) {
          state.pages[pageId].hidden = false;
          state.activePageId = pageId;
          state.project.activePageId = pageId;
          state.selectedNodeIds = [];
          state.selectedEdgeIds = [];
          state.focusedDiagramId = null;
          state.editingNodeId = null;
          state.editingInitialValue = null;

          const boardId = state.pages[pageId].boardId;
          if (boardId && state.boards[boardId]) {
            state.boards[boardId].activePageId = pageId;
          }
        }
      });
    } finally {
      temporal?.resume();
    }
  },

  hidePage: (pageId: string) => {
    const temporal = getTemporal?.();
    temporal?.pause();
    try {
      set((state) => {
        const page = state.pages[pageId];
        if (!page || page.hidden) return;

        const visiblePageIds = state.project.pageIds.filter(
          (id) => state.pages[id] && !state.pages[id].hidden
        );
        if (visiblePageIds.length <= 1) {
          console.warn('[ProjectStore] Cannot hide the last visible page tab.');
          return;
        }

        page.hidden = true;
        page.updatedAt = Date.now();

        if (state.activePageId === pageId) {
          const idx = visiblePageIds.indexOf(pageId);
          const remainingVisible = visiblePageIds.filter((id) => id !== pageId);
          const nextActiveId =
            remainingVisible[Math.min(idx, remainingVisible.length - 1)] ||
            remainingVisible[0];

          if (nextActiveId) {
            state.activePageId = nextActiveId;
            state.project.activePageId = nextActiveId;
            state.selectedNodeIds = [];
            state.selectedEdgeIds = [];
            state.focusedDiagramId = null;
            state.editingNodeId = null;
            state.editingInitialValue = null;

            const boardId = state.pages[nextActiveId]?.boardId;
            if (boardId && state.boards[boardId]) {
              state.boards[boardId].activePageId = nextActiveId;
            }
          }
        }

        state.project.updatedAt = Date.now();
      });
    } finally {
      temporal?.resume();
    }
  },

  reopenPage: (pageId: string, activate: boolean = true) => {
    const temporal = getTemporal?.();
    temporal?.pause();
    try {
      set((state) => {
        const page = state.pages[pageId];
        if (!page) return;

        page.hidden = false;
        page.updatedAt = Date.now();

        if (activate) {
          state.activePageId = pageId;
          state.project.activePageId = pageId;
          state.selectedNodeIds = [];
          state.selectedEdgeIds = [];
          state.focusedDiagramId = null;
          state.editingNodeId = null;
          state.editingInitialValue = null;

          const boardId = page.boardId;
          if (boardId && state.boards[boardId]) {
            state.boards[boardId].activePageId = pageId;
          }
        }

        state.project.updatedAt = Date.now();
      });
    } finally {
      temporal?.resume();
    }
  },

  deletePage: (pageId: string) => {
    set((state) => {
      if (state.project.pageIds.length <= 1) {
        console.warn('[ProjectStore] Cannot delete the only remaining page.');
        return;
      }

      const pageToDelete = state.pages[pageId];
      if (!pageToDelete) return;

      // Cascade delete nodes & edges attached to this page
      const deletedNodeSet = new Set(pageToDelete.nodeIds);
      for (const nodeId of pageToDelete.nodeIds) {
        delete state.nodes[nodeId];
      }
      // Defensive unparenting if any child on any page referenced deleted parent
      for (const node of Object.values(state.nodes)) {
        if (node.parentId && deletedNodeSet.has(node.parentId)) {
          delete node.parentId;
          delete node.extent;
        }
      }
      for (const edgeId of pageToDelete.edgeIds) {
        delete state.edges[edgeId];
      }

      delete state.pages[pageId];
      state.project.pageIds = state.project.pageIds.filter((p) => p !== pageId);

      if (state.activePageId === pageId) {
        const nextActiveId =
          state.project.pageIds.find(
            (id) => state.pages[id] && !state.pages[id].hidden
          ) || state.project.pageIds[0];
        if (nextActiveId && state.pages[nextActiveId]) {
          state.pages[nextActiveId].hidden = false;
          state.activePageId = nextActiveId;
          state.project.activePageId = nextActiveId;
        }
      }

      for (const board of Object.values(state.boards)) {
        board.pageIds = board.pageIds.filter((p) => p !== pageId);
        if (board.activePageId === pageId) {
          board.activePageId = state.activePageId;
        }
      }

      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
      state.editingNodeId = null;
      state.editingInitialValue = null;
      state.project.updatedAt = Date.now();
    });
  },

  updatePageTitle: (pageId: string, title: string) => {
    set((state) => {
      const page = state.pages[pageId];
      if (page) {
        page.title = title;
        page.name = title;
        page.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      }
    });
  },

  setPageLineJump: (enabled: boolean, pageId?: string) => {
    set((state) => {
      const targetId = pageId || state.activePageId;
      const page = state.pages[targetId];
      if (page) {
        page.lineJump = enabled;
        page.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      }
    });
  },

  togglePageLineJump: (pageId?: string) => {
    set((state) => {
      const targetId = pageId || state.activePageId;
      const page = state.pages[targetId];
      if (page) {
        const current = page.lineJump ?? true;
        page.lineJump = !current;
        page.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      }
    });
  },

  setViewport: (pageId: string, viewport: Viewport) => {
    set((state) => {
      const page = state.pages[pageId];
      if (page) {
        page.viewport = viewport;
        page.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      }
    });
  },
});
