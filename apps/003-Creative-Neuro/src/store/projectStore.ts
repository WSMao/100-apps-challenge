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
  NeuroEdgeData,
  NeuroNodeData,
  NeuroNodeType,
  ToolMode,
  Point,
  Viewport,
  ThemeMode,
  SpawnDirection,
  ProjectSummary,
  LayoutMode,
  EdgeRoutingType,
  SelectionFilter,
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
  isResizing: boolean;

  // --- Requirements State ---
  themeMode: ThemeMode;
  lastDirection: SpawnDirection;
  pageLayoutMode: LayoutMode;
  connectorSourceNodeId: string | null;
  defaultEdgeRoutingType: EdgeRoutingType;
  availableProjects: ProjectSummary[];
  selectionFilter: SelectionFilter;
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
  batchUpdateNodeData: (ids: string[], data: Partial<NeuroNodeData>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: Omit<NeuroEdge, 'id'> & { id?: string }) => string;
  updateEdgeData: (id: string, data: Partial<NeuroEdgeData>) => void;
  batchUpdateEdgeData: (ids: string[], data: Partial<NeuroEdgeData>) => void;
  reconnectEdge: (edgeId: string, newConnection: Connection) => void;
  removeEdge: (id: string) => void;
  undo: () => void;
  redo: () => void;
  addConnectedNode: (
    node: Omit<Partial<NeuroNode>, 'data'> & {
      type?: NeuroNodeType;
      data?: Partial<NeuroNodeData>;
    },
    edge?: Omit<NeuroEdge, 'id'> & { id?: string }
  ) => { nodeId: string; edgeId?: string };
  batchDelete: (nodeIds?: string[], edgeIds?: string[]) => void;

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

  // Requirements: OP-07, PM, TL, UI-04, FN
  setLastDirection: (dir: SpawnDirection) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPageLayoutMode: (mode: LayoutMode) => void;
  setNodeLayoutMode: (nodeId: string, mode: LayoutMode) => void;
  batchSetNodeLayoutMode: (nodeIds: string[], mode: LayoutMode) => void;
  setDefaultEdgeRoutingType: (type: EdgeRoutingType) => void;
  handleConnectorNodeClick: (nodeId: string) => string | null;
  resetConnector: () => void;
  toggleNodeSelection: (nodeId: string) => void;
  bringToFront: (nodeIdOrIds: string | string[]) => void;
  sendToBack: (nodeIdOrIds: string | string[]) => void;
  groupSelectedNodes: (title?: string) => string | null;
  ungroupNodes: (frameId: string) => void;

  // Project Management Actions (PM-01, PM-02)
  createProject: (name?: string) => string;
  switchProject: (projectId: string) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  refreshAvailableProjects: () => Promise<void>;

  // Selection Filter Actions
  setSelectionFilter: (filter: Partial<SelectionFilter>) => void;
  toggleSelectionFilterItem: (key: keyof SelectionFilter) => void;
  resetSelectionFilter: () => void;
  clearSelectionFilter: () => void;
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
  isResizing: false,

  themeMode: 'light',
  lastDirection: 'right',
  pageLayoutMode: 'auto-elk',
  connectorSourceNodeId: null,
  defaultEdgeRoutingType: 'jump',
  availableProjects: [
    {
      id: initialSeed.project.id,
      name: initialSeed.project.name,
      updatedAt: initialSeed.project.updatedAt,
      pageCount: initialSeed.project.pageIds.length,
    },
  ],
  selectionFilter: {
    shape: true,
    text: true,
    edge: true,
    frame: true,
    diagram: true,
  },
};

// ============================================================================
// 3. Zustand Store Definition with Immer & Zundo
// ============================================================================

function areNodesEqualExcludingTransient(
  a?: Record<string, NeuroNode>,
  b?: Record<string, NeuroNode>
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const id of keysA) {
    const na = a[id];
    const nb = b[id];
    if (na === nb) continue;
    if (!na || !nb) return false;
    if (
      na.id !== nb.id ||
      na.type !== nb.type ||
      na.position.x !== nb.position.x ||
      na.position.y !== nb.position.y ||
      na.width !== nb.width ||
      na.height !== nb.height ||
      na.parentId !== nb.parentId ||
      na.extent !== nb.extent ||
      na.groupId !== nb.groupId ||
      na.layoutMode !== nb.layoutMode ||
      na.zIndex !== nb.zIndex ||
      na.hidden !== nb.hidden ||
      na.data !== nb.data
    ) {
      return false;
    }
  }
  return true;
}

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

            const rawRecordName = typeof record.name === 'string' ? record.name : 'Untitled Project';
            const recordName =
              rawRecordName === 'Creative-Neuro Showcase' ||
              rawRecordName.startsWith('Creative-Neuro') ||
              record.id === 'proj-creative-neuro-demo'
                ? 'Demo'
                : rawRecordName;

            state.project = {
              id: typeof record.id === 'string' && record.id ? record.id : `proj-${Date.now()}`,
              name: recordName,
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

            const rawProjName = typeof proj?.name === 'string' ? proj.name : 'Untitled Project';
            const projName =
              rawProjName === 'Creative-Neuro Showcase' ||
              rawProjName.startsWith('Creative-Neuro') ||
              proj?.id === 'proj-creative-neuro-demo'
                ? 'Demo'
                : rawProjName;

            state.project = {
              id: typeof proj?.id === 'string' && proj.id ? proj.id : `proj-${Date.now()}`,
              name: projName,
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

          // Sanitize text nodes to guarantee transparent background and border
          for (const node of Object.values(state.nodes)) {
            if (node && node.type === 'text') {
              if (!node.data) node.data = { label: '', layoutMode: 'manual' };
              if (
                !node.data.backgroundColor ||
                node.data.backgroundColor === '#ffffff' ||
                node.data.backgroundColor === '#f8fafc' ||
                node.data.backgroundColor === 'white' ||
                node.id === 'mm-note'
              ) {
                node.data.backgroundColor = 'transparent';
                node.data.borderColor = 'transparent';
                node.data.borderWidth = 0;
              }
            }
          }

          // Ephemeral UI State Sanitization
          state.toolMode = 'select';
          state.hoveredNodeId = null;
          state.selectedNodeIds = [];
          state.selectedEdgeIds = [];
          state.focusedDiagramId = null;
          state.isDragging = false;
        });

        const temporal = (useProjectStore as unknown as { temporal?: { getState: () => TemporalState<unknown> } }).temporal;
        temporal?.getState().clear();
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
        const temporal = (useProjectStore as unknown as { temporal?: { getState: () => TemporalState<unknown> } }).temporal;
        temporal?.getState().pause();
        try {
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
        } finally {
          temporal?.getState().resume();
        }
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

      addConnectedNode: (nodeData, edgeData) => {
        const nodeId =
          nodeData.id ||
          `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const activePageId = get().activePageId;
        const defaultRouting = get().defaultEdgeRoutingType || 'jump';

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
                jumpArc: routing === 'jump',
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

      batchUpdateNodeData: (ids, patch) => {
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
        const defaultRouting = get().defaultEdgeRoutingType || 'jump';
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
              jumpArc: routing === 'jump',
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

      updateEdgeData: (id, patch) => {
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

      batchUpdateEdgeData: (ids, patch) => {
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

      reconnectEdge: (edgeId, newConnection) => {
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

      batchDelete: (nodeIds = [], edgeIds = []) => {
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

          // 5. Sanitize selection arrays
          state.selectedNodeIds = state.selectedNodeIds.filter((nid) => !nodeIdSet.has(nid));
          state.selectedEdgeIds = state.selectedEdgeIds.filter((eid) => !allEdgesToDelete.has(eid));

          // 6. Timestamps
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
        let hasStructuralCandidate = false;
        const currentState = get();
        for (const change of changes) {
          if (change.type === 'remove') {
            hasStructuralCandidate = true;
            break;
          }
          if (change.type === 'dimensions' && change.resizing && change.dimensions) {
            const existing = currentState.nodes[change.id];
            if (
              !existing ||
              existing.width !== change.dimensions.width ||
              existing.height !== change.dimensions.height
            ) {
              hasStructuralCandidate = true;
              break;
            }
          }
          if (change.type === 'position' && change.position) {
            const existing = currentState.nodes[change.id];
            if (
              !existing ||
              existing.position.x !== change.position.x ||
              existing.position.y !== change.position.y
            ) {
              hasStructuralCandidate = true;
              break;
            }
          }
        }

        const temporal = (
          useProjectStore as unknown as {
            temporal?: { getState: () => TemporalState<unknown> };
          }
        ).temporal;
        const wasTracking = temporal?.getState().isTracking;
        if (!hasStructuralCandidate && wasTracking) {
          temporal?.getState().pause();
        }

        try {
          set((state) => {
            const activePage = state.pages[state.activePageId];
            if (!activePage) return;

            let isCurrentlyDragging = false;
            let isCurrentlyResizing = false;
            let hasPositionOrDimensionChange = false;
            let hasRemoval = false;

            // 1. Separate select changes and filter automated DOM measurements
            const selectChanges: Extract<NodeChange<Node>, { type: 'select' }>[] = [];
            const structuralChanges: NodeChange<Node>[] = [];

            for (const change of changes) {
              if (change.type === 'select') {
                selectChanges.push(change);
              } else if (change.type === 'dimensions') {
                // Ignore automated ResizeObserver DOM measurements when user is not manually resizing
                if (change.resizing) {
                  isCurrentlyResizing = true;
                  const existing = state.nodes[change.id];
                  if (
                    !existing ||
                    !change.dimensions ||
                    existing.width !== change.dimensions.width ||
                    existing.height !== change.dimensions.height
                  ) {
                    hasPositionOrDimensionChange = true;
                    structuralChanges.push(change);
                  }
                }
              } else if (change.type === 'position') {
                if (change.dragging) {
                  isCurrentlyDragging = true;
                }
                const existing = state.nodes[change.id];
                if (existing) {
                  if (change.dragging === false) {
                    delete existing.dragging;
                  } else if (change.dragging === true) {
                    existing.dragging = true;
                    if (existing.layoutMode === 'auto-elk') {
                      existing.layoutMode = 'manual';
                    }
                    if (existing.data && existing.data.layoutMode === 'auto-elk') {
                      existing.data.layoutMode = 'manual';
                    }
                  }
                }
                if (change.position) {
                  if (
                    !existing ||
                    existing.position.x !== change.position.x ||
                    existing.position.y !== change.position.y
                  ) {
                    hasPositionOrDimensionChange = true;
                    structuralChanges.push(change);
                  }
                } else {
                  structuralChanges.push(change);
                }
              } else {
                structuralChanges.push(change);
              }
            }
            state.isDragging = isCurrentlyDragging;
            state.isResizing = isCurrentlyResizing;

            // When dragging is inactive, purge any stranded dragging flags across all nodes
            if (!isCurrentlyDragging) {
              for (const node of Object.values(state.nodes)) {
                if (node && 'dragging' in node) {
                  delete node.dragging;
                }
              }
            }

            // 2. Handle selection changes on ephemeral state only (does NOT mutate state.nodes or produce history entries)
            if (selectChanges.length > 0) {
              const currentSelected = new Set(state.selectedNodeIds);
              const nextSelected = new Set(state.selectedNodeIds);

              for (const change of selectChanges) {
                if (change.selected) {
                  const node = state.nodes[change.id];
                  const gid = node?.groupId || node?.data?.groupId;
                  const toAdd = gid
                    ? Object.values(state.nodes)
                        .filter((n) => n.groupId === gid || n.data?.groupId === gid)
                        .map((n) => n.id)
                    : [change.id];
                  for (const aid of toAdd) {
                    nextSelected.add(aid);
                  }
                } else {
                  nextSelected.delete(change.id);
                }
              }

              if (
                currentSelected.size !== nextSelected.size ||
                Array.from(nextSelected).some((id) => !currentSelected.has(id))
              ) {
                state.selectedNodeIds = Array.from(nextSelected);
              }
            }

            // 3. Apply structural changes (position, manual resize, remove) to state.nodes
            if (structuralChanges.length > 0) {
              const currentNodes = activePage.nodeIds
                .map((id) => state.nodes[id])
                .filter((n): n is NeuroNode => Boolean(n));

              const updatedNodes = applyNodeChanges(
                structuralChanges,
                currentNodes as unknown as Node[]
              ) as unknown as NeuroNode[];
              for (const node of updatedNodes) {
                state.nodes[node.id] = node;
              }

              for (const change of structuralChanges) {
                if (change.type === 'position' && change.position) {
                  const node = state.nodes[change.id];
                  if (node) {
                    if (node.layoutMode === 'auto-elk') {
                      node.layoutMode = 'manual';
                    }
                    if (node.data && node.data.layoutMode === 'auto-elk') {
                      node.data.layoutMode = 'manual';
                    }
                    if (change.dragging === false) {
                      delete node.dragging;
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
              }
            }

            // Post-apply safeguard: purge any stranded dragging flags across all nodes when inactive
            if (!isCurrentlyDragging) {
              for (const node of Object.values(state.nodes)) {
                if (node && 'dragging' in node) {
                  delete node.dragging;
                }
              }
            }
          }

          if (hasPositionOrDimensionChange || hasRemoval) {
            activePage.updatedAt = Date.now();
            state.project.updatedAt = Date.now();
          }
        });
      } finally {
        if (!hasStructuralCandidate && wasTracking) {
          temporal?.getState().resume();
        }
      }
    },

      onEdgesChange: (changes) => {
        set((state) => {
          const activePage = state.pages[state.activePageId];
          if (!activePage) return;

          const selectChanges: Extract<EdgeChange<Edge>, { type: 'select' }>[] = [];
          const structuralChanges: EdgeChange<Edge>[] = [];

          for (const change of changes) {
            if (change.type === 'select') {
              selectChanges.push(change);
            } else {
              structuralChanges.push(change);
            }
          }

          // Handle select changes on ephemeral state only
          if (selectChanges.length > 0) {
            const currentSelected = new Set(state.selectedEdgeIds);
            const nextSelected = new Set(state.selectedEdgeIds);

            for (const change of selectChanges) {
              if (change.selected) {
                nextSelected.add(change.id);
              } else {
                nextSelected.delete(change.id);
              }
            }

            if (
              currentSelected.size !== nextSelected.size ||
              Array.from(nextSelected).some((id) => !currentSelected.has(id))
            ) {
              state.selectedEdgeIds = Array.from(nextSelected);
            }
          }

          if (structuralChanges.length > 0) {
            const currentEdges = activePage.edgeIds
              .map((id) => state.edges[id])
              .filter((e): e is NeuroEdge => Boolean(e));

            const updatedEdges = applyEdgeChanges(
              structuralChanges,
              currentEdges as unknown as Edge[]
            ) as unknown as NeuroEdge[];
            for (const edge of updatedEdges) {
              state.edges[edge.id] = edge;
            }

            let hasRemoval = false;
            for (const change of structuralChanges) {
              if (change.type === 'remove') {
                hasRemoval = true;
                delete state.edges[change.id];

                for (const page of Object.values(state.pages)) {
                  page.edgeIds = page.edgeIds.filter((eid) => eid !== change.id);
                }

                state.selectedEdgeIds = state.selectedEdgeIds.filter((eid) => eid !== change.id);
              }
            }

            if (hasRemoval) {
              activePage.updatedAt = Date.now();
              state.project.updatedAt = Date.now();
            }
          }
        });
      },

      onConnect: (connection) => {
        if (!connection.source || !connection.target) return;
        const routing = get().defaultEdgeRoutingType || 'jump';
        get().addEdge({
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
          type: routing,
          data: {
            routingType: routing,
            jumpArc: routing === 'jump',
          },
        });
      },

      // ----------------------------------------------------------------------
      // Ephemeral UI Actions
      // ----------------------------------------------------------------------

      setToolMode: (toolMode) => set({ toolMode }),
      setSelectedNodes: (selectedNodeIds) => {
        const state = get();
        const expanded = new Set<string>();
        for (const id of selectedNodeIds) {
          expanded.add(id);
          const node = state.nodes[id];
          const gid = node?.groupId || node?.data?.groupId;
          if (gid) {
            for (const other of Object.values(state.nodes)) {
              if (other.groupId === gid || other.data?.groupId === gid) {
                expanded.add(other.id);
              }
            }
          }
        }
        const currentSet = new Set(state.selectedNodeIds);
        if (
          currentSet.size === expanded.size &&
          Array.from(expanded).every((id) => currentSet.has(id))
        ) {
          return;
        }
        set({ selectedNodeIds: Array.from(expanded) });
      },
      setSelectedEdges: (selectedEdgeIds) => {
        const state = get();
        const currentSet = new Set(state.selectedEdgeIds);
        const incomingSet = new Set(selectedEdgeIds);
        if (
          currentSet.size === incomingSet.size &&
          selectedEdgeIds.every((id) => currentSet.has(id))
        ) {
          return;
        }
        set({ selectedEdgeIds });
      },
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
        get().resetSelectionFilter();
      },

      // ----------------------------------------------------------------------
      // Requirements Actions: OP-07, PM, TL, UI-04, FN
      // ----------------------------------------------------------------------

      setLastDirection: (lastDirection) => set({ lastDirection }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setPageLayoutMode: (pageLayoutMode) => set({ pageLayoutMode }),

      setNodeLayoutMode: (nodeId, mode) => {
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

      batchSetNodeLayoutMode: (ids, mode) => {
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

      setDefaultEdgeRoutingType: (defaultEdgeRoutingType) => set({ defaultEdgeRoutingType }),

      handleConnectorNodeClick: (nodeId) => {
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

        const routing = get().defaultEdgeRoutingType || 'jump';

        // Establish edge between currentSource and nodeId with optimal handles
        const edgeId = get().addEdge({
          source: currentSource,
          target: nodeId,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: routing,
          data: {
            routingType: routing,
            jumpArc: routing === 'jump',
          },
        });

        // Reset connector source so user can continuously connect another pair
        set({ connectorSourceNodeId: null });
        return edgeId;
      },

      resetConnector: () => set({ connectorSourceNodeId: null }),

      toggleNodeSelection: (nodeId) => {
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

      bringToFront: (nodeIdOrIds) => {
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

      sendToBack: (nodeIdOrIds) => {
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

      groupSelectedNodes: (title?: string) => {
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

      createProject: (name = 'New Project') => {
        const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const pageId = `page-${Date.now()}-1`;
        const boardId = `board-${Date.now()}-1`;

        const newProject: Project = {
          id,
          name,
          version: '1.0.0',
          activeBoardId: boardId,
          boardIds: [boardId],
          activePageId: pageId,
          pageIds: [pageId],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const newBoard: Board = {
          id: boardId,
          projectId: id,
          name: 'Main Board',
          activePageId: pageId,
          pageIds: [pageId],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const newPage: Page = {
          id: pageId,
          projectId: id,
          boardId,
          title: 'Page 1',
          name: 'Page 1',
          order: 0,
          viewport: { x: 0, y: 0, zoom: 1 },
          nodeIds: [],
          edgeIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((s) => {
          s.project = newProject;
          s.boards = { [boardId]: newBoard };
          s.pages = { [pageId]: newPage };
          s.nodes = {};
          s.edges = {};
          s.activePageId = pageId;
          s.selectedNodeIds = [];
          s.selectedEdgeIds = [];
          s.focusedDiagramId = null;

          // Update available project list
          const summary: ProjectSummary = {
            id,
            name,
            updatedAt: Date.now(),
            pageCount: 1,
          };
          s.availableProjects = [
            summary,
            ...s.availableProjects.filter((p) => p.id !== id),
          ];
        });

        const temporal = (useProjectStore as unknown as { temporal?: { getState: () => TemporalState<unknown> } }).temporal;
        temporal?.getState().clear();

        return id;
      },

      switchProject: async (projectId) => {
        try {
          const dbMod = await import('../db/index.ts');
          const rec = await dbMod.db.projects.get(projectId);
          if (rec) {
            get().setProject(rec, rec.pages, rec.nodes, rec.edges, rec.boards);
            return true;
          }
        } catch {
          // ignore
        }

        // Fallback for in-memory / test environments
        if (projectId === initialSeed.project.id) {
          get().resetToSeed();
          return true;
        }
        return false;
      },

      deleteProject: async (projectId) => {
        set((s) => {
          s.availableProjects = s.availableProjects.filter((p) => p.id !== projectId);
        });
        try {
          const dbMod = await import('../db/index.ts');
          await dbMod.db.projects.delete(projectId);
          return true;
        } catch {
          return true;
        }
      },

      refreshAvailableProjects: async () => {
        try {
          const dbMod = await import('../db/index.ts');
          const allProjects = await dbMod.db.projects.toArray();
          if (allProjects.length > 0) {
            const summaries: ProjectSummary[] = allProjects.map((p) => ({
              id: p.id,
              name: p.name,
              updatedAt: p.updatedAt,
              pageCount: p.pageIds?.length || Object.keys(p.pages || {}).length,
            }));
            set({ availableProjects: summaries });
          }
        } catch {
          // ignore in tests
        }
      },

      // ----------------------------------------------------------------------
      // History Undo / Redo Actions with Selection Sanitization
      // ----------------------------------------------------------------------

      undo: () => {
        if (get().isDragging) return;
        const temporalApi = (useProjectStore as unknown as { temporal?: { getState: () => TemporalState<unknown> } }).temporal;
        if (temporalApi) {
          temporalApi.getState().undo();
          const current = get();
          const wasTracking = temporalApi.getState().isTracking;
          temporalApi.getState().pause();
          try {
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
          } finally {
            if (wasTracking) {
              temporalApi.getState().resume();
            } else {
              temporalApi.getState().pause();
            }
          }
        }
      },

      setSelectionFilter: (filter) => {
        set((state) => {
          state.selectionFilter = {
            ...state.selectionFilter,
            ...filter,
          };
        });
      },

      toggleSelectionFilterItem: (key) => {
        set((state) => {
          state.selectionFilter[key] = !state.selectionFilter[key];
        });
      },

      resetSelectionFilter: () => {
        set((state) => {
          state.selectionFilter = {
            shape: true,
            text: true,
            edge: true,
            frame: true,
            diagram: true,
          };
        });
      },

      clearSelectionFilter: () => {
        set((state) => {
          state.selectionFilter = {
            shape: false,
            text: false,
            edge: false,
            frame: false,
            diagram: false,
          };
        });
      },

      redo: () => {
        if (get().isDragging) return;
        const temporalApi = (useProjectStore as unknown as { temporal?: { getState: () => TemporalState<unknown> } }).temporal;
        if (temporalApi) {
          temporalApi.getState().redo();
          const current = get();
          const wasTracking = temporalApi.getState().isTracking;
          temporalApi.getState().pause();
          try {
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
          } finally {
            if (wasTracking) {
              temporalApi.getState().resume();
            } else {
              temporalApi.getState().pause();
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
      equality: (pastState, currentState) => {
        const nodesEqual =
          pastState.nodes === currentState.nodes ||
          areNodesEqualExcludingTransient(pastState.nodes, currentState.nodes);
        const edgesEqual = pastState.edges === currentState.edges;
        const pagesEqual = pastState.pages === currentState.pages;
        const boardsEqual = pastState.boards === currentState.boards;
        const activePageEqual = pastState.activePageId === currentState.activePageId;
        const projectEqual =
          pastState.project === currentState.project ||
          (pastState.project.id === currentState.project.id &&
            pastState.project.name === currentState.project.name &&
            pastState.project.activeBoardId === currentState.project.activeBoardId &&
            pastState.project.activePageId === currentState.project.activePageId &&
            pastState.project.pageIds === currentState.project.pageIds &&
            pastState.project.boardIds === currentState.project.boardIds);

        return (
          nodesEqual &&
          edgesEqual &&
          pagesEqual &&
          boardsEqual &&
          activePageEqual &&
          projectEqual
        );
      },
      limit: 100,
      handleSet: (handleSet) => (pastState, replace, currentState, deltaState) => {
        const storeState = useProjectStore?.getState?.() as ProjectState | undefined;
        // Skip history recording while dragging or resizing to prevent frame-by-frame history bloat
        if (storeState?.isDragging || storeState?.isResizing) {
          return;
        }
        return (handleSet as any)(pastState, replace, currentState, deltaState);
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
  const canUndo = useStore(
    useProjectStore.temporal,
    (s) => s.pastStates.length > 0
  );
  const canRedo = useStore(
    useProjectStore.temporal,
    (s) => s.futureStates.length > 0
  );
  const { clear, pause, resume } = useProjectStore.temporal.getState();

  return {
    canUndo,
    canRedo,
    undo: () => useProjectStore.getState().undo(),
    redo: () => useProjectStore.getState().redo(),
    clear,
    pause,
    resume,
  };
};

export const undo = () => useProjectStore.getState().undo();
export const redo = () => useProjectStore.getState().redo();

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
export const clearHistory = () => useProjectStore.temporal.getState().clear();
