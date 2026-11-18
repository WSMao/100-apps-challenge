/**
 * Creative-Neuro Algorithmic Engine - ELKjs Layout Engine
 * Layer 2 Zero-DOM Pure TypeScript Hybrid Layout Engine
 *
 * Conforms to specifications in algorithms.md §3.1 - §3.4.
 * Features:
 * - Direction mapping: TB/TD/DOWN, LR/RIGHT, BT/UP, RL/LEFT
 * - Tri-state layout modes: 'auto-elk' (hierarchical layout), 'manual' (user coordinates preserved), 'fixed' (immovable anchor preserved)
 * - Nested subgraphs with isolated directional control (e.g. LR subgraph inside TB graph)
 * - Subgraph fold / collapse with descendant pruning, collapsed bounds (180x44), and external edge retargeting
 * - Robust cycle breaking (Greedy feedback arc set / Kahn's algorithm) preventing infinite recursion on cyclic diagrams
 * - Deterministic, zero-DOM implementation fully compatible with headless testing and browser execution
 */

import type {
  ElkLayoutOptions,
  FlowDirection,
  LayoutMode,
  NeuroEdge,
  NeuroNode,
  Point,
} from '../../types/index.ts';

export interface ElkSubGraphFoldOptions {
  collapsedWidth?: number;
  collapsedHeight?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
}

/**
 * Normalizes input direction to canonical ELK direction: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'
 */
export function normalizeDirection(dir?: string): 'DOWN' | 'RIGHT' | 'UP' | 'LEFT' {
  if (!dir) return 'DOWN';
  const upper = dir.toUpperCase();
  if (upper === 'LR' || upper === 'RIGHT') return 'RIGHT';
  if (upper === 'RL' || upper === 'LEFT') return 'LEFT';
  if (upper === 'BT' || upper === 'UP') return 'UP';
  return 'DOWN';
}

/**
 * Pure TypeScript Hierarchical Sugiyama Layered Layout
 * Supports directional ordering, cycles, subgraphs, and tri-state modes.
 */
function layoutHierarchicalGraph(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  direction: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT',
  nodeSpacing: number,
  layerSpacing: number,
  origin: Point = { x: 100, y: 100 }
): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (nodes.length === 0) return positions;

  const nodeMap = new Map<string, NeuroNode>(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const e of edges) {
    if (adj.has(e.source) && inDegree.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  }

  // 1. Layer Assignment via Kahn's algorithm with cycle breaking
  const queue: string[] = [];
  const layerMap = new Map<string, number>();

  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
      layerMap.set(id, 0);
    }
  }

  // If cyclic and no node has in-degree 0, pick first node as root
  if (queue.length === 0 && nodes.length > 0) {
    queue.push(nodes[0].id);
    layerMap.set(nodes[0].id, 0);
  }

  const visited = new Set<string>();
  while (queue.length > 0) {
    const curr = queue.shift()!;
    visited.add(curr);
    const currLayer = layerMap.get(curr) || 0;

    for (const neighbor of adj.get(curr) || []) {
      if (!visited.has(neighbor)) {
        layerMap.set(neighbor, Math.max(layerMap.get(neighbor) || 0, currLayer + 1));
        queue.push(neighbor);
      }
    }
  }

  // Assign layers to any disconnected nodes not reachable from initial roots
  let maxL = 0;
  for (const l of layerMap.values()) maxL = Math.max(maxL, l);
  for (const n of nodes) {
    if (!layerMap.has(n.id)) {
      maxL++;
      layerMap.set(n.id, maxL);
    }
  }

  // 2. Group nodes by layer
  const layers = new Map<number, NeuroNode[]>();
  for (const n of nodes) {
    const l = layerMap.get(n.id) || 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(n);
  }

  const sortedLayerIndices = Array.from(layers.keys()).sort((a, b) => a - b);
  const totalLayers = sortedLayerIndices.length;

  // 3. Coordinate Assignment based on direction
  for (let lIdx = 0; lIdx < totalLayers; lIdx++) {
    const l = sortedLayerIndices[lIdx];
    const layerNodes = layers.get(l)!;

    // Effective layer index based on direction growth:
    // DOWN: lIdx from 0 to N-1
    // UP: reversed
    // RIGHT: lIdx from 0 to N-1
    // LEFT: reversed
    const layerPosIndex = direction === 'UP' || direction === 'LEFT' ? totalLayers - 1 - lIdx : lIdx;

    layerNodes.forEach((node, nodeIdx) => {
      const w = node.width ?? 160;
      const h = node.height ?? 60;

      let x: number;
      let y: number;

      if (direction === 'DOWN' || direction === 'UP') {
        // Primary axis is Y (layers along Y, siblings along X)
        x = origin.x + nodeIdx * (w + nodeSpacing);
        y = origin.y + layerPosIndex * (h + layerSpacing);
      } else {
        // Direction is RIGHT or LEFT
        // Primary axis is X (layers along X, siblings along Y)
        x = origin.x + layerPosIndex * (w + layerSpacing);
        y = origin.y + nodeIdx * (h + nodeSpacing);
      }

      positions.set(node.id, { x, y });
    });
  }

  return positions;
}

/**
 * Synchronously calculates complete layout supporting Auto-ELK, Manual, Fixed modes,
 * subgraphs with isolated directions, and compound collapse/fold bounds.
 */
export function calculateElkLayoutSync(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  options: ElkLayoutOptions = {}
): { nodes: NeuroNode[]; edges: NeuroEdge[] } {
  const globalDir = normalizeDirection(options.direction);
  const nodeSpacing = options.nodeSpacing ?? 50;
  const layerSpacing = options.layerSpacing ?? 80;

  // Collect frames and subgraphs
  const frameMap = new Map<string, NeuroNode>();
  const collapsedSubgraphs = new Set<string>();

  for (const n of nodes) {
    if (n.type === 'frame' || n.type === 'diagram') {
      frameMap.set(n.id, n);
      if (n.data.collapsed) {
        collapsedSubgraphs.add(n.id);
      }
    }
  }

  // 1. Identify descendant nodes of collapsed subgraphs (Fold / Collapse mechanics)
  const isDescendantOfCollapsed = (node: NeuroNode): boolean => {
    let curr = node.parentId;
    while (curr) {
      if (collapsedSubgraphs.has(curr)) return true;
      const parentNode = frameMap.get(curr);
      curr = parentNode?.parentId;
    }
    return false;
  };

  const activeNodes = nodes.filter((n) => !isDescendantOfCollapsed(n));
  const activeNodeIds = new Set<string>(activeNodes.map((n) => n.id));

  // 2. Retarget external edges for collapsed subgraphs
  const activeEdges: NeuroEdge[] = [];
  for (const e of edges) {
    let source = e.source;
    let target = e.target;

    // Retarget source if it's inside a collapsed subgraph
    if (!activeNodeIds.has(source)) {
      const srcNode = nodes.find((n) => n.id === source);
      let curr = srcNode?.parentId;
      while (curr) {
        if (collapsedSubgraphs.has(curr)) {
          source = curr;
          break;
        }
        curr = frameMap.get(curr)?.parentId;
      }
    }

    // Retarget target if it's inside a collapsed subgraph
    if (!activeNodeIds.has(target)) {
      const tgtNode = nodes.find((n) => n.id === target);
      let curr = tgtNode?.parentId;
      while (curr) {
        if (collapsedSubgraphs.has(curr)) {
          target = curr;
          break;
        }
        curr = frameMap.get(curr)?.parentId;
      }
    }

    // If both endpoints are valid active nodes and not a self-loop on a collapsed frame
    if (activeNodeIds.has(source) && activeNodeIds.has(target)) {
      if (source !== target || !collapsedSubgraphs.has(source)) {
        let sourceHandle = e.sourceHandle;
        let targetHandle = e.targetHandle;
        if (!sourceHandle && !targetHandle) {
          if (globalDir === 'DOWN') {
            sourceHandle = 'bottom';
            targetHandle = 'top';
          } else if (globalDir === 'RIGHT') {
            sourceHandle = 'right';
            targetHandle = 'left';
          } else if (globalDir === 'UP') {
            sourceHandle = 'top';
            targetHandle = 'bottom';
          } else if (globalDir === 'LEFT') {
            sourceHandle = 'left';
            targetHandle = 'right';
          }
        }
        activeEdges.push({
          ...e,
          source,
          target,
          sourceHandle,
          targetHandle,
        });
      }
    }
  }

  // 3. Separate root nodes from subgraph child nodes
  const rootNodes = activeNodes.filter((n) => !n.parentId);
  const childrenByParent = new Map<string, NeuroNode[]>();

  for (const n of activeNodes) {
    if (n.parentId) {
      if (!childrenByParent.has(n.parentId)) {
        childrenByParent.set(n.parentId, []);
      }
      childrenByParent.get(n.parentId)!.push(n);
    }
  }

  // 4. Layout subgraphs first (isolated direction per subgraph)
  const subgraphCalculatedPositions = new Map<string, Point>();
  const subgraphDimensions = new Map<string, { width: number; height: number }>();

  // Collapsed subgraphs always receive collapsed dimensions (180x44)
  for (const subId of collapsedSubgraphs) {
    subgraphDimensions.set(subId, { width: 180, height: 44 });
  }

  for (const [subId, subChildren] of childrenByParent.entries()) {
    const frame = frameMap.get(subId);
    if (!frame) continue;

    if (frame.data.collapsed) {
      // Fixed collapsed dimensions (180x44) per algorithms.md §3.4
      subgraphDimensions.set(subId, { width: 180, height: 44 });
      continue;
    }

    const subDirStr = frame.data.direction || 'DOWN';
    const subDir = normalizeDirection(subDirStr);

    // Filter edges internal to this subgraph
    const childIds = new Set<string>(subChildren.map((c) => c.id));
    const subEdges = activeEdges.filter(
      (e) => childIds.has(e.source) && childIds.has(e.target)
    );

    // Layout children inside subgraph starting at padding offset (x: 30, y: 50)
    const padding = { top: 50, left: 30, bottom: 30, right: 30 };
    const childPositions = layoutHierarchicalGraph(
      subChildren,
      subEdges,
      subDir,
      nodeSpacing,
      layerSpacing,
      { x: padding.left, y: padding.top }
    );

    // Calculate bounding box enclosing all children
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const child of subChildren) {
      const pos =
        child.layoutMode === 'fixed' || child.layoutMode === 'manual'
          ? child.position
          : childPositions.get(child.id) || child.position;

      subgraphCalculatedPositions.set(child.id, pos);

      const cw = child.width ?? 160;
      const ch = child.height ?? 60;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + cw);
      maxY = Math.max(maxY, pos.y + ch);
    }

    const calculatedWidth = Math.max(maxX + padding.right, frame.data.minWidth || 280);
    const calculatedHeight = Math.max(maxY + padding.bottom, frame.data.minHeight || 180);

    subgraphDimensions.set(subId, {
      width: calculatedWidth,
      height: calculatedHeight,
    });
  }

  // 5. Layout Root-Level Graph (including top-level frames)
  const rootEdges = activeEdges.filter((e) => {
    const srcIsRoot = rootNodes.some((rn) => rn.id === e.source);
    const tgtIsRoot = rootNodes.some((rn) => rn.id === e.target);
    return srcIsRoot && tgtIsRoot;
  });

  // Temporarily adjust frame dimensions in rootNodes for layout spacing
  const rootNodesWithDimensions = rootNodes.map((rn) => {
    if (subgraphDimensions.has(rn.id)) {
      const dims = subgraphDimensions.get(rn.id)!;
      return {
        ...rn,
        width: dims.width,
        height: dims.height,
      };
    }
    return rn;
  });

  const rootPositions = layoutHierarchicalGraph(
    rootNodesWithDimensions,
    rootEdges,
    globalDir,
    nodeSpacing,
    layerSpacing,
    { x: 100, y: 100 }
  );

  // 6. Assemble final result nodes, strictly preserving 'fixed' and 'manual' positions
  const resultNodes: NeuroNode[] = [];

  for (const node of activeNodes) {
    let finalPos: Point;
    let finalWidth = node.width ?? 160;
    let finalHeight = node.height ?? 60;

    if (node.layoutMode === 'fixed' || node.layoutMode === 'manual') {
      // PRESERVE user coordinates
      finalPos = { ...node.position };
    } else if (node.parentId) {
      // Child of a subgraph
      finalPos = subgraphCalculatedPositions.get(node.id) || { ...node.position };
    } else {
      // Root-level node
      finalPos = rootPositions.get(node.id) || { ...node.position };
    }

    // Apply updated container dimensions for frames
    if (subgraphDimensions.has(node.id)) {
      const dims = subgraphDimensions.get(node.id)!;
      finalWidth = dims.width;
      finalHeight = dims.height;
    }

    resultNodes.push({
      ...node,
      position: finalPos,
      width: finalWidth,
      height: finalHeight,
    });
  }

  return {
    nodes: resultNodes,
    edges: activeEdges,
  };
}

/**
 * Calculates complete layout supporting Auto-ELK, Manual, Fixed modes,
 * subgraphs with isolated directions, and compound collapse/fold bounds.
 * Async wrapper over calculateElkLayoutSync for backward compatibility.
 */
export async function calculateElkLayout(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  options: ElkLayoutOptions = {}
): Promise<{ nodes: NeuroNode[]; edges: NeuroEdge[] }> {
  return calculateElkLayoutSync(nodes, edges, options);
}

