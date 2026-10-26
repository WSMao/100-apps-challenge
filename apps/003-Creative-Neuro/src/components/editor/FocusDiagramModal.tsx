/**
 * Creative-Neuro Editor Subsystem - FocusDiagramModal (State B: Focused Workspace)
 * Path: src/components/editor/FocusDiagramModal.tsx
 *
 * Implements:
 * - State B Focused Fullscreen / Modal Workspace when focusedDiagramId !== null
 * - Split-screen CodeMirror 6 MermaidEditor on left + independent @xyflow/react sub-canvas on right
 * - 300ms debounced bidirectional synchronization (reconcileMermaidAST & serializeMermaid)
 * - Global Escape key listener & Done button flushing changes back to parent DiagramNode
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Check,
  Code2,
  Workflow,
  AlertCircle,
} from 'lucide-react';

import { useProjectStore } from '../../store/useProjectStore.ts';
import {
  parseMermaid,
  reconcileMermaidAST,
  serializeMermaid,
} from '../../engine/index.ts';
import type { NeuroNode, NeuroEdge, FlowDirection } from '../../types/index.ts';
import { MermaidEditor } from './MermaidEditor.tsx';
import ShapeNode from '../canvas/nodes/ShapeNode.tsx';
import TextNode from '../canvas/nodes/TextNode.tsx';
import FrameNode from '../canvas/nodes/FrameNode.tsx';
import JumpConnectorEdge from '../canvas/edges/JumpConnectorEdge.tsx';

const subNodeTypes: NodeTypes = {
  shape: ShapeNode,
  text: TextNode,
  frame: FrameNode,
};

const subEdgeTypes: EdgeTypes = {
  jump: JumpConnectorEdge,
  default: JumpConnectorEdge,
};

export function FocusDiagramModal() {
  const focusedDiagramId = useProjectStore((s) => s.focusedDiagramId);
  const setFocusedDiagramId = useProjectStore((s) => s.setFocusedDiagramId);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const parentNode = useProjectStore((s) =>
    focusedDiagramId ? s.nodes[focusedDiagramId] : undefined
  );

  const initialCode =
    parentNode?.data?.mermaidCode ||
    'flowchart TD\n  Start([Start]) --> End([End])';
  const initialTitle =
    parentNode?.data?.title || parentNode?.data?.label || 'Sub-Diagram';

  const [code, setCode] = useState<string>(initialCode);
  const [title, setTitle] = useState<string>(initialTitle);
  const [direction, setDirection] = useState<FlowDirection>(
    (parentNode?.data?.diagramOrientation as FlowDirection) || 'TB'
  );
  const [nodes, setNodes] = useState<NeuroNode[]>([]);
  const [edges, setEdges] = useState<NeuroEdge[]>([]);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);

  // Initialize modal state whenever focusedDiagramId transitions to a valid diagram node
  useEffect(() => {
    if (!focusedDiagramId || !parentNode) return;

    const mermaid =
      parentNode.data?.mermaidCode ||
      'flowchart TD\n  Start([Start]) --> End([End])';
    const nodeTitle =
      parentNode.data?.title || parentNode.data?.label || 'Sub-Diagram';
    const orient =
      (parentNode.data?.diagramOrientation as FlowDirection) || 'TB';

    setCode(mermaid);
    setTitle(nodeTitle);
    setDirection(orient);
    setSyntaxError(null);

    const savedSubNodes = parentNode.data?.customData?.subNodes as
      | NeuroNode[]
      | undefined;
    const savedSubEdges = parentNode.data?.customData?.subEdges as
      | NeuroEdge[]
      | undefined;

    try {
      const ast = parseMermaid(mermaid);
      const reconciled = reconcileMermaidAST(ast, savedSubNodes || []);
      setNodes(reconciled.nodes);
      setEdges(
        savedSubEdges && savedSubEdges.length > 0
          ? savedSubEdges
          : reconciled.edges
      );
    } catch {
      setNodes(savedSubNodes || []);
      setEdges(savedSubEdges || []);
    }
  }, [focusedDiagramId, parentNode]);

  // Close & Sync Back to Parent Node
  const handleClose = useCallback(() => {
    if (!focusedDiagramId) return;
    updateNodeData(focusedDiagramId, {
      title,
      label: title,
      mermaidCode: code,
      isFocused: false,
      diagramMode: 'embedded',
      diagramOrientation: direction,
      customData: {
        ...parentNode?.data?.customData,
        subNodes: nodes,
        subEdges: edges,
      },
    });
    setFocusedDiagramId(null);
  }, [
    focusedDiagramId,
    title,
    code,
    direction,
    nodes,
    edges,
    parentNode?.data?.customData,
    updateNodeData,
    setFocusedDiagramId,
  ]);

  // Global Escape Key Listener
  useEffect(() => {
    if (!focusedDiagramId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedDiagramId, handleClose]);

  // CodeMirror -> Sub-Canvas Sync
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      try {
        const ast = parseMermaid(newCode);
        setSyntaxError(null);
        if (ast.direction) setDirection(ast.direction);

        const result = reconcileMermaidAST(ast, nodes);
        setNodes(result.nodes);
        setEdges(result.edges);
      } catch (err: unknown) {
        setSyntaxError(
          err instanceof Error ? err.message : 'Invalid Mermaid syntax'
        );
      }
    },
    [nodes]
  );

  // Sub-Canvas visual changes -> CodeMirror Sync
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(
          changes,
          nds as unknown as Node[]
        ) as unknown as NeuroNode[];
        for (const change of changes) {
          if (change.type === 'position' && change.position) {
            const target = updated.find((n) => n.id === change.id);
            if (target) {
              target.layoutMode = 'manual';
              if (target.data) target.data.layoutMode = 'manual';
            }
          }
        }
        return updated;
      });
    },
    []
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) =>
      applyEdgeChanges(
        changes,
        eds as unknown as Edge[]
      ) as unknown as NeuroEdge[]
    );
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      const newEdge: NeuroEdge = {
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || undefined,
        targetHandle: params.targetHandle || undefined,
        type: 'jump',
      };
      const nextEdges = [...edges, newEdge];
      setEdges(nextEdges);

      const nextMermaid = serializeMermaid(nodes, nextEdges, direction);
      setCode(nextMermaid);
    },
    [edges, nodes, direction]
  );

  if (!focusedDiagramId || !parentNode) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-slate-100 backdrop-blur-xl">
      {/* Top Header Bar */}
      <header className="h-14 px-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Canvas</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-indigo-400" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent font-semibold text-sm text-white border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-0.5"
              placeholder="Diagram Title"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {syntaxError ? (
            <span className="flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Syntax Error</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
              <Check className="w-3.5 h-3.5" />
              <span>Synced ({nodes.length} nodes)</span>
            </span>
          )}

          <select
            value={direction}
            onChange={(e) => {
              const newDir = e.target.value as FlowDirection;
              setDirection(newDir);
              const serialized = serializeMermaid(nodes, edges, newDir);
              setCode(serialized);
            }}
            className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
          >
            <option value="TB">TB (Top to Bottom)</option>
            <option value="LR">LR (Left to Right)</option>
            <option value="BT">BT (Bottom to Top)</option>
            <option value="RL">RL (Right to Left)</option>
          </select>

          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done (Esc)</span>
          </button>
        </div>
      </header>

      {/* Main Split Content Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: CodeMirror 6 Mermaid Editor */}
        <div className="w-[420px] lg:w-[480px] border-r border-slate-800 flex flex-col bg-slate-900/50 shrink-0">
          <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mermaid Source Code</span>
            </span>
            <span className="text-[11px] text-slate-500">Auto-syncs 300ms</span>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <MermaidEditor
              value={code}
              onChange={handleCodeChange}
              error={syntaxError}
            />
          </div>
        </div>

        {/* Right Side: Dedicated Sub-Canvas */}
        <div className="flex-1 relative bg-slate-950">
          <ReactFlow
            nodes={nodes as unknown as Node[]}
            edges={edges as unknown as Edge[]}
            nodeTypes={subNodeTypes}
            edgeTypes={subEdgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
            className="w-full h-full"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="#334155"
            />
            <Controls className="!bg-slate-900 !border-slate-800 !text-slate-200" />
          </ReactFlow>

          {/* Sub-canvas Quick Hint Overlay */}
          <div className="absolute bottom-4 left-4 pointer-events-none text-xs text-slate-500 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800 backdrop-blur">
            Drag sub-nodes to arrange, or edit Mermaid syntax on left
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(FocusDiagramModal);
