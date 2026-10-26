/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Layer 1 Zustand + Immer + Zundo State Store
 *
 * Architecture:
 * - State container: Zustand v5 curried create()
 * - Mutability engine: Immer middleware Draft<T> proxy
 * - History engine: Zundo v2 temporal middleware with partialize filter
 * - UI Integration: React Flow v12 (@xyflow/react) NodeChange/EdgeChange handlers
 */

import { useMemo } from 'react';
import { create, useStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal, type TemporalState } from 'zundo';
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
} from '@xyflow/react';
import {
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';

import type {
  Project,
  Board,
  Page,
  NeuroNode,
  NeuroEdge,
  NeuroNodeData,
  NeuroNodeType,
  ToolMode,
  Point,
  Viewport,
} from '../types/index.ts';
import { createSeedProject } from './seedData.ts';

// ============================================================================
// 1. Store State & Action Signatures
// ============================================================================

export interface ProjectRecord extends Omit<Project, 'boards' | 'pages'> {
  boards: Record<string, Board>;
  pages: Record<string, Page>;
  nodes: Record<string, NeuroNode>;
  edges: Record<string, NeuroEdge>;
}

export interface ProjectState {
  // --- Persistent Graph State (Tracked by Zundo) ---
  project: Project;
  boards: Record<string, Board>;
  pages: Record<string, Page>;
  nodes: Record<string, NeuroNode>;
  edges: Record<string, NeuroEdge>;
  activePageId: string;

  // --- Ephemeral UI State (Excluded from Zundo) ---
  toolMode: ToolMode;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  focusedDiagramId: string | null;
  hoveredNodeId: string | null;
  isDragging: boolean;
}

export interface ProjectActions {
  // Required Core Actions
  setProject: (
    project: ProjectRecord | Project,
    pages?: Record<string, Page>,
    nodes?: Record<string, NeuroNode>,
    edges?: Record<string, NeuroEdge>,
    boards?: Record<string, Board>
  ) => void;
  addPage: (name?: string) => string;
  setActivePage: (pageId: string) => void;
  addNode: (
    node: Omit<Partial<NeuroNode>, 'data'> & {
      type?: NeuroNodeType;
      data?: Partial<NeuroNodeData>;
    }
  ) => string;
  updateNodePosition: (id: string, position: Point) => void;
  updateNodeData: (id: string, data: Partial<NeuroNodeData>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: Omit<NeuroEdge, 'id'> & { id?: string }) => string;
  removeEdge: (id: string) => void;
  undo: () => void;
  redo: () => void;

  // Extended React Flow & Workspace Actions
  onNodesChange: (changes: NodeChange<Node>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  deleteNodes: (ids: string[]) => void;
  deleteEdges: (ids: string[]) => void;
  deletePage: (pageId: string) => void;
  updatePageTitle: (pageId: string, title: string) => void;
  setViewport: (pageId: string, viewport: Viewport) => void;
  setToolMode: (mode: ToolMode) => void;
  setSelectedNodes: (ids: string[]) => void;
  setSelectedEdges: (ids: string[]) => void;
  setFocusedDiagramId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  resetToSeed: () => void;
}

export type ProjectStore = ProjectState & ProjectActions;

// ============================================================================
// 2. Initial Seed Baseline
// ============================================================================

const initialSeed = createSeedProject();

const initialState: ProjectState = {
  project: initialSeed.project,
  boards: initialSeed.boards,
  pages: initialSeed.pages,
  nodes: initialSeed.nodes,
  edges: initialSeed.edges,
  activePageId: initialSeed.project.activePageId,

  toolMode: 'select',
  selectedNodeIds: [],
  selectedEdgeIds: [],
  focusedDiagramId: null,
  hoveredNodeId: null,
  isDragging: false,
};

// ============================================================================
// 3. Zustand Store Definition with Immer & Zundo
// ============================================================================

export const useProjectStore = create<ProjectStore>()(
  temporal(
    immer((set, get) => ({
      ...initialState,

      // ----------------------------------------------------------------------
      // Project & Page Management
      // ----------------------------------------------------------------------

      setProject: (projectOrRecord, pages, nodes, edges, boards) => {
        set((state) => {
          let resolvedPages: Record<string, Page> = {};
          let resolvedNodes: Record<string, NeuroNode> = {};
          let resolvedEdges: Record<string, NeuroEdge> = {};
          let resolvedBoards: Record<string, Board> = {};

          if (
            'pages' in projectOrRecord &&
            projectOrRecord.pages &&
            typeof projectOrRecord.pages === 'object' &&
            !Array.isArray(projectOrRecord.pages)
          ) {
            const record = projectOrRecord as ProjectRecord;
            resolvedPages = record.pages;
            resolvedNodes =
              record.nodes && typeof record.nodes === 'object' && !Array.isArray(record.nodes)
                ? record.nodes
                : {};
            resolvedEdges =
              record.edges && typeof record.edges === 'object' && !Array.isArray(record.edges)
                ? record.edges
                : {};
            resolvedBoards =
              record.boards && typeof record.boards === 'object' && !Array.isArray(record.boards)
                ? record.boards
                : {};

            const pageKeys = Object.keys(resolvedPages);
            const validPageIds =
              Array.isArray(record.pageIds) && record.pageIds.length > 0
                ? record.pageIds.filter((pid) => typeof pid === 'string')
                : pageKeys;

            const boardKeys = Object.keys(resolvedBoards);
            const validBoardIds =
              Array.isArray(record.boardIds) && record.boardIds.length > 0
                ? record.boardIds.filter((bid) => typeof bid === 'string')
                : boardKeys;

            state.project = {
              id: typeof record.id === 'string' && record.id ? record.id : `proj-${Date.now()}`,
              name: typeof record.name === 'string' ? record.name : 'Untitled Project',
              description: typeof record.description === 'string' ? record.description : '',
              version: typeof record.version === 'string' ? record.version : '1.0.0',
              activePageId:
                record.activePageId && resolvedPages[record.activePageId]
                  ? record.activePageId
                  : validPageIds[0] || 'page-1',
              pageIds: validPageIds,
              activeBoardId: record.activeBoardId || validBoardIds[0] || 'board-1',
              boardIds: validBoardIds,
              createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
              updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
            };
            state.pages = resolvedPages;
            state.nodes = resolvedNodes;
            state.edges = resolvedEdges;
            state.boards = resolvedBoards;
            state.activePageId = state.project.activePageId;
          } else {
            const proj = projectOrRecord as Project;
            resolvedPages =
              pages && typeof pages === 'object' && !Array.isArray(pages) ? pages : {};
            resolvedNodes =
              nodes && typeof nodes === 'object' && !Array.isArray(nodes) ? nodes : {};
            resolvedEdges =
              edges && typeof edges === 'object' && !Array.isArray(edges) ? edges : {};
            resolvedBoards =
              boards && typeof boards === 'object' && !Array.isArray(boards) ? boards : {};

            const pageKeys = Object.keys(resolvedPages);
            const validPageIds =
              Array.isArray(proj?.pageIds) && proj.pageIds.length > 0
                ? proj.pageIds.filter((pid) => typeof pid === 'string')
                : pageKeys;

            const boardKeys = Object.keys(resolvedBoards);
            const validBoardIds =
              Array.isArray(proj?.boardIds) && proj.boardIds.length > 0
                ? proj.boardIds.filter((bid) => typeof bid === 'string')
                : boardKeys;

            state.project = {
              id: typeof proj?.id === 'string' && proj.id ? proj.id : `proj-${Date.now()}`,
              name: typeof proj?.name === 'string' ? proj.name : 'Untitled Project',
              description: typeof proj?.description === 'string' ? proj.description : '',
              version: typeof proj?.version === 'string' ? proj.version : '1.0.0',
              activePageId:
                proj?.activePageId && resolvedPages[proj.activePageId]
                  ? proj.activePageId
                  : validPageIds[0] || 'page-1',
              pageIds: validPageIds,
              activeBoardId: proj?.activeBoardId || validBoardIds[0] || 'board-1',
              boardIds: validBoardIds,
              createdAt: typeof proj?.createdAt === 'number' ? proj.createdAt : Date.now(),
              updatedAt: typeof proj?.updatedAt === 'number' ? proj.updatedAt : Date.now(),
            };
            state.pages = resolvedPages;
            state.nodes = resolvedNodes;
            state.edges = resolvedEdges;
            state.boards = resolvedBoards;
            state.activePageId = state.project.activePageId;
          }

          // Ephemeral UI State Sanitization
          state.toolMode = 'select';
          state.hoveredNodeId = null;
          state.selectedNodeIds = [];
          state.selectedEdgeIds = [];
          state.focusedDiagramId = null;
          state.isDragging = false;
        });
      },

      addPage: (name) => {
        const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const title = name || `Page ${get().project.pageIds.length + 1}`;

        set((state) => {
          const newPage: Page = {
            id,
            projectId: state.project.id,
            boardId:
              state.project.activeBoardId ||
              Object.keys(state.boards)[0] ||
              'board-1',
            title,
            name: title,
            order: state.project.pageIds.length,
            viewport: { x: 0, y: 0, zoom: 1 },
            nodeIds: [],
            edgeIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          state.pages[id] = newPage;
          state.project.pageIds.push(id);
          state.activePageId = id;
          state.project.activePageId = id;

          const board = state.boards[newPage.boardId];
          if (board && !board.pageIds.includes(id)) {
            board.pageIds.push(id);
            board.activePageId = id;
          }

          state.selectedNodeIds = [];
          state.selectedEdgeIds = [];
          state.focusedDiagramId = null;
          state.project.updatedAt = Date.now();
        });

        return id;
      },

      setActivePage: (pageId) => {
        set((state) => {
          if (state.pages[pageId]) {
            state.activePageId = pageId;
            state.project.activePageId = pageId;
            state.selectedNodeIds = [];
            state.selectedEdgeIds = [];
            state.focusedDiagramId = null;

            const boardId = state.pages[pageId].boardId;
            if (boardId && state.boards[boardId]) {
              state.boards[boardId].activePageId = pageId;
            }
          }
        });
      },

      deletePage: (pageId) => {
        set((state) => {
          if (state.project.pageIds.length <= 1) {
            console.warn('[ProjectStore] Cannot delete the only remaining page.');
            return;
          }

          const pageToDelete = state.pages[pageId];
          if (!pageToDelete) return;

          // Cascade delete nodes & edges attached to this page
          const deletedNodeSet = new Set(pageToDelete.nodeIds);
          for (const nodeId of pageToDelete.nodeIds) {
            delete state.nodes[nodeId];
          }
          // Defensive unparenting if any child on any page referenced deleted parent
          for (const node of Object.values(state.nodes)) {
            if (node.parentId && deletedNodeSet.has(node.parentId)) {
              delete node.parentId;
              delete node.extent;
            }
          }
          for (const edgeId of pageToDelete.edgeIds) {
            delete state.edges[edgeId];
          }

          delete state.pages[pageId];
          state.project.pageIds = state.project.pageIds.filter((p) => p !== pageId);

          if (state.activePageId === pageId) {
            const nextActiveId = state.project.pageIds[0];
            state.activePageId = nextActiveId;
            state.project.activePageId = nextActiveId;
          }

          for (const board of Object.values(state.boards)) {
            board.pageIds = board.pageIds.filter((p) => p !== pageId);
            if (board.activePageId === pageId) {
              board.activePageId = state.activePageId;
            }
          }

          state.selectedNodeIds = [];
          state.selectedEdgeIds = [];
          state.project.updatedAt = Date.now();
        });
      },

      updatePageTitle: (pageId, title) => {
        set((state) => {
          const page = state.pages[pageId];
          if (page) {
            page.title = title;
            page.name = title;
            page.updatedAt = Date.now();
            state.project.updatedAt = Date.now();
          }
        });
      },

      setViewport: (pageId, viewport) => {
        set((state) => {
          const page = state.pages[pageId];
          if (page) {
            page.viewport = viewport;
            page.updatedAt = Date.now();
            state.project.updatedAt = Date.now();
          }
        });
      },

      // ----------------------------------------------------------------------
      // Node Operations
      // ----------------------------------------------------------------------

      addNode: (nodeData) => {
        const id =
          nodeData.id ||
          `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const activePageId = get().activePageId;

        set((state) => {
          const defaultData: NeuroNodeData = {
            label: nodeData.data?.label || 'New Node',
            layoutMode:
              nodeData.data?.layoutMode || nodeData.layoutMode || 'manual',
            shapeType: nodeData.data?.shapeType || 'rounded',
            backgroundColor: '#ffffff',
            borderColor: '#94a3b8',
            borderWidth: 1.5,
            color: '#0f172a',
            fontSize: 14,
            textAlign: 'center',
            ...nodeData.data,
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

      updateNodePosition: (id, position) => {
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

      updateNodeData: (id, patch) => {
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

      removeNode: (id) => {
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

      deleteNodes: (ids) => {
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

          // 5. Sanitize selection arrays
          state.selectedNodeIds = state.selectedNodeIds.filter((nid) => !idSet.has(nid));
          state.selectedEdgeIds = state.selectedEdgeIds.filter(
            (eid) => !edgeDeleteSet.has(eid)
          );

          // 6. Update timestamps
          const page = state.pages[state.activePageId];
          if (page) {
            page.updatedAt = Date.now();
          }
          state.project.updatedAt = Date.now();
        });
      },

      // ----------------------------------------------------------------------
      // Edge Operations
      // ----------------------------------------------------------------------

      addEdge: (edgeData) => {
        const id =
          edgeData.id ||
          `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const activePageId = get().activePageId;

        set((state) => {
          const newEdge: NeuroEdge = {
            id,
            source: edgeData.source,
            target: edgeData.target,
            sourceHandle: edgeData.sourceHandle,
            targetHandle: edgeData.targetHandle,
            type: edgeData.type || 'jump',
            label: edgeData.label,
            animated: edgeData.animated,
            style: edgeData.style,
            data: {
              jumpArc: true,
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

      removeEdge: (id) => {
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

      deleteEdges: (ids) => {
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

      // ----------------------------------------------------------------------
      // React Flow v12 Event Handlers
      // ----------------------------------------------------------------------

      onNodesChange: (changes) => {
        set((state) => {
          const activePage = state.pages[state.activePageId];
          if (!activePage) return;

          let isCurrentlyDragging = false;
          let hasPositionOrDimensionChange = false;
          let hasRemoval = false;

          for (const change of changes) {
            if (change.type === 'position') {
              if (change.dragging) {
                isCurrentlyDragging = true;
              }
              if (change.position) {
                hasPositionOrDimensionChange = true;
              }
            } else if (change.type === 'dimensions') {
              hasPositionOrDimensionChange = true;
            }
          }
          state.isDragging = isCurrentlyDragging;

          const currentNodes = activePage.nodeIds
            .map((id) => state.nodes[id])
            .filter((n): n is NeuroNode => Boolean(n));

          const updatedNodes = applyNodeChanges(
            changes,
            currentNodes as unknown as Node[]
          ) as unknown as NeuroNode[];
          for (const node of updatedNodes) {
            state.nodes[node.id] = node;
          }

          for (const change of changes) {
            if (change.type === 'position' && change.position) {
              const node = state.nodes[change.id];
              if (node) {
                if (node.layoutMode === 'auto-elk') {
                  node.layoutMode = 'manual';
                }
                if (node.data && node.data.layoutMode === 'auto-elk') {
                  node.data.layoutMode = 'manual';
                }
              }
            } else if (change.type === 'remove') {
              hasRemoval = true;
              delete state.nodes[change.id];

              // Unparent child nodes if removed node was a container / frame
              for (const node of Object.values(state.nodes)) {
                if (node.parentId === change.id) {
                  delete node.parentId;
                  delete node.extent;
                }
              }

              for (const page of Object.values(state.pages)) {
                page.nodeIds = page.nodeIds.filter((nid) => nid !== change.id);
              }

              // Cascade delete incident edges across all pages
              const edgesToDelete: string[] = [];
              for (const [edgeId, edge] of Object.entries(state.edges)) {
                if (edge.source === change.id || edge.target === change.id) {
                  edgesToDelete.push(edgeId);
                  delete state.edges[edgeId];
                }
              }

              for (const page of Object.values(state.pages)) {
                page.edgeIds = page.edgeIds.filter((eid) => !edgesToDelete.includes(eid));
              }

              // Sanitize selections
              state.selectedNodeIds = state.selectedNodeIds.filter((nid) => nid !== change.id);
              state.selectedEdgeIds = state.selectedEdgeIds.filter(
                (eid) => !edgesToDelete.includes(eid)
              );
            } else if (change.type === 'select') {
              if (change.selected) {
                if (!state.selectedNodeIds.includes(change.id)) {
                  state.selectedNodeIds.push(change.id);
                }
              } else {
                state.selectedNodeIds = state.selectedNodeIds.filter(
                  (id) => id !== change.id
                );
              }
            }
          }

          if (hasPositionOrDimensionChange || hasRemoval) {
            activePage.updatedAt = Date.now();
            state.project.updatedAt = Date.now();
          }
        });
      },

      onEdgesChange: (changes) => {
        set((state) => {
          const activePage = state.pages[state.activePageId];
          if (!activePage) return;

          const currentEdges = activePage.edgeIds
            .map((id) => state.edges[id])
            .filter((e): e is NeuroEdge => Boolean(e));

          const updatedEdges = applyEdgeChanges(
            changes,
            currentEdges as unknown as Edge[]
          ) as unknown as NeuroEdge[];
          for (const edge of updatedEdges) {
            state.edges[edge.id] = edge;
          }

          let hasRemoval = false;

          for (const change of changes) {
            if (change.type === 'remove') {
              hasRemoval = true;
              delete state.edges[change.id];

              for (const page of Object.values(state.pages)) {
                page.edgeIds = page.edgeIds.filter((eid) => eid !== change.id);
              }

              state.selectedEdgeIds = state.selectedEdgeIds.filter((eid) => eid !== change.id);
            } else if (change.type === 'select') {
              if (change.selected) {
                if (!state.selectedEdgeIds.includes(change.id)) {
                  state.selectedEdgeIds.push(change.id);
                }
              } else {
                state.selectedEdgeIds = state.selectedEdgeIds.filter(
                  (id) => id !== change.id
                );
              }
            }
          }

          if (hasRemoval) {
            activePage.updatedAt = Date.now();
            state.project.updatedAt = Date.now();
          }
        });
      },

      onConnect: (connection) => {
        if (!connection.source || !connection.target) return;
        get().addEdge({
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
          type: 'jump',
        });
      },

      // ----------------------------------------------------------------------
      // Ephemeral UI Actions
      // ----------------------------------------------------------------------

      setToolMode: (toolMode) => set({ toolMode }),
      setSelectedNodes: (selectedNodeIds) => set({ selectedNodeIds }),
      setSelectedEdges: (selectedEdgeIds) => set({ selectedEdgeIds }),
      setFocusedDiagramId: (focusedDiagramId) => set({ focusedDiagramId }),
      setHoveredNodeId: (hoveredNodeId) => set({ hoveredNodeId }),

      resetToSeed: () => {
        const seed = createSeedProject();
        get().setProject(
          seed.project,
          seed.pages,
          seed.nodes,
          seed.edges,
          seed.boards
        );
      },

      // ----------------------------------------------------------------------
      // History Undo / Redo Actions with Selection Sanitization
      // ----------------------------------------------------------------------

      undo: () => {
        const temporalApi = (useProjectStore as unknown as { temporal?: { getState: () => TemporalState<unknown> } }).temporal;
        if (temporalApi) {
          temporalApi.getState().undo();
          const current = get();
          // Sanitize ghost selections if undone node/edge disappeared
          if (
            current.selectedNodeIds.some((id) => !current.nodes[id]) ||
            current.selectedEdgeIds.some((id) => !current.edges[id])
          ) {
            set((s) => {
              s.selectedNodeIds = s.selectedNodeIds.filter((id) => Boolean(s.nodes[id]));
              s.selectedEdgeIds = s.selectedEdgeIds.filter((id) => Boolean(s.edges[id]));
            });
          }
          // Fallback if active page was deleted in undo
          if (!current.pages[current.activePageId]) {
            const fallbackId = current.project.pageIds[0] || Object.keys(current.pages)[0];
            if (fallbackId) {
              set((s) => {
                s.activePageId = fallbackId;
                s.project.activePageId = fallbackId;
              });
            }
          }
        }
      },

      redo: () => {
        const temporalApi = (useProjectStore as unknown as { temporal?: { getState: () => TemporalState<unknown> } }).temporal;
        if (temporalApi) {
          temporalApi.getState().redo();
          const current = get();
          if (
            current.selectedNodeIds.some((id) => !current.nodes[id]) ||
            current.selectedEdgeIds.some((id) => !current.edges[id])
          ) {
            set((s) => {
              s.selectedNodeIds = s.selectedNodeIds.filter((id) => Boolean(s.nodes[id]));
              s.selectedEdgeIds = s.selectedEdgeIds.filter((id) => Boolean(s.edges[id]));
            });
          }
          if (!current.pages[current.activePageId]) {
            const fallbackId = current.project.pageIds[0] || Object.keys(current.pages)[0];
            if (fallbackId) {
              set((s) => {
                s.activePageId = fallbackId;
                s.project.activePageId = fallbackId;
              });
            }
          }
        }
      },
    })),
    {
      // History Filtering: Only persist scene graph data in Zundo
      partialize: (state) => ({
        project: state.project,
        boards: state.boards,
        pages: state.pages,
        nodes: state.nodes,
        edges: state.edges,
        activePageId: state.activePageId,
      }),
      equality: (pastState, currentState) =>
        pastState.project === currentState.project &&
        pastState.boards === currentState.boards &&
        pastState.pages === currentState.pages &&
        pastState.nodes === currentState.nodes &&
        pastState.edges === currentState.edges &&
        pastState.activePageId === currentState.activePageId,
      limit: 100,
      handleSet: (handleSet) => (state) => {
        // Skip history recording while dragging to prevent frame-by-frame history bloat
        if ((state as unknown as ProjectState).isDragging) {
          return;
        }
        return handleSet(state);
      },
    }
  )
);

// ============================================================================
// 4. Reactive Selectors & Temporal Hooks
// ============================================================================

export const useActivePageNodes = (): NeuroNode[] => {
  try {
    const activePageId = useProjectStore((state) => state.activePageId);
    const pages = useProjectStore((state) => state.pages);
    const nodes = useProjectStore((state) => state.nodes);
    return useMemo(() => {
      const activePage = pages[activePageId];
      if (!activePage || !Array.isArray(activePage.nodeIds)) return [];
      return activePage.nodeIds
        .map((id) => nodes[id])
        .filter((n): n is NeuroNode => Boolean(n));
    }, [activePageId, pages, nodes]);
  } catch {
    const state = useProjectStore.getState();
    const activePage = state.pages?.[state.activePageId];
    if (!activePage || !Array.isArray(activePage.nodeIds)) return [];
    return activePage.nodeIds
      .map((id) => state.nodes?.[id])
      .filter((n): n is NeuroNode => Boolean(n));
  }
};

export const useActivePageEdges = (): NeuroEdge[] => {
  try {
    const activePageId = useProjectStore((state) => state.activePageId);
    const pages = useProjectStore((state) => state.pages);
    const edges = useProjectStore((state) => state.edges);
    return useMemo(() => {
      const activePage = pages[activePageId];
      if (!activePage || !Array.isArray(activePage.edgeIds)) return [];
      return activePage.edgeIds
        .map((id) => edges[id])
        .filter((e): e is NeuroEdge => Boolean(e));
    }, [activePageId, pages, edges]);
  } catch {
    const state = useProjectStore.getState();
    const activePage = state.pages?.[state.activePageId];
    if (!activePage || !Array.isArray(activePage.edgeIds)) return [];
    return activePage.edgeIds
      .map((id) => state.edges?.[id])
      .filter((e): e is NeuroEdge => Boolean(e));
  }
};

export const useActivePage = (): Page | undefined => {
  try {
    return useProjectStore((state) => state.pages[state.activePageId]);
  } catch {
    const state = useProjectStore.getState();
    return state.pages?.[state.activePageId];
  }
};

export const useTemporal = () => {
  const pastStates = useStore(
    useProjectStore.temporal,
    (state) => state.pastStates
  );
  const futureStates = useStore(
    useProjectStore.temporal,
    (state) => state.futureStates
  );
  const { undo, redo, clear, pause, resume } = useProjectStore.temporal.getState();

  return {
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
    undo,
    redo,
    clear,
    pause,
    resume,
  };
};

export const undo = () => useProjectStore.temporal.getState().undo();
export const redo = () => useProjectStore.temporal.getState().redo();
export const clearHistory = () => useProjectStore.temporal.getState().clear();
