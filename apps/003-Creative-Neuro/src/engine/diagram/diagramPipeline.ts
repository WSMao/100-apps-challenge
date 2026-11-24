/**
 * Creative-Neuro Algorithmic Subsystem - Unified Diagram Pipeline
 * Path: src/engine/diagram/diagramPipeline.ts
 *
 * Deep module encapsulating the complete Mermaid -> Layout -> Geometry -> Mini-Map lifecycle:
 * 1. Syntax Parsing & Error Recovery
 * 2. Node ID Reconciliation (preserves coordinates & manual tweaks)
 * 3. ELKjs Hierarchical Layout (with Direction and Spacing presets)
 * 4. Subgraph Frame Coordinate Flattening (relative -> absolute positioning)
 * 5. Bounding Box & SVG ViewBox calculation for State A mini-maps
 * 6. Bi-directional Mermaid DSL Serialization
 */

import type {
  NeuroNode,
  NeuroEdge,
  FlowDirection,
  EdgeRoutingType,
  ElkSpacingPreset,
  Point,
} from '../../types/index.ts';
import { parseMermaid, type ParsedMermaidAST } from '../mermaid/parser.ts';
import { reconcileMermaidAST } from '../mermaid/reconciliation.ts';
import { serializeMermaid } from '../mermaid/serializer.ts';
import { calculateElkLayoutSync } from '../layout/elkEngine.ts';

export const SPACING_PRESETS: Record<
  ElkSpacingPreset,
  { nodeSpacing: number; layerSpacing: number; label: string }
> = {
  compact: { nodeSpacing: 36, layerSpacing: 60, label: 'Compact (36 / 60)' },
  normal: { nodeSpacing: 50, layerSpacing: 80, label: 'Normal (50 / 80)' },
  spacious: { nodeSpacing: 80, layerSpacing: 130, label: 'Spacious (80 / 130)' },
};

export interface DiagramCompilationOptions {
  mermaidCode: string;
  savedSubNodes?: NeuroNode[];
  savedSubEdges?: NeuroEdge[];
  direction?: FlowDirection;
  spacingPreset?: ElkSpacingPreset;
  edgeRouting?: EdgeRoutingType;
  paddingX?: number;
  paddingY?: number;
}

export interface DiagramPreviewNode {
  id: string;
  label: string;
  shape?: string;
  x: number;
  y: number;
}

export interface DiagramPreviewEdge {
  id: string;
  source: string;
  target: string;
  src: Point;
  tgt: Point;
  label?: string;
}

export interface DiagramCompilationResult {
  ast: ParsedMermaidAST;
  direction: FlowDirection;
  nodes: NeuroNode[];
  edges: NeuroEdge[];
  absolutePositions: Map<string, Point>;
  preview: {
    svgWidth: number;
    svgHeight: number;
    isHorizontal: boolean;
    nodes: DiagramPreviewNode[];
    edges: DiagramPreviewEdge[];
  };
  syntaxError: string | null;
}

/**
 * Resolves absolute canvas coordinates for nodes nested within subgraphs/frames.
 */
export function flattenNestedCoordinates(nodes: NeuroNode[]): Map<string, Point> {
  const nodeById = new Map<string, NeuroNode>(nodes.map((n) => [n.id, n]));
  const absPosMap = new Map<string, Point>();

  for (const n of nodes) {
    let ax = n.position.x;
    let ay = n.position.y;
    let currP = n.parentId;
    const seen = new Set<string>();

    while (currP && !seen.has(currP)) {
      seen.add(currP);
      const parent = nodeById.get(currP);
      if (!parent) break;
      ax += parent.position.x;
      ay += parent.position.y;
      currP = parent.parentId;
    }

    absPosMap.set(n.id, { x: ax, y: ay });
  }

  return absPosMap;
}

/**
 * Applies edge routing types across a list of edges.
 */
export function applyEdgeRouting(
  edges: NeuroEdge[],
  routing: EdgeRoutingType,
  forceOverwrite = false
): NeuroEdge[] {
  return edges.map((e) => {
    const effectiveRouting = forceOverwrite
      ? routing
      : e.data?.routingType || routing;
    return {
      ...e,
      type: 'jump',
      data: {
        ...e.data,
        routingType: effectiveRouting,
        jumpArc: effectiveRouting === 'jump',
      },
    };
  });
}

export const DiagramPipeline = {
  /**
   * Compiles Mermaid DSL into a fully laid-out graph with absolute positions and mini-map metrics.
   */
  compile(options: DiagramCompilationOptions): DiagramCompilationResult {
    const {
      mermaidCode,
      savedSubNodes = [],
      savedSubEdges = [],
      direction: explicitDirection,
      spacingPreset = 'normal',
      edgeRouting = 'jump',
      paddingX = 24,
      paddingY = 20,
    } = options;

    let ast: ParsedMermaidAST;
    let syntaxError: string | null = null;

    try {
      ast = parseMermaid(mermaidCode);
    } catch (err: unknown) {
      syntaxError = err instanceof Error ? err.message : 'Invalid Mermaid syntax';
      ast = {
        nodes: [],
        edges: [],
        direction: (explicitDirection || 'TB') as FlowDirection,
        diagramType: 'flowchart',
        subgraphs: [],
      };
    }

    const effectiveDir = (ast.direction || explicitDirection || 'TB') as FlowDirection;
    const isHorizontal = effectiveDir === 'LR' || effectiveDir === 'RL';

    const reconciled = reconcileMermaidAST(ast, savedSubNodes);
    const spacingCfg = SPACING_PRESETS[spacingPreset] || SPACING_PRESETS.normal;

    const edgesToLayout =
      savedSubEdges.length > 0 && !syntaxError ? savedSubEdges : reconciled.edges;

    const layoutResult = calculateElkLayoutSync(reconciled.nodes, edgesToLayout, {
      direction: effectiveDir,
      nodeSpacing: spacingCfg.nodeSpacing,
      layerSpacing: spacingCfg.layerSpacing,
    });

    const finalEdges = applyEdgeRouting(layoutResult.edges, edgeRouting);
    const absPosMap = flattenNestedCoordinates(layoutResult.nodes);

    // Compute bounding box of laid out leaf nodes (or all nodes if empty)
    const leafNodes = layoutResult.nodes.filter((n) => n.type !== 'frame');
    const previewTargetNodes = leafNodes.length > 0 ? leafNodes : layoutResult.nodes;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of previewTargetNodes) {
      const abs = absPosMap.get(n.id) || n.position;
      minX = Math.min(minX, abs.x);
      minY = Math.min(minY, abs.y);
      maxX = Math.max(maxX, abs.x + 70);
      maxY = Math.max(maxY, abs.y + 28);
    }

    if (!Number.isFinite(minX)) {
      minX = 0;
      maxX = 200;
      minY = 0;
      maxY = 140;
    }

    const svgWidth = Math.max(180, maxX - minX + paddingX * 2);
    const svgHeight = Math.max(120, maxY - minY + paddingY * 2);

    const miniMapPositions = new Map<string, Point>();
    for (const n of layoutResult.nodes) {
      const abs = absPosMap.get(n.id) || n.position;
      miniMapPositions.set(n.id, {
        x: paddingX + (abs.x - minX),
        y: paddingY + (abs.y - minY),
      });
    }

    const previewNodes: DiagramPreviewNode[] = previewTargetNodes.map((node) => {
      const pos = miniMapPositions.get(node.id) || { x: paddingX, y: paddingY };
      return {
        id: node.id,
        label: node.data?.label || node.id,
        shape: node.data?.shapeType,
        x: pos.x,
        y: pos.y,
      };
    });

    const previewEdges: DiagramPreviewEdge[] = finalEdges.map((edge, idx) => {
      const src = miniMapPositions.get(edge.source) || { x: paddingX, y: paddingY };
      const tgt = miniMapPositions.get(edge.target) || { x: paddingX, y: paddingY };
      return {
        id: edge.id || `preview-edge-${idx}`,
        source: edge.source,
        target: edge.target,
        src,
        tgt,
        label: edge.label as string | undefined,
      };
    });

    return {
      ast,
      direction: effectiveDir,
      nodes: layoutResult.nodes,
      edges: finalEdges,
      absolutePositions: absPosMap,
      preview: {
        svgWidth,
        svgHeight,
        isHorizontal,
        nodes: previewNodes,
        edges: previewEdges,
      },
      syntaxError,
    };
  },

  /**
   * Serializes canvas nodes & edges back to Mermaid DSL with direction headers.
   */
  serialize(
    nodes: NeuroNode[],
    edges: NeuroEdge[],
    direction: FlowDirection = 'TB'
  ): string {
    return serializeMermaid(nodes, edges, direction);
  },
};
