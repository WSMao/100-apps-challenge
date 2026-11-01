/**
 * Creative-Neuro Algorithmic Engine - Node ID Reconciliation Engine
 * Layer 2 Zero-DOM Pure TypeScript Reconciliation Engine
 *
 * Conforms to specifications in algorithms.md §2.5.
 * Critical capability:
 * Solves the flaw of naive diagrams by preserving user-adjusted coordinates (x, y)
 * and layout mode states ('auto-elk' | 'manual' | 'fixed') during bi-directional Mermaid text sync.
 */

import type {
  LayoutMode,
  NeuroEdge,
  NeuroNode,
  Point,
} from '../../types/index.ts';
import type { ParsedMermaidAST } from './parser.ts';

export interface ReconcileOptions {
  defaultLayoutMode?: LayoutMode;
}

export interface ReconcileResult {
  nodes: NeuroNode[];
  edges: NeuroEdge[];
  addedNodeIds: string[];
  removedNodeIds: string[];
  updatedNodeIds: string[];
}

/**
 * Estimates node dimensions from label text.
 * Preserves 160x60 for standard single-line labels while expanding
 * cleanly for multi-line (<br>) or long architectural descriptions.
 */
function estimateNodeDimensions(label: string): { width: number; height: number } {
  const lines = (label || '').split('\n');
  let maxLineVisualUnits = 0;
  for (const line of lines) {
    let units = 0;
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      units += code > 0x024f ? 1.85 : 1;
    }
    if (units > maxLineVisualUnits) maxLineVisualUnits = units;
  }

  if (lines.length <= 1 && maxLineVisualUnits <= 22) {
    return { width: 160, height: 60 };
  }

  const width = Math.min(440, Math.max(160, Math.round(maxLineVisualUnits * 7.8 + 36)));
  const height = Math.max(60, lines.length * 22 + 24);
  return { width, height };
}

/**
 * Reconciles parsed Mermaid AST with existing scene graph nodes and edges.
 */
export function reconcileMermaidAST(
  ast: ParsedMermaidAST,
  existingNodes: NeuroNode[],
  defaultMode: LayoutMode = 'auto-elk',
  options: ReconcileOptions = {}
): ReconcileResult {
  const effectiveDefaultMode = options.defaultLayoutMode ?? defaultMode;

  const existingNodeMap = new Map<string, NeuroNode>(
    existingNodes.map((n) => [n.id, n])
  );

  const nextNodes: NeuroNode[] = [];
  const addedNodeIds: string[] = [];
  const updatedNodeIds: string[] = [];
  const processedNodeIds = new Set<string>();

  // Incremental coordinate allocator for new unplaced nodes
  let autoX = 100;
  let autoY = 100;

  // 1. Process Subgraphs from AST -> create/update frame container nodes
  const astSubgraphs = ast.subgraphs || [];
  const astSubgraphIds = new Set<string>(astSubgraphs.map((s) => s.id));

  for (const sub of astSubgraphs) {
    processedNodeIds.add(sub.id);
    const existing = existingNodeMap.get(sub.id);

    // Canonical parentId: only valid if parent container exists in AST
    const canonicalParentId =
      sub.parentSubgraphId && astSubgraphIds.has(sub.parentSubgraphId)
        ? sub.parentSubgraphId
        : undefined;

    if (existing) {
      // Preserve coordinates and layoutMode, update semantic properties
      const updatedFrame: NeuroNode = {
        ...existing,
        type: 'frame',
        parentId: canonicalParentId,
        data: {
          ...existing.data,
          title: sub.title,
          label: sub.title,
          direction: sub.direction,
        },
        position: { ...existing.position },
        layoutMode: existing.layoutMode ?? effectiveDefaultMode,
      };
      nextNodes.push(updatedFrame);
      updatedNodeIds.push(sub.id);
    } else {
      // New Subgraph Frame Node
      const newFrame: NeuroNode = {
        id: sub.id,
        type: 'frame',
        position: { x: autoX, y: autoY },
        width: 320,
        height: 240,
        parentId: canonicalParentId,
        layoutMode: effectiveDefaultMode,
        data: {
          title: sub.title,
          label: sub.title,
          direction: sub.direction,
          layoutMode: effectiveDefaultMode,
        },
      };
      nextNodes.push(newFrame);
      addedNodeIds.push(sub.id);

      autoX += 360;
      if (autoX > 1200) {
        autoX = 100;
        autoY += 280;
      }
    }
  }

  // 2. Process Leaf Nodes from AST
  for (const astNode of ast.nodes) {
    processedNodeIds.add(astNode.id);
    const existing = existingNodeMap.get(astNode.id);

    // Canonical parentId: if astNode specifies a parent that exists in AST, use it;
    // otherwise it is at the root level (undefined).
    const canonicalParentId =
      astNode.parentId && astSubgraphIds.has(astNode.parentId)
        ? astNode.parentId
        : undefined;

    const estimatedDims = estimateNodeDimensions(astNode.label);
    const styleOverrides: Partial<NeuroNode['data']> = {};
    if (astNode.style?.fill) styleOverrides.backgroundColor = astNode.style.fill;
    if (astNode.style?.stroke) styleOverrides.borderColor = astNode.style.stroke;
    if (astNode.style?.color) styleOverrides.color = astNode.style.color;
    if (astNode.style?.strokeWidth !== undefined) styleOverrides.borderWidth = astNode.style.strokeWidth;

    if (existing) {
      // PRESERVE user coordinates (x, y) and layoutMode!
      const updatedNode: NeuroNode = {
        ...existing,
        parentId: canonicalParentId,
        width: Math.max(existing.width ?? 160, estimatedDims.width),
        height: Math.max(existing.height ?? 60, estimatedDims.height),
        position: { ...existing.position }, // Coordinate strictly preserved
        layoutMode: existing.layoutMode ?? effectiveDefaultMode, // Mode preserved
        data: {
          ...existing.data,
          label: astNode.label,
          shapeType: astNode.shapeType,
          ...styleOverrides,
        },
      };
      nextNodes.push(updatedNode);
      updatedNodeIds.push(astNode.id);
    } else {
      // NEW Node created in Mermaid code
      const pos: Point = { x: autoX, y: autoY };
      autoX += 180;
      if (autoX > 1000) {
        autoX = 100;
        autoY += 120;
      }

      const newNode: NeuroNode = {
        id: astNode.id,
        type: 'shape',
        position: pos,
        width: estimatedDims.width,
        height: estimatedDims.height,
        parentId: canonicalParentId,
        layoutMode: effectiveDefaultMode,
        data: {
          label: astNode.label,
          shapeType: astNode.shapeType,
          layoutMode: effectiveDefaultMode,
          isUnplaced: true,
          ...styleOverrides,
        },
      };
      nextNodes.push(newNode);
      addedNodeIds.push(astNode.id);
    }
  }

  // 3. Identify Removed Nodes
  const removedNodeIds = existingNodes
    .filter((n) => !processedNodeIds.has(n.id))
    .map((n) => n.id);

  // 4. Reconcile Edges
  const nextEdges: NeuroEdge[] = [];
  ast.edges.forEach((astEdge, idx) => {
    // Only link if both endpoints exist in nextNodes
    if (!processedNodeIds.has(astEdge.source) || !processedNodeIds.has(astEdge.target)) {
      return;
    }

    const edge: NeuroEdge = {
      id: `e_${astEdge.source}_${astEdge.target}_${idx}`,
      source: astEdge.source,
      target: astEdge.target,
      label: astEdge.label,
      type: 'jump',
      data: {
        label: astEdge.label,
        lineStyle: astEdge.stroke === 'dotted' ? 'dotted' : 'solid',
        arrowEnd: astEdge.arrowHead !== 'none',
        ...(astEdge.arrowStart ? { arrowStart: true } : {}),
        ...(astEdge.stroke === 'thick' ? { strokeWidth: 2.5 } : {}),
      },
    };
    nextEdges.push(edge);
  });

  return {
    nodes: nextNodes,
    edges: nextEdges,
    addedNodeIds,
    removedNodeIds,
    updatedNodeIds,
  };
}
