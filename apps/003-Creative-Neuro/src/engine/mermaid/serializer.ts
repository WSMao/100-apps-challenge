/**
 * Creative-Neuro Algorithmic Engine - Mermaid AST Serializer
 * Layer 2 Zero-DOM Pure TypeScript Serializer
 *
 * Conforms to specifications in algorithms.md §2.4.
 * Converts NeuroNode[] and NeuroEdge[] scene graph entities back into valid Mermaid flowchart DSL.
 */

import type { FlowDirection, NeuroEdge, NeuroNode, ShapeType } from '../../types/index.ts';

/**
 * Escapes labels for Mermaid syntax safety.
 */
function escapeLabel(raw: string): string {
  let s = raw.replace(/\r?\n/g, '<br/>');
  // Escape quotes
  s = s.replace(/"/g, '\\"');
  return s;
}

/**
 * Formats a node with the appropriate Mermaid shape enclosure.
 */
export function formatNodeToken(node: NeuroNode): string {
  const id = node.id;
  const rawLabel = node.data.label || id;
  const label = escapeLabel(rawLabel);
  const shape: ShapeType = node.data.shapeType || 'rectangle';

  switch (shape) {
    case 'rounded':
      return `${id}("${label}")`;
    case 'circle':
      return `${id}(("${label}"))`;
    case 'diamond':
      return `${id}{"${label}"}`;
    case 'cylinder':
    case 'database':
      return `${id}[("${label}")]`;
    case 'stadium':
    case 'pill':
      return `${id}(["${label}"])`;
    case 'subroutine':
      return `${id}[["${label}"]]`;
    case 'hexagon':
      return `${id}{{"${label}"}}`;
    case 'rectangle':
    default:
      return `${id}["${label}"]`;
  }
}

/**
 * Formats an edge into Mermaid syntax.
 */
export function formatEdgeToken(edge: NeuroEdge): string {
  const stroke = edge.data?.lineStyle || 'solid';
  const hasArrowEnd = edge.data?.arrowEnd !== false;
  const label = edge.data?.label || edge.label;

  let arrowSyntax = '-->';
  if (stroke === 'dotted') {
    arrowSyntax = hasArrowEnd ? '-.->' : '-.-';
  } else if (stroke === 'dashed') {
    arrowSyntax = hasArrowEnd ? '-.->' : '-.-';
  } else {
    // solid
    arrowSyntax = hasArrowEnd ? '-->' : '---';
  }

  if (label) {
    const escapedLabel = escapeLabel(label);
    return `${edge.source} ${arrowSyntax}|${escapedLabel}| ${edge.target}`;
  }

  return `${edge.source} ${arrowSyntax} ${edge.target}`;
}

/**
 * Serializes nodes and edges to standard Mermaid flowchart code.
 */
export function serializeMermaid(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  direction: FlowDirection = 'TB'
): string {
  const lines: string[] = [`flowchart ${direction}`];

  // Separate nodes into root nodes and subgraphs
  const nodesByParent = new Map<string, NeuroNode[]>();
  const rootNodes: NeuroNode[] = [];
  const frameContainers = new Map<string, NeuroNode>();

  for (const n of nodes) {
    if (n.type === 'frame' || n.type === 'diagram') {
      frameContainers.set(n.id, n);
    }
  }

  for (const n of nodes) {
    if (n.type === 'frame' || n.type === 'diagram') {
      // Frame containers are handled as subgraphs, not leaf nodes
      continue;
    }

    // Only group under parentId if the parent frame container actually exists
    if (n.parentId && frameContainers.has(n.parentId)) {
      if (!nodesByParent.has(n.parentId)) {
        nodesByParent.set(n.parentId, []);
      }
      nodesByParent.get(n.parentId)!.push(n);
    } else {
      rootNodes.push(n);
    }
  }

  // Recursive subgraph emitter to support nested subgraphs
  const emittedSubgraphs = new Set<string>();

  function emitSubgraph(subId: string, indent: string) {
    if (emittedSubgraphs.has(subId)) return;
    emittedSubgraphs.add(subId);

    const frame = frameContainers.get(subId);
    if (!frame) return; // Safeguard against missing container definitions

    const title = frame.data?.title || frame.data?.label || subId;
    const dir = frame.data?.direction;

    lines.push(`${indent}subgraph ${subId} ["${escapeLabel(title)}"]`);
    if (dir) {
      lines.push(`${indent}  direction ${dir}`);
    }

    // Direct children nodes
    const children = nodesByParent.get(subId) || [];
    for (const child of children) {
      lines.push(`${indent}  ${formatNodeToken(child)}`);
    }

    // Check if any frame containers have this subId as parentId (nested subgraphs)
    for (const [childSubId, childFrame] of frameContainers.entries()) {
      if (childFrame.parentId === subId) {
        emitSubgraph(childSubId, `${indent}  `);
      }
    }

    lines.push(`${indent}end`);
  }

  // Emit top-level frame containers (containers with no parent or whose parent is not in frameContainers)
  for (const [frameId, frameNode] of frameContainers.entries()) {
    if (!frameNode.parentId || !frameContainers.has(frameNode.parentId)) {
      emitSubgraph(frameId, '  ');
    }
  }

  // Emit root-level nodes
  for (const rn of rootNodes) {
    lines.push(`  ${formatNodeToken(rn)}`);
  }

  // Emit edges
  for (const e of edges) {
    lines.push(`  ${formatEdgeToken(e)}`);
  }

  return lines.join('\n');
}
