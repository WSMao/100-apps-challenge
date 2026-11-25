/**
 * Creative-Neuro Store Subsystem - React Flow Event Handlers Slice
 * Path: src/store/slices/reactFlowSlice.ts
 */

import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
} from '@xyflow/react';
import {
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { TemporalState } from 'zundo';
import type { NeuroNode, NeuroEdge } from '../../types/index.ts';
import type { StoreSet, StoreGet } from './types.ts';

export const createReactFlowSlice = (
  set: StoreSet,
  get: StoreGet,
  getTemporal?: () => TemporalState<unknown> | undefined
) => ({
  onNodesChange: (changes: NodeChange<Node>[]) => {
    let hasStructuralCandidate = false;
    const currentState = get();
    for (const change of changes) {
      if (change.type === 'remove') {
        hasStructuralCandidate = true;
        break;
      }
      if (change.type === 'dimensions' && change.resizing && change.dimensions) {
        const existing = currentState.nodes[change.id];
        if (
          !existing ||
          existing.width !== change.dimensions.width ||
          existing.height !== change.dimensions.height
        ) {
          hasStructuralCandidate = true;
          break;
        }
      }
      if (change.type === 'position' && change.position) {
        const existing = currentState.nodes[change.id];
        if (
          !existing ||
          existing.position.x !== change.position.x ||
          existing.position.y !== change.position.y
        ) {
          hasStructuralCandidate = true;
          break;
        }
      }
    }

    const temporal = getTemporal?.();
    const wasTracking = temporal?.isTracking;
    if (!hasStructuralCandidate && wasTracking) {
      temporal?.pause();
    }

    try {
      set((state) => {
        const activePage = state.pages[state.activePageId];
        if (!activePage) return;

        let isCurrentlyDragging = false;
        let isCurrentlyResizing = false;
        let hasPositionOrDimensionChange = false;
        let hasRemoval = false;

        // 1. Separate select changes and filter automated DOM measurements
        const selectChanges: Extract<NodeChange<Node>, { type: 'select' }>[] = [];
        const structuralChanges: NodeChange<Node>[] = [];

        for (const change of changes) {
          if (change.type === 'select') {
            selectChanges.push(change);
          } else if (change.type === 'dimensions') {
            // Ignore automated ResizeObserver DOM measurements when user is not manually resizing
            if (change.resizing) {
              isCurrentlyResizing = true;
              const existing = state.nodes[change.id];
              if (
                !existing ||
                !change.dimensions ||
                existing.width !== change.dimensions.width ||
                existing.height !== change.dimensions.height
              ) {
                hasPositionOrDimensionChange = true;
                structuralChanges.push(change);
              }
            }
          } else if (change.type === 'position') {
            const existing = state.nodes[change.id];
            if (existing && (existing.locked || existing.data?.locked)) {
              // Locked objects cannot be dragged or repositioned by user gesture
              continue;
            }
            if (change.dragging) {
              isCurrentlyDragging = true;
            }
            if (existing) {
              if (change.dragging === false) {
                delete existing.dragging;
              } else if (change.dragging === true) {
                existing.dragging = true;
              }
            }
            if (change.position) {
              if (
                !existing ||
                existing.position.x !== change.position.x ||
                existing.position.y !== change.position.y
              ) {
                hasPositionOrDimensionChange = true;
                structuralChanges.push(change);
              }
            } else {
              structuralChanges.push(change);
            }
          } else {
            structuralChanges.push(change);
          }
        }
        state.isDragging = isCurrentlyDragging;
        state.isResizing = isCurrentlyResizing;

        // When dragging is inactive, purge any stranded dragging flags across all nodes
        if (!isCurrentlyDragging) {
          for (const node of Object.values(state.nodes)) {
            if (node && 'dragging' in node) {
              delete node.dragging;
            }
          }
        }

        // 2. Handle selection changes on ephemeral state only (does NOT mutate state.nodes or produce history entries)
        if (selectChanges.length > 0) {
          const currentSelected = new Set(state.selectedNodeIds);
          const nextSelected = new Set(state.selectedNodeIds);

          for (const change of selectChanges) {
            if (change.selected) {
              const node = state.nodes[change.id];
              const gid = node?.groupId || node?.data?.groupId;
              const toAdd = gid
                ? Object.values(state.nodes)
                    .filter((n) => n.groupId === gid || n.data?.groupId === gid)
                    .map((n) => n.id)
                : [change.id];
              for (const aid of toAdd) {
                nextSelected.add(aid);
              }
            } else {
              nextSelected.delete(change.id);
            }
          }

          if (
            currentSelected.size !== nextSelected.size ||
            Array.from(nextSelected).some((id) => !currentSelected.has(id))
          ) {
            state.selectedNodeIds = Array.from(nextSelected);
            if (state.editingNodeId && !nextSelected.has(state.editingNodeId)) {
              state.editingNodeId = null;
              state.editingInitialValue = null;
            }
          }
        }

        // 3. Apply structural changes (position, manual resize, remove) to state.nodes
        if (structuralChanges.length > 0) {
          const currentNodes = activePage.nodeIds
            .map((id) => state.nodes[id])
            .filter((n): n is NeuroNode => Boolean(n));

          const updatedNodes = applyNodeChanges(
            structuralChanges,
            currentNodes as unknown as Node[]
          ) as unknown as NeuroNode[];
          for (const node of updatedNodes) {
            state.nodes[node.id] = node;
          }

          for (const change of structuralChanges) {
            if (change.type === 'position' && change.position) {
              const node = state.nodes[change.id];
              if (node) {
                if (change.dragging === false) {
                  delete node.dragging;
                }
              }
            } else if (change.type === 'remove') {
              hasRemoval = true;
              delete state.nodes[change.id];

              // Unparent child nodes if removed node was a container / frame
              for (const node of Object.values(state.nodes)) {
                if (node.parentId === change.id) {
                  delete node.parentId;
                  delete node.extent;
                }
              }

              for (const page of Object.values(state.pages)) {
                page.nodeIds = page.nodeIds.filter((nid) => nid !== change.id);
              }

              // Cascade delete incident edges across all pages
              const edgesToDelete: string[] = [];
              for (const [edgeId, edge] of Object.entries(state.edges)) {
                if (edge.source === change.id || edge.target === change.id) {
                  edgesToDelete.push(edgeId);
                  delete state.edges[edgeId];
                }
              }

              for (const page of Object.values(state.pages)) {
                page.edgeIds = page.edgeIds.filter((eid) => !edgesToDelete.includes(eid));
              }

              // Sanitize selections
              state.selectedNodeIds = state.selectedNodeIds.filter((nid) => nid !== change.id);
              state.selectedEdgeIds = state.selectedEdgeIds.filter(
                (eid) => !edgesToDelete.includes(eid)
              );
            }
          }

          // Post-apply safeguard: purge any stranded dragging flags across all nodes when inactive
          if (!isCurrentlyDragging) {
            for (const node of Object.values(state.nodes)) {
              if (node && 'dragging' in node) {
                delete node.dragging;
              }
            }
          }
        }

        if (hasPositionOrDimensionChange || hasRemoval) {
          activePage.updatedAt = Date.now();
          state.project.updatedAt = Date.now();
        }
      });
    } finally {
      if (!hasStructuralCandidate && wasTracking) {
        temporal?.resume();
      }
    }
  },

  onEdgesChange: (changes: EdgeChange<Edge>[]) => {
    set((state) => {
      const activePage = state.pages[state.activePageId];
      if (!activePage) return;

      const selectChanges: Extract<EdgeChange<Edge>, { type: 'select' }>[] = [];
      const structuralChanges: EdgeChange<Edge>[] = [];

      for (const change of changes) {
        if (change.type === 'select') {
          selectChanges.push(change);
        } else {
          structuralChanges.push(change);
        }
      }

      // Handle select changes on ephemeral state only
      if (selectChanges.length > 0) {
        const currentSelected = new Set(state.selectedEdgeIds);
        const nextSelected = new Set(state.selectedEdgeIds);

        for (const change of selectChanges) {
          if (change.selected) {
            nextSelected.add(change.id);
          } else {
            nextSelected.delete(change.id);
          }
        }

        if (
          currentSelected.size !== nextSelected.size ||
          Array.from(nextSelected).some((id) => !currentSelected.has(id))
        ) {
          state.selectedEdgeIds = Array.from(nextSelected);
        }
      }

      if (structuralChanges.length > 0) {
        const currentEdges = activePage.edgeIds
          .map((id) => state.edges[id])
          .filter((e): e is NeuroEdge => Boolean(e));

        const updatedEdges = applyEdgeChanges(
          structuralChanges,
          currentEdges as unknown as Edge[]
        ) as unknown as NeuroEdge[];
        for (const edge of updatedEdges) {
          state.edges[edge.id] = edge;
        }

        let hasRemoval = false;
        for (const change of structuralChanges) {
          if (change.type === 'remove') {
            hasRemoval = true;
            delete state.edges[change.id];

            for (const page of Object.values(state.pages)) {
              page.edgeIds = page.edgeIds.filter((eid) => eid !== change.id);
            }

            state.selectedEdgeIds = state.selectedEdgeIds.filter((eid) => eid !== change.id);
          }
        }

        if (hasRemoval) {
          activePage.updatedAt = Date.now();
          state.project.updatedAt = Date.now();
        }
      }
    });
  },

  onConnect: (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const routing = get().defaultEdgeRoutingType || 'jump';
    get().addEdge({
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined,
      type: routing,
      data: {
        routingType: routing,
        jumpArc: routing === 'jump',
      },
    });
  },
});

