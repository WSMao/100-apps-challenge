/**
 * Creative-Neuro Algorithmic Subsystem - MindMap Mode Engine
 * Layer 2 Zero-DOM Pure TypeScript Engine
 *
 * Implements:
 * - 1-to-many tree topology enforcement (single root, cycle prevention, unique parent)
 * - Radial (left-right balanced), Rightward, and Downward symmetric tree layout
 * - Lock-respecting layout & neat arrangement of Floating nodes
 * - Drag-to-attach proximity detection, attach/detach, node swapping
 * - Mermaid `mindmap` syntax serialization & parsing
 */

import type {
  MindMapDirection,
  NeuroEdge,
  NeuroNode,
} from '../../types/index.ts';

export interface MindMapLayoutOptions {
  rootId?: string;
  direction?: MindMapDirection;
  nodeSpacing?: number;
  layerSpacing?: number;
}

export interface MindMapLayoutResult {
  nodes: NeuroNode[];
  edges: NeuroEdge[];
  rootId: string | null;
  floatingNodeIds: string[];
}

export interface MindMapTreeStructure {
  rootId: string | null;
  childrenMap: Map<string, string[]>;
  parentMap: Map<string, string>;
  treeNodeIds: Set<string>;
  floatingNodeIds: string[];
  validTreeEdges: NeuroEdge[];
}

const DEFAULT_NODE_W = 140;
const DEFAULT_NODE_H = 48;

function getNodeSize(node: NeuroNode): { w: number; h: number } {
  return {
    w: node.width || node.measured?.width || DEFAULT_NODE_W,
    h: node.height || node.measured?.height || DEFAULT_NODE_H,
  };
}

function isNodeLocked(node: NeuroNode): boolean {
  return Boolean(node.locked || node.data?.locked);
}

/**
 * Resolves the single root node ID for a MindMap Diagram.
 */
export function resolveMindMapRootId(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  explicitRootId?: string
): string | null {
  if (nodes.length === 0) return null;
  const nodeIds = new Set(nodes.map((n) => n.id));

  if (explicitRootId && nodeIds.has(explicitRootId)) {
    return explicitRootId;
  }

  const flaggedRoot = nodes.find((n) => n.data?.isMindMapRoot);
  if (flaggedRoot) return flaggedRoot.id;

  const incomingCount = new Map<string, number>();
  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target) {
      incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
    }
  }

  const zeroIn = nodes.find((n) => (incomingCount.get(n.id) || 0) === 0);
  return zeroIn ? zeroIn.id : nodes[0].id;
}

/**
 * Builds a strict 1-to-many tree rooted at `rootId` and classifies unreachable nodes as Floating.
 */
export function buildMindMapTree(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  explicitRootId?: string
): MindMapTreeStructure {
  const rootId = resolveMindMapRootId(nodes, edges, explicitRootId);
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  const treeNodeIds = new Set<string>();
  const validTreeEdges: NeuroEdge[] = [];

  for (const n of nodes) {
    childrenMap.set(n.id, []);
  }

  if (!rootId) {
    return {
      rootId: null,
      childrenMap,
      parentMap,
      treeNodeIds,
      floatingNodeIds: [],
      validTreeEdges,
    };
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, NeuroEdge[]>();
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target) || e.source === e.target) {
      continue;
    }
    const list = adj.get(e.source) || [];
    list.push(e);
    adj.set(e.source, list);
  }

  // BFS from rootId to enforce single-parent 1-to-many tree without cycles
  const queue: string[] = [rootId];
  treeNodeIds.add(rootId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const outgoing = adj.get(current) || [];
    for (const edge of outgoing) {
      if (treeNodeIds.has(edge.target)) continue; // Prevent cycle or multi-parent
      treeNodeIds.add(edge.target);
      parentMap.set(edge.target, current);
      childrenMap.get(current)!.push(edge.target);
      validTreeEdges.push(edge);
      queue.push(edge.target);
    }
  }

  const floatingNodeIds = nodes
    .filter((n) => !treeNodeIds.has(n.id))
    .map((n) => n.id);

  return {
    rootId,
    childrenMap,
    parentMap,
    treeNodeIds,
    floatingNodeIds,
    validTreeEdges,
  };
}

/**
 * Calculates symmetric MindMap layout supporting:
 * - 'radial': balanced left-right growth around root
 * - 'right': rightward tree growth
 * - 'down': downward tree growth
 * Respects locked nodes and arranges unlocked Floating nodes neatly below the tree.
 */
export function calculateMindMapLayout(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  options: MindMapLayoutOptions = {}
): MindMapLayoutResult {
  const direction: MindMapDirection = options.direction || 'radial';
  const nodeSpacing = options.nodeSpacing ?? 40;
  const layerSpacing = options.layerSpacing ?? 80;

  if (nodes.length === 0) {
    return { nodes: [], edges: [], rootId: null, floatingNodeIds: [] };
  }

  const tree = buildMindMapTree(nodes, edges, options.rootId);
  const { rootId, childrenMap, floatingNodeIds, validTreeEdges } = tree;

  if (!rootId) {
    return {
      nodes: nodes.map((n) => ({ ...n })),
      edges: edges.map((e) => ({ ...e })),
      rootId: null,
      floatingNodeIds,
    };
  }

  const nodeById = new Map<string, NeuroNode>(nodes.map((n) => [n.id, n]));
  const positioned = new Map<string, { x: number; y: number }>();
  const edgeSideByTarget = new Map<string, 'left' | 'right' | 'down'>();

  const rootNode = nodeById.get(rootId)!;
  const rootSize = getNodeSize(rootNode);
  const rootPos = { x: rootNode.position.x, y: rootNode.position.y };
  positioned.set(rootId, rootPos);

  const rootCenterX = rootPos.x + rootSize.w / 2;
  const rootCenterY = rootPos.y + rootSize.h / 2;

  if (direction === 'down') {
    const spanWidthMemo = new Map<string, number>();
    const getSubtreeWidth = (id: string): number => {
      if (spanWidthMemo.has(id)) return spanWidthMemo.get(id)!;
      const n = nodeById.get(id)!;
      const { w } = getNodeSize(n);
      const children = childrenMap.get(id) || [];
      if (children.length === 0) {
        spanWidthMemo.set(id, w);
        return w;
      }
      const childrenTotal =
        children.reduce((sum, cid) => sum + getSubtreeWidth(cid), 0) +
        nodeSpacing * (children.length - 1);
      const span = Math.max(w, childrenTotal);
      spanWidthMemo.set(id, span);
      return span;
    };

    const placeDown = (parentId: string, parentX: number, parentY: number) => {
      const parentNode = nodeById.get(parentId)!;
      const parentSize = getNodeSize(parentNode);
      const children = childrenMap.get(parentId) || [];
      if (children.length === 0) return;

      const totalChildrenW =
        children.reduce((sum, cid) => sum + getSubtreeWidth(cid), 0) +
        nodeSpacing * (children.length - 1);
      let cursorX = parentX + parentSize.w / 2 - totalChildrenW / 2;
      const childY = parentY + parentSize.h + layerSpacing;

      for (const cid of children) {
        const cNode = nodeById.get(cid)!;
        const cSize = getNodeSize(cNode);
        const span = getSubtreeWidth(cid);
        const targetX = Math.round(cursorX + span / 2 - cSize.w / 2);
        const targetY = Math.round(childY);
        const finalPos = isNodeLocked(cNode) ? { ...cNode.position } : { x: targetX, y: targetY };
        positioned.set(cid, finalPos);
        edgeSideByTarget.set(cid, 'down');
        placeDown(cid, finalPos.x, finalPos.y);
        cursorX += span + nodeSpacing;
      }
    };

    placeDown(rootId, rootPos.x, rootPos.y);
  } else {
    // 'right' or 'radial'
    const spanHeightMemo = new Map<string, number>();
    const getSubtreeHeight = (id: string): number => {
      if (spanHeightMemo.has(id)) return spanHeightMemo.get(id)!;
      const n = nodeById.get(id)!;
      const { h } = getNodeSize(n);
      const children = childrenMap.get(id) || [];
      if (children.length === 0) {
        spanHeightMemo.set(id, h);
        return h;
      }
      const childrenTotal =
        children.reduce((sum, cid) => sum + getSubtreeHeight(cid), 0) +
        nodeSpacing * (children.length - 1);
      const span = Math.max(h, childrenTotal);
      spanHeightMemo.set(id, span);
      return span;
    };

    const placeHorizontalChildren = (
      children: string[],
      anchorX: number,
      anchorW: number,
      anchorCenterY: number,
      side: 'left' | 'right'
    ) => {
      if (children.length === 0) return;
      const totalH =
        children.reduce((sum, cid) => sum + getSubtreeHeight(cid), 0) +
        nodeSpacing * (children.length - 1);
      let cursorY = anchorCenterY - totalH / 2;

      for (const cid of children) {
        const cNode = nodeById.get(cid)!;
        const cSize = getNodeSize(cNode);
        const span = getSubtreeHeight(cid);
        const targetX =
          side === 'right'
            ? Math.round(anchorX + anchorW + layerSpacing)
            : Math.round(anchorX - layerSpacing - cSize.w);
        const targetY = Math.round(cursorY + span / 2 - cSize.h / 2);
        const finalPos = isNodeLocked(cNode) ? { ...cNode.position } : { x: targetX, y: targetY };
        positioned.set(cid, finalPos);
        edgeSideByTarget.set(cid, side);

        const grandChildren = childrenMap.get(cid) || [];
        placeHorizontalChildren(
          grandChildren,
          finalPos.x,
          cSize.w,
          finalPos.y + cSize.h / 2,
          side
        );
        cursorY += span + nodeSpacing;
      }
    };

    const rootChildren = childrenMap.get(rootId) || [];
    if (direction === 'right') {
      placeHorizontalChildren(rootChildren, rootPos.x, rootSize.w, rootCenterY, 'right');
    } else {
      // 'radial': split root children evenly between right and left
      const splitIndex = Math.ceil(rootChildren.length / 2);
      const rightChildren = rootChildren.slice(0, splitIndex);
      const leftChildren = rootChildren.slice(splitIndex);

      placeHorizontalChildren(rightChildren, rootPos.x, rootSize.w, rootCenterY, 'right');
      placeHorizontalChildren(leftChildren, rootPos.x, rootSize.w, rootCenterY, 'left');
    }
  }

  // Arrange unlocked Floating nodes neatly below the tree
  if (floatingNodeIds.length > 0) {
    let minTreeX = rootPos.x;
    let maxTreeY = rootPos.y + rootSize.h;
    for (const [id, pos] of positioned.entries()) {
      const sz = getNodeSize(nodeById.get(id)!);
      if (pos.x < minTreeX) minTreeX = pos.x;
      if (pos.y + sz.h > maxTreeY) maxTreeY = pos.y + sz.h;
    }

    const startY = Math.round(maxTreeY + layerSpacing);
    let cursorX = Math.round(minTreeX);
    let cursorY = startY;
    let rowMaxH = 0;
    const colsPerRow = 4;
    let colIdx = 0;

    for (const fid of floatingNodeIds) {
      const fNode = nodeById.get(fid)!;
      const fSize = getNodeSize(fNode);
      if (isNodeLocked(fNode)) {
        positioned.set(fid, { ...fNode.position });
        continue;
      }
      if (colIdx >= colsPerRow) {
        colIdx = 0;
        cursorX = Math.round(minTreeX);
        cursorY += rowMaxH + nodeSpacing;
        rowMaxH = 0;
      }
      positioned.set(fid, { x: cursorX, y: cursorY });
      cursorX += fSize.w + nodeSpacing;
      if (fSize.h > rowMaxH) rowMaxH = fSize.h;
      colIdx += 1;
    }
  }

  const nextNodes = nodes.map((n) => {
    const pos = positioned.get(n.id);
    if (!pos) return { ...n };
    return {
      ...n,
      position: { x: pos.x, y: pos.y },
    };
  });

  const nextEdges = validTreeEdges.map((e) => {
    const side = edgeSideByTarget.get(e.target) || 'right';
    const handles =
      side === 'left'
        ? { sourceHandle: 'left', targetHandle: 'right' }
        : side === 'down'
          ? { sourceHandle: 'bottom', targetHandle: 'top' }
          : { sourceHandle: 'right', targetHandle: 'left' };

    return {
      ...e,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: e.type || 'bezier',
    };
  });

  return {
    nodes: nextNodes,
    edges: nextEdges,
    rootId,
    floatingNodeIds,
  };
}

/**
 * Checks whether attaching `childId` under `targetParentId` preserves 1-to-many tree topology without cycles.
 */
export function canAttachMindMapNode(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  childId: string,
  targetParentId: string,
  explicitRootId?: string
): boolean {
  if (childId === targetParentId) return false;
  const rootId = resolveMindMapRootId(nodes, edges, explicitRootId);
  if (childId === rootId) return false;

  const tree = buildMindMapTree(nodes, edges, rootId || undefined);
  // Check if targetParentId is a descendant of childId (would create a cycle)
  const queue = [childId];
  const visited = new Set<string>([childId]);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === targetParentId) return false;
    for (const c of tree.childrenMap.get(curr) || []) {
      if (!visited.has(c)) {
        visited.add(c);
        queue.push(c);
      }
    }
  }
  return true;
}

/**
 * Attaches `childId` to `targetParentId`, enforcing 1-to-many unique parent (replaces any prior parent edge).
 */
export function attachMindMapNode(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  childId: string,
  targetParentId: string,
  options: { rootId?: string; direction?: MindMapDirection; autoLayout?: boolean } = {}
): { nodes: NeuroNode[]; edges: NeuroEdge[] } {
  if (!canAttachMindMapNode(nodes, edges, childId, targetParentId, options.rootId)) {
    return { nodes, edges };
  }

  const filteredEdges = edges.filter((e) => e.target !== childId);
  const newEdge: NeuroEdge = {
    id: `e-${targetParentId}-${childId}-${Date.now()}`,
    source: targetParentId,
    target: childId,
    type: 'bezier',
    data: { routingType: 'bezier' },
  };
  const nextEdges = [...filteredEdges, newEdge];

  if (options.autoLayout) {
    const res = calculateMindMapLayout(nodes, nextEdges, {
      rootId: options.rootId,
      direction: options.direction || 'radial',
    });
    return { nodes: res.nodes, edges: res.edges };
  }

  return { nodes, edges: nextEdges };
}

/**
 * Detaches a non-root node from its parent edge, turning it (and its subtree) into Floating.
 */
export function detachMindMapNode(
  edges: NeuroEdge[],
  nodeId: string,
  rootId?: string | null
): NeuroEdge[] {
  if (rootId && nodeId === rootId) return edges;
  return edges.filter((e) => e.target !== nodeId);
}

/**
 * Swaps two MindMap nodes' positions and sibling/parent attachment order.
 */
export function swapMindMapNodes(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  nodeIdA: string,
  nodeIdB: string,
  options: { rootId?: string; direction?: MindMapDirection; autoLayout?: boolean } = {}
): { nodes: NeuroNode[]; edges: NeuroEdge[] } {
  if (nodeIdA === nodeIdB) return { nodes, edges };
  const nodeA = nodes.find((n) => n.id === nodeIdA);
  const nodeB = nodes.find((n) => n.id === nodeIdB);
  if (!nodeA || !nodeB) return { nodes, edges };

  const posA = { ...nodeA.position };
  const posB = { ...nodeB.position };

  const nextNodes = nodes.map((n) => {
    if (n.id === nodeIdA && !isNodeLocked(n)) {
      return { ...n, position: posB };
    }
    if (n.id === nodeIdB && !isNodeLocked(n)) {
      return { ...n, position: posA };
    }
    return n;
  });

  // Swap edge target positions in the edge array so Auto Layout preserves the swapped sibling order
  const idxA = edges.findIndex((e) => e.target === nodeIdA);
  const idxB = edges.findIndex((e) => e.target === nodeIdB);
  const nextEdges = [...edges];
  if (idxA !== -1 && idxB !== -1) {
    const edgeA = nextEdges[idxA];
    const edgeB = nextEdges[idxB];
    nextEdges[idxA] = { ...edgeB, source: edgeA.source };
    nextEdges[idxB] = { ...edgeA, source: edgeB.source };
  }

  if (options.autoLayout) {
    const res = calculateMindMapLayout(nextNodes, nextEdges, {
      rootId: options.rootId,
      direction: options.direction || 'radial',
    });
    return { nodes: res.nodes, edges: res.edges };
  }

  return { nodes: nextNodes, edges: nextEdges };
}

/**
 * Finds the nearest valid MindMap tree node whose expanded bounding box overlaps `draggedNodeId`.
 */
export function findAttachTargetNode(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  draggedNodeId: string,
  explicitRootId?: string,
  threshold = 48
): NeuroNode | null {
  const dragged = nodes.find((n) => n.id === draggedNodeId);
  if (!dragged) return null;

  const tree = buildMindMapTree(nodes, edges, explicitRootId);
  const dSize = getNodeSize(dragged);
  const dCx = dragged.position.x + dSize.w / 2;
  const dCy = dragged.position.y + dSize.h / 2;

  let bestNode: NeuroNode | null = null;
  let bestDist = Infinity;

  for (const candidate of nodes) {
    if (candidate.id === draggedNodeId) continue;
    if (!tree.treeNodeIds.has(candidate.id)) continue;
    if (!canAttachMindMapNode(nodes, edges, draggedNodeId, candidate.id, tree.rootId || undefined)) {
      continue;
    }

    const cSize = getNodeSize(candidate);
    const minX = candidate.position.x - threshold;
    const maxX = candidate.position.x + cSize.w + threshold;
    const minY = candidate.position.y - threshold;
    const maxY = candidate.position.y + cSize.h + threshold;

    const dMinX = dragged.position.x;
    const dMaxX = dragged.position.x + dSize.w;
    const dMinY = dragged.position.y;
    const dMaxY = dragged.position.y + dSize.h;

    const overlaps = dMaxX >= minX && dMinX <= maxX && dMaxY >= minY && dMinY <= maxY;
    if (!overlaps) continue;

    const cCx = candidate.position.x + cSize.w / 2;
    const cCy = candidate.position.y + cSize.h / 2;
    const dist = Math.hypot(dCx - cCx, dCy - cCy);
    if (dist < bestDist) {
      bestDist = dist;
      bestNode = candidate;
    }
  }

  return bestNode;
}

/**
 * Serializes MindMap tree nodes & edges into Mermaid `mindmap` syntax.
 */
export function serializeMindMapMermaid(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  explicitRootId?: string
): string {
  const tree = buildMindMapTree(nodes, edges, explicitRootId);
  if (!tree.rootId) return 'mindmap\n  root((Central Topic))';

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const lines: string[] = ['mindmap'];

  const visit = (id: string, depth: number) => {
    const node = nodeById.get(id);
    if (!node) return;
    const indent = '  '.repeat(depth + 1);
    const label = (node.data?.label || id).replace(/\r?\n/g, ' ').trim();
    if (depth === 0) {
      lines.push(`${indent}root((${label}))`);
    } else {
      lines.push(`${indent}${label}`);
    }
    for (const cid of tree.childrenMap.get(id) || []) {
      visit(cid, depth + 1);
    }
  };

  visit(tree.rootId, 0);
  return lines.join('\n');
}

/**
 * Parses Mermaid `mindmap` syntax into NeuroNode[] and NeuroEdge[] with 1-to-many tree edges.
 */
export function parseMindMapMermaid(code: string): {
  nodes: NeuroNode[];
  edges: NeuroEdge[];
  rootId: string | null;
} {
  const rawLines = code.split(/\r?\n/);
  const nodes: NeuroNode[] = [];
  const edges: NeuroEdge[] = [];
  const stack: Array<{ indent: number; id: string }> = [];
  let rootId: string | null = null;
  let idx = 0;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed === 'mindmap' || trimmed.startsWith('%%')) continue;

    const indent = rawLine.search(/\S/);
    let label = trimmed;

    // Strip common Mermaid mindmap delimiters: root((...)), ((...)), (...), [...], {{...}}
    const rootMatch = label.match(/^root\(\((.+)\)\)$/);
    if (rootMatch) {
      label = rootMatch[1].trim();
    } else {
      const parenMatch = label.match(/^(?:\(\((.+)\)\)|\[(.+)\]|\((.+)\)|\{\{(.+)\}\})$/);
      if (parenMatch) {
        label = (parenMatch[1] || parenMatch[2] || parenMatch[3] || parenMatch[4] || label).trim();
      }
    }

    const id = idx === 0 ? 'mm_root' : `mm_node_${idx}`;
    const isRoot = idx === 0;
    if (isRoot) rootId = id;
    idx += 1;

    nodes.push({
      id,
      type: 'shape',
      position: { x: 0, y: 0 },
      width: isRoot ? 180 : 140,
      height: isRoot ? 56 : 48,
      locked: false,
      data: {
        label,
        shapeType: isRoot ? 'pill' : 'rounded',
        locked: false,
        ...(isRoot ? { isMindMapRoot: true } : {}),
      },
    });

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    if (stack.length > 0) {
      const parentId = stack[stack.length - 1].id;
      edges.push({
        id: `e-${parentId}-${id}`,
        source: parentId,
        target: id,
        type: 'bezier',
        data: { routingType: 'bezier' },
      });
    }
    stack.push({ indent, id });
  }

  return { nodes, edges, rootId };
}

/**
 * Creates a new Diagram node payload initialized in MindMap Mode with a central root node.
 */
export function createMindMapDiagramPayload(
  position: { x: number; y: number },
  isDark = false
) {
  const defaultCode = 'mindmap\n  root((Central Topic))\n    Main Idea 1\n    Main Idea 2';
  const parsed = parseMindMapMermaid(defaultCode);
  const laidOut = calculateMindMapLayout(parsed.nodes, parsed.edges, {
    rootId: parsed.rootId || undefined,
    direction: 'radial',
  });

  return {
    type: 'diagram' as const,
    position,
    width: 340,
    height: 240,
    locked: false,
    data: {
      label: 'MindMap Diagram',
      title: 'MindMap Diagram',
      locked: false,
      diagramKind: 'mindmap' as const,
      mindMapDirection: 'radial' as MindMapDirection,
      continuousLayout: true,
      mermaidCode: defaultCode,
      diagramOrientation: 'LR' as const,
      diagramMode: 'embedded' as const,
      isFocused: false,
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderColor: isDark ? '#334155' : '#cbd5e1',
      customData: {
        subNodes: laidOut.nodes,
        subEdges: laidOut.edges,
        edgeRouting: 'bezier',
      },
    },
  };
}
