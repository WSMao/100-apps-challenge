/**
 * Creative-Neuro Canvas Subsystem - Dual-Mode DiagramNode (State A: Embedded Preview)
 * Path: src/components/canvas/nodes/DiagramNode.tsx
 *
 * Implements:
 * - State A Embedded Interactive Preview Card on the infinite canvas
 * - Left-click drag anywhere on the card to move position on the main canvas
 * - 8-direction (4 borders + 4 corners) left-click resize handles with zoom compensation & atomic Undo/Redo
 * - Scaled SVG vector mini-map thumbnail rendered from Mermaid DSL AST
 * - 4-way macro flowchart connection handles (Top, Right, Bottom, Left)
 * - Focus button & double-click trigger to enter State B (FocusDiagramModal)
 */

import React, { useMemo, useCallback } from 'react';
import { Handle, Position, useStoreApi, type NodeProps } from '@xyflow/react';
import { Workflow, Maximize2, Layers } from 'lucide-react';
import type { NeuroNode, NeuroEdge, FlowDirection } from '../../../types/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { DiagramPipeline, calculateElkLayoutSync } from '../../../engine/index.ts';
import { NodeFloatingActionBar } from '../NodeFloatingActionBar.tsx';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

const MIN_DIAGRAM_WIDTH = 220;
const MIN_DIAGRAM_HEIGHT = 160;
const MAX_DIAGRAM_WIDTH = 1600;
const MAX_DIAGRAM_HEIGHT = 1200;

export function DiagramNode({
  id,
  data: rawData,
  selected,
  width = 340,
  height = 240,
}: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const storeApi = useStoreApi();
  const setFocusedDiagramId = useProjectStore((s) => s.setFocusedDiagramId);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const isStoreSelected = useProjectStore((s) => s.selectedNodeIds.includes(id));
  const selectedNodeCount = useProjectStore((s) => s.selectedNodeIds.length);
  const storeWidth = useProjectStore((s) => s.nodes[id]?.width);
  const storeHeight = useProjectStore((s) => s.nodes[id]?.height);
  const isNodeSelected = selected || isStoreSelected;

  const mermaidCode =
    data?.mermaidCode || 'flowchart TD\n  Start([Start]) --> End([End])';
  const title = data?.title || data?.label || 'Sub-Diagram Flow';

  // Compile Mermaid diagram via pure DiagramPipeline
  const compiled = useMemo(() => {
    return DiagramPipeline.compile({
      mermaidCode,
      savedSubNodes: data?.customData?.subNodes as NeuroNode[] | undefined,
      savedSubEdges: data?.customData?.subEdges as NeuroEdge[] | undefined,
      direction: data?.diagramOrientation as FlowDirection | undefined,
    });
  }, [
    mermaidCode,
    data?.customData?.subNodes,
    data?.customData?.subEdges,
    data?.diagramOrientation,
  ]);

  const nodeCount = compiled.ast.nodes.length;
  const edgeCount = compiled.ast.edges.length;
  const previewElements = nodeCount > 0 ? compiled.preview : null;

  const handleOpenFocus = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    updateNodeData(id, { isFocused: true, diagramMode: 'focused' });
    setFocusedDiagramId(id);
  };

  const W = storeWidth || width || 340;
  const H = storeHeight || height || 240;

  // 8-Direction (4 borders + 4 corners) Left-Click Resize Handler
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, dir: ResizeDirection) => {
      if (e.button !== 0) return; // Only Left Mouse Button
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
      const startW = targetNode.width || W;
      const startH = targetNode.height || H;
      const startPosX = targetNode.position.x;
      const startPosY = targetNode.position.y;

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

        let nextW = startW;
        let nextH = startH;
        let nextPosX = startPosX;
        let nextPosY = startPosY;

        if (dir.includes('e')) {
          nextW = Math.min(
            MAX_DIAGRAM_WIDTH,
            Math.max(MIN_DIAGRAM_WIDTH, Math.round(startW + dx))
          );
        }
        if (dir.includes('s')) {
          nextH = Math.min(
            MAX_DIAGRAM_HEIGHT,
            Math.max(MIN_DIAGRAM_HEIGHT, Math.round(startH + dy))
          );
        }
        if (dir.includes('w')) {
          nextW = Math.min(
            MAX_DIAGRAM_WIDTH,
            Math.max(MIN_DIAGRAM_WIDTH, Math.round(startW - dx))
          );
          nextPosX = Math.round(startPosX + (startW - nextW));
        }
        if (dir.includes('n')) {
          nextH = Math.min(
            MAX_DIAGRAM_HEIGHT,
            Math.max(MIN_DIAGRAM_HEIGHT, Math.round(startH - dy))
          );
          nextPosY = Math.round(startPosY + (startH - nextH));
        }

        useProjectStore.setState((s) => {
          const n = s.nodes[id];
          if (!n) return;
          n.width = nextW;
          n.height = nextH;
          n.position = { x: nextPosX, y: nextPosY };
          n.measured = { width: nextW, height: nextH };
          if (n.layoutMode === 'auto-elk') {
            n.layoutMode = 'manual';
          }
          if (n.data && n.data.layoutMode === 'auto-elk') {
            n.data.layoutMode = 'manual';
          }
        });
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        useProjectStore.setState((s) => {
          s.isResizing = false;
          const page = s.pages[s.activePageId];
          if (page) page.updatedAt = Date.now();
          s.project.updatedAt = Date.now();
        });

        const endState = useProjectStore.getState();
        const endNode = endState.nodes[id];
        const hasResized =
          endNode &&
          (endNode.width !== startW ||
            endNode.height !== startH ||
            endNode.position.x !== startPosX ||
            endNode.position.y !== startPosY);

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
    [id, W, H, storeApi]
  );

  return (
    <div
      data-testid={`diagram-node-${id}`}
      onDoubleClick={(e) => handleOpenFocus(e)}
      className={`group relative flex flex-col rounded-2xl bg-slate-900/90 border transition-shadow duration-200 select-none shadow-xl backdrop-blur-md cursor-grab active:cursor-grabbing ${
        isNodeSelected
          ? 'border-cyan-400 ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.6)]'
          : 'border-slate-800 hover:border-slate-700 hover:shadow-2xl'
      }`}
      style={{
        width: W,
        height: H,
      }}
    >
      {/* Horizontal Floating Quick-Action Menu directly above diagram node when single diagram is selected */}
      {isNodeSelected && selectedNodeCount <= 1 && <NodeFloatingActionBar nodeId={id} />}

      {/* 4 Border Resize Strips (n, s, e, w) — Left-click drag to resize width/height */}
      <div
        data-testid="diagram-resize-n"
        onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
        className="nodrag nopan absolute -top-1.5 left-3 right-3 h-3 cursor-ns-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />
      <div
        data-testid="diagram-resize-s"
        onMouseDown={(e) => handleResizeMouseDown(e, 's')}
        className="nodrag nopan absolute -bottom-1.5 left-3 right-3 h-3 cursor-ns-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />
      <div
        data-testid="diagram-resize-w"
        onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
        className="nodrag nopan absolute -left-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />
      <div
        data-testid="diagram-resize-e"
        onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
        className="nodrag nopan absolute -right-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-20 rounded-full hover:bg-cyan-400/30 transition-colors"
      />

      {/* 4 Corner Resize Handles (nw, ne, sw, se) — Left-click drag to resize both axes */}
      <div
        data-testid="diagram-resize-nw"
        onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
        className={`nodrag nopan absolute -top-2 -left-2 w-4 h-4 cursor-nwse-resize z-30 flex items-center justify-center transition-opacity ${
          isNodeSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-sm bg-slate-950 border-2 border-cyan-400 shadow-sm" />
      </div>
      <div
        data-testid="diagram-resize-ne"
        onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
        className={`nodrag nopan absolute -top-2 -right-2 w-4 h-4 cursor-nesw-resize z-30 flex items-center justify-center transition-opacity ${
          isNodeSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-sm bg-slate-950 border-2 border-cyan-400 shadow-sm" />
      </div>
      <div
        data-testid="diagram-resize-sw"
        onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
        className={`nodrag nopan absolute -bottom-2 -left-2 w-4 h-4 cursor-nesw-resize z-30 flex items-center justify-center transition-opacity ${
          isNodeSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-sm bg-slate-950 border-2 border-cyan-400 shadow-sm" />
      </div>
      <div
        data-testid="diagram-resize-se"
        onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
        className={`nodrag nopan absolute -bottom-2 -right-2 w-4 h-4 cursor-nwse-resize z-30 flex items-center justify-center transition-opacity ${
          isNodeSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <span className="w-2.5 h-2.5 rounded-sm bg-slate-950 border-2 border-cyan-400 shadow-sm" />
      </div>

      {/* 4-Direction Macro Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-slate-900 opacity-0 group-hover:opacity-100 hover:!scale-125 transition-all !z-30"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-slate-900 opacity-0 group-hover:opacity-100 hover:!scale-125 transition-all !z-30"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-slate-900 opacity-0 group-hover:opacity-100 hover:!scale-125 transition-all !z-30"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-slate-900 opacity-0 group-hover:opacity-100 hover:!scale-125 transition-all !z-30"
      />

      {/* Inner clipped card container so header/body/footer stay within rounded-2xl corners */}
      <div className="flex flex-col flex-1 w-full h-full rounded-2xl overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Workflow className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="text-xs font-semibold text-slate-200 truncate" title={title}>
              {title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
              {nodeCount}n · {edgeCount}e
            </span>
            <button
              type="button"
              onClick={handleOpenFocus}
              title="Focus Diagram (Double-click)"
              className="nodrag flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors cursor-pointer pointer-events-auto"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Focus</span>
            </button>
          </div>
        </div>

        {/* Card Body: Scaled Mini-Graph Vector Preview */}
        <div className="relative flex-1 bg-slate-950/40 p-2 overflow-hidden flex items-center justify-center">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, #818cf8 1px, transparent 0)',
              backgroundSize: '16px 16px',
            }}
          />

          {previewElements ? (
            <svg
              className="w-full h-full pointer-events-none"
              viewBox={`0 0 ${previewElements.svgWidth} ${previewElements.svgHeight}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <marker
                  id={`arrow-${id}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                </marker>
              </defs>

              {/* Render Edges */}
              {previewElements.edges.map((e) => {
                const edgePath = previewElements.isHorizontal
                  ? `M ${e.src.x + 70} ${e.src.y + 14} C ${(e.src.x + 70 + e.tgt.x) / 2} ${e.src.y + 14}, ${(e.src.x + 70 + e.tgt.x) / 2} ${e.tgt.y + 14}, ${e.tgt.x} ${e.tgt.y + 14}`
                  : `M ${e.src.x + 35} ${e.src.y + 28} C ${e.src.x + 35} ${(e.src.y + 28 + e.tgt.y) / 2}, ${e.tgt.x + 35} ${(e.src.y + 28 + e.tgt.y) / 2}, ${e.tgt.x + 35} ${e.tgt.y}`;

                return (
                  <path
                    key={e.id}
                    d={edgePath}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeOpacity="0.75"
                    markerEnd={`url(#arrow-${id})`}
                  />
                );
              })}

              {/* Render Nodes */}
              {previewElements.nodes.map((n) => (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  <rect
                    width="70"
                    height="28"
                    rx="6"
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <text
                    x="35"
                    y="18"
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="9"
                    fontFamily="sans-serif"
                    fontWeight="500"
                  >
                    {n.label.length > 9 ? n.label.slice(0, 8) + '…' : n.label}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <div className="text-slate-500 text-xs flex flex-col items-center gap-1 pointer-events-none">
              <Layers className="w-5 h-5 opacity-40" />
              <span>Empty Sub-Diagram</span>
            </div>
          )}

          {/* Hover Cue Overlay (pointer-events-none so left-click drag moves the card smoothly; double-click expands) */}
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span className="text-xs font-medium text-indigo-300 bg-slate-900/90 px-3 py-1.5 rounded-full border border-indigo-500/40 shadow-lg flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5" />
              Double-click to expand
            </span>
          </div>
        </div>

        {/* Card Footer */}
        <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
          <span className="font-mono">Dir: {compiled.ast.direction || 'TB'}</span>
          <span className="text-indigo-400/80 font-medium">{Math.round(W)} × {Math.round(H)}</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(DiagramNode);
