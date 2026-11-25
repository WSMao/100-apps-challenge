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
        id,
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

      state.nodes[id] = newNode;

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
});

