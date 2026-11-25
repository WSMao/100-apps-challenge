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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
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
  type ReactFlowInstance,
  BackgroundVariant,
  SelectionMode,
  PanOnScrollMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Check,
  Code2,
  Workflow,
  AlertCircle,
  Network,
  Plus,
  Unlink,
  ArrowLeftRight,
} from 'lucide-react';

import { useProjectStore } from '../../store/useProjectStore.ts';
import {
  DiagramPipeline,
  applyEdgeRouting,
  calculateElkLayoutSync,
  calculateMindMapLayout,
  attachMindMapNode,
  detachMindMapNode,
  swapMindMapNodes,
  findAttachTargetNode,
  serializeMindMapMermaid,
  resolveMindMapRootId,
} from '../../engine/index.ts';
import type {
  NeuroNode,
  NeuroEdge,
  FlowDirection,
  MindMapDirection,
  EdgeRoutingType,
  ElkSpacingPreset,
} from '../../types/index.ts';
import { MermaidEditor } from './MermaidEditor.tsx';
import ShapeNode from '../canvas/nodes/ShapeNode.tsx';
import TextNode from '../canvas/nodes/TextNode.tsx';
import FrameNode from '../canvas/nodes/FrameNode.tsx';
import JumpConnectorEdge from '../canvas/edges/JumpConnectorEdge.tsx';

export type { ElkSpacingPreset };

export const SPACING_PRESETS: Record<
  ElkSpacingPreset,
  { nodeSpacing: number; layerSpacing: number; label: string }
> = {
  compact: { nodeSpacing: 36, layerSpacing: 60, label: 'Compact (36 / 60)' },
  normal: { nodeSpacing: 50, layerSpacing: 80, label: 'Normal (50 / 80)' },
  spacious: { nodeSpacing: 80, layerSpacing: 130, label: 'Spacious (80 / 130)' },
};

const subNodeTypes: NodeTypes = {
  shape: ShapeNode,
  text: TextNode,
  frame: FrameNode,
};

const subEdgeTypes: EdgeTypes = {
  jump: JumpConnectorEdge,
  smoothstep: JumpConnectorEdge,
  bezier: JumpConnectorEdge,
  straight: JumpConnectorEdge,
  default: JumpConnectorEdge,
};

// Stable React Flow Sub-Canvas configuration matching main Canvas (OP-01, OP-02, OP-03)
const SNAP_GRID: [number, number] = [16, 16];
const PAN_ON_DRAG = [2]; // Right-click drag pans canvas
const MULTI_SELECTION_KEY_CODE = ['Meta', 'Control'];
const ZOOM_ACTIVATION_KEY_CODE = ['Meta', 'Control'];
const FIT_VIEW_OPTIONS = { padding: 0.2 };
const PRO_OPTIONS = { hideAttribution: true };

export interface ConnectDiagramEdgeParams {
  nodes: NeuroNode[];
  edges: NeuroEdge[];
  connection: Connection;
  isMindMapMode: boolean;
  continuousLayout: boolean;
  direction: FlowDirection;
  mindMapDirection: MindMapDirection;
  spacingPreset: ElkSpacingPreset;
  edgeRouting: EdgeRoutingType;
  lineJump: boolean;
}

export function connectDiagramEdge({
  nodes,
  edges,
  connection,
  isMindMapMode,
  continuousLayout,
  direction,
  mindMapDirection,
  spacingPreset,
  edgeRouting,
  lineJump,
}: ConnectDiagramEdgeParams): { nodes: NeuroNode[]; edges: NeuroEdge[]; code: string } {
  const newEdge: NeuroEdge = {
    id: `e-${connection.source}-${connection.target}-${Date.now()}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    type: edgeRouting,
    data: {
      routingType: edgeRouting,
      jumpArc: lineJump,
    },
  };
  const nextEdges = [...edges, newEdge];

  if (isMindMapMode) {
    const rootId = resolveMindMapRootId(nodes, nextEdges);
    if (continuousLayout) {
      const spacingCfg = SPACING_PRESETS[spacingPreset] || SPACING_PRESETS.normal;
      const res = calculateMindMapLayout(nodes, nextEdges, {
        rootId: rootId || undefined,
        direction: mindMapDirection,
        nodeSpacing: spacingCfg.nodeSpacing,
        layerSpacing: spacingCfg.layerSpacing,
      });
      const routed = applyEdgeRouting(res.edges, edgeRouting || 'bezier', false, lineJump);
      return {
        nodes: res.nodes,
        edges: routed,
        code: serializeMindMapMermaid(res.nodes, routed, res.rootId || undefined),
      };
    }
    return {
      nodes,
      edges: nextEdges,
      code: serializeMindMapMermaid(nodes, nextEdges, rootId || undefined),
    };
  }

  return {
    nodes,
    edges: nextEdges,
    code: DiagramPipeline.serialize(nodes, nextEdges, direction),
  };
}

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
  const isMindMapMode = Boolean(
    parentNode?.data?.diagramKind === 'mindmap' ||
      initialCode.trimStart().startsWith('mindmap')
  );

  const [code, setCode] = useState<string>(initialCode);
  const [title, setTitle] = useState<string>(initialTitle);
  const [direction, setDirection] = useState<FlowDirection>(
    (parentNode?.data?.diagramOrientation as FlowDirection) || 'TB'
  );
  const [mindMapDirection, setMindMapDirection] = useState<MindMapDirection>(
    (parentNode?.data?.mindMapDirection as MindMapDirection) || 'radial'
  );
  const [showMermaidEditor, setShowMermaidEditor] = useState<boolean>(!isMindMapMode);
  const [attachPreview, setAttachPreview] = useState<{
    childId: string;
    targetId: string;
  } | null>(null);
  const lastSubPaneClickRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const [edgeRouting, setEdgeRouting] = useState<EdgeRoutingType>(() => {
    const saved = parentNode?.data?.customData?.edgeRouting as string | undefined;
    if (saved === 'jump') return 'straight';
    return (saved as EdgeRoutingType) || 'smoothstep';
  });
  const [lineJump, setLineJump] = useState<boolean>(
    () =>
      parentNode?.data?.lineJump ??
      (parentNode?.data?.customData?.lineJump as boolean | undefined) ??
      true
  );
  const [spacingPreset, setSpacingPreset] = useState<ElkSpacingPreset>(
    (parentNode?.data?.customData?.spacingPreset as ElkSpacingPreset) || 'normal'
  );
  const [continuousLayout, setContinuousLayout] = useState<boolean>(
    Boolean(parentNode?.data?.continuousLayout)
  );
  const [nodes, setNodes] = useState<NeuroNode[]>([]);
  const [edges, setEdges] = useState<NeuroEdge[]>([]);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const applyRoutingToEdges = useCallback(
    (
      edgeList: NeuroEdge[],
      routing: EdgeRoutingType,
      forceOverwrite = false,
      jumpEnabled?: boolean
    ): NeuroEdge[] => applyEdgeRouting(edgeList, routing, forceOverwrite, jumpEnabled),
    []
  );

  const scheduleFitView = useCallback(() => {
    setTimeout(() => {
      rfInstanceRef.current?.fitView({ padding: 0.08, duration: 150 });
    }, 60);
  }, []);

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
    const rawRouting = parentNode.data?.customData?.edgeRouting as string | undefined;
    const savedRouting: EdgeRoutingType =
      rawRouting === 'jump' ? 'straight' : ((rawRouting as EdgeRoutingType) || 'smoothstep');
    const savedLineJump =
      parentNode.data?.lineJump ??
      (parentNode.data?.customData?.lineJump as boolean | undefined) ??
      true;
    setLineJump(savedLineJump);
    const savedSpacing =
      (parentNode.data?.customData?.spacingPreset as ElkSpacingPreset) || 'normal';

    setCode(mermaid);
    setTitle(nodeTitle);
    setDirection(orient);
    setMindMapDirection((parentNode.data?.mindMapDirection as MindMapDirection) || 'radial');
    setShowMermaidEditor(
      !(parentNode.data?.diagramKind === 'mindmap' || mermaid.trimStart().startsWith('mindmap'))
    );
    setAttachPreview(null);
    setEdgeRouting(savedRouting);
    setSpacingPreset(savedSpacing);
    setContinuousLayout(Boolean(parentNode.data?.continuousLayout));
    setSyntaxError(null);

    const savedSubNodes = parentNode.data?.customData?.subNodes as
      | NeuroNode[]
      | undefined;
    const savedSubEdges = parentNode.data?.customData?.subEdges as
      | NeuroEdge[]
      | undefined;

    try {
      const mindMapFlag =
        parentNode.data?.diagramKind === 'mindmap' || mermaid.trimStart().startsWith('mindmap');
      const compiled = DiagramPipeline.compile({
        mermaidCode: mermaid,
        savedSubNodes,
        savedSubEdges,
        direction: orient,
        diagramKind: mindMapFlag ? 'mindmap' : 'flowchart',
        mindMapDirection: (parentNode.data?.mindMapDirection as MindMapDirection) || 'radial',
        continuousLayout: Boolean(parentNode.data?.continuousLayout),
        spacingPreset: savedSpacing,
        edgeRouting: savedRouting,
      });
      setDirection(compiled.direction);
      setNodes(compiled.nodes);
      setEdges(compiled.edges);
      scheduleFitView();
    } catch {
      setNodes(savedSubNodes || []);
      setEdges(savedSubEdges || []);
    }
  }, [focusedDiagramId, parentNode, scheduleFitView]);

  // Close & Sync Back to Parent Node
  const handleClose = useCallback(() => {
    if (!focusedDiagramId) return;
    updateNodeData(focusedDiagramId, {
      title,
      label: title,
      mermaidCode: code,
      isFocused: false,
      diagramMode: 'embedded',
      diagramKind: isMindMapMode ? 'mindmap' : 'flowchart',
      mindMapDirection,
      diagramOrientation: direction,
      continuousLayout,
      lineJump,
      customData: {
        ...parentNode?.data?.customData,
        subNodes: nodes,
        subEdges: edges,
        edgeRouting,
        lineJump,
        spacingPreset,
      },
    });
    setFocusedDiagramId(null);
  }, [
    focusedDiagramId,
    title,
    code,
    direction,
    edgeRouting,
    lineJump,
    spacingPreset,
    nodes,
    edges,
    continuousLayout,
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

  // CodeMirror -> Sub-Canvas Sync with ELK or MindMap Auto-Layout
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      const compiled = DiagramPipeline.compile({
        mermaidCode: newCode,
        savedSubNodes: isMindMapMode ? undefined : nodes,
        direction,
        diagramKind: isMindMapMode ? 'mindmap' : 'flowchart',
        mindMapDirection,
        continuousLayout,
        spacingPreset,
        edgeRouting,
      });

      if (compiled.syntaxError) {
        setSyntaxError(compiled.syntaxError);
      } else {
        setSyntaxError(null);
        if (compiled.ast.direction) setDirection(compiled.ast.direction);
        setNodes(compiled.nodes);
        setEdges(compiled.edges);
        scheduleFitView();
      }
    },
    [nodes, direction, isMindMapMode, mindMapDirection, continuousLayout, spacingPreset, edgeRouting, scheduleFitView]
  );

  // Sub-Canvas visual changes -> enforce lock guard & optional Continuous Auto Layout
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let shouldReLayout = false;
      setNodes((nds) => {
        const filteredChanges = changes.filter((change) => {
          if (change.type === 'position') {
            const existing = nds.find((n) => n.id === change.id);
            if (existing && (existing.locked || existing.data?.locked)) {
              return false;
            }
            if (continuousLayout && change.dragging === false) {
              shouldReLayout = true;
            }
          }
          return true;
        });

        const updated = applyNodeChanges(
          filteredChanges,
          nds as unknown as Node[]
        ) as unknown as NeuroNode[];

        if (shouldReLayout && !isMindMapMode) {
          const spacingCfg = SPACING_PRESETS[spacingPreset] || SPACING_PRESETS.normal;
          const layoutResult = calculateElkLayoutSync(updated, edges, {
            direction,
            nodeSpacing: spacingCfg.nodeSpacing,
            layerSpacing: spacingCfg.layerSpacing,
          });
          setEdges(applyRoutingToEdges(layoutResult.edges, edgeRouting));
          return layoutResult.nodes;
        }
        return updated;
      });
    },
    [continuousLayout, isMindMapMode, spacingPreset, edges, direction, edgeRouting, applyRoutingToEdges]
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) =>
      applyEdgeChanges(
        changes,
        eds as unknown as Edge[]
      ) as unknown as NeuroEdge[]
    );
  }, []);

  // Direction change with ELK Re-Layout
  const handleDirectionChange = useCallback(
    (newDir: FlowDirection) => {
      setDirection(newDir);
      const spacingCfg = SPACING_PRESETS[spacingPreset] || SPACING_PRESETS.normal;
      const layoutResult = calculateElkLayoutSync(nodes, edges, {
        direction: newDir,
        nodeSpacing: spacingCfg.nodeSpacing,
        layerSpacing: spacingCfg.layerSpacing,
      });
      setNodes(layoutResult.nodes);
      const routedEdges = applyRoutingToEdges(layoutResult.edges, edgeRouting);
      setEdges(routedEdges);
      const serialized = DiagramPipeline.serialize(layoutResult.nodes, routedEdges, newDir);
      setCode(serialized);
      scheduleFitView();
    },
    [nodes, edges, spacingPreset, edgeRouting, applyRoutingToEdges, scheduleFitView]
  );

  // Edge Routing Type Change (Smoothstep / Bezier / Straight)
  const handleEdgeRoutingChange = useCallback(
    (newRouting: EdgeRoutingType) => {
      setEdgeRouting(newRouting);
      setEdges((eds) => applyRoutingToEdges(eds, newRouting, true, lineJump));
    },
    [applyRoutingToEdges, lineJump]
  );

  // Diagram-level Line Jump Toggle
  const handleLineJumpToggle = useCallback(() => {
    const next = !lineJump;
    setLineJump(next);
    setEdges((eds) => applyRoutingToEdges(eds, edgeRouting, false, next));
    if (focusedDiagramId) {
      updateNodeData(focusedDiagramId, {
        lineJump: next,
        customData: {
          ...parentNode?.data?.customData,
          lineJump: next,
        },
      });
    }
  }, [lineJump, edgeRouting, applyRoutingToEdges, focusedDiagramId, updateNodeData, parentNode?.data?.customData]);

  // ELK Spacing Preset Change (Compact / Normal / Spacious)
  const handleSpacingChange = useCallback(
    (newPreset: ElkSpacingPreset) => {
      setSpacingPreset(newPreset);
      const spacingCfg = SPACING_PRESETS[newPreset] || SPACING_PRESETS.normal;
      const layoutResult = calculateElkLayoutSync(nodes, edges, {
        direction,
        nodeSpacing: spacingCfg.nodeSpacing,
        layerSpacing: spacingCfg.layerSpacing,
      });
      setNodes(layoutResult.nodes);
      setEdges(applyRoutingToEdges(layoutResult.edges, edgeRouting));
      scheduleFitView();
    },
    [nodes, edges, direction, edgeRouting, applyRoutingToEdges, scheduleFitView]
  );

  // One-shot Trigger: Auto-Layout with ELK or MindMap Engine (skips locked nodes)
  const handleAutoLayout = useCallback(() => {
    const spacingCfg = SPACING_PRESETS[spacingPreset] || SPACING_PRESETS.normal;
    if (isMindMapMode) {
      const res = calculateMindMapLayout(nodes, edges, {
        direction: mindMapDirection,
        nodeSpacing: spacingCfg.nodeSpacing,
        layerSpacing: spacingCfg.layerSpacing,
      });
      setNodes(res.nodes);
      const routed = applyRoutingToEdges(res.edges, edgeRouting || 'bezier');
      setEdges(routed);
      setCode(serializeMindMapMermaid(res.nodes, routed, res.rootId || undefined));
      scheduleFitView();
      return;
    }
    const layoutResult = calculateElkLayoutSync(nodes, edges, {
      direction,
      nodeSpacing: spacingCfg.nodeSpacing,
      layerSpacing: spacingCfg.layerSpacing,
    });
    setNodes(layoutResult.nodes);
    setEdges(applyRoutingToEdges(layoutResult.edges, edgeRouting));
    scheduleFitView();
  }, [nodes, edges, direction, isMindMapMode, mindMapDirection, spacingPreset, edgeRouting, applyRoutingToEdges, scheduleFitView]);

  const handleMindMapDirectionChange = useCallback(
    (newDir: MindMapDirection) => {
      setMindMapDirection(newDir);
      const spacingCfg = SPACING_PRESETS[spacingPreset] || SPACING_PRESETS.normal;
      const res = calculateMindMapLayout(nodes, edges, {
        direction: newDir,
        nodeSpacing: spacingCfg.nodeSpacing,
        layerSpacing: spacingCfg.layerSpacing,
      });
      setNodes(res.nodes);
      const routed = applyRoutingToEdges(res.edges, edgeRouting || 'bezier');
      setEdges(routed);
      setCode(serializeMindMapMermaid(res.nodes, routed, res.rootId || undefined));
      scheduleFitView();
    },
    [nodes, edges, spacingPreset, edgeRouting, applyRoutingToEdges, scheduleFitView]
  );

  const selectedSubNodes = nodes.filter((n) => n.selected);

  const addMindMapNode = useCallback(
    (kind: 'child' | 'sibling') => {
      if (!isMindMapMode) return;
      const rootId = resolveMindMapRootId(nodes, edges);
      const anchor = selectedSubNodes[0] || nodes.find((n) => n.id === rootId) || nodes[0];
      if (!anchor) return;

      let parentId = anchor.id;
      if (kind === 'sibling' && anchor.id !== rootId) {
        const parentEdge = edges.find((e) => e.target === anchor.id);
        if (parentEdge) parentId = parentEdge.source;
      }

      const newId = `mm_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newNode: NeuroNode = {
        id: newId,
        type: 'shape',
        position: { x: anchor.position.x + 180, y: anchor.position.y + 40 },
        width: 140,
        height: 48,
        locked: false,
        selected: true,
        data: {
          label: kind === 'child' ? 'New Topic' : 'Sibling Topic',
          shapeType: 'rounded',
          locked: false,
        },
      };
      const newEdge: NeuroEdge = {
        id: `e-${parentId}-${newId}`,
        source: parentId,
        target: newId,
        type: 'bezier',
        data: { routingType: 'bezier' },
      };

      const baseNodes: NeuroNode[] = [...nodes.map((n) => ({ ...n, selected: false })), newNode];
      const baseEdges = [...edges, newEdge];

      if (continuousLayout) {
        const spacingCfg = SPACING_PRESETS[spacingPreset] || SPACING_PRESETS.normal;
        const res = calculateMindMapLayout(baseNodes, baseEdges, {
          rootId: rootId || undefined,
          direction: mindMapDirection,
          nodeSpacing: spacingCfg.nodeSpacing,
          layerSpacing: spacingCfg.layerSpacing,
        });
        setNodes(res.nodes);
        const routed = applyRoutingToEdges(res.edges, edgeRouting || 'bezier');
        setEdges(routed);
        setCode(serializeMindMapMermaid(res.nodes, routed, res.rootId || undefined));
      } else {
        setNodes(baseNodes);
        setEdges(baseEdges);
        setCode(serializeMindMapMermaid(baseNodes, baseEdges, rootId || undefined));
      }
    },
    [isMindMapMode, nodes, edges, selectedSubNodes, continuousLayout, spacingPreset, mindMapDirection, edgeRouting, applyRoutingToEdges]
  );

  const handleDetachSelected = useCallback(() => {
    if (!isMindMapMode || selectedSubNodes.length === 0) return;
    const rootId = resolveMindMapRootId(nodes, edges);
    let nextEdges = edges;
    for (const sel of selectedSubNodes) {
      nextEdges = detachMindMapNode(nextEdges, sel.id, rootId);
    }
    setEdges(nextEdges);
    setCode(serializeMindMapMermaid(nodes, nextEdges, rootId || undefined));
  }, [isMindMapMode, selectedSubNodes, nodes, edges]);

  const handleSwapSelected = useCallback(() => {
    if (!isMindMapMode || selectedSubNodes.length !== 2) return;
    const rootId = resolveMindMapRootId(nodes, edges);
    const swapped = swapMindMapNodes(
      nodes,
      edges,
      selectedSubNodes[0].id,
      selectedSubNodes[1].id,
      {
        rootId: rootId || undefined,
        direction: mindMapDirection,
        autoLayout: continuousLayout,
      }
    );
    setNodes(swapped.nodes);
    setEdges(swapped.edges);
    setCode(serializeMindMapMermaid(swapped.nodes, swapped.edges, rootId || undefined));
  }, [isMindMapMode, selectedSubNodes, nodes, edges, mindMapDirection, continuousLayout]);

  const handleSubNodeDrag = useCallback(
    (_event: React.MouseEvent | MouseEvent | TouchEvent, draggedNode: Node) => {
      if (!isMindMapMode) return;
      const rootId = resolveMindMapRootId(nodes, edges);
      const hasParent = edges.some((e) => e.target === draggedNode.id);
      if (hasParent || draggedNode.id === rootId) {
        if (attachPreview) setAttachPreview(null);
        return;
      }
      const updatedNodes = nodes.map((n) =>
        n.id === draggedNode.id ? { ...n, position: draggedNode.position } : n
      );
      const target = findAttachTargetNode(updatedNodes, edges, draggedNode.id, rootId || undefined, 48);
      if (target) {
        setAttachPreview({ childId: draggedNode.id, targetId: target.id });
      } else if (attachPreview) {
        setAttachPreview(null);
      }
    },
    [isMindMapMode, nodes, edges, attachPreview]
  );

  const handleSubNodeDragStop = useCallback(
    (_event: React.MouseEvent | MouseEvent | TouchEvent, draggedNode: Node) => {
      if (!isMindMapMode) return;
      const rootId = resolveMindMapRootId(nodes, edges);
      const updatedNodes = nodes.map((n) =>
        n.id === draggedNode.id ? { ...n, position: draggedNode.position } : n
      );

      if (attachPreview && attachPreview.childId === draggedNode.id) {
        const attached = attachMindMapNode(
          updatedNodes,
          edges,
          attachPreview.childId,
          attachPreview.targetId,
          {
            rootId: rootId || undefined,
            direction: mindMapDirection,
            autoLayout: continuousLayout,
          }
        );
        setAttachPreview(null);
        setNodes(attached.nodes);
        const routed = applyRoutingToEdges(attached.edges, edgeRouting || 'bezier');
        setEdges(routed);
        setCode(serializeMindMapMermaid(attached.nodes, routed, rootId || undefined));
        return;
      }

      setAttachPreview(null);
      if (continuousLayout) {
        const spacingCfg = SPACING_PRESETS[spacingPreset] || SPACING_PRESETS.normal;
        const res = calculateMindMapLayout(updatedNodes, edges, {
          rootId: rootId || undefined,
          direction: mindMapDirection,
          nodeSpacing: spacingCfg.nodeSpacing,
          layerSpacing: spacingCfg.layerSpacing,
        });
        setNodes(res.nodes);
        const routed = applyRoutingToEdges(res.edges, edgeRouting || 'bezier');
        setEdges(routed);
      }
    },
    [isMindMapMode, nodes, edges, attachPreview, mindMapDirection, continuousLayout, spacingPreset, edgeRouting, applyRoutingToEdges]
  );

  const handleSubPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isMindMapMode) return;
      const now = Date.now();
      const prev = lastSubPaneClickRef.current;
      if (
        prev &&
        now - prev.time < 380 &&
        Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 12
      ) {
        lastSubPaneClickRef.current = null;
        const flowPos = rfInstanceRef.current?.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }) || { x: 100, y: 100 };

        const floatId = `mm_float_${Date.now()}`;
        const floatNode: NeuroNode = {
          id: floatId,
          type: 'shape',
          position: flowPos,
          width: 140,
          height: 48,
          locked: false,
          selected: true,
          data: {
            label: 'Floating Idea',
            shapeType: 'rounded',
            locked: false,
          },
        };
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), floatNode]);
        return;
      }
      lastSubPaneClickRef.current = { time: now, x: event.clientX, y: event.clientY };
    },
    [isMindMapMode]
  );

  const handleToggleContinuous = useCallback(
    (checked: boolean) => {
      setContinuousLayout(checked);
      if (checked) {
        handleAutoLayout();
      }
    },
    [handleAutoLayout]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      const result = connectDiagramEdge({
        nodes,
        edges,
        connection: params,
        isMindMapMode,
        continuousLayout,
        direction,
        mindMapDirection,
        spacingPreset,
        edgeRouting,
        lineJump,
      });
      if (result.nodes !== nodes) {
        setNodes(result.nodes);
      }
      setEdges(result.edges);
      setCode(result.code);
    },
    [edges, nodes, isMindMapMode, continuousLayout, direction, mindMapDirection, spacingPreset, edgeRouting, lineJump]
  );

  useEffect(() => {
    if (!focusedDiagramId || !isMindMapMode) return;
    const onMindMapKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.cm-editor'))
      ) {
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        addMindMapNode('child');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        addMindMapNode('sibling');
      }
    };
    window.addEventListener('keydown', onMindMapKeyDown);
    return () => window.removeEventListener('keydown', onMindMapKeyDown);
  }, [focusedDiagramId, isMindMapMode, addMindMapNode]);

  if (!focusedDiagramId || !parentNode) return null;

  const renderedEdges: Edge[] = (
    attachPreview
      ? [
          ...edges,
          {
            id: 'preview-attach-edge',
            source: attachPreview.targetId,
            target: attachPreview.childId,
            type: 'bezier',
            animated: true,
            style: { stroke: '#34d399', strokeWidth: 2, strokeDasharray: '6 4' },
            data: { routingType: 'bezier' },
          },
        ]
      : edges
  ) as unknown as Edge[];

  return (
    <div
      data-testid="focus-diagram-modal"
      className="fixed inset-0 z-[1000000] flex flex-col bg-slate-950/95 text-slate-100 backdrop-blur-xl"
    >
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
            {isMindMapMode ? (
              <Network className="w-4 h-4 text-emerald-400" />
            ) : (
              <Workflow className="w-4 h-4 text-indigo-400" />
            )}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent font-semibold text-sm text-white border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-0.5"
              placeholder="Diagram Title"
            />
            {isMindMapMode && (
              <span
                data-testid="focus-mindmap-badge"
                className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              >
                MindMap Mode
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isMindMapMode && (
            <div className="flex items-center gap-1.5 mr-1">
              <button
                type="button"
                data-testid="mindmap-add-child"
                onClick={() => addMindMapNode('child')}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-pointer"
                title="Add Child Topic (Tab)"
              >
                <Plus className="w-3 h-3" />
                <span>Child</span>
              </button>
              <button
                type="button"
                data-testid="mindmap-add-sibling"
                onClick={() => addMindMapNode('sibling')}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                title="Add Sibling Topic (Enter)"
              >
                <Plus className="w-3 h-3" />
                <span>Sibling</span>
              </button>
              {selectedSubNodes.length >= 1 && (
                <button
                  type="button"
                  data-testid="mindmap-detach"
                  onClick={handleDetachSelected}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 cursor-pointer"
                  title="Detach selected node into Floating"
                >
                  <Unlink className="w-3 h-3" />
                  <span>Detach</span>
                </button>
              )}
              {selectedSubNodes.length === 2 && (
                <button
                  type="button"
                  data-testid="mindmap-swap"
                  onClick={handleSwapSelected}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 cursor-pointer"
                  title="Swap two selected nodes"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Swap</span>
                </button>
              )}
              <button
                type="button"
                data-testid="mindmap-toggle-mermaid"
                onClick={() => setShowMermaidEditor((v) => !v)}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${
                  showMermaidEditor
                    ? 'bg-indigo-600/25 text-indigo-200 border-indigo-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
                title="Toggle optional Mermaid syntax sync panel"
              >
                <Code2 className="w-3 h-3" />
                <span>Mermaid</span>
              </button>
            </div>
          )}
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

          {/* Edge Routing Type Selector (Smoothstep / Bezier / Straight) */}
          <div
            data-testid="focus-diagram-edge-routing"
            className="flex items-center bg-slate-800/90 border border-slate-700 rounded-lg p-0.5 gap-0.5"
            title="連接線種類 (Connector Type)"
          >
            {(
              [
                { id: 'smoothstep', label: 'Step', title: '正交直角折線 (Smoothstep)' },
                { id: 'bezier', label: 'Curve', title: '平滑貝茲曲線 (Bezier)' },
                { id: 'straight', label: 'Line', title: '直線 (Straight)' },
              ] as const
            ).map((opt) => {
              const active = edgeRouting === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`focus-routing-${opt.id}`}
                  onClick={() => handleEdgeRoutingChange(opt.id)}
                  title={opt.title}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Diagram-level Line Jump Toggle */}
          <button
            type="button"
            data-testid="focus-diagram-line-jump-toggle"
            aria-pressed={lineJump}
            onClick={handleLineJumpToggle}
            title="Toggle Line Jump arcs for intersecting connectors in this Diagram"
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition cursor-pointer ${
              lineJump
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            Line Jump
          </button>

          {/* ELK Spacing Preset Selector (nodeSpacing / layerSpacing) */}
          <select
            value={spacingPreset}
            data-testid="focus-diagram-spacing"
            onChange={(e) =>
              handleSpacingChange(e.target.value as ElkSpacingPreset)
            }
            title="ELK 節點與層級間距 (nodeSpacing / layerSpacing)"
            className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="compact">Spacing: Compact (36/60)</option>
            <option value="normal">Spacing: Normal (50/80)</option>
            <option value="spacious">Spacing: Spacious (80/130)</option>
          </select>

          {/* ELK Auto-Layout Button & Continuous Checkbox */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="focus-diagram-auto-layout"
              onClick={handleAutoLayout}
              title="Auto-arrange unlocked nodes using ELK hierarchical layout"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/40 hover:border-indigo-500 transition cursor-pointer shadow-sm"
            >
              <Workflow className="w-3.5 h-3.5 text-indigo-400" />
              <span>Auto Layout</span>
            </button>
            <label
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-300 bg-slate-800/80 border border-slate-700 rounded-lg cursor-pointer select-none hover:border-indigo-500/50 transition"
              title="Continuous Auto Layout: automatically re-balance unlocked nodes after manual drag"
            >
              <input
                type="checkbox"
                data-testid="focus-diagram-continuous-checkbox"
                checked={continuousLayout}
                onChange={(e) => handleToggleContinuous(e.target.checked)}
                className="accent-indigo-500 cursor-pointer"
              />
              <span>Continuous</span>
            </label>
          </div>

          {isMindMapMode ? (
            <select
              value={mindMapDirection}
              data-testid="focus-mindmap-direction"
              onChange={(e) =>
                handleMindMapDirectionChange(e.target.value as MindMapDirection)
              }
              className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="radial">Radial (Left-Right)</option>
              <option value="right">Right</option>
              <option value="down">Down</option>
            </select>
          ) : (
            <select
              value={direction}
              data-testid="focus-diagram-direction"
              onChange={(e) => handleDirectionChange(e.target.value as FlowDirection)}
              className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="TB">TB (Top to Bottom)</option>
              <option value="LR">LR (Left to Right)</option>
              <option value="BT">BT (Bottom to Top)</option>
              <option value="RL">RL (Right to Left)</option>
            </select>
          )}

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
        {/* Left Side: CodeMirror 6 Mermaid Editor (optional in MindMap Mode) */}
        {showMermaidEditor && (
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
        )}

        {/* Right Side: Dedicated Sub-Canvas */}
        <div className="flex-1 relative bg-slate-950">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes.map((n) => ({
                ...n,
                draggable: !Boolean(n.locked || n.data?.locked),
              })) as unknown as Node[]}
              edges={renderedEdges}
              nodeTypes={subNodeTypes}
              edgeTypes={subEdgeTypes}
              onInit={(instance) => {
                rfInstanceRef.current = instance;
              }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDrag={handleSubNodeDrag}
              onNodeDragStop={handleSubNodeDragStop}
              onPaneClick={handleSubPaneClick}
              onConnect={onConnect}
              onPaneContextMenu={(e) => e.preventDefault()}
              onNodeContextMenu={(e) => e.preventDefault()}
              snapToGrid={true}
              snapGrid={SNAP_GRID}
              minZoom={0.05}
              maxZoom={2.5}
              // OP-01: Right-click drag pans the canvas
              panOnDrag={PAN_ON_DRAG}
              // OP-03: Left-click drag on empty canvas creates selection box
              selectionOnDrag={true}
              selectionMode={SelectionMode.Full}
              selectionKeyCode={null}
              // Multi-select with Cmd/Ctrl + click
              multiSelectionKeyCode={MULTI_SELECTION_KEY_CODE}
              // OP-02: Mouse wheel vertical scroll, Shift+wheel horizontal scroll
              panOnScroll={true}
              panOnScrollMode={PanOnScrollMode.Free}
              // OP-02: Cmd/Ctrl + wheel zooms in/out
              zoomOnScroll={false}
              zoomOnDoubleClick={false}
              zoomActivationKeyCode={ZOOM_ACTIVATION_KEY_CODE}
              fitView
              fitViewOptions={FIT_VIEW_OPTIONS}
              colorMode="dark"
              elevateNodesOnSelect={true}
              elevateEdgesOnSelect={true}
              proOptions={PRO_OPTIONS}
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
          </ReactFlowProvider>

          {/* Sub-canvas Quick Hint Overlay */}
          <div className="absolute bottom-4 left-4 pointer-events-none text-xs text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 shadow-md backdrop-blur flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            <span>右鍵拖移平移畫布 · 滾輪上下/左右捲動 · ⌘+滾輪縮放 · 左鍵框選多選</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(FocusDiagramModal);
