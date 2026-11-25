/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Layer 1 Core Type System & Normalized Scene Graph Schema
 *
 * Conforms to:
 * - React Flow v12 (@xyflow/react)
 * - ELKjs layered layout engine (elkjs/lib/elk.bundled.js)
 * - CodeMirror 6 Mermaid AST parser & serializer
 * - Dexie.js v4 IndexedDB persistence
 * - Zundo temporal undo/redo history filtering
 */

// ============================================================================
// 1. Primitive & Geometric Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BoundingBox extends Point, Size {}

export interface FreehandPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// ============================================================================
// 2. Enums & Literal Unions
// ============================================================================

// Layout state is a single boolean `locked` on Canvas Objects (`NeuroNode.locked`),
// while Auto Layout controls live at the container level (Page & Diagram).

/**
 * Supported geometric shapes for flowchart and mindmap nodes.
 */
export type ShapeType =
  | 'rectangle'
  | 'rounded'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'database'
  | 'pill'
  | 'stadium'
  | 'subroutine'
  | 'note'
  | 'hexagon';

/**
 * Registered canvas node component types in React Flow.
 */
export type NeuroNodeType =
  | 'shape'
  | 'text'
  | 'frame'
  | 'diagram'
  | 'freehand'
  | 'pageCard'
  | 'image';

/**
 * Workspace toolbar interaction modes.
 */
export type ToolMode =
  | 'select'
  | 'shape'
  | 'text'
  | 'connect'
  | 'draw'
  | 'frame'
  | 'diagram'
  | 'mindmap'
  | 'image';

/**
 * Connector line rendering types.
 */
export type EdgeType = 'smoothstep' | 'bezier' | 'straight' | 'default';

export type EdgeRoutingType = 'smoothstep' | 'bezier' | 'straight';

/**
 * Diagram object interaction modes:
 * - 'embedded': Inline preview card on infinite canvas.
 * - 'focused': Full split-screen with CodeMirror 6 editor on left, camera focused on diagram.
 */
export type DiagramMode = 'embedded' | 'focused';

/**
 * Directional flow directive for Mermaid subgraphs and ELK layouts.
 */
export type DiagramOrientation = 'TB' | 'LR' | 'BT' | 'RL' | 'TD';
export type FlowDirection = DiagramOrientation;
export type MindMapDirection = 'radial' | 'right' | 'down';

export type ThemeMode = 'light' | 'dark';
export type SpawnDirection = 'top' | 'right' | 'bottom' | 'left';

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  pageCount: number;
}

// ============================================================================
// 3. Styling & Presentation Types
// ============================================================================

export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  color?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  opacity?: number;
  strokeDasharray?: string;
}

export interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  animated?: boolean;
}

// ============================================================================
// 4. Data Payloads (Node & Edge Data)
// ============================================================================

export interface NeuroNodeData {
  label: string;
  shapeType?: ShapeType;
  locked?: boolean;

  // Visual & Presentation Styling
  style?: NodeStyle;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';

  // Diagram Node specific properties (Mermaid DSL & MindMap Mode)
  mermaidCode?: string;
  diagramMode?: DiagramMode;
  diagramKind?: 'flowchart' | 'mindmap';
  diagramOrientation?: DiagramOrientation;
  mindMapDirection?: MindMapDirection;
  isMindMapRoot?: boolean;
  continuousLayout?: boolean;
  isFocused?: boolean;
  lineJump?: boolean;

  // Freehand Doodle specific properties (perfect-freehand)
  freehandPoints?: FreehandPoint[];
  points?: Array<[number, number, number?]>; // [x, y, pressure?]
  strokeColor?: string;
  strokeWidth?: number;

  // Frame / Subgraph specific properties
  title?: string;
  collapsed?: boolean;
  minWidth?: number;
  minHeight?: number;
  direction?: DiagramOrientation;

  // Logical Grouping property (FN-04)
  groupId?: string;

  // Page Card specific properties (inter-page navigation)
  targetPageId?: string;

  // Image Node specific properties (IndexedDB Asset or external URL)
  assetId?: string;
  src?: string;
  alt?: string;
  fileName?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  objectFit?: 'contain' | 'cover' | 'fill';

  // Algorithmic flags
  isUnplaced?: boolean;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NeuroEdgeData {
  label?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  routingType?: EdgeRoutingType;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  color?: string;
  strokeWidth?: number;
  animated?: boolean;
  jumpArc?: boolean;
  jumpPoints?: Point[];
  [key: string]: unknown;
}

// ============================================================================
// 5. Scene Graph Entities (React Flow Compatible)
// ============================================================================

export interface NeuroNode {
  id: string;
  type: NeuroNodeType;
  position: Point;
  size?: Size;
  width?: number;
  height?: number;
  parentId?: string; // Container grouping (FrameNode / DiagramNode)
  extent?: 'parent';
  groupId?: string; // Logical Grouping (FN-04)
  locked?: boolean;
  data: NeuroNodeData;
  selected?: boolean;
  dragging?: boolean;
  measured?: { width?: number; height?: number };
  zIndex?: number;
  hidden?: boolean;
}

export interface NeuroEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // 'top' | 'right' | 'bottom' | 'left'
  targetHandle?: string;
  type?: EdgeType;
  label?: string;
  animated?: boolean;
  style?: EdgeStyle;
  data?: NeuroEdgeData;
}

// ============================================================================
// 6. Hierarchy Entities (Project -> Board -> Page)
// ============================================================================

export interface Page {
  id: string;
  projectId: string;
  boardId: string;
  title: string;
  name?: string; // Alias for title
  order: number;
  hidden?: boolean;
  viewport: Viewport;
  lineJump?: boolean;
  nodeIds: string[];
  edgeIds: string[];
  nodes?: Record<string, NeuroNode>;
  edges?: Record<string, NeuroEdge>;
  groupStyles?: Record<string, NodeStyle>;
  createdAt: number;
  updatedAt: number;
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  activePageId: string;
  pageIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  version: string;
  activeBoardId: string;
  boardIds: string[];
  activePageId: string;
  pageIds: string[];
  boards?: Record<string, Board>;
  pages?: Record<string, Page>;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// 7. Aggregate & Serialized Schemas (Dexie & Export)
// ============================================================================

export interface SerializedAsset {
  id: string;
  projectId: string;
  mimeType: string;
  dataUrl: string;
  fileName?: string;
  width?: number;
  height?: number;
  createdAt: number;
}

export interface SerializedProjectPayload {
  version: string;
  project: Project;
  boards: Record<string, Board>;
  pages: Record<string, Page>;
  nodes: Record<string, NeuroNode>;
  edges: Record<string, NeuroEdge>;
  assets?: Record<string, SerializedAsset>;
  exportedAt: number;
}

export interface StoredNode extends NeuroNode {
  pageId: string;
}

export interface StoredEdge extends NeuroEdge {
  pageId: string;
}

// ============================================================================
// 8. Algorithmic Options & Interfaces (Cross-layer Contracts)
// ============================================================================

export type ElkSpacingPreset = 'compact' | 'normal' | 'spacious';

export interface ElkLayoutOptions {
  algorithm?: 'layered' | 'mrtree';
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP' | FlowDirection | string;
  nodeSpacing?: number;
  layerSpacing?: number;
}

export interface PlacementConfig {
  margin?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  maxIterations?: number;
}

export interface LineSegment {
  p1: Point;
  p2: Point;
}

export interface JumpArc {
  crossingPoint: Point;
  startPoint: Point;
  endPoint: Point;
  t: number;
  radius: number;
  svgArcCommand: string;
}

export interface LineJumpConfig {
  jumpRadius?: number;
  endpointTolerance?: number;
  suppressColinear?: boolean;
}

export interface SelectionFilter {
  shape: boolean;
  text: boolean;
  edge: boolean;
  frame: boolean;
  diagram: boolean;
  image: boolean;
}
