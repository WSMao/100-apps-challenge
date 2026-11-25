/**
 * Creative-Neuro Canvas Subsystem - Node Drag & Frame Containment Coordinator Hook
 * Path: src/components/canvas/hooks/useDragCoordinator.ts
 *
 * Encapsulates:
 * 1. Node drag start: Zundo history pause & initial snapshot capture
 * 2. Node drag stop: Zundo resume, single atomic undo record push, Frame re-parenting & auto-growth
 * 3. Global drag cancel safety net: ensures temporal is never stuck paused if pointer drops
 */

import { useRef, useCallback, useEffect } from 'react';
import type { OnNodeDrag, Node } from '@xyflow/react';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import type { NeuroNode } from '../../../types/index.ts';
import { calculateFrameAutoGrowth } from '../../../engine/index.ts';

export function useDragCoordinator() {
  const dragStartSnapshotRef = useRef<{
    project: any;
    boards: any;
    pages: any;
    nodes: Record<string, NeuroNode>;
    edges: any;
    activePageId: string;
  } | null>(null);

  // 1. Drag Start: Pause Zundo and capture starting snapshot
  const handleNodeDragStart: OnNodeDrag = useCallback((_event, node) => {
    const state = useProjectStore.getState();
    if (node && !state.selectedNodeIds.includes(node.id)) {
      state.setSelectedNodes([node.id]);
      state.setSelectedEdges([]);
    }
    dragStartSnapshotRef.current = {
      project: state.project,
      boards: state.boards,
      pages: state.pages,
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: state.edges,
      activePageId: state.activePageId,
    };
    useProjectStore.temporal.getState().pause();
    useProjectStore.setState({ isDragging: true });
  }, []);

  // 2. Drag Stop: Atomically record single historical step and re-parent frame containment
  const handleNodeDragStop = useCallback(
    (_event: unknown, _draggedNode: Node, allDraggedNodes?: Node[]) => {
      const draggedNodesList =
        allDraggedNodes && allDraggedNodes.length > 0
          ? allDraggedNodes
          : _draggedNode
          ? [_draggedNode]
          : [];

      const startSnapshot = dragStartSnapshotRef.current;
      dragStartSnapshotRef.current = null;

      try {
        useProjectStore.setState((state) => {
          state.isDragging = false;
          state.alignmentGuides = [];
          for (const node of Object.values(state.nodes)) {
            if (node && 'dragging' in node) {
              delete node.dragging;
            }
          }
          const currentNodes = Object.values(state.nodes);

          for (const dn of draggedNodesList) {
            const storeNode = state.nodes[dn.id];
            if (!storeNode) continue;

            delete storeNode.dragging;

            // 1. Frame container attachment check (exclude frame and macro diagram cards)
            if (dn.type !== 'frame' && dn.type !== 'diagram') {
              const frames = currentNodes.filter(
                (n) => n.type === 'frame' && n.id !== dn.id && !n.data?.collapsed
              );

              const oldParent = storeNode.parentId ? state.nodes[storeNode.parentId] : null;
              const absPos = oldParent
                ? {
                    x: oldParent.position.x + dn.position.x,
                    y: oldParent.position.y + dn.position.y,
                  }
                : dn.position;

              const nodeW = dn.width ?? storeNode.width ?? 160;
              const nodeH = dn.height ?? storeNode.height ?? 60;
              const nodeCenter = {
                x: absPos.x + nodeW / 2,
                y: absPos.y + nodeH / 2,
              };

              let matchedFrame: NeuroNode | null = null;
              for (const frame of frames) {
                const fw = frame.width ?? 360;
                const fh = frame.height ?? 260;
                if (
                  nodeCenter.x >= frame.position.x &&
                  nodeCenter.x <= frame.position.x + fw &&
                  nodeCenter.y >= frame.position.y &&
                  nodeCenter.y <= frame.position.y + fh
                ) {
                  matchedFrame = frame;
                  break;
                }
              }

              if (matchedFrame && storeNode.parentId !== matchedFrame.id) {
                // Attach to frame and convert position to relative coordinates
                storeNode.parentId = matchedFrame.id;
                storeNode.position = {
                  x: absPos.x - matchedFrame.position.x,
                  y: absPos.y - matchedFrame.position.y,
                };
                storeNode.zIndex = Math.max(storeNode.zIndex ?? 1, (matchedFrame.zIndex ?? 0) + 1);
                // Auto expand frame if near border
                const children = currentNodes.filter(
                  (n) => n.parentId === matchedFrame!.id
                );
                const newDims = calculateFrameAutoGrowth(
                  matchedFrame,
                  children,
                  storeNode.position,
                  { width: nodeW, height: nodeH },
                  40
                );
                const targetFrame = state.nodes[matchedFrame.id];
                if (targetFrame) {
                  targetFrame.width = newDims.width;
                  targetFrame.height = newDims.height;
                }
              } else if (!matchedFrame && storeNode.parentId) {
                // Detached from frame: convert relative position back to absolute
                storeNode.position = absPos;
                delete storeNode.parentId;
                delete storeNode.extent;
              }
            }
          }
        });

        // Check if positions actually changed compared to startSnapshot
        if (startSnapshot) {
          const currentState = useProjectStore.getState();
          const hasMoved = draggedNodesList.some((dn) => {
            const original = startSnapshot.nodes[dn.id];
            const current = currentState.nodes[dn.id];
            return (
              original &&
              current &&
              (original.position.x !== current.position.x ||
                original.position.y !== current.position.y)
            );
          });

          if (hasMoved) {
            useProjectStore.temporal.setState((t) => {
              const pastStates = [...t.pastStates, startSnapshot];
              if (pastStates.length > 100) pastStates.shift();
              return {
                pastStates,
                futureStates: [],
              };
            });
          }
        }
      } finally {
        // Guarantee temporal tracking resumes cleanly
        useProjectStore.temporal.getState().resume();
      }
    },
    []
  );

  // Global drag safety net: ensures temporal is never stuck paused if pointer capture drops
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const handleGlobalDragCancel = () => {
      timerId = setTimeout(() => {
        const state = useProjectStore.getState();
        if (state.isDragging || dragStartSnapshotRef.current) {
          useProjectStore.setState((s) => {
            s.isDragging = false;
            s.alignmentGuides = [];
            for (const node of Object.values(s.nodes)) {
              if (node && 'dragging' in node) {
                delete node.dragging;
              }
            }
          });
          useProjectStore.temporal.getState().resume();
          dragStartSnapshotRef.current = null;
        }
      }, 0);
    };

    window.addEventListener('pointerup', handleGlobalDragCancel);
    window.addEventListener('mouseup', handleGlobalDragCancel);
    window.addEventListener('pointercancel', handleGlobalDragCancel);

    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('pointerup', handleGlobalDragCancel);
      window.removeEventListener('mouseup', handleGlobalDragCancel);
      window.removeEventListener('pointercancel', handleGlobalDragCancel);
    };
  }, []);

  return {
    handleNodeDragStart,
    handleNodeDragStop,
  };
}

