/**
 * Creative-Neuro E2E Test Suite - Core Interface Contracts & Types
 * Authoritative Source: PROJECT.md, specs.md, ORIGINAL_REQUEST.md
 */

export type LayoutMode = 'auto-elk' | 'manual' | 'fixed';

export type ShapeType =
  | 'rectangle'
  | 'rounded'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'stadium'
  | 'subroutine'
  | 'hexagon';

export type ToolMode =
  | 'select'
  | 'shape'
  | 'text'
  | 'connect'
  | 'draw'
  | 'frame'
  | 'diagram';

export type FlowDirection = 'TB' | 'TD' | 'BT' | 'RL' | 'LR';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BoundingBox extends Point, Size {}

export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  color?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  strokeDasharray?: string;
}

export interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  animated?: boolean;
}

export type NeuroNodeType =
  | 'shape'
  | 'text'
  | 'frame'
  | 'diagram'
  | 'freehand'
  | 'pageCard';

export interface NeuroNodeData {
  label?: string;
  shapeType?: ShapeType;
  style?: NodeStyle;
  title?: string;
  collapsed?: boolean;
  direction?: FlowDirection;
  mermaidCode?: string;
  isFocused?: boolean;
  points?: Array<[number, number, number?]>;
  color?: string;
  size?: number;
  targetPageId?: string;
}

export interface NeuroNode {
  id: string;
  type: NeuroNodeType;
  position: Point;
  width?: number;
  height?: number;
  parentId?: string;
  layoutMode: LayoutMode;
  data: NeuroNodeData;
  selected?: boolean;
  zIndex?: number;
  hidden?: boolean;
}

export interface NeuroEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: 'jump' | 'default' | 'straight' | 'smoothstep';
  label?: string;
  animated?: boolean;
  style?: EdgeStyle;
  data?: {
    jumpPoints?: Point[];
    jumpArc?: boolean;
  };
}

export interface Page {
  id: string;
  boardId: string;
  name: string;
  nodes: Record<string, NeuroNode>;
  edges: Record<string, NeuroEdge>;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  activePageId: string;
  pageIds: string[];
}

export interface Project {
  id: string;
  name: string;
  version: string;
  activeBoardId: string;
  boards: Record<string, Board>;
  pages: Record<string, Page>;
  createdAt: number;
  updatedAt: number;
}

export interface ElkLayoutOptions {
  algorithm?: 'layered' | 'mrtree';
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
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
