/**
 * Creative-Neuro Canvas Subsystem - Dual-Mode DiagramNode (State A: Embedded Preview)
 * Path: src/components/canvas/nodes/DiagramNode.tsx
 *
 * Implements:
 * - State A Embedded Interactive Preview Card on the infinite canvas
 * - Scaled SVG vector mini-map thumbnail rendered from Mermaid DSL AST
 * - 4-way macro flowchart connection handles (Top, Right, Bottom, Left)
 * - Focus button & double-click trigger to enter State B (FocusDiagramModal)
 */

import React, { useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Workflow, Maximize2, Layers } from 'lucide-react';
import type { NeuroNode } from '../../../types/index.ts';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import { parseMermaid } from '../../../engine/index.ts';

export function DiagramNode({
  id,
  data: rawData,
  selected,
  width = 340,
  height = 240,
}: NodeProps) {
  const data = rawData as unknown as NeuroNode['data'];
  const setFocusedDiagramId = useProjectStore((s) => s.setFocusedDiagramId);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  const mermaidCode =
    data?.mermaidCode || 'flowchart TD\n  Start([Start]) --> End([End])';
  const title = data?.title || data?.label || 'Sub-Diagram Flow';

  // Parse Mermaid code for preview metrics and mini-map layout
  const ast = useMemo(() => {
    try {
      return parseMermaid(mermaidCode);
    } catch {
      return {
        nodes: [],
        edges: [],
        direction: 'TB' as const,
        diagramType: 'flowchart' as const,
        subgraphs: [],
      };
    }
  }, [mermaidCode]);

  const nodeCount = ast.nodes.length;
  const edgeCount = ast.edges.length;

  const handleOpenFocus = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    updateNodeData(id, { isFocused: true, diagramMode: 'focused' });
    setFocusedDiagramId(id);
  };

  // Generate SVG mini-map elements
  const previewElements = useMemo(() => {
    const count = ast.nodes.length;
    if (count === 0) return null;

    const isHorizontal = ast.direction === 'LR' || ast.direction === 'RL';
    const stepX = isHorizontal ? 120 : 0;
    const stepY = isHorizontal ? 0 : 60;

    const nodePositions = new Map<string, { x: number; y: number }>();
    ast.nodes.forEach((n, idx) => {
      nodePositions.set(n.id, {
        x: 40 + (isHorizontal ? idx * stepX : 50),
        y: 40 + (isHorizontal ? 40 : idx * stepY),
      });
    });

    const svgWidth = isHorizontal ? Math.max(260, count * 130 + 40) : 220;
    const svgHeight = isHorizontal ? 140 : Math.max(160, count * 70 + 40);

    return {
      svgWidth,
      svgHeight,
      nodes: ast.nodes.map((node) => {
        const pos = nodePositions.get(node.id) || { x: 50, y: 50 };
        return {
          id: node.id,
          label: node.label,
          shape: node.shapeType,
          x: pos.x,
          y: pos.y,
        };
      }),
      edges: ast.edges.map((edge, idx) => {
        const src = nodePositions.get(edge.source) || { x: 40, y: 40 };
        const tgt = nodePositions.get(edge.target) || { x: 100, y: 100 };
        return {
          id: `${edge.source}-${edge.target}-${idx}`,
          src,
          tgt,
        };
      }),
    };
  }, [ast]);

  const W = width || 340;
  const H = height || 240;

  return (
    <div
      onDoubleClick={(e) => handleOpenFocus(e)}
      className={`group relative flex flex-col rounded-2xl bg-slate-900/90 border transition-all duration-200 select-none shadow-xl overflow-hidden backdrop-blur-md ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-indigo-500/20'
          : 'border-slate-800 hover:border-slate-700 hover:shadow-2xl'
      }`}
      style={{
        width: W,
        height: H,
      }}
    >
      {/* 4-Direction Macro Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />

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
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors cursor-pointer pointer-events-auto"
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
            className="w-full h-full"
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
            {previewElements.edges.map((e) => (
              <path
                key={e.id}
                d={`M ${e.src.x + 35} ${e.src.y + 14} Q ${(e.src.x + e.tgt.x) / 2 + 10} ${
                  (e.src.y + e.tgt.y) / 2
                } ${e.tgt.x - 5} ${e.tgt.y + 14}`}
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.5"
                strokeOpacity="0.7"
                markerEnd={`url(#arrow-${id})`}
              />
            ))}

            {/* Render Nodes */}
            {previewElements.nodes.map((n) => (
              <g key={n.id} transform={`translate(${n.x - 35}, ${n.y})`}>
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
          <div className="text-slate-500 text-xs flex flex-col items-center gap-1">
            <Layers className="w-5 h-5 opacity-40" />
            <span>Empty Sub-Diagram</span>
          </div>
        )}

        {/* Hover Cue Overlay */}
        <div
          onClick={handleOpenFocus}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
        >
          <span className="text-xs font-medium text-indigo-300 bg-slate-900/90 px-3 py-1.5 rounded-full border border-indigo-500/40 shadow-lg flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5" />
            Double-click to expand
          </span>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span className="font-mono">Dir: {ast.direction || 'TB'}</span>
        <span className="text-indigo-400/80 font-medium">Mermaid DSL</span>
      </div>
    </div>
  );
}

export default React.memo(DiagramNode);
