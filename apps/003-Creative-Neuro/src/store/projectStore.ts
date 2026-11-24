/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Layer 1 Zustand + Immer + Zundo State Store (Facade)
 *
 * Architecture:
 * - State container: Zustand v5 curried create()
 * - Mutability engine: Immer middleware Draft<T> proxy
 * - History engine: Zundo v2 temporal middleware with partialize filter
 * - Modularity: Composed from domain slices (Selection, Page, Graph, ReactFlow, ProjectStorage)
 * - UI Integration: React Flow v12 (@xyflow/react) NodeChange/EdgeChange handlers
 */

import { useMemo } from 'react';
import { create, useStore, type UseBoundStore, type StoreApi } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal, type TemporalState } from 'zundo';
import type { NeuroNode, NeuroEdge, Page } from '../types/index.ts';

import {
  initialState,
  createHistoryConfig,
  createSelectionSlice,
  createPageSlice,
  createGraphSlice,
  createReactFlowSlice,
  createProjectStorageSlice,
  findOptimalHandlePair,
} from './slices/index.ts';
import type {
  ProjectRecord,
  ProjectState,
  ProjectActions,
  ProjectStore,
  StoreSet,
  StoreGet,
} from './slices/index.ts';

export type {
  ProjectRecord,
  ProjectState,
  ProjectActions,
  ProjectStore,
};

export { findOptimalHandlePair };

export type BoundProjectStore = UseBoundStore<
  Omit<StoreApi<ProjectStore>, 'setState'> & {
    setState: (
      nextStateOrUpdater:
        | ProjectStore
        | Partial<ProjectStore>
        | ((state: ProjectStore) => void),
      shouldReplace?: boolean
    ) => void;
  }
> & {
  temporal: StoreApi<TemporalState<ProjectStore>>;
};

export const useProjectStore: BoundProjectStore = create<ProjectStore>()(
  temporal(
    immer((set, get) => ({
      ...initialState,
      ...createSelectionSlice(set as unknown as StoreSet, get as unknown as StoreGet),
      ...createPageSlice(set as unknown as StoreSet, get as unknown as StoreGet, () => (useProjectStore as any)?.temporal?.getState()),
      ...createGraphSlice(set as unknown as StoreSet, get as unknown as StoreGet),
      ...createReactFlowSlice(set as unknown as StoreSet, get as unknown as StoreGet, () => (useProjectStore as any)?.temporal?.getState()),
      ...createProjectStorageSlice(set as unknown as StoreSet, get as unknown as StoreGet, () => (useProjectStore as any)?.temporal?.getState()),
    })),
    createHistoryConfig(() => (useProjectStore as any)?.getState?.())
  )
) as unknown as BoundProjectStore;

// ============================================================================
// Reactive Selectors & Temporal Hooks
// ============================================================================

export const useActivePageNodes = (): NeuroNode[] => {
  try {
    const activePageId = useProjectStore((state) => state.activePageId);
    const pages = useProjectStore((state) => state.pages);
    const nodes = useProjectStore((state) => state.nodes);
    return useMemo(() => {
      const activePage = pages[activePageId];
      if (!activePage || !Array.isArray(activePage.nodeIds)) return [];
      return activePage.nodeIds
        .map((id) => nodes[id])
        .filter((n): n is NeuroNode => Boolean(n));
    }, [activePageId, pages, nodes]);
  } catch {
    const state = useProjectStore.getState();
    const activePage = state.pages?.[state.activePageId];
    if (!activePage || !Array.isArray(activePage.nodeIds)) return [];
    return activePage.nodeIds
      .map((id) => state.nodes?.[id])
      .filter((n): n is NeuroNode => Boolean(n));
  }
};

export const useActivePageEdges = (): NeuroEdge[] => {
  try {
    const activePageId = useProjectStore((state) => state.activePageId);
    const pages = useProjectStore((state) => state.pages);
    const edges = useProjectStore((state) => state.edges);
    return useMemo(() => {
      const activePage = pages[activePageId];
      if (!activePage || !Array.isArray(activePage.edgeIds)) return [];
      return activePage.edgeIds
        .map((id) => edges[id])
        .filter((e): e is NeuroEdge => Boolean(e));
    }, [activePageId, pages, edges]);
  } catch {
    const state = useProjectStore.getState();
    const activePage = state.pages?.[state.activePageId];
    if (!activePage || !Array.isArray(activePage.edgeIds)) return [];
    return activePage.edgeIds
      .map((id) => state.edges?.[id])
      .filter((e): e is NeuroEdge => Boolean(e));
  }
};

export const useActivePage = (): Page | undefined => {
  try {
    return useProjectStore((state) => state.pages[state.activePageId]);
  } catch {
    const state = useProjectStore.getState();
    return state.pages?.[state.activePageId];
  }
};

export const useTemporal = () => {
  const canUndo = useStore(
    useProjectStore.temporal,
    (s: any) => s.pastStates.length > 0
  );
  const canRedo = useStore(
    useProjectStore.temporal,
    (s: any) => s.futureStates.length > 0
  );
  const { clear, pause, resume } = useProjectStore.temporal.getState();

  return {
    canUndo,
    canRedo,
    undo: () => useProjectStore.getState().undo(),
    redo: () => useProjectStore.getState().redo(),
    clear,
    pause,
    resume,
  };
};

export const undo = () => useProjectStore.getState().undo();
export const redo = () => useProjectStore.getState().redo();
export const clearHistory = () => useProjectStore.temporal.getState().clear();
