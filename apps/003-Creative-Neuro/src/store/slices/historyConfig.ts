/**
 * Creative-Neuro Store Subsystem - Zundo Temporal History Configuration
 * Path: src/store/slices/historyConfig.ts
 */

import type { NeuroNode } from '../../types/index.ts';
import type { ProjectState, ProjectStore } from './types.ts';

export function areNodesEqualExcludingTransient(
  a?: Record<string, NeuroNode>,
  b?: Record<string, NeuroNode>
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const id of keysA) {
    const na = a[id];
    const nb = b[id];
    if (na === nb) continue;
    if (!na || !nb) return false;
    if (
      na.id !== nb.id ||
      na.type !== nb.type ||
      na.position.x !== nb.position.x ||
      na.position.y !== nb.position.y ||
      na.width !== nb.width ||
      na.height !== nb.height ||
      na.parentId !== nb.parentId ||
      na.extent !== nb.extent ||
      na.groupId !== nb.groupId ||
      na.layoutMode !== nb.layoutMode ||
      na.zIndex !== nb.zIndex ||
      na.hidden !== nb.hidden ||
      na.data !== nb.data
    ) {
      return false;
    }
  }
  return true;
}

export function createHistoryConfig(
  getStore: () => { isDragging?: boolean; isResizing?: boolean } | undefined | any
): any {
  return {
    // History Filtering: Only persist scene graph data in Zundo
    partialize: (state: any) => ({
      project: state.project,
      boards: state.boards,
      pages: state.pages,
      nodes: state.nodes,
      edges: state.edges,
      activePageId: state.activePageId,
    }),
    equality: (pastState: any, currentState: any) => {
      const nodesEqual =
        pastState.nodes === currentState.nodes ||
        areNodesEqualExcludingTransient(pastState.nodes, currentState.nodes);
      const edgesEqual = pastState.edges === currentState.edges;
      const pagesEqual = pastState.pages === currentState.pages;
      const boardsEqual = pastState.boards === currentState.boards;
      const activePageEqual = pastState.activePageId === currentState.activePageId;
      const projectEqual =
        pastState.project === currentState.project ||
        (pastState.project.id === currentState.project.id &&
          pastState.project.name === currentState.project.name &&
          pastState.project.activeBoardId === currentState.project.activeBoardId &&
          pastState.project.activePageId === currentState.project.activePageId &&
          pastState.project.pageIds === currentState.project.pageIds &&
          pastState.project.boardIds === currentState.project.boardIds);

      return (
        nodesEqual &&
        edgesEqual &&
        pagesEqual &&
        boardsEqual &&
        activePageEqual &&
        projectEqual
      );
    },
    limit: 100,
    handleSet: (handleSet: any) => (pastState: any, replace: any, currentState: any, deltaState: any) => {
      const storeState = getStore?.() as ProjectState | undefined;
      // Skip history recording while dragging or resizing to prevent frame-by-frame history bloat
      if (storeState?.isDragging || storeState?.isResizing) {
        return;
      }
      return handleSet(pastState, replace, currentState, deltaState);
    },
  };
}
