/**
 * Creative-Neuro Store Subsystem - Graph Operations Slice (Nodes & Edges)
 * Path: src/store/slices/graphSlice.ts
 */

import type { Connection } from '@xyflow/react';
import type {
  NeuroNode,
  NeuroEdge,
  NeuroEdgeData,
  NeuroNodeData,
  NeuroNodeType,
  Point,
  LayoutMode,
  EdgeRoutingType,
  NodeStyle,
} from '../../types/index.ts';
import type { StoreSet, StoreGet } from './types.ts';

/**
 * Calculates the pair of connection handles (top, right, bottom, left)
 * between two nodes that has the minimum Euclidean distance.
 */
export function findOptimalHandlePair(
  nodeA: NeuroNode,
  nodeB: NeuroNode
): {
  sourceHandle: 'top' | 'right' | 'bottom' | 'left';
  targetHandle: 'top' | 'right' | 'bottom' | 'left';
} {
  const wA = nodeA.width || 160;
  const hA = nodeA.height || 60;
  const posA = nodeA.position;

  const wB = nodeB.width || 160;
  const hB = nodeB.height || 60;
  const posB = nodeB.position;

  const portsA: Record<'top' | 'right' | 'bottom' | 'left', { x: number; y: number }> = {
    top: { x: posA.x + wA / 2, y: posA.y },
    right: { x: posA.x + wA, y: posA.y + hA / 2 },
    bottom: { x: posA.x + wA / 2, y: posA.y + hA },
    left: { x: posA.x, y: posA.y + hA / 2 },
  };

  const portsB: Record<'top' | 'right' | 'bottom' | 'left', { x: number; y: number }> = {
    top: { x: posB.x + wB / 2, y: posB.y },
    right: { x: posB.x + wB, y: posB.y + hB / 2 },
    bottom: { x: posB.x + wB / 2, y: posB.y + hB },
    left: { x: posB.x, y: posB.y + hB / 2 },
  };

  const sides: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];

  let bestDist = Infinity;
  let bestPair: {
    sourceHandle: 'top' | 'right' | 'bottom' | 'left';
    targetHandle: 'top' | 'right' | 'bottom' | 'left';
  } = {
    sourceHandle: 'right',
    targetHandle: 'left',
  };

  for (const sA of sides) {
    for (const sB of sides) {
      const pA = portsA[sA];
      const pB = portsB[sB];
      const dist = Math.hypot(pA.x - pB.x, pA.y - pB.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestPair = { sourceHandle: sA, targetHandle: sB };
      }
    }
  }

  return bestPair;
}

export const createGraphSlice = (set: StoreSet, get: StoreGet) => ({
  addNode: (
    nodeData: Omit<Partial<NeuroNode>, 'data'> & {
      type?: NeuroNodeType;
      data?: Partial<NeuroNodeData>;
    }
  ): string => {
    const id =
      nodeData.id ||
      `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const activePageId = get().activePageId;

    set((state) => {
      const resolvedType: NeuroNodeType = nodeData.type || 'shape';
      const isTextType = resolvedType === 'text';
      const isFrameType = resolvedType === 'frame';
      const isImageType = resolvedType === 'image';
      const isDark = state.themeMode === 'dark';
      const defaultBg = isTextType || isImageType
        ? 'transparent'
        : isFrameType
        ? isDark
          ? 'rgba(30, 41, 59, 0.55)'
          : 'rgba(226, 232, 240, 0.55)'
        : '#ffffff';
      const defaultBorder = isTextType
        ? 'transparent'
        : isFrameType
        ? isDark
          ? '#475569'
          : '#94a3b8'
        : '#94a3b8';

      const defaultData: NeuroNodeData = {
        ...nodeData.data,
        label:
          nodeData.data?.label ||
          (isTextType
            ? 'Type text here...'
            : isFrameType
            ? 'Container Frame'
            : isImageType
            ? 'Image'
            : 'New Node'),
        layoutMode:
          nodeData.data?.layoutMode || nodeData.layoutMode || 'manual',
        shapeType:
          nodeData.data?.shapeType ||
          (isTextType || isFrameType || isImageType ? undefined : 'rounded'),
        backgroundColor: nodeData.data?.backgroundColor || defaultBg,
        borderColor: nodeData.data?.borderColor || defaultBorder,
        borderWidth: isTextType
          ? (nodeData.data?.borderWidth ?? 0)
          : (nodeData.data?.borderWidth ?? 1.5),
        color:
          nodeData.data?.color ||
          (isTextType ? undefined : isFrameType && isDark ? '#e2e8f0' : '#0f172a'),
        fontSize: nodeData.data?.fontSize || 14,
        textAlign: nodeData.data?.textAlign || (isTextType ? 'left' : 'center'),
      };

      const newNode: NeuroNode = {
        id,
        type: resolvedType,
        position: nodeData.position || { x: 100, y: 100 },
        width: nodeData.width || (isFrameType ? 360 : isImageType ? 240 : 160),
        height: nodeData.height || (isFrameType ? 260 : isImageType ? 180 : 60),
        parentId: nodeData.parentId,
        extent: nodeData.extent,
        layoutMode: defaultData.layoutMode,
        data: defaultData,
        zIndex: nodeData.zIndex ?? (isFrameType ? 0 : 1),
      };

      state.nodes[id] = newNode;

      if (
        resolvedType === 'shape' ||
        resolvedType === 'text' ||
        resolvedType === 'frame' ||
        resolvedType === 'diagram' ||
        resolvedType === 'image'
      ) {
        state.lastCreatedNodeType = resolvedType;
      }

      const page = state.pages[activePageId];
      if (page) {
        if (!page.nodeIds.includes(id)) {
          page.nodeIds.push(id);
        }
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });

    return id;
  },

  spawnNodeForLastCreatedType: (centerPos: Point): string => {
    const state = get();
    const targetType = state.lastCreatedNodeType || 'shape';
    const isDark = state.themeMode === 'dark';

    let newNodeId: string;
    if (targetType === 'text') {
      newNodeId = state.addNode({
        type: 'text',
        position: { x: Math.round(centerPos.x - 100), y: Math.round(centerPos.y - 30) },
        width: 200,
        height: 60,
        layoutMode: 'manual',
        data: {
          label: 'Text Note',
          layoutMode: 'manual',
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
          color: isDark ? '#f8fafc' : '#0f172a',
        },
      });
    } else if (targetType === 'frame') {
      newNodeId = state.addNode({
        type: 'frame',
        position: { x: Math.round(centerPos.x - 180), y: Math.round(centerPos.y - 130) },
        width: 360,
        height: 260,
        layoutMode: 'manual',
        data: {
          label: 'Container Group',
          title: 'Container Group',
          collapsed: false,
          direction: 'TB',
          layoutMode: 'manual',
        },
      });
    } else if (targetType === 'diagram') {
      newNodeId = state.addNode({
        type: 'diagram',
        position: { x: Math.round(centerPos.x - 170), y: Math.round(centerPos.y - 130) },
        width: 340,
        height: 260,
        layoutMode: 'manual',
        data: {
          label: 'Mermaid Diagram',
          title: 'Mermaid Diagram',
          diagramMode: 'embedded',
          diagramOrientation: 'TB',
          mermaidCode:
            'flowchart TD\n  Start([Start]) --> Process[Action]\n  Process --> End([Done])',
          layoutMode: 'manual',
        },
      });
    } else if (targetType === 'image') {
      newNodeId = state.addNode({
        type: 'image',
        position: { x: Math.round(centerPos.x - 120), y: Math.round(centerPos.y - 90) },
        width: 240,
        height: 180,
        layoutMode: 'manual',
        data: {
          label: 'Image',
          layoutMode: 'manual',
        },
      });
    } else {
      newNodeId = state.addNode({
        type: 'shape',
        position: { x: Math.round(centerPos.x - 80), y: Math.round(centerPos.y - 30) },
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
    }

    state.setSelectedNodes([newNodeId]);
    return newNodeId;
  },

  addConnectedNode: (
    nodeData: Omit<Partial<NeuroNode>, 'data'> & {
      type?: NeuroNodeType;
      data?: Partial<NeuroNodeData>;
    },
    edgeData?: Omit<NeuroEdge, 'id'> & { id?: string }
  ): { nodeId: string; edgeId?: string } => {
    const nodeId =
      nodeData.id ||
      `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const activePageId = get().activePageId;
    const defaultRouting = get().defaultEdgeRoutingType || 'smoothstep';

    let edgeId: string | undefined;
    if (edgeData) {
      edgeId =
        edgeData.id ||
        `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }

    set((state) => {
      const isTextType = nodeData.type === 'text';
      const defaultData: NeuroNodeData = {
        ...nodeData.data,
        label: nodeData.data?.label || (isTextType ? 'Type text here...' : 'New Node'),
        layoutMode:
          nodeData.data?.layoutMode || nodeData.layoutMode || 'manual',
        shapeType: nodeData.data?.shapeType || (isTextType ? undefined : 'rounded'),
        backgroundColor: isTextType
          ? (nodeData.data?.backgroundColor || 'transparent')
          : (nodeData.data?.backgroundColor || '#ffffff'),
        borderColor: isTextType
          ? (nodeData.data?.borderColor || 'transparent')
          : (nodeData.data?.borderColor || '#94a3b8'),
        borderWidth: isTextType
          ? (nodeData.data?.borderWidth ?? 0)
          : (nodeData.data?.borderWidth ?? 1.5),
        color: nodeData.data?.color || (isTextType ? undefined : '#0f172a'),
        fontSize: nodeData.data?.fontSize || 14,
        textAlign: nodeData.data?.textAlign || (isTextType ? 'left' : 'center'),
      };

      const newNode: NeuroNode = {
        id: nodeId,
        type: nodeData.type || 'shape',
        position: nodeData.position || { x: 100, y: 100 },
        width: nodeData.width || 160,
        height: nodeData.height || 60,
        parentId: nodeData.parentId,
        extent: nodeData.extent,
        layoutMode: defaultData.layoutMode,
        data: defaultData,
        zIndex: nodeData.zIndex || 1,
      };

      state.nodes[nodeId] = newNode;

      const page = state.pages[activePageId];
      if (page) {
        if (!page.nodeIds.includes(nodeId)) {
          page.nodeIds.push(nodeId);
        }
      }

      if (edgeData && edgeId) {
        const routing = (edgeData.type as EdgeRoutingType) || defaultRouting;
        const newEdge: NeuroEdge = {
          id: edgeId,
          source: edgeData.source,
          target: edgeData.target || nodeId,
          sourceHandle: edgeData.sourceHandle,
          targetHandle: edgeData.targetHandle,
          type: routing,
          label: edgeData.label,
          animated: edgeData.animated,
          style: edgeData.style,
          data: {
            routingType: routing,
            ...edgeData.data,
          },
        };

        state.edges[edgeId] = newEdge;
        if (page) {
          if (!page.edgeIds.includes(edgeId)) {
            page.edgeIds.push(edgeId);
          }
        }
      }

      state.selectedNodeIds = [nodeId];
      state.selectedEdgeIds = [];

      if (page) {
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });

    return { nodeId, edgeId };
  },

  updateNodePosition: (id: string, position: Point) => {
    set((state) => {
      const node = state.nodes[id];
      if (node) {
        node.position = position;
        // Moving a node manually switches auto-elk to manual to preserve coordinates
        if (node.layoutMode === 'auto-elk') {
          node.layoutMode = 'manual';
        }
        if (node.data && node.data.layoutMode === 'auto-elk') {
          node.data.layoutMode = 'manual';
        }
        const page = state.pages[state.activePageId];
        if (page) {
          page.updatedAt = Date.now();
        }
        state.project.updatedAt = Date.now();
      }
    });
  },

  updateNodeData: (id: string, patch: Partial<NeuroNodeData>) => {
    const currentNode = get().nodes[id];
    if (!currentNode) return;
    const currentData = currentNode.data as Record<string, any> | undefined;
    let hasDataChange = false;
    if (currentData) {
      for (const key of Object.keys(patch)) {
        if (key === 'layoutMode') continue;
        if (currentData[key] !== (patch as any)[key]) {
          hasDataChange = true;
          break;
        }
      }
    } else {
      hasDataChange = true;
    }

    const hasLayoutChange = patch.layoutMode && currentNode.layoutMode !== patch.layoutMode;
    if (!hasDataChange && !hasLayoutChange) {
      return;
    }

    set((state) => {
      const node = state.nodes[id];
      if (node) {
        node.data = {
          ...node.data,
          ...patch,
        };
        if (patch.layoutMode) {
          node.layoutMode = patch.layoutMode;
        }
        const page = state.pages[state.activePageId];
        if (page) {
          page.updatedAt = Date.now();
        }
        state.project.updatedAt = Date.now();
      }
    });
  },

  batchUpdateNodeData: (ids: string[], patch: Partial<NeuroNodeData>) => {
    if (!ids || ids.length === 0) return;
    set((state) => {
      for (const id of ids) {
        const node = state.nodes[id];
        if (node) {
          node.data = {
            ...node.data,
            ...patch,
          };
          if (patch.layoutMode) {
            node.layoutMode = patch.layoutMode;
          }
        }
      }
      const page = state.pages[state.activePageId];
      if (page) {
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });
  },

  removeNode: (id: string) => {
    set((state) => {
      delete state.nodes[id];

      // Unparent child nodes if id was a container / frame
      for (const node of Object.values(state.nodes)) {
        if (node.parentId === id) {
          delete node.parentId;
          delete node.extent;
        }
      }

      for (const page of Object.values(state.pages)) {
        page.nodeIds = page.nodeIds.filter((nid) => nid !== id);
      }

      const edgesToDelete: string[] = [];
      for (const [edgeId, edge] of Object.entries(state.edges)) {
        if (edge.source === id || edge.target === id) {
          edgesToDelete.push(edgeId);
          delete state.edges[edgeId];
        }
      }

      for (const page of Object.values(state.pages)) {
        page.edgeIds = page.edgeIds.filter((eid) => !edgesToDelete.includes(eid));
      }

      state.selectedNodeIds = state.selectedNodeIds.filter((nid) => nid !== id);
      state.selectedEdgeIds = state.selectedEdgeIds.filter(
        (eid) => !edgesToDelete.includes(eid)
      );

      const page = state.pages[state.activePageId];
      if (page) {
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });
  },

  deleteNodes: (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);

    set((state) => {
      // 1. Delete nodes
      for (const id of ids) {
        delete state.nodes[id];
      }

      // 2. Unparent child nodes if any deleted node was a container / frame
      for (const node of Object.values(state.nodes)) {
        if (node.parentId && idSet.has(node.parentId)) {
          delete node.parentId;
          delete node.extent;
        }
      }

      // 3. Purge node IDs from all pages
      for (const page of Object.values(state.pages)) {
        page.nodeIds = page.nodeIds.filter((nid) => !idSet.has(nid));
      }

      // 4. Cascade delete incident edges across all pages
      const edgesToDelete: string[] = [];
      for (const [edgeId, edge] of Object.entries(state.edges)) {
        if (idSet.has(edge.source) || idSet.has(edge.target)) {
          edgesToDelete.push(edgeId);
          delete state.edges[edgeId];
        }
      }

      const edgeDeleteSet = new Set(edgesToDelete);
      for (const page of Object.values(state.pages)) {
        page.edgeIds = page.edgeIds.filter((eid) => !edgeDeleteSet.has(eid));
      }

      // 5. Sanitize selection arrays and editing state
      state.selectedNodeIds = state.selectedNodeIds.filter((nid) => !idSet.has(nid));
      state.selectedEdgeIds = state.selectedEdgeIds.filter(
        (eid) => !edgeDeleteSet.has(eid)
      );
      if (state.editingNodeId && idSet.has(state.editingNodeId)) {
        state.editingNodeId = null;
        state.editingInitialValue = null;
      }

      // 6. Update timestamps
      const page = state.pages[state.activePageId];
      if (page) {
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });
  },

  addEdge: (edgeData: Omit<NeuroEdge, 'id'> & { id?: string }): string => {
    const id =
      edgeData.id ||
      `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const activePageId = get().activePageId;
    const defaultRouting = get().defaultEdgeRoutingType || 'smoothstep';
    const routing = (edgeData.type as EdgeRoutingType) || defaultRouting;

    set((state) => {
      const newEdge: NeuroEdge = {
        id,
        source: edgeData.source,
        target: edgeData.target,
        sourceHandle: edgeData.sourceHandle,
        targetHandle: edgeData.targetHandle,
        type: routing,
        label: edgeData.label,
        animated: edgeData.animated,
        style: edgeData.style,
        data: {
          routingType: routing,
          ...edgeData.data,
        },
      };

      state.edges[id] = newEdge;

      const page = state.pages[activePageId];
      if (page) {
        if (!page.edgeIds.includes(id)) {
          page.edgeIds.push(id);
        }
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });

    return id;
  },

  removeEdge: (id: string) => {
    set((state) => {
      delete state.edges[id];

      for (const page of Object.values(state.pages)) {
        page.edgeIds = page.edgeIds.filter((eid) => eid !== id);
      }

      state.selectedEdgeIds = state.selectedEdgeIds.filter((eid) => eid !== id);

      const page = state.pages[state.activePageId];
      if (page) {
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });
  },

  updateEdgeData: (id: string, patch: Partial<NeuroEdgeData>) => {
    set((state) => {
      const edge = state.edges[id];
      if (edge) {
        edge.data = {
          ...edge.data,
          ...patch,
        };
        if (patch.routingType) {
          edge.type = patch.routingType;
        }
        const page = state.pages[state.activePageId];
        if (page) {
          page.updatedAt = Date.now();
        }
        state.project.updatedAt = Date.now();
      }
    });
  },

  batchUpdateEdgeData: (ids: string[], patch: Partial<NeuroEdgeData>) => {
    if (!ids || ids.length === 0) return;
    set((state) => {
      for (const id of ids) {
        const edge = state.edges[id];
        if (edge) {
          edge.data = {
            ...edge.data,
            ...patch,
          };
          if (patch.routingType) {
            edge.type = patch.routingType;
          }
        }
      }
      const page = state.pages[state.activePageId];
      if (page) {
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });
  },

  reconnectEdge: (edgeId: string, newConnection: Connection) => {
    set((state) => {
      const edge = state.edges[edgeId];
      if (!edge || !newConnection.source || !newConnection.target) return;
      edge.source = newConnection.source;
      edge.target = newConnection.target;
      edge.sourceHandle = newConnection.sourceHandle || undefined;
      edge.targetHandle = newConnection.targetHandle || undefined;
      const page = state.pages[state.activePageId];
      if (page) {
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });
  },

  deleteEdges: (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);

    set((state) => {
      for (const id of ids) {
        delete state.edges[id];
      }

      for (const page of Object.values(state.pages)) {
        page.edgeIds = page.edgeIds.filter((eid) => !idSet.has(eid));
      }

      state.selectedEdgeIds = state.selectedEdgeIds.filter(
        (eid) => !idSet.has(eid)
      );

      const page = state.pages[state.activePageId];
      if (page) {
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });
  },

  batchDelete: (nodeIds: string[] = [], edgeIds: string[] = []) => {
    const nIds = nodeIds || [];
    const eIds = edgeIds || [];
    if (nIds.length === 0 && eIds.length === 0) return;

    const nodeIdSet = new Set(nIds);
    const edgeIdSet = new Set(eIds);

    set((state) => {
      // 1. Delete nodes
      for (const id of nIds) {
        delete state.nodes[id];
      }

      // 2. Unparent children if deleted node was container / frame
      for (const node of Object.values(state.nodes)) {
        if (node.parentId && nodeIdSet.has(node.parentId)) {
          delete node.parentId;
          delete node.extent;
        }
      }

      // 3. Purge node IDs from all pages
      for (const page of Object.values(state.pages)) {
        page.nodeIds = page.nodeIds.filter((nid) => !nodeIdSet.has(nid));
      }

      // 4. Cascade delete incident edges and explicit edges
      const allEdgesToDelete = new Set(edgeIdSet);
      for (const [edgeId, edge] of Object.entries(state.edges)) {
        if (nodeIdSet.has(edge.source) || nodeIdSet.has(edge.target)) {
          allEdgesToDelete.add(edgeId);
        }
      }

      for (const eid of allEdgesToDelete) {
        delete state.edges[eid];
      }

      for (const page of Object.values(state.pages)) {
        page.edgeIds = page.edgeIds.filter((eid) => !allEdgesToDelete.has(eid));
      }

      // 5. Sanitize selection arrays and editing state
      state.selectedNodeIds = state.selectedNodeIds.filter((nid) => !nodeIdSet.has(nid));
      state.selectedEdgeIds = state.selectedEdgeIds.filter((eid) => !allEdgesToDelete.has(eid));
      if (state.editingNodeId && nodeIdSet.has(state.editingNodeId)) {
        state.editingNodeId = null;
        state.editingInitialValue = null;
      }

      // 6. Timestamps
      const page = state.pages[state.activePageId];
      if (page) {
        page.updatedAt = Date.now();
      }
      state.project.updatedAt = Date.now();
    });
  },

  setPageLayoutMode: (pageLayoutMode: LayoutMode) => set({ pageLayoutMode }),

  setNodeLayoutMode: (nodeId: string, mode: LayoutMode) => {
    set((state) => {
      const node = state.nodes[nodeId];
      if (node) {
        node.layoutMode = mode;
        if (node.data) {
          node.data.layoutMode = mode;
        }
        const page = state.pages[state.activePageId];
        if (page) page.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      }
    });
  },

  batchSetNodeLayoutMode: (ids: string[], mode: LayoutMode) => {
    if (!ids || ids.length === 0) return;
    set((state) => {
      for (const id of ids) {
        const node = state.nodes[id];
        if (node) {
          node.layoutMode = mode;
          if (node.data) {
            node.data.layoutMode = mode;
          }
        }
      }
      const page = state.pages[state.activePageId];
      if (page) page.updatedAt = Date.now();
      state.project.updatedAt = Date.now();
    });
  },

  setDefaultEdgeRoutingType: (defaultEdgeRoutingType: EdgeRoutingType) =>
    set({ defaultEdgeRoutingType }),

  handleConnectorNodeClick: (nodeId: string): string | null => {
    const currentSource = get().connectorSourceNodeId;
    if (!currentSource) {
      set({ connectorSourceNodeId: nodeId });
      return null;
    }

    if (currentSource === nodeId) {
      // Deselect if same node clicked
      set({ connectorSourceNodeId: null });
      return null;
    }

    const nodeA = get().nodes[currentSource];
    const nodeB = get().nodes[nodeId];

    let handles: { sourceHandle?: string; targetHandle?: string } = {};
    if (nodeA && nodeB) {
      handles = findOptimalHandlePair(nodeA, nodeB);
    }

    const routing = get().defaultEdgeRoutingType || 'smoothstep';

    // Establish edge between currentSource and nodeId with optimal handles
    const edgeId = get().addEdge({
      source: currentSource,
      target: nodeId,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: routing,
      data: {
        routingType: routing,
      },
    });

    // Reset connector source so user can continuously connect another pair
    set({ connectorSourceNodeId: null });
    return edgeId;
  },

  resetConnector: () => set({ connectorSourceNodeId: null }),

  toggleNodeSelection: (nodeId: string) => {
    set((state) => {
      const node = state.nodes[nodeId];
      const gid = node?.groupId || node?.data?.groupId;
      const memberIds = gid
        ? Object.values(state.nodes)
            .filter((n) => n.groupId === gid || n.data?.groupId === gid)
            .map((n) => n.id)
        : [nodeId];

      const isSelected = state.selectedNodeIds.includes(nodeId);
      if (isSelected) {
        state.selectedNodeIds = state.selectedNodeIds.filter(
          (id) => !memberIds.includes(id)
        );
      } else {
        for (const mid of memberIds) {
          if (!state.selectedNodeIds.includes(mid)) {
            state.selectedNodeIds.push(mid);
          }
        }
      }
    });
  },

  bringToFront: (nodeIdOrIds: string | string[]) => {
    set((state) => {
      const ids = Array.isArray(nodeIdOrIds) ? nodeIdOrIds : [nodeIdOrIds];
      const allZ = Object.values(state.nodes).map((n) => n.zIndex || 0);
      let maxZ = allZ.length > 0 ? Math.max(...allZ) : 1;
      for (const id of ids) {
        const target = state.nodes[id];
        if (target) {
          maxZ += 1;
          target.zIndex = maxZ;
        }
      }
    });
  },

  sendToBack: (nodeIdOrIds: string | string[]) => {
    set((state) => {
      const ids = Array.isArray(nodeIdOrIds) ? nodeIdOrIds : [nodeIdOrIds];
      const allZ = Object.values(state.nodes).map((n) => n.zIndex || 0);
      let minZ = allZ.length > 0 ? Math.min(...allZ) : 1;
      for (const id of ids) {
        const target = state.nodes[id];
        if (target) {
          minZ -= 1;
          target.zIndex = minZ;
        }
      }
    });
  },

  bringForward: (nodeIdOrIds: string | string[]) => {
    set((state) => {
      const ids = Array.isArray(nodeIdOrIds) ? nodeIdOrIds : [nodeIdOrIds];
      const targetSet = new Set(ids);
      const activePage = state.pages[state.activePageId];
      const pageNodes = (activePage ? activePage.nodeIds : Object.keys(state.nodes))
        .map((id) => state.nodes[id])
        .filter((n): n is NeuroNode => Boolean(n));
      if (pageNodes.length < 2) return;

      const sorted = [...pageNodes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      // Ensure strictly increasing zIndex values so ties can step cleanly
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) {
          sorted[i].zIndex = sorted[i].zIndex ?? 1;
        } else if ((sorted[i].zIndex ?? 0) <= (sorted[i - 1].zIndex ?? 0)) {
          sorted[i].zIndex = (sorted[i - 1].zIndex ?? 0) + 1;
        }
      }

      for (let i = sorted.length - 2; i >= 0; i--) {
        if (targetSet.has(sorted[i].id) && !targetSet.has(sorted[i + 1].id)) {
          const tmpZ = sorted[i].zIndex!;
          sorted[i].zIndex = sorted[i + 1].zIndex!;
          sorted[i + 1].zIndex = tmpZ;
          [sorted[i], sorted[i + 1]] = [sorted[i + 1], sorted[i]];
        }
      }
      if (activePage) activePage.updatedAt = Date.now();
      state.project.updatedAt = Date.now();
    });
  },

  sendBackward: (nodeIdOrIds: string | string[]) => {
    set((state) => {
      const ids = Array.isArray(nodeIdOrIds) ? nodeIdOrIds : [nodeIdOrIds];
      const targetSet = new Set(ids);
      const activePage = state.pages[state.activePageId];
      const pageNodes = (activePage ? activePage.nodeIds : Object.keys(state.nodes))
        .map((id) => state.nodes[id])
        .filter((n): n is NeuroNode => Boolean(n));
      if (pageNodes.length < 2) return;

      const sorted = [...pageNodes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) {
          sorted[i].zIndex = sorted[i].zIndex ?? 1;
        } else if ((sorted[i].zIndex ?? 0) <= (sorted[i - 1].zIndex ?? 0)) {
          sorted[i].zIndex = (sorted[i - 1].zIndex ?? 0) + 1;
        }
      }

      for (let i = 1; i < sorted.length; i++) {
        if (targetSet.has(sorted[i].id) && !targetSet.has(sorted[i - 1].id)) {
          const tmpZ = sorted[i].zIndex!;
          sorted[i].zIndex = sorted[i - 1].zIndex!;
          sorted[i - 1].zIndex = tmpZ;
          [sorted[i], sorted[i - 1]] = [sorted[i - 1], sorted[i]];
        }
      }
      if (activePage) activePage.updatedAt = Date.now();
      state.project.updatedAt = Date.now();
    });
  },

  groupSelectedNodes: (_title?: string): string | null => {
    const state = get();
    const selectedIds = state.selectedNodeIds;
    if (selectedIds.length < 2) return null;

    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    set((s) => {
      for (const nid of selectedIds) {
        const node = s.nodes[nid];
        if (node) {
          node.groupId = groupId;
          if (node.data) {
            node.data.groupId = groupId;
          }
        }
      }
      const activePage = s.pages[s.activePageId];
      if (activePage) activePage.updatedAt = Date.now();
      s.project.updatedAt = Date.now();
    });

    return groupId;
  },

  ungroupNodes: (targetIdOrGroupId: string) => {
    set((state) => {
      let targetGroupId: string | null = null;
      // 1. Direct groupId check
      const isDirectGroupId = Object.values(state.nodes).some(
        (n) => n.groupId === targetIdOrGroupId || n.data?.groupId === targetIdOrGroupId
      );
      if (isDirectGroupId) {
        targetGroupId = targetIdOrGroupId;
      } else {
        const targetNode = state.nodes[targetIdOrGroupId];
        if (targetNode) {
          targetGroupId = targetNode.groupId || targetNode.data?.groupId || null;
        }
      }

      if (targetGroupId) {
        for (const node of Object.values(state.nodes)) {
          if (node.groupId === targetGroupId || node.data?.groupId === targetGroupId) {
            delete node.groupId;
            if (node.data) {
              delete node.data.groupId;
            }
          }
        }
        for (const page of Object.values(state.pages)) {
          if (page.groupStyles && page.groupStyles[targetGroupId]) {
            delete page.groupStyles[targetGroupId];
          }
        }
      }

      // 2. Also support legacy / container FrameNode unparenting if a FrameNode id is passed
      const frame = state.nodes[targetIdOrGroupId];
      if (frame && frame.type === 'frame') {
        for (const node of Object.values(state.nodes)) {
          if (node.parentId === targetIdOrGroupId) {
            delete node.parentId;
            delete node.extent;
          }
        }
        delete state.nodes[targetIdOrGroupId];
        const activePage = state.pages[state.activePageId];
        if (activePage) {
          activePage.nodeIds = activePage.nodeIds.filter((id) => id !== targetIdOrGroupId);
        }
        state.selectedNodeIds = state.selectedNodeIds.filter((id) => id !== targetIdOrGroupId);
      }

      const activePage = state.pages[state.activePageId];
      if (activePage) activePage.updatedAt = Date.now();
      state.project.updatedAt = Date.now();
    });
  },

  setGroupStyle: (groupId: string, style: Partial<NodeStyle> | null) => {
    if (!groupId) return;
    set((state) => {
      const activePage = state.pages[state.activePageId];
      if (!activePage) return;
      if (!activePage.groupStyles) {
        activePage.groupStyles = {};
      }
      if (style === null) {
        delete activePage.groupStyles[groupId];
      } else {
        activePage.groupStyles[groupId] = {
          ...(activePage.groupStyles[groupId] || {}),
          ...style,
        };
      }
      activePage.updatedAt = Date.now();
      state.project.updatedAt = Date.now();
    });
  },

  captureNodesInFrame: (frameId: string): string[] => {
    const capturedIds: string[] = [];
    set((state) => {
      const frame = state.nodes[frameId];
      if (!frame || frame.type !== 'frame' || frame.data?.collapsed) return;

      const fx = frame.position.x;
      const fy = frame.position.y;
      const fw = frame.width || 360;
      const fh = frame.height || 260;

      const activePage = state.pages[state.activePageId];
      const pageNodeIds = activePage ? activePage.nodeIds : Object.keys(state.nodes);

      for (const nid of pageNodeIds) {
        if (nid === frameId) continue;
        const node = state.nodes[nid];
        if (
          !node ||
          node.parentId ||
          node.type === 'frame' ||
          node.type === 'diagram' ||
          node.hidden
        ) {
          continue;
        }
        const nw = node.width || 160;
        const nh = node.height || 60;
        const cx = node.position.x + nw / 2;
        const cy = node.position.y + nh / 2;

        if (cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh) {
          node.parentId = frameId;
          node.position = {
            x: node.position.x - fx,
            y: node.position.y - fy,
          };
          node.zIndex = Math.max(node.zIndex ?? 1, (frame.zIndex ?? 0) + 1);
          capturedIds.push(nid);
        }
      }

      if (capturedIds.length > 0) {
        if (activePage) activePage.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      }
    });
    return capturedIds;
  },

  toggleFrameCollapse: (frameId: string) => {
    set((state) => {
      const frame = state.nodes[frameId];
      if (!frame || frame.type !== 'frame') return;

      const nextCollapsed = !Boolean(frame.data?.collapsed);
      const childIdSet = new Set<string>();

      if (nextCollapsed) {
        frame.data = {
          ...frame.data,
          collapsed: true,
          minWidth: frame.width || frame.data?.minWidth || 360,
          minHeight: frame.height || frame.data?.minHeight || 260,
        };
        frame.width = 180;
        frame.height = 44;

        for (const node of Object.values(state.nodes)) {
          if (node.parentId === frameId) {
            node.hidden = true;
            childIdSet.add(node.id);
          }
        }
      } else {
        const restoredW = frame.data?.minWidth || 360;
        const restoredH = frame.data?.minHeight || 260;
        frame.data = {
          ...frame.data,
          collapsed: false,
        };
        frame.width = restoredW;
        frame.height = restoredH;

        for (const node of Object.values(state.nodes)) {
          if (node.parentId === frameId) {
            node.hidden = false;
            childIdSet.add(node.id);
          }
        }
      }

      for (const edge of Object.values(state.edges)) {
        if (childIdSet.has(edge.source) || childIdSet.has(edge.target)) {
          (edge as any).hidden = nextCollapsed;
        }
      }

      const activePage = state.pages[state.activePageId];
      if (activePage) activePage.updatedAt = Date.now();
      state.project.updatedAt = Date.now();
    });
  },
});

