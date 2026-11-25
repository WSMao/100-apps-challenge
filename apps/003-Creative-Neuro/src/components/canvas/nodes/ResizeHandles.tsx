/**
 * Shared 8-Direction (4 edges + 4 corners) Node Resize Engine & Handles
 * Path: src/components/canvas/nodes/ResizeHandles.tsx
 */
import React, { useCallback } from 'react';
import { useStoreApi } from '@xyflow/react';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { computeResizeSnap, type SnapRect } from '../../../engine/index.ts';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export interface ResizeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export function computeResizedBounds(
  start: ResizeBounds,
  dir: ResizeDirection,
  dx: number,
  dy: number,
  constraints: ResizeConstraints = {}
): ResizeBounds {
  const minW = constraints.minWidth ?? 60;
  const minH = constraints.minHeight ?? 36;
  const maxW = constraints.maxWidth ?? 4000;
  const maxH = constraints.maxHeight ?? 4000;

  let nextW = start.width;
  let nextH = start.height;
  let nextX = start.x;
  let nextY = start.y;

  if (dir.includes('e')) {
    nextW = Math.min(maxW, Math.max(minW, Math.round(start.width + dx)));
  }
  if (dir.includes('s')) {
    nextH = Math.min(maxH, Math.max(minH, Math.round(start.height + dy)));
  }
  if (dir.includes('w')) {
    nextW = Math.min(maxW, Math.max(minW, Math.round(start.width - dx)));
    nextX = Math.round(start.x + (start.width - nextW));
  }
  if (dir.includes('n')) {
    nextH = Math.min(maxH, Math.max(minH, Math.round(start.height - dy)));
    nextY = Math.round(start.y + (start.height - nextH));
  }

  return { x: nextX, y: nextY, width: nextW, height: nextH };
}

export interface UseNodeResizeOptions extends ResizeConstraints {
  id: string;
  defaultWidth: number;
  defaultHeight: number;
  disabled?: boolean;
  onResizeStep?: (deltaPos: { dx: number; dy: number }) => void;
  onResizeEnd?: (hasResized: boolean) => void;
}

export function useNodeResize({
  id,
  defaultWidth,
  defaultHeight,
  minWidth = 60,
  minHeight = 36,
  maxWidth = 4000,
  maxHeight = 4000,
  disabled = false,
  onResizeStep,
  onResizeEnd,
}: UseNodeResizeOptions) {
  const storeApi = useStoreApi();

  return useCallback(
    (e: React.MouseEvent, dir: ResizeDirection) => {
      if (e.button !== 0 || disabled) return;
      e.stopPropagation();
      e.preventDefault();

      const state = useProjectStore.getState();
      const targetNode = state.nodes[id];
      if (!targetNode) return;

      if (!state.selectedNodeIds.includes(id)) {
        state.setSelectedNodes([id]);
        state.setSelectedEdges([]);
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = targetNode.width || defaultWidth;
      const startH = targetNode.height || defaultHeight;
      const startPosX = targetNode.position.x;
      const startPosY = targetNode.position.y;
      let prevPosX = startPosX;
      let prevPosY = startPosY;

      const startSnapshot = {
        project: state.project,
        boards: state.boards,
        pages: state.pages,
        nodes: JSON.parse(JSON.stringify(state.nodes)),
        edges: state.edges,
        activePageId: state.activePageId,
      };

      useProjectStore.temporal.getState().pause();
      useProjectStore.setState({ isResizing: true });

      const onMouseMove = (moveEvent: MouseEvent) => {
        const rfTransform = storeApi.getState().transform;
        const zoom = rfTransform && rfTransform[2] ? rfTransform[2] : 1;
        const dx = (moveEvent.clientX - startX) / zoom;
        const dy = (moveEvent.clientY - startY) / zoom;

        const rawNext = computeResizedBounds(
          { x: startPosX, y: startPosY, width: startW, height: startH },
          dir,
          dx,
          dy,
          { minWidth, minHeight, maxWidth, maxHeight }
        );

        const curState = useProjectStore.getState();
        const curNode = curState.nodes[id];
        const parentNode = curNode?.parentId ? curState.nodes[curNode.parentId] : null;
        const absOffsetX = parentNode ? parentNode.position.x : 0;
        const absOffsetY = parentNode ? parentNode.position.y : 0;

        const activePage = curState.pages[curState.activePageId];
        const pageNodeIds = activePage?.nodeIds ?? Object.keys(curState.nodes);
        const otherRects: SnapRect[] = [];
        for (const nid of pageNodeIds) {
          if (nid === id) continue;
          const n = curState.nodes[nid];
          if (!n || n.hidden || n.type === 'freehand' || n.parentId === id) continue;
          const nParent = n.parentId ? curState.nodes[n.parentId] : null;
          otherRects.push({
            id: n.id,
            x: nParent ? nParent.position.x + n.position.x : n.position.x,
            y: nParent ? nParent.position.y + n.position.y : n.position.y,
            width: n.width ?? n.measured?.width ?? 160,
            height: n.height ?? n.measured?.height ?? 60,
          });
        }

        const snapped = computeResizeSnap(
          {
            x: rawNext.x + absOffsetX,
            y: rawNext.y + absOffsetY,
            width: rawNext.width,
            height: rawNext.height,
          },
          dir,
          otherRects,
          { minWidth, minHeight, maxWidth, maxHeight },
          { snapThreshold: 6, gridSize: 16 }
        );

        const next = {
          x: snapped.bounds.x - absOffsetX,
          y: snapped.bounds.y - absOffsetY,
          width: snapped.bounds.width,
          height: snapped.bounds.height,
        };

        const deltaPosX = next.x - prevPosX;
        const deltaPosY = next.y - prevPosY;
        prevPosX = next.x;
        prevPosY = next.y;

        useProjectStore.setState((s) => {
          const n = s.nodes[id];
          if (!n) return;
          n.width = next.width;
          n.height = next.height;
          n.position = { x: next.x, y: next.y };
          n.measured = { width: next.width, height: next.height };
          s.alignmentGuides = snapped.guides;
        });

        if (deltaPosX !== 0 || deltaPosY !== 0) {
          onResizeStep?.({ dx: deltaPosX, dy: deltaPosY });
        }
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        useProjectStore.setState((s) => {
          s.isResizing = false;
          s.alignmentGuides = [];
          const page = s.pages[s.activePageId];
          if (page) page.updatedAt = Date.now();
          s.project.updatedAt = Date.now();
        });

        const endState = useProjectStore.getState();
        const endNode = endState.nodes[id];
        const hasResized = Boolean(
          endNode &&
            (endNode.width !== startW ||
              endNode.height !== startH ||
              endNode.position.x !== startPosX ||
              endNode.position.y !== startPosY)
        );

        onResizeEnd?.(hasResized);

        useProjectStore.temporal.getState().resume();
        if (hasResized) {
          useProjectStore.temporal.setState((t) => {
            const pastStates = [...t.pastStates, startSnapshot];
            if (pastStates.length > 100) pastStates.shift();
            return {
              pastStates,
              futureStates: [],
            };
          });
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [
      id,
      defaultWidth,
      defaultHeight,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      disabled,
      storeApi,
      onResizeStep,
      onResizeEnd,
    ]
  );
}

export interface ResizeHandlesProps {
  isSelected: boolean;
  testIdPrefix: string;
  onResizeMouseDown: (e: React.MouseEvent, dir: ResizeDirection) => void;
  disabled?: boolean;
}

const CORNER_CLASS_BASE =
  'nodrag nopan absolute w-4 h-4 z-30 flex items-center justify-center transition-opacity';

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  isSelected,
  testIdPrefix,
  onResizeMouseDown,
  disabled = false,
}) => {
  if (disabled) return null;

  const visibilityClass = isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  return (
    <>
      {/* 4 Edge Resize Strips */}
      <div
        data-testid={`${testIdPrefix}-resize-n`}
        onMouseDown={(e) => onResizeMouseDown(e, 'n')}
        className="nodrag nopan absolute -top-1.5 left-3 right-3 h-3 cursor-ns-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />
      <div
        data-testid={`${testIdPrefix}-resize-s`}
        onMouseDown={(e) => onResizeMouseDown(e, 's')}
        className="nodrag nopan absolute -bottom-1.5 left-3 right-3 h-3 cursor-ns-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />
      <div
        data-testid={`${testIdPrefix}-resize-w`}
        onMouseDown={(e) => onResizeMouseDown(e, 'w')}
        className="nodrag nopan absolute -left-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />
      <div
        data-testid={`${testIdPrefix}-resize-e`}
        onMouseDown={(e) => onResizeMouseDown(e, 'e')}
        className="nodrag nopan absolute -right-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />

      {/* 4 Corner Resize Handles */}
      <div
        data-testid={`${testIdPrefix}-resize-nw`}
        onMouseDown={(e) => onResizeMouseDown(e, 'nw')}
        className={`${CORNER_CLASS_BASE} -top-2 -left-2 cursor-nwse-resize ${visibilityClass}`}
      >
        <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 border border-slate-900 shadow-sm" />
      </div>
      <div
        data-testid={`${testIdPrefix}-resize-ne`}
        onMouseDown={(e) => onResizeMouseDown(e, 'ne')}
        className={`${CORNER_CLASS_BASE} -top-2 -right-2 cursor-nesw-resize ${visibilityClass}`}
      >
        <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 border border-slate-900 shadow-sm" />
      </div>
      <div
        data-testid={`${testIdPrefix}-resize-sw`}
        onMouseDown={(e) => onResizeMouseDown(e, 'sw')}
        className={`${CORNER_CLASS_BASE} -bottom-2 -left-2 cursor-nesw-resize ${visibilityClass}`}
      >
        <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 border border-slate-900 shadow-sm" />
      </div>
      <div
        data-testid={`${testIdPrefix}-resize-se`}
        onMouseDown={(e) => onResizeMouseDown(e, 'se')}
        className={`${CORNER_CLASS_BASE} -bottom-2 -right-2 cursor-nwse-resize ${visibilityClass}`}
      >
        <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 border border-slate-900 shadow-sm" />
      </div>
    </>
  );
};
