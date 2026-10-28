/**
 * Convenience re-export for the projectStore module.
 * Satisfies both '@/store/projectStore' and '@/store/useProjectStore' import conventions.
 */

export {
  useProjectStore,
  useActivePageNodes,
  useActivePageEdges,
  useActivePage,
  useTemporal,
  undo,
  redo,
  clearHistory,
} from './projectStore.ts';

export type {
  ProjectStore,
  ProjectState,
  ProjectActions,
  ProjectRecord,
} from './projectStore.ts';
