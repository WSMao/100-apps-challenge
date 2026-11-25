/**
 * Creative-Neuro Store Subsystem - Selection & Filter Slice
 * Path: src/store/slices/selectionSlice.ts
 */

import type { ProjectStore, StoreSet, StoreGet } from './types.ts';

export const createSelectionSlice = (set: StoreSet, get: StoreGet) => ({
  setToolMode: (toolMode: ProjectStore['toolMode']) => set({ toolMode }),

  setSelectedNodes: (selectedNodeIds: string[]) => {
    const state = get();
    const expanded = new Set<string>();
    for (const id of selectedNodeIds) {
      expanded.add(id);
      const node = state.nodes[id];
      const gid = node?.groupId || node?.data?.groupId;
      if (gid) {
        for (const other of Object.values(state.nodes)) {
          if (other.groupId === gid || other.data?.groupId === gid) {
            expanded.add(other.id);
          }
        }
      }
    }
    const currentSet = new Set(state.selectedNodeIds);
    if (
      currentSet.size === expanded.size &&
      Array.from(expanded).every((id) => currentSet.has(id))
    ) {
      return;
    }
    const nextEditingId =
      state.editingNodeId && expanded.has(state.editingNodeId)
        ? state.editingNodeId
        : null;
    set({
      selectedNodeIds: Array.from(expanded),
      editingNodeId: nextEditingId,
      editingInitialValue: nextEditingId ? state.editingInitialValue : null,
    });
  },

  setEditingNodeId: (nodeId: string | null, initialValue: string | null = null) => {
    set({
      editingNodeId: nodeId,
      editingInitialValue: nodeId ? initialValue : null,
    });
  },

  setSelectedEdges: (selectedEdgeIds: string[]) => {
    const state = get();
    const currentSet = new Set(state.selectedEdgeIds);
    const incomingSet = new Set(selectedEdgeIds);
    if (
      currentSet.size === incomingSet.size &&
      selectedEdgeIds.every((id) => currentSet.has(id))
    ) {
      return;
    }
    set({ selectedEdgeIds });
  },

  setFocusedDiagramId: (focusedDiagramId: string | null) =>
    set({ focusedDiagramId }),

  setHoveredNodeId: (hoveredNodeId: string | null) =>
    set({ hoveredNodeId }),

  setAlignmentGuides: (alignmentGuides: ProjectStore['alignmentGuides']) =>
    set({ alignmentGuides }),

  clearAlignmentGuides: () =>
    set((state) => {
      if (state.alignmentGuides.length === 0) return;
      state.alignmentGuides = [];
    }),

  setLastDirection: (lastDirection: ProjectStore['lastDirection']) =>
    set({ lastDirection }),

  setThemeMode: (themeMode: ProjectStore['themeMode']) =>
    set({ themeMode }),

  setSelectionFilter: (filter: Partial<ProjectStore['selectionFilter']>) => {
    set((state) => {
      state.selectionFilter = {
        ...state.selectionFilter,
        ...filter,
      };
    });
  },

  toggleSelectionFilterItem: (key: keyof ProjectStore['selectionFilter']) => {
    set((state) => {
      state.selectionFilter[key] = !state.selectionFilter[key];
    });
  },

  resetSelectionFilter: () => {
    set((state) => {
      state.selectionFilter = {
        shape: true,
        text: true,
        edge: true,
        frame: true,
        diagram: true,
        image: true,
      };
    });
  },

  clearSelectionFilter: () => {
    set((state) => {
      state.selectionFilter = {
        shape: false,
        text: false,
        edge: false,
        frame: false,
        diagram: false,
        image: false,
      };
    });
  },
});
