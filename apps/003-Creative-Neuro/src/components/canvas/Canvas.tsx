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

import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  useStore,
  ViewportPortal,
  PanOnScrollMode,
  SelectionMode,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  type EdgeTypes,
  type Connection,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

import {
  useProjectStore,
  useActivePageNodes,
  useActivePageEdges,
} from '../../store/useProjectStore.ts';
import type { NeuroNode } from '../../types/index.ts';
import { calculateFrameAutoGrowth } from '../../engine/index.ts';

import ShapeNode from './nodes/ShapeNode.tsx';
import TextNode from './nodes/TextNode.tsx';
import FrameNode from './nodes/FrameNode.tsx';
import DiagramNode from './nodes/DiagramNode.tsx';
import JumpConnectorEdge from './edges/JumpConnectorEdge.tsx';
import FreehandOverlay from './freehand/FreehandOverlay.tsx';
import FocusDiagramModal from '../editor/FocusDiagramModal.tsx';
import { ContextMenu } from './ContextMenu.tsx';
import { NodeFloatingActionBar } from './NodeFloatingActionBar.tsx';

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
  smoothstep: JumpConnectorEdge,
  bezier: JumpConnectorEdge,
  straight: JumpConnectorEdge,
};

interface ContextMenuState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  targetNodeId: string | null;
}

export function CanvasContent() {
  const nodes = useActivePageNodes();
  const edges = useActivePageEdges();

  const {
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    toolMode,
    setToolMode,
    setSelectedNodes,
    setSelectedEdges,
    selectedNodeIds,
    selectedEdgeIds,
    handleConnectorNodeClick,
    reconnectEdge,
    themeMode,
    selectionFilter,
    isDragging,
  } = useProjectStore();

  const isDark = themeMode === 'dark';
  const userSelectionActive = useStore((s) => s.userSelectionActive);
  const {
    screenToFlowPosition,
    zoomIn,
    zoomOut,
    fitView,
    setNodes: setReactFlowNodes,
    setEdges: setReactFlowEdges,
  } = useReactFlow();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const rightClickStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPaneClickRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastDoubleClickSpawnRef = useRef<number>(0);

  // Shared helper to spawn a floating node centered at client coordinates (OP-06)
  const spawnFloatingNodeAtClientPos = useCallback(
    (clientX: number, clientY: number) => {
      const now = Date.now();
      if (now - lastDoubleClickSpawnRef.current < 350) {
        return;
      }
      lastDoubleClickSpawnRef.current = now;

      const flowPos = screenToFlowPosition({
        x: clientX,
        y: clientY,
      });
      const newNodeId = addNode({
        type: 'shape',
        position: {
          x: Math.round(flowPos.x - 80),
          y: Math.round(flowPos.y - 30),
        },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: {
          label: 'New Idea',
          layoutMode: 'manual',
          shapeType: 'rounded',
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          borderColor: isDark ? '#475569' : '#cbd5e1',
          color: isDark ? '#f8fafc' : '#0f172a',
        },
      });
      setSelectedNodes([newNodeId]);
    },
    [screenToFlowPosition, addNode, setSelectedNodes, isDark]
  );

  // Edge Reconnection handler (TL-03)
  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      reconnectEdge(oldEdge.id, newConnection);
    },
    [reconnectEdge]
  );

  // Dragging lifecycle & manual layoutMode conversion
  const dragStartSnapshotRef = useRef<{
    project: any;
    boards: any;
    pages: any;
    nodes: Record<string, NeuroNode>;
    edges: any;
    activePageId: string;
  } | null>(null);

  const handleNodeDragStart = useCallback(() => {
    const state = useProjectStore.getState();
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

  // Global drag safety net: ensures temporal is never stuck paused if pointer capture drops
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const handleGlobalDragCancel = () => {
      // Defer to macro-task so handleNodeDragStop has an opportunity to execute first
      timerId = setTimeout(() => {
        const state = useProjectStore.getState();
        if (state.isDragging || dragStartSnapshotRef.current) {
          useProjectStore.setState((s) => {
            s.isDragging = false;
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

  // Canvas click-to-add for toolbar modes
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (contextMenu) setContextMenu(null);

      // OP-06: Detect rapid double-click on empty pane in selectionOnDrag mode
      if (toolMode === 'select' || toolMode === 'connect') {
        setSelectedNodes([]);
        setSelectedEdges([]);
        const now = Date.now();
        const prev = lastPaneClickRef.current;
        if (
          prev &&
          now - prev.time < 320 &&
          Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 10
        ) {
          lastPaneClickRef.current = null;
          spawnFloatingNodeAtClientPos(event.clientX, event.clientY);
          return;
        }
        lastPaneClickRef.current = {
          time: now,
          x: event.clientX,
          y: event.clientY,
        };
        return;
      }

      if (toolMode === 'draw') {
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
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#475569' : '#cbd5e1',
            color: isDark ? '#f8fafc' : '#0f172a',
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
            color: isDark ? '#f8fafc' : '#0f172a',
            fontSize: 15,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
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
    [
      toolMode,
      screenToFlowPosition,
      addNode,
      setToolMode,
      isDark,
      contextMenu,
      spawnFloatingNodeAtClientPos,
    ]
  );

  // Double click empty canvas creates a new floating node (OP-06)
  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      // Ignore if double-clicking on an existing node, edge, handle, or overlay control
      if (
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__edge') ||
        target.closest('.react-flow__handle') ||
        target.closest('.react-flow__panel') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea')
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      spawnFloatingNodeAtClientPos(event.clientX, event.clientY);
    },
    [spawnFloatingNodeAtClientPos]
  );

  // Connector Tool Node Click Handler (TL-01) & Group Selection Click (FN-04)
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (toolMode === 'connect') {
        handleConnectorNodeClick(node.id);
      } else if (toolMode === 'select') {
        const targetNode = nodes.find((n) => n.id === node.id);
        const gid = targetNode?.groupId || targetNode?.data?.groupId;
        if (gid) {
          const groupMemberIds = nodes
            .filter((n) => n.groupId === gid || n.data?.groupId === gid)
            .map((n) => n.id);
          setSelectedNodes(groupMemberIds);
        }
      }
    },
    [toolMode, handleConnectorNodeClick, nodes, setSelectedNodes]
  );

  // Mouse Down: Record initial point for right-click pan vs contextmenu discrimination
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      rightClickStartRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  // Pane Context Menu (OP-01)
  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const start = rightClickStartRef.current;
      if (start) {
        const dist = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (dist > 5) {
          // It was a pan drag gesture, do not open context menu
          return;
        }
      }

      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
        targetNodeId: null,
      });
    },
    [screenToFlowPosition]
  );

  // Node Context Menu (OP-01)
  const handleNodeContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
        targetNodeId: node.id,
      });
    },
    [screenToFlowPosition]
  );

  const isInternalSelectionRef = useRef(false);

  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      isInternalSelectionRef.current = true;

      // 1. Filter nodes based on selectionFilter
      const filteredSelNodes = selNodes.filter((n) => {
        const typeKey = (n.type || 'shape') as keyof typeof selectionFilter;
        return selectionFilter[typeKey] ?? true;
      });

      const selNodeIdSet = new Set(filteredSelNodes.map((n) => n.id));

      // 2. Filter edges based on selectionFilter.edge AND box selection enclosing rule:
      // - If selectionFilter.edge is false, NO edges can be selected.
      // - If user is actively box-selecting (userSelectionActive is true):
      //   A line segment is ONLY selected if BOTH its source AND target nodes are also inside the selection!
      //   (If only one end is inside, the line extends outside the selection box, so it is NOT fully enclosed!)
      // - If user clicked directly (userSelectionActive is false):
      //   Allow selecting the clicked edge(s).
      const filteredSelEdges = selectionFilter.edge
        ? selEdges.filter((e) => {
            if (userSelectionActive) {
              return selNodeIdSet.has(e.source) && selNodeIdSet.has(e.target);
            }
            return true;
          })
        : [];

      setSelectedNodes(filteredSelNodes.map((n) => n.id));
      setSelectedEdges(filteredSelEdges.map((e) => e.id));
    },
    [setSelectedNodes, setSelectedEdges, selectionFilter, userSelectionActive]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (changes.some((c) => c.type === 'select')) {
        isInternalSelectionRef.current = true;
      }
      (onNodesChange as unknown as (changes: NodeChange[]) => void)(changes);
    },
    [onNodesChange]
  );

  // Filter out freehand stroke nodes and apply per-type selectable flag from selectionFilter
  // Stable reference across selection updates to completely prevent React Flow StoreUpdater infinite loops
  const reactFlowNodes = useMemo(() => {
    return nodes
      .filter((n) => n.type !== 'freehand')
      .map((n) => {
        const typeKey = (n.type || 'shape') as keyof typeof selectionFilter;
        const isSelectable = selectionFilter[typeKey] ?? true;
        const nodeObj: any = {
          ...n,
          selectable: isSelectable,
          measured: {
            width: n.measured?.width ?? n.width ?? 160,
            height: n.measured?.height ?? n.height ?? 60,
          },
        };
        if (!isDragging || !n.dragging) {
          delete nodeObj.dragging;
        }
        return nodeObj as Node;
      });
  }, [nodes, selectionFilter, isDragging]);

  const reactFlowEdges = useMemo(() => {
    const isSelectable = selectionFilter.edge ?? true;
    return edges.map((e) => ({
      ...e,
      selectable: isSelectable,
    })) as unknown as Edge[];
  }, [edges, selectionFilter.edge]);

  // Programmatic selection synchronizer: only syncs external selections (e.g. keyboard navigation)
  const lastSyncedNodeIdsRef = useRef<string[]>([]);
  const lastSyncedEdgeIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (isInternalSelectionRef.current) {
      isInternalSelectionRef.current = false;
      lastSyncedNodeIdsRef.current = selectedNodeIds;
      return;
    }

    const prev = lastSyncedNodeIdsRef.current;
    if (
      prev.length === selectedNodeIds.length &&
      prev.every((id, idx) => id === selectedNodeIds[idx])
    ) {
      return;
    }
    lastSyncedNodeIdsRef.current = selectedNodeIds;

    const set = new Set(selectedNodeIds);
    setReactFlowNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        const shouldBe = set.has(n.id);
        if (Boolean(n.selected) !== shouldBe) {
          changed = true;
          return { ...n, selected: shouldBe };
        }
        return n;
      });
      return changed ? next : nds;
    });
  }, [selectedNodeIds, setReactFlowNodes]);

  useEffect(() => {
    const prev = lastSyncedEdgeIdsRef.current;
    if (
      prev.length === selectedEdgeIds.length &&
      prev.every((id, idx) => id === selectedEdgeIds[idx])
    ) {
      return;
    }
    lastSyncedEdgeIdsRef.current = selectedEdgeIds;

    const set = new Set(selectedEdgeIds);
    setReactFlowEdges((eds) => {
      let changed = false;
      const next = eds.map((e) => {
        const shouldBe = set.has(e.id);
        if (Boolean(e.selected) !== shouldBe) {
          changed = true;
          return { ...e, selected: shouldBe };
        }
        return e;
      });
      return changed ? next : eds;
    });
  }, [selectedEdgeIds, setReactFlowEdges]);

  // FN-03 & FN-04: Multi-Selection & Group Bounding Box
  const selectionBounds = useMemo(() => {
    const selectedSet = new Set(selectedNodeIds);
    const targetNodes = nodes.filter((n) => selectedSet.has(n.id));
    if (targetNodes.length < 2) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of targetNodes) {
      if (!n.position || typeof n.position.x !== 'number' || typeof n.position.y !== 'number') {
        continue;
      }
      const w = n.width || 160;
      const h = n.height || 60;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }

    const firstGid = targetNodes[0]?.groupId || targetNodes[0]?.data?.groupId;
    const isCommonGroup =
      Boolean(firstGid) &&
      targetNodes.every(
        (n) => (n.groupId || n.data?.groupId) === firstGid
      );

    const pad = 12;
    return {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
      count: targetNodes.length,
      isGroup: isCommonGroup,
      groupId: firstGid,
    };
  }, [nodes, selectedNodeIds]);

  return (
    <div
      className={`w-full h-full relative overflow-hidden select-none transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
      onContextMenu={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.react-flow__node')) {
          handlePaneContextMenu(e);
        } else {
          e.preventDefault();
        }
      }}
      onDoubleClick={handlePaneDoubleClick}
      onMouseDown={handleMouseDown}
    >
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={
          onEdgesChange as unknown as (changes: EdgeChange[]) => void
        }
        onConnect={onConnect}
        edgesReconnectable={true}
        onReconnect={handleReconnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        onDoubleClick={handlePaneDoubleClick}
        onNodeClick={handleNodeClick}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onSelectionChange={handleSelectionChange}
        snapToGrid={true}
        snapGrid={[16, 16]}
        minZoom={0.1}
        maxZoom={2.5}
        // OP-01: Right-click drag pans the canvas in all tools
        panOnDrag={[2]}
        // OP-03: Left-click drag on empty canvas creates selection box
        // Requirement: Only fully enclosed objects count as selected
        selectionOnDrag={true}
        selectionMode={SelectionMode.Full}
        selectionKeyCode={null}
        // FN-03: Multi-select with Cmd/Ctrl + click
        multiSelectionKeyCode={['Meta', 'Control']}
        // OP-02: Mouse wheel vertical scroll, Shift+wheel horizontal scroll
        panOnScroll={true}
        panOnScrollMode={PanOnScrollMode.Free}
        // OP-02: Cmd/Ctrl + wheel or side-wheel zooms in/out
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        zoomActivationKeyCode={['Meta', 'Control']}
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        colorMode={themeMode}
        elevateNodesOnSelect={true}
        elevateEdgesOnSelect={true}
        className={isDark ? 'text-slate-100' : 'text-slate-900'}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1.2}
          color={isDark ? '#334155' : '#94a3b8'}
        />

        <FreehandOverlay />

        {/* FN-03 & FN-04: Selection & Group Bounding Box Overlay */}
        {selectionBounds && (
          <ViewportPortal>
            <div
              style={{
                transform: `translate(${selectionBounds.x}px, ${selectionBounds.y}px)`,
                width: `${selectionBounds.width}px`,
                height: `${selectionBounds.height}px`,
              }}
              className="absolute top-0 left-0 pointer-events-none rounded-2xl border-2 border-dashed border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] z-[99999] transition-all duration-75"
              data-testid="selection-bounding-box"
              data-is-group={selectionBounds.isGroup ? 'true' : 'false'}
            >
              <div className="absolute -top-7 left-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500 text-slate-950 shadow-md">
                {selectionBounds.isGroup ? (
                  <span>Group ({selectionBounds.count} items)</span>
                ) : (
                  <span>Selected ({selectionBounds.count} items)</span>
                )}
              </div>

              {/* Single Unified Floating Action Bar for Batch Multi-Selection */}
              <NodeFloatingActionBar nodeIds={selectedNodeIds} />
            </div>
          </ViewportPortal>
        )}
      </ReactFlow>

      {/* OP-09 & UI-01: Zoom In / Zoom Out / Fit View Controls moved to Bottom-Right */}
      <div
        className={`absolute bottom-3 right-3 z-20 flex items-center gap-1 p-1 rounded-xl shadow-xl border backdrop-blur-md transition ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 text-slate-300'
            : 'bg-white/95 border-slate-200 text-slate-700 shadow-slate-200/50'
        }`}
      >
        <button
          type="button"
          onClick={() => zoomIn({ duration: 200 })}
          title="Zoom In (⌘+)"
          aria-label="Zoom In"
          className={`p-1.5 rounded-lg cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
          data-testid="canvas-zoom-in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomOut({ duration: 200 })}
          title="Zoom Out (⌘-)"
          aria-label="Zoom Out"
          className={`p-1.5 rounded-lg cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
          data-testid="canvas-zoom-out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className={`w-[1px] h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        <button
          type="button"
          onClick={() => fitView({ padding: 0.2, duration: 250 })}
          title="Fit View"
          aria-label="Fit View"
          className={`p-1.5 rounded-lg cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
          data-testid="canvas-fit-view"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* OP-01: Custom App Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          flowX={contextMenu.flowX}
          flowY={contextMenu.flowY}
          targetNodeId={contextMenu.targetNodeId}
          onClose={() => setContextMenu(null)}
        />
      )}

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
