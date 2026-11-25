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
 * - Lock state enforcement (`draggable: !locked`) on user drag
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
  useStoreApi,
  ViewportPortal,
  PanOnScrollMode,
  SelectionMode,
  ConnectionMode,
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  type EdgeTypes,
  type Connection,
  type OnSelectionChangeParams,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

import {
  useProjectStore,
  useActivePageNodes,
  useActivePageEdges,
} from '../../store/useProjectStore.ts';
import type { NeuroNode, NeuroEdge, Point } from '../../types/index.ts';
import {
  calculateFrameAutoGrowth,
  isEdgeInSelectionRect,
  type BoundingRect,
} from '../../engine/index.ts';
import { useCanvasGestures, type ContextMenuState } from './hooks/useCanvasGestures.ts';
import { useDragCoordinator } from './hooks/useDragCoordinator.ts';
import { useSelectionSync } from './hooks/useSelectionSync.ts';

import ShapeNode from './nodes/ShapeNode.tsx';
import TextNode from './nodes/TextNode.tsx';
import FrameNode from './nodes/FrameNode.tsx';
import DiagramNode from './nodes/DiagramNode.tsx';
import ImageNode from './nodes/ImageNode.tsx';
import JumpConnectorEdge from './edges/JumpConnectorEdge.tsx';
import {
  importImageFileAsNode,
  importImageUrlAsNode,
  isImageFile,
  isImageUrlCandidate,
} from '../../utils/imageImport.ts';
import FreehandOverlay from './freehand/FreehandOverlay.tsx';
import FocusDiagramModal from '../editor/FocusDiagramModal.tsx';
import { ContextMenu } from './ContextMenu.tsx';
import { NodeFloatingActionBar } from './NodeFloatingActionBar.tsx';
import { EdgeFloatingActionBar } from './edges/EdgeFloatingActionBar.tsx';
import { AlignmentGuidesOverlay } from './AlignmentGuidesOverlay.tsx';
import { computeDragSnap, type SnapRect } from '../../engine/index.ts';

// Stable top-level module constants to prevent React Flow StoreUpdater infinite re-renders
const SNAP_GRID: [number, number] = [16, 16];
const PAN_ON_DRAG = [2];
const MULTI_SELECTION_KEY_CODE = ['Meta', 'Control'];
const ZOOM_ACTIVATION_KEY_CODE = ['Meta', 'Control'];
const FIT_VIEW_OPTIONS = { padding: 0.2 };
const PRO_OPTIONS = { hideAttribution: true };

// Stable cache for node measured dimensions to avoid allocating new objects on every render
const measuredCache = new Map<string, { width: number; height: number }>();

function getStableMeasured(id: string, width?: number, height?: number): { width: number; height: number } {
  const w = width ?? 160;
  const h = height ?? 60;
  const cached = measuredCache.get(id);
  if (cached && cached.width === w && cached.height === h) {
    return cached;
  }
  const next = { width: w, height: h };
  measuredCache.set(id, next);
  return next;
}

// Custom Node & Edge Types Registration
const nodeTypes: NodeTypes = {
  shape: ShapeNode,
  text: TextNode,
  frame: FrameNode,
  diagram: DiagramNode,
  image: ImageNode,
};

const edgeTypes: EdgeTypes = {
  jump: JumpConnectorEdge,
  default: JumpConnectorEdge,
  smoothstep: JumpConnectorEdge,
  bezier: JumpConnectorEdge,
  straight: JumpConnectorEdge,
};

export function CanvasContent() {
  const nodes = useActivePageNodes();
  const edges = useActivePageEdges();

  const {
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    spawnNodeForLastCreatedType,
    toolMode,
    setToolMode,
    setSelectedNodes,
    setSelectedEdges,
    selectedNodeIds,
    selectedEdgeIds,
    handleConnectorNodeClick,
    reconnectEdge,
    removeEdge,
    themeMode,
    selectionFilter,
    isDragging,
  } = useProjectStore();

  const isDark = themeMode === 'dark';
  const storeApi = useStoreApi();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__CREATIVE_NEURO_STORE__ = useProjectStore;
    }
  }, []);
  const {
    screenToFlowPosition,
    zoomIn,
    zoomOut,
    fitView,
    getViewport,
    setViewport,
  } = useReactFlow();

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
      spawnNodeForLastCreatedType(flowPos);
    },
    [screenToFlowPosition, spawnNodeForLastCreatedType]
  );

  // Interaction coordinator hooks (Candidate 3)
  const {
    contextMenu,
    setContextMenu,
    isSpacePressed,
    handleMouseDown,
    handleMouseUp,
    handlePaneContextMenu,
    handleNodeContextMenu,
    handlePaneClick,
  } = useCanvasGestures({
    toolMode,
    screenToFlowPosition,
    addNode,
    setToolMode,
    setSelectedNodes,
    setSelectedEdges,
    spawnFloatingNodeAtClientPos,
    isDark,
  });

  const { handleNodeDragStart, handleNodeDragStop } = useDragCoordinator();

  const {
    onReconnectStart,
    onReconnect: handleReconnect,
    onReconnectEnd,
  } = useSelectionSync({
    selectedNodeIds,
    selectedEdgeIds,
    nodes,
    edges,
    reconnectEdge,
    removeEdge,
  });

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

  // Drag-and-drop image files or image URLs onto the canvas
  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    if (
      event.dataTransfer?.types?.includes('Files') ||
      event.dataTransfer?.types?.includes('text/uri-list') ||
      event.dataTransfer?.types?.includes('text/plain')
    ) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleCanvasDrop = useCallback(
    async (event: React.DragEvent) => {
      const files = Array.from(event.dataTransfer?.files || []).filter(isImageFile);
      if (files.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        const basePos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const store = useProjectStore.getState();
        for (let i = 0; i < files.length; i++) {
          await importImageFileAsNode(
            files[i],
            { x: Math.round(basePos.x + i * 24), y: Math.round(basePos.y + i * 24) },
            store
          );
        }
        return;
      }

      const uri =
        event.dataTransfer?.getData('text/uri-list') ||
        event.dataTransfer?.getData('text/plain') ||
        '';
      if (isImageUrlCandidate(uri)) {
        event.preventDefault();
        event.stopPropagation();
        const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        importImageUrlAsNode(uri, pos, useProjectStore.getState());
      }
    },
    [screenToFlowPosition]
  );

  // Connector Tool Node Click Handler (TL-01) & Single/Group Node Selection Click (FN-04)
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (toolMode === 'connect') {
        handleConnectorNodeClick(node.id);
        return;
      }
      if (toolMode === 'select') {
        const isMulti = event.metaKey || event.ctrlKey || event.shiftKey;
        const targetNode = nodes.find((n) => n.id === node.id);
        const gid = targetNode?.groupId || targetNode?.data?.groupId;
        if (gid) {
          const groupMemberIds = nodes
            .filter((n) => n.groupId === gid || n.data?.groupId === gid)
            .map((n) => n.id);
          if (isMulti) {
            const next = Array.from(new Set([...selectedNodeIds, ...groupMemberIds]));
            setSelectedNodes(next);
          } else {
            setSelectedNodes(groupMemberIds);
            setSelectedEdges([]);
          }
        } else {
          if (isMulti) {
            const next = selectedNodeIds.includes(node.id)
              ? selectedNodeIds.filter((id) => id !== node.id)
              : [...selectedNodeIds, node.id];
            setSelectedNodes(next);
          } else {
            setSelectedNodes([node.id]);
            setSelectedEdges([]);
          }
        }
      }
    },
    [toolMode, handleConnectorNodeClick, nodes, selectedNodeIds, setSelectedNodes, setSelectedEdges]
  );

  // Single/Multi Edge Selection Click Handler
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (toolMode === 'select' || toolMode === 'connect') {
        if (toolMode === 'select') {
          const isSelectable = selectionFilter.edge ?? true;
          if (!isSelectable) return;
        } else {
          useProjectStore.getState().resetConnector();
        }

        const isMulti = event.metaKey || event.ctrlKey || event.shiftKey;
        if (isMulti) {
          const next = selectedEdgeIds.includes(edge.id)
            ? selectedEdgeIds.filter((id) => id !== edge.id)
            : [...selectedEdgeIds, edge.id];
          setSelectedEdges(next);
        } else {
          setSelectedEdges([edge.id]);
          setSelectedNodes([]);
        }
      }
    },
    [toolMode, selectionFilter.edge, selectedEdgeIds, setSelectedEdges, setSelectedNodes]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      const storeState = storeApi.getState();
      const userSelectionActive = storeState.userSelectionActive;
      const nodesSelectionActive = storeState.nodesSelectionActive;
      const userSelectionRect = storeState.userSelectionRect;
      const transform = storeState.transform;
      const nodeLookup = storeState.nodeLookup;

      const { selectedNodeIds: currNodeIds, selectedEdgeIds: currEdgeIds, nodes: allStoreNodes } =
        useProjectStore.getState();

      // Guard 1: If Zustand has selected nodes that React Flow's nodeLookup hasn't registered yet,
      // React Flow is emitting a transient / stale selection event during an un-batched render pass.
      // Do NOT allow a stale onSelectionChange event to clobber the store's selection!
      const hasUnregisteredNode = currNodeIds.some((id) => !nodeLookup.has(id));
      if (hasUnregisteredNode) {
        return;
      }

      // 1. Filter nodes based on selectionFilter
      const filteredSelNodes = selNodes.filter((n) => {
        const typeKey = (n.type || 'shape') as keyof typeof selectionFilter;
        return selectionFilter[typeKey] ?? true;
      });

      const targetNodeIds = filteredSelNodes.map((n) => n.id);

      // Guard 2: Guard against stale references to deleted nodes
      const hasDeletedNode = targetNodeIds.some((id) => !allStoreNodes[id]);
      if (hasDeletedNode) {
        return;
      }

      const selNodeIdSet = new Set(targetNodeIds);

      // 2. Select edges based on selectionFilter.edge AND box selection:
      let targetEdgeIds: string[] = [];
      if (selectionFilter.edge ?? true) {
        const edgeIdSet = new Set<string>();

        // Include edges passed directly by React Flow (e.g. from single-click or React Flow internal events)
        for (const e of selEdges) {
          edgeIdSet.add(e.id);
        }

        // OP-08: Only select a Connector during box selection when BOTH source and target nodes
        // are fully enclosed inside the selection rectangle.
        if (
          userSelectionActive &&
          userSelectionRect &&
          userSelectionRect.width > 2 &&
          userSelectionRect.height > 2
        ) {
          const [tx, ty, zoom] = transform;
          const rect: BoundingRect = {
            minX: (userSelectionRect.x - tx) / zoom,
            minY: (userSelectionRect.y - ty) / zoom,
            maxX: (userSelectionRect.x + userSelectionRect.width - tx) / zoom,
            maxY: (userSelectionRect.y + userSelectionRect.height - ty) / zoom,
          };

          const nodeMap = new Map<string, NeuroNode>();
          for (const n of nodes) {
            nodeMap.set(n.id, n);
          }

          const isNodeFullyInRect = (n: NeuroNode) => {
            const w = n.width ?? n.measured?.width ?? 160;
            const h = n.height ?? n.measured?.height ?? 60;
            return (
              n.position.x >= rect.minX &&
              n.position.y >= rect.minY &&
              n.position.x + w <= rect.maxX &&
              n.position.y + h <= rect.maxY
            );
          };

          for (const e of edges) {
            const src = nodeMap.get(e.source);
            const tgt = nodeMap.get(e.target);
            if (src && tgt && isNodeFullyInRect(src) && isNodeFullyInRect(tgt)) {
              edgeIdSet.add(e.id);
            }
          }
        }

        // If both endpoints are enclosed by selected nodes, ensure connecting edge is also selected
        for (const e of edges) {
          if (selNodeIdSet.has(e.source) && selNodeIdSet.has(e.target)) {
            edgeIdSet.add(e.id);
          }
        }

        targetEdgeIds = Array.from(edgeIdSet);
      }

      const currNodeSet = new Set(currNodeIds);
      const targetNodeSet = new Set(targetNodeIds);
      const nodesChanged =
        currNodeSet.size !== targetNodeSet.size ||
        targetNodeIds.some((id) => !currNodeSet.has(id));

      const isBoxSelecting = userSelectionActive || nodesSelectionActive;

      // Only allow React Flow's onSelectionChange to overwrite node selection if:
      // - The user is actively marquee-selecting (isBoxSelecting), OR
      // - The store currently has NO selected nodes (e.g. initial empty selection sync)
      if (nodesChanged) {
        if (isBoxSelecting || currNodeIds.length === 0) {
          setSelectedNodes(targetNodeIds);
        }
      }

      const currEdgeSet = new Set(currEdgeIds);
      const targetEdgeSet = new Set(targetEdgeIds);
      const edgesChanged =
        currEdgeSet.size !== targetEdgeSet.size ||
        targetEdgeIds.some((id) => !currEdgeSet.has(id));

      if (edgesChanged) {
        if (isBoxSelecting || currEdgeIds.length === 0) {
          setSelectedEdges(targetEdgeIds);
        }
      }
    },
    [setSelectedNodes, setSelectedEdges, selectionFilter, storeApi, nodes, edges]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nonSelectChanges = changes.filter((c) => c.type !== 'select');
      if (nonSelectChanges.length === 0) return;

      const draggingPosChanges = nonSelectChanges.filter(
        (c): c is Extract<NodeChange, { type: 'position' }> =>
          c.type === 'position' && Boolean(c.dragging) && Boolean(c.position)
      );

      let finalChanges = nonSelectChanges;
      if (draggingPosChanges.length > 0) {
        const store = useProjectStore.getState();
        const activePage = store.pages[store.activePageId];
        const draggedIds = new Set(draggingPosChanges.map((c) => c.id));
        const primaryChange = draggingPosChanges[0];
        const primaryNode = store.nodes[primaryChange.id];

        if (primaryNode && primaryChange.position && !(primaryNode.locked || primaryNode.data?.locked)) {
          const parent = primaryNode.parentId ? store.nodes[primaryNode.parentId] : null;
          const absX = parent ? parent.position.x + primaryChange.position.x : primaryChange.position.x;
          const absY = parent ? parent.position.y + primaryChange.position.y : primaryChange.position.y;
          const w = primaryNode.width ?? primaryNode.measured?.width ?? 160;
          const h = primaryNode.height ?? primaryNode.measured?.height ?? 60;

          const otherRects: SnapRect[] = [];
          const pageNodeIds = activePage?.nodeIds ?? Object.keys(store.nodes);
          for (const nid of pageNodeIds) {
            if (draggedIds.has(nid)) continue;
            const n = store.nodes[nid];
            if (!n || n.hidden || n.type === 'freehand') continue;
            const nParent = n.parentId ? store.nodes[n.parentId] : null;
            otherRects.push({
              id: n.id,
              x: nParent ? nParent.position.x + n.position.x : n.position.x,
              y: nParent ? nParent.position.y + n.position.y : n.position.y,
              width: n.width ?? n.measured?.width ?? 160,
              height: n.height ?? n.measured?.height ?? 60,
            });
          }

          const snap = computeDragSnap(
            { id: primaryNode.id, x: absX, y: absY, width: w, height: h },
            otherRects,
            { snapThreshold: 6, gridSize: SNAP_GRID[0] }
          );
          const dx = snap.x - absX;
          const dy = snap.y - absY;

          if (dx !== 0 || dy !== 0) {
            finalChanges = nonSelectChanges.map((c) => {
              if (c.type === 'position' && c.dragging && c.position) {
                return {
                  ...c,
                  position: {
                    x: c.position.x + dx,
                    y: c.position.y + dy,
                  },
                };
              }
              return c;
            });
          }
          store.setAlignmentGuides(snap.guides);
        }
      }

      (onNodesChange as unknown as (changes: NodeChange[]) => void)(finalChanges);
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const nonSelectChanges = changes.filter((c) => c.type !== 'select');
      if (nonSelectChanges.length > 0) {
        (onEdgesChange as unknown as (changes: EdgeChange[]) => void)(nonSelectChanges);
      }
    },
    [onEdgesChange]
  );

  const selectionEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (selectionEndTimerRef.current) {
        clearTimeout(selectionEndTimerRef.current);
      }
    };
  }, []);

  const handleSelectionEnd = useCallback(() => {
    if (selectionEndTimerRef.current) {
      clearTimeout(selectionEndTimerRef.current);
    }
    selectionEndTimerRef.current = setTimeout(() => {
      storeApi.setState({ nodesSelectionActive: false });
    }, 0);
  }, [storeApi]);

  // Filter out freehand stroke nodes and apply per-type selectable flag from selectionFilter
  // Pass controlled selected flag with dependency on selectedNodeIds
  const reactFlowNodes = useMemo(() => {
    const selectedSet = new Set(selectedNodeIds);
    return nodes
      .filter((n) => n.type !== 'freehand')
      .map((n) => {
        const typeKey = (n.type || 'shape') as keyof typeof selectionFilter;
        const isSelectable = selectionFilter[typeKey] ?? true;
        const w = n.width ?? n.measured?.width ?? 160;
        const h = n.height ?? n.measured?.height ?? 60;
        const measured = getStableMeasured(n.id, w, h);

        const nodeObj: any = {
          ...n,
          width: w,
          height: h,
          draggable: !Boolean(n.locked || n.data?.locked),
          selected: selectedSet.has(n.id),
          selectable: isSelectable,
          measured,
        };
        if (!isDragging || !n.dragging) {
          delete nodeObj.dragging;
        }
        return nodeObj as Node;
      });
  }, [nodes, selectionFilter, isDragging, selectedNodeIds]);

  const reactFlowEdges = useMemo(() => {
    const selectedSet = new Set(selectedEdgeIds);
    const isSelectable = selectionFilter.edge ?? true;
    return edges.map((e) => {
      const isSelected = selectedSet.has(e.id);
      const strokeColor = isSelected
        ? '#06b6d4'
        : e.data?.color || (e.style?.stroke as string) || (themeMode === 'dark' ? '#94a3b8' : '#64748b');

      const hasArrowEnd = e.data?.arrowEnd !== false;
      const hasArrowStart = Boolean(e.data?.arrowStart);

      return {
        ...e,
        selected: selectedSet.has(e.id),
        selectable: isSelectable,
        markerEnd: hasArrowEnd
          ? {
              type: MarkerType.ArrowClosed,
              color: strokeColor,
              width: 14,
              height: 14,
            }
          : undefined,
        markerStart: hasArrowStart
          ? {
              type: MarkerType.ArrowClosed,
              color: strokeColor,
              width: 14,
              height: 14,
            }
          : undefined,
      };
    }) as unknown as Edge[];
  }, [edges, selectionFilter.edge, selectedEdgeIds, themeMode]);

  const activePageGroupStyles = useProjectStore(
    (s) => s.pages[s.activePageId]?.groupStyles
  );

  const styledGroupBoxes = useMemo(() => {
    if (!activePageGroupStyles) return [];
    const byGroup = new Map<string, NeuroNode[]>();
    for (const n of nodes) {
      const gid = n.groupId || n.data?.groupId;
      if (!gid || n.hidden) continue;
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid)!.push(n);
    }

    const boxes: Array<{
      groupId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
    }> = [];

    for (const [gid, members] of byGroup.entries()) {
      const gStyle = activePageGroupStyles[gid];
      if (!gStyle) continue;
      const hasBg = gStyle.backgroundColor && gStyle.backgroundColor !== 'transparent';
      const hasBorder = gStyle.borderColor && gStyle.borderColor !== 'transparent';
      if (!hasBg && !hasBorder) continue;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const m of members) {
        const w = m.width || 160;
        const h = m.height || 60;
        minX = Math.min(minX, m.position.x);
        minY = Math.min(minY, m.position.y);
        maxX = Math.max(maxX, m.position.x + w);
        maxY = Math.max(maxY, m.position.y + h);
      }
      if (!isFinite(minX)) continue;
      const pad = 12;
      boxes.push({
        groupId: gid,
        x: minX - pad,
        y: minY - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
        backgroundColor: gStyle.backgroundColor,
        borderColor: gStyle.borderColor,
        borderWidth: gStyle.borderWidth ?? 2,
      });
    }
    return boxes;
  }, [nodes, activePageGroupStyles]);

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
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheelCapture={(e) => {
        if (e.metaKey || e.ctrlKey) {
          e.stopPropagation();
          const vp = getViewport();
          const factor = Math.exp(-e.deltaY * 0.002);
          const nextZoom = Math.min(2.5, Math.max(0.1, vp.zoom * factor));
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          const ratio = nextZoom / vp.zoom;
          setViewport({
            x: px - (px - vp.x) * ratio,
            y: py - (py - vp.y) * ratio,
            zoom: nextZoom,
          });
          return;
        }
        if (e.shiftKey && e.deltaX === 0 && e.deltaY !== 0) {
          e.stopPropagation();
          const vp = getViewport();
          setViewport({ x: vp.x - e.deltaY * 0.5, y: vp.y, zoom: vp.zoom });
        }
      }}
    >
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        edgesReconnectable={true}
        reconnectRadius={12}
        onReconnect={handleReconnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        onDoubleClick={handlePaneDoubleClick}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onSelectionChange={handleSelectionChange}
        onSelectionEnd={handleSelectionEnd}
        snapToGrid={false}
        snapGrid={SNAP_GRID}
        minZoom={0.1}
        maxZoom={2.5}
        // OP-01: Right-click drag pans the canvas in all tools
        panOnDrag={PAN_ON_DRAG}
        // OP-03: Left-click drag on empty canvas creates selection box
        // Requirement: Only fully enclosed objects count as selected
        selectionOnDrag={true}
        selectionMode={SelectionMode.Full}
        selectionKeyCode={null}
        // FN-03: Multi-select with Cmd/Ctrl + click
        multiSelectionKeyCode={MULTI_SELECTION_KEY_CODE}
        // OP-02: Mouse wheel vertical scroll, Shift+wheel horizontal scroll
        panOnScroll={true}
        panOnScrollMode={PanOnScrollMode.Free}
        // OP-02: Cmd/Ctrl + wheel or side-wheel zooms in/out
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        zoomActivationKeyCode={ZOOM_ACTIVATION_KEY_CODE}
        fitViewOptions={FIT_VIEW_OPTIONS}
        proOptions={PRO_OPTIONS}
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
        <AlignmentGuidesOverlay />

        {/* Styled Logical Group Backgrounds/Borders (shown when styled; transparent by default when unselected) */}
        {styledGroupBoxes.length > 0 && !useProjectStore.getState().focusedDiagramId && (
          <ViewportPortal>
            {styledGroupBoxes.map((box) => (
              <div
                key={box.groupId}
                data-testid={`logical-group-box-${box.groupId}`}
                style={{
                  transform: `translate(${box.x}px, ${box.y}px)`,
                  width: `${box.width}px`,
                  height: `${box.height}px`,
                  backgroundColor: box.backgroundColor || 'transparent',
                  borderColor: box.borderColor || 'transparent',
                  borderWidth: box.borderColor ? `${box.borderWidth ?? 2}px` : 0,
                  borderStyle: 'solid',
                  zIndex: 0,
                }}
                className="absolute top-0 left-0 pointer-events-none rounded-2xl transition-all duration-75"
              />
            ))}
          </ViewportPortal>
        )}

        {/* FN-03 & FN-04: Selection & Group Bounding Box Overlay */}
        {selectionBounds && !useProjectStore.getState().focusedDiagramId && (
          <ViewportPortal>
            <div
              style={{
                transform: `translate(${selectionBounds.x}px, ${selectionBounds.y}px)`,
                width: `${selectionBounds.width}px`,
                height: `${selectionBounds.height}px`,
                zIndex: 999999,
              }}
              className="absolute top-0 left-0 pointer-events-none rounded-2xl border-2 border-dashed border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] z-[999999] transition-all duration-75"
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

              {/* Stacked Unified Floating Action Bars for Batch Multi-Selection */}
              <div
                className="absolute -top-9 left-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center gap-2 pointer-events-auto z-[999999]"
                style={{ zIndex: 999999 }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                data-testid="multi-selection-action-bars"
              >
                {/* 1. Top: Edge Floating Action Bar (連接線快速選單，由上而下排第一) */}
                {selectedEdgeIds.length > 0 && (
                  <EdgeFloatingActionBar edgeIds={selectedEdgeIds} />
                )}

                {/* 2. Below it: Node Floating Action Bar (節點快速選單，由上而下排第二) */}
                <NodeFloatingActionBar nodeIds={selectedNodeIds} isStacked={true} />
              </div>
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
