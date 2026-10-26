/**
 * Creative-Neuro Canvas Subsystem - Main Infinite Canvas Component
 * Path: src/components/canvas/Canvas.tsx
 *
 * Implements:
 * - React Flow v12 (@xyflow/react) provider & viewport shell
 * - Custom node types registration: ShapeNode, TextNode, FrameNode, DiagramNode
 * - Custom edge types registration: JumpConnectorEdge
 * - FreehandOverlay portaled inside ReactFlow + FocusDiagramModal overlay
 * - Dragging lifecycle & Zundo history suppression (isDragging flag)
 * - Automatic layoutMode transition ('auto-elk' -> 'manual') on user drag
 * - Dynamic FrameNode parenting & auto-expansion via calculateFrameAutoGrowth
 * - Click-to-create toolbar node spawning (shape, text, frame, diagram)
 */

import React, { useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  type EdgeTypes,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  useProjectStore,
  useActivePageNodes,
  useActivePageEdges,
} from '../../store/useProjectStore.ts';
import type { NeuroNode, NeuroEdge } from '../../types/index.ts';
import { calculateFrameAutoGrowth } from '../../engine/index.ts';

import ShapeNode from './nodes/ShapeNode.tsx';
import TextNode from './nodes/TextNode.tsx';
import FrameNode from './nodes/FrameNode.tsx';
import DiagramNode from './nodes/DiagramNode.tsx';
import JumpConnectorEdge from './edges/JumpConnectorEdge.tsx';
import FreehandOverlay from './freehand/FreehandOverlay.tsx';
import FocusDiagramModal from '../editor/FocusDiagramModal.tsx';

// Custom Node & Edge Types Registration
const nodeTypes: NodeTypes = {
  shape: ShapeNode,
  text: TextNode,
  frame: FrameNode,
  diagram: DiagramNode,
};

const edgeTypes: EdgeTypes = {
  jump: JumpConnectorEdge,
  default: JumpConnectorEdge,
};

export function CanvasContent() {
  const nodes = useActivePageNodes();
  const edges = useActivePageEdges();

  const {
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeData,
    addNode,
    toolMode,
    setToolMode,
    setSelectedNodes,
    setSelectedEdges,
  } = useProjectStore();

  const { screenToFlowPosition } = useReactFlow();

  // Dragging lifecycle & manual layoutMode conversion
  const handleNodeDragStart = useCallback(() => {
    useProjectStore.setState({ isDragging: true });
  }, []);

  const handleNodeDragStop = useCallback(
    (_event: unknown, _draggedNode: Node, allDraggedNodes: Node[]) => {
      useProjectStore.setState({ isDragging: false });

      useProjectStore.setState((state) => {
        const currentNodes = Object.values(state.nodes);

        for (const dn of allDraggedNodes) {
          const storeNode = state.nodes[dn.id];
          if (!storeNode) continue;

          // 1. Force layoutMode to manual on user drag
          if (storeNode.layoutMode === 'auto-elk') {
            storeNode.layoutMode = 'manual';
          }
          if (storeNode.data && storeNode.data.layoutMode === 'auto-elk') {
            storeNode.data.layoutMode = 'manual';
          }

          // 2. Frame container attachment check
          if (dn.type !== 'frame') {
            const frames = currentNodes.filter(
              (n) => n.type === 'frame' && n.id !== dn.id && !n.data?.collapsed
            );

            const nodePos = dn.position;
            const nodeW = dn.width ?? storeNode.width ?? 160;
            const nodeH = dn.height ?? storeNode.height ?? 60;
            const nodeCenter = {
              x: nodePos.x + nodeW / 2,
              y: nodePos.y + nodeH / 2,
            };

            let matchedFrame: NeuroNode | null = null;
            for (const frame of frames) {
              const fw = frame.width ?? 320;
              const fh = frame.height ?? 240;
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
              // Attach to frame
              storeNode.parentId = matchedFrame.id;
              // Auto expand frame if near border
              const children = currentNodes.filter(
                (n) => n.parentId === matchedFrame!.id
              );
              const newDims = calculateFrameAutoGrowth(
                matchedFrame,
                children,
                nodePos,
                { width: nodeW, height: nodeH },
                40
              );
              const targetFrame = state.nodes[matchedFrame.id];
              if (targetFrame) {
                targetFrame.width = newDims.width;
                targetFrame.height = newDims.height;
              }
            } else if (!matchedFrame && storeNode.parentId) {
              // Detached from frame
              delete storeNode.parentId;
              delete storeNode.extent;
            }
          }
        }
      });
    },
    []
  );

  // Canvas click-to-add for toolbar modes
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (toolMode === 'select' || toolMode === 'connect' || toolMode === 'draw') {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (toolMode === 'shape') {
        addNode({
          type: 'shape',
          position,
          width: 160,
          height: 60,
          layoutMode: 'manual',
          data: {
            label: 'New Node',
            layoutMode: 'manual',
            shapeType: 'rounded',
            backgroundColor: '#1e293b',
            borderColor: '#475569',
            color: '#f8fafc',
          },
        });
        setToolMode('select');
      } else if (toolMode === 'text') {
        addNode({
          type: 'text',
          position,
          width: 160,
          height: 40,
          layoutMode: 'manual',
          data: {
            label: 'Type text here...',
            layoutMode: 'manual',
            color: '#f8fafc',
            fontSize: 15,
          },
        });
        setToolMode('select');
      } else if (toolMode === 'frame') {
        addNode({
          type: 'frame',
          position,
          width: 360,
          height: 260,
          layoutMode: 'manual',
          data: {
            label: 'Container Frame',
            title: 'Container Frame',
            layoutMode: 'manual',
            collapsed: false,
          },
        });
        setToolMode('select');
      } else if (toolMode === 'diagram') {
        addNode({
          type: 'diagram',
          position,
          width: 340,
          height: 240,
          layoutMode: 'manual',
          data: {
            label: 'Sub-Diagram Flow',
            title: 'Sub-Diagram Flow',
            layoutMode: 'manual',
            diagramMode: 'embedded',
            diagramOrientation: 'TB',
            mermaidCode:
              'flowchart TD\n  Start([Start]) --> Process[Process Step]\n  Process --> End([End])',
          },
        });
        setToolMode('select');
      }
    },
    [toolMode, screenToFlowPosition, addNode, setToolMode]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      setSelectedNodes(selNodes.map((n) => n.id));
      setSelectedEdges(selEdges.map((e) => e.id));
    },
    [setSelectedNodes, setSelectedEdges]
  );

  // Filter out freehand stroke nodes from standard ReactFlow DOM nodes since FreehandOverlay renders them in ViewportPortal
  const reactFlowNodes = nodes.filter(
    (n) => n.type !== 'freehand'
  ) as unknown as Node[];
  const reactFlowEdges = edges as unknown as Edge[];

  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden select-none">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={
          onNodesChange as unknown as (changes: NodeChange[]) => void
        }
        onEdgesChange={
          onEdgesChange as unknown as (changes: EdgeChange[]) => void
        }
        onConnect={onConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        snapToGrid={true}
        snapGrid={[16, 16]}
        minZoom={0.1}
        maxZoom={2.5}
        panOnDrag={toolMode === 'select' ? [1, 2] : false}
        zoomOnScroll={true}
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        className="text-slate-100"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1.2}
          color="#334155"
        />
        <Controls
          showInteractive={false}
          className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 fill-slate-300 [&>button]:border-slate-800 [&>button]:bg-slate-900 [&>button:hover]:bg-slate-800"
        />
        <FreehandOverlay />
      </ReactFlow>

      {/* Focused Sub-Diagram Modal Overlay (State B) */}
      <FocusDiagramModal />
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
}

export default Canvas;
