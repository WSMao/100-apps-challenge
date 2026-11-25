/**
 * Creative-Neuro Algorithmic Subsystem
 * Layer 2 Zero-DOM Pure TypeScript Core Engines
 *
 * Exposes:
 * 1. Mermaid AST Parser, Serializer & Reconciliation Engine
 * 2. Hybrid ELKjs Layered Layout Engine
 * 3. Minkowski AABB Collision-Free Smart Placement Engine
 * 4. 2D Vector Cross-Product Line Jump Arc Geometry Engine
 */

// 1. Mermaid Engine
export {
  parseMermaid,
  parseNodeToken,
  type ParsedMermaidAST,
  type MermaidParsedNode,
  type MermaidParsedEdge,
  type MermaidParsedSubgraph,
} from './mermaid/parser.ts';

export {
  serializeMermaid,
  formatNodeToken,
  formatEdgeToken,
} from './mermaid/serializer.ts';

export {
  reconcileMermaidAST,
  type ReconcileOptions,
  type ReconcileResult,
} from './mermaid/reconciliation.ts';

// 1.5 Unified Diagram Pipeline Subsystem
export {
  DiagramPipeline,
  flattenNestedCoordinates,
  applyEdgeRouting,
  SPACING_PRESETS,
  type DiagramCompilationOptions,
  type DiagramCompilationResult,
  type DiagramPreviewNode,
  type DiagramPreviewEdge,
} from './diagram/diagramPipeline.ts';

// 2. ELK Layout Engine
export {
  calculateElkLayout,
  calculateElkLayoutSync,
  normalizeDirection,
  type ElkSubGraphFoldOptions,
} from './layout/elkEngine.ts';

// 3. Collision & Placement Engine
export {
  checkAABBCollision,
  getMinkowskiSumBox,
  isPointInBox,
  getBoundingBoxEnclosing,
} from './placement/collision.ts';

export {
  findCollisionFreePosition,
  findSiblingPosition,
  calculateFrameAutoGrowth,
  type PlacementDirection,
} from './placement/smartPlacement.ts';

// 4. Geometry & Line Jump Engine
export {
  crossProduct2D,
  findSegmentIntersection,
  type SegmentIntersection,
} from './geometry/lineIntersection.ts';

export {
  computeLineJumpsForSegment,
  calculateLineJumps,
} from './geometry/svgArc.ts';

export {
  GraphRoutingEngine,
  isPointInRect,
  lineSegmentsCross,
  isSegmentIntersectingRect,
  getNodeEndpoint,
  isEdgeInSelectionRect,
  findEdgesInSelectionRect,
  computeJumpArcsForEdge,
  buildJumpSvgPath,
  sampleEdgePolyline,
  computeJumpArcsForPolyline,
  buildPolylineJumpSvgPath,
  computeSmartLabelPosition,
  type BoundingRect,
  type JumpArcData,
  type LeafRect,
  type HandleSide,
} from './geometry/graphRoutingEngine.ts';

// 5. MindMap Mode Engine
export {
  resolveMindMapRootId,
  buildMindMapTree,
  calculateMindMapLayout,
  canAttachMindMapNode,
  attachMindMapNode,
  detachMindMapNode,
  swapMindMapNodes,
  findAttachTargetNode,
  serializeMindMapMermaid,
  parseMindMapMermaid,
  createMindMapDiagramPayload,
  type MindMapLayoutOptions,
  type MindMapLayoutResult,
  type MindMapTreeStructure,
} from './mindmap/mindmapEngine.ts';

// 6. Alignment & Snapping Engine
export {
  calculateAlignmentPositions,
  computeDragSnap,
  computeResizeSnap,
  type AlignmentActionType,
  type AlignmentGuide,
  type SnapRect,
  type SnapOptions,
  type DragSnapResult,
  type ResizeSnapConstraints,
  type ResizeSnapResult,
} from './geometry/alignmentEngine.ts';
