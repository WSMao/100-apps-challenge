/**
 * Creative-Neuro Phase 1 Store Subsystem - Slices & Store Types
 * Path: src/store/slices/types.ts
 */

import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  Viewport,
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
  ThemeMode,
  SpawnDirection,
  ProjectSummary,
  LayoutMode,
  EdgeRoutingType,
  SelectionFilter,
  NodeStyle,
} from '../../types/index.ts';

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
  editingNodeId: string | null;
  editingInitialValue: string | null;
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
  lastCreatedNodeType: NeuroNodeType;
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
  hidePage: (pageId: string) => void;
  reopenPage: (pageId: string, activate?: boolean) => void;
  updatePageTitle: (pageId: string, title: string) => void;
  setPageLineJump: (enabled: boolean, pageId?: string) => void;
  togglePageLineJump: (pageId?: string) => void;
  setViewport: (pageId: string, viewport: Viewport) => void;
  setToolMode: (mode: ToolMode) => void;
  setSelectedNodes: (ids: string[]) => void;
  setSelectedEdges: (ids: string[]) => void;
  setEditingNodeId: (id: string | null, initialValue?: string | null) => void;
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
  bringForward: (nodeIdOrIds: string | string[]) => void;
  sendBackward: (nodeIdOrIds: string | string[]) => void;
  groupSelectedNodes: (title?: string) => string | null;
  ungroupNodes: (frameId: string) => void;
  setGroupStyle: (groupId: string, style: Partial<NodeStyle> | null) => void;
  captureNodesInFrame: (frameId: string) => string[];
  toggleFrameCollapse: (frameId: string) => void;

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
  spawnNodeForLastCreatedType: (centerPos: Point) => string;
}

export type ProjectStore = ProjectState & ProjectActions;

export type StoreSet = {
  (updater: (state: ProjectStore) => void, shouldReplace?: boolean): void;
  (nextState: Partial<ProjectStore>, shouldReplace?: boolean): void;
};

export type StoreGet = () => ProjectStore;


