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
 * Supports directional ordering, cycle breaking, variable node sizes, subgraphs, and tri-state modes.
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

  const nodeOrder = new Map<string, number>();
  nodes.forEach((n, idx) => nodeOrder.set(n.id, idx));

  const rawAdj = new Map<string, string[]>();
  for (const n of nodes) {
    rawAdj.set(n.id, []);
  }
  for (const e of edges) {
    if (e.source === e.target) continue; // Ignore self-loops
    if (rawAdj.has(e.source) && rawAdj.has(e.target)) {
      rawAdj.get(e.source)!.push(e.target);
    }
  }

  // 1. Cycle Breaking via DFS in declaration order to identify feedback back-edges
  const visitedDfs = new Set<string>();
  const onStack = new Set<string>();
  const backEdges = new Set<string>();

  const dfs = (u: string) => {
    visitedDfs.add(u);
    onStack.add(u);
    for (const v of rawAdj.get(u) || []) {
      if (onStack.has(v)) {
        backEdges.add(`${u}->${v}`);
      } else if (!visitedDfs.has(v)) {
        dfs(v);
      }
    }
    onStack.delete(u);
  };

  for (const n of nodes) {
    if (!visitedDfs.has(n.id)) {
      dfs(n.id);
    }
  }

  // Build acyclic forward graph
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const e of edges) {
    if (e.source === e.target) continue;
    if (!adj.has(e.source) || !inDegree.has(e.target)) continue;
    if (backEdges.has(`${e.source}->${e.target}`)) continue;
    adj.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  }

  // 2. Longest-Path Layer Assignment via Kahn's topological traversal
  const queue: string[] = [];
  const layerMap = new Map<string, number>();

  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
      layerMap.set(id, 0);
    }
  }

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
      layerMap.set(neighbor, Math.max(layerMap.get(neighbor) || 0, currLayer + 1));
      const nextDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, nextDeg);
      if (nextDeg <= 0 && !visited.has(neighbor) && !queue.includes(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  // Handle any remaining nodes not reached
  let maxL = 0;
  for (const l of layerMap.values()) maxL = Math.max(maxL, l);
  for (const n of nodes) {
    if (!layerMap.has(n.id)) {
      maxL++;
      layerMap.set(n.id, maxL);
    }
  }

  // 2b. If laying out top-level container frames in vertical (DOWN/UP) mode,
  // ensure multiple frames do not collide side-by-side in the same horizontal tier;
  // order frames sequentially by (computedLayer, declarationIndex).
  const allFrames = nodes.length > 1 && nodes.every((n) => n.type === 'frame');
  if (allFrames && (direction === 'DOWN' || direction === 'UP')) {
    const sortedFrames = [...nodes].sort((a, b) => {
      const la = layerMap.get(a.id) ?? 0;
      const lb = layerMap.get(b.id) ?? 0;
      if (la !== lb) return la - lb;
      return (nodeOrder.get(a.id) ?? 0) - (nodeOrder.get(b.id) ?? 0);
    });
    sortedFrames.forEach((f, idx) => {
      layerMap.set(f.id, idx);
    });
  }

  // 3. Group nodes by layer
  const layers = new Map<number, NeuroNode[]>();
  for (const n of nodes) {
    const l = layerMap.get(n.id) || 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(n);
  }

  const sortedLayerIndices = Array.from(layers.keys()).sort((a, b) => a - b);
  const orderedLayers =
    direction === 'UP' || direction === 'LEFT'
      ? [...sortedLayerIndices].reverse()
      : sortedLayerIndices;

  // 4. Coordinate Assignment with variable node dimensions & centering
  if (direction === 'DOWN' || direction === 'UP') {
    // Primary axis: Y (layers stacked vertically), Secondary axis: X (siblings arranged horizontally)
    const layerWidths: number[] = [];
    const layerHeights: number[] = [];

    for (const l of orderedLayers) {
      const layerNodes = layers.get(l)!;
      let totalW = 0;
      let maxH = 0;
      layerNodes.forEach((node, idx) => {
        const w = node.width ?? 160;
        const h = node.height ?? 60;
        totalW += w + (idx > 0 ? nodeSpacing : 0);
        maxH = Math.max(maxH, h);
      });
      layerWidths.push(totalW);
      layerHeights.push(maxH);
    }

    const maxLayerWidth = Math.max(...layerWidths, 0);
    const shouldCenterLayers =
      nodes.some((n) => n.type === 'frame') || orderedLayers.some((l) => layers.get(l)!.length > 1);

    let currentY = origin.y;
    for (let i = 0; i < orderedLayers.length; i++) {
      const l = orderedLayers[i];
      const layerNodes = layers.get(l)!;
      const layerW = layerWidths[i];
      const layerH = layerHeights[i];

      let currentX =
        origin.x +
        (shouldCenterLayers && maxLayerWidth > layerW
          ? Math.round((maxLayerWidth - layerW) / 2)
          : 0);

      for (const node of layerNodes) {
        const w = node.width ?? 160;
        const h = node.height ?? 60;
        const offsetY = Math.round((layerH - h) / 2);
        positions.set(node.id, { x: currentX, y: currentY + offsetY });
        currentX += w + nodeSpacing;
      }

      currentY += layerH + layerSpacing;
    }
  } else {
    // Direction is RIGHT or LEFT
    // Primary axis: X (layers arranged horizontally), Secondary axis: Y (siblings stacked vertically)
    const layerWidths: number[] = [];
    const layerHeights: number[] = [];

    for (const l of orderedLayers) {
      const layerNodes = layers.get(l)!;
      let maxW = 0;
      let totalH = 0;
      layerNodes.forEach((node, idx) => {
        const w = node.width ?? 160;
        const h = node.height ?? 60;
        maxW = Math.max(maxW, w);
        totalH += h + (idx > 0 ? nodeSpacing : 0);
      });
      layerWidths.push(maxW);
      layerHeights.push(totalH);
    }

    const maxLayerHeight = Math.max(...layerHeights, 0);
    const shouldCenterLayers =
      nodes.some((n) => n.type === 'frame') || orderedLayers.some((l) => layers.get(l)!.length > 1);

    let currentX = origin.x;
    for (let i = 0; i < orderedLayers.length; i++) {
      const l = orderedLayers[i];
      const layerNodes = layers.get(l)!;
      const layerW = layerWidths[i];
      const layerH = layerHeights[i];

      let currentY =
        origin.y +
        (shouldCenterLayers && maxLayerHeight > layerH
          ? Math.round((maxLayerHeight - layerH) / 2)
          : 0);

      for (const node of layerNodes) {
        const w = node.width ?? 160;
        const h = node.height ?? 60;
        const offsetX = Math.round((layerW - w) / 2);
        positions.set(node.id, { x: currentX + offsetX, y: currentY });
        currentY += h + nodeSpacing;
      }

      currentX += layerW + layerSpacing;
    }
  }

  return positions;
}

/**
 * Layouts child nodes inside a horizontal tier subgraph (when parent graph is DOWN/UP
 * and subgraph has no explicit conflicting direction). Places connected chains and siblings
 * in compact horizontal rows with extra gap for labeled internal edges.
 */
function layoutSubgraphHorizontalBand(
  subChildren: NeuroNode[],
  subEdges: NeuroEdge[],
  nodeSpacing: number,
  layerSpacing: number,
  origin: Point
): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (subChildren.length === 0) return positions;

  // Preserve declaration order while respecting internal forward edges
  const ordered = [...subChildren];
  const maxColsPerRow = 5;
  const rows: NeuroNode[][] = [];
  for (let i = 0; i < ordered.length; i += maxColsPerRow) {
    rows.push(ordered.slice(i, i + maxColsPerRow));
  }

  // Helper to check if two nodes have an internal edge (and whether it has a label)
  const getEdgeBetween = (idA: string, idB: string): NeuroEdge | undefined =>
    subEdges.find(
      (e) =>
        (e.source === idA && e.target === idB) ||
        (e.source === idB && e.target === idA)
    );

  let currentY = origin.y;
  for (const row of rows) {
    const rowMaxH = Math.max(...row.map((n) => n.height ?? 60), 60);
    let currentX = origin.x;

    for (let i = 0; i < row.length; i++) {
      const node = row[i];
      const w = node.width ?? 160;
      const h = node.height ?? 60;
      const yOffset = Math.round((rowMaxH - h) / 2);
      positions.set(node.id, { x: currentX, y: currentY + yOffset });

      if (i < row.length - 1) {
        const nextNode = row[i + 1];
        const connectingEdge = getEdgeBetween(node.id, nextNode.id);
        const hasLabel = Boolean(connectingEdge?.label || connectingEdge?.data?.label);
        const gap = hasLabel
          ? Math.max(nodeSpacing, 220)
          : connectingEdge
          ? Math.max(nodeSpacing, 90)
          : Math.max(nodeSpacing, 48);
        currentX += w + gap;
      }
    }

    currentY += rowMaxH + Math.max(40, Math.round(layerSpacing * 0.6));
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

  // 4. Layout subgraphs first (bottom-up by nesting depth, isolated direction per subgraph)
  const subgraphCalculatedPositions = new Map<string, Point>();
  const subgraphDimensions = new Map<string, { width: number; height: number }>();

  // Collapsed subgraphs always receive collapsed dimensions (180x44)
  for (const subId of collapsedSubgraphs) {
    subgraphDimensions.set(subId, { width: 180, height: 44 });
  }

  const getDepth = (id: string): number => {
    let depth = 0;
    let curr = frameMap.get(id)?.parentId;
    const seen = new Set<string>();
    while (curr && !seen.has(curr)) {
      seen.add(curr);
      depth++;
      curr = frameMap.get(curr)?.parentId;
    }
    return depth;
  };

  const sortedSubEntries = Array.from(childrenByParent.entries()).sort(
    (a, b) => getDepth(b[0]) - getDepth(a[0])
  );

  for (const [subId, rawSubChildren] of sortedSubEntries) {
    const frame = frameMap.get(subId);
    if (!frame) continue;

    if (frame.data.collapsed) {
      // Fixed collapsed dimensions (180x44) per algorithms.md §3.4
      subgraphDimensions.set(subId, { width: 180, height: 44 });
      continue;
    }

    // Apply any already-calculated child subgraph dimensions
    const subChildren = rawSubChildren.map((c) => {
      if (subgraphDimensions.has(c.id)) {
        const dims = subgraphDimensions.get(c.id)!;
        return { ...c, width: dims.width, height: dims.height };
      }
      return c;
    });

    // Filter edges internal to this subgraph
    const childIds = new Set<string>(subChildren.map((c) => c.id));
    const subEdges = activeEdges.filter(
      (e) => childIds.has(e.source) && childIds.has(e.target)
    );

    const padding = { top: 52, left: 32, bottom: 28, right: 32 };
    let childPositions: Map<string, Point>;

    if (frame.data.direction) {
      const subDir = normalizeDirection(frame.data.direction);
      childPositions = layoutHierarchicalGraph(
        subChildren,
        subEdges,
        subDir,
        nodeSpacing,
        layerSpacing,
        { x: padding.left, y: padding.top }
      );
    } else if (globalDir === 'DOWN' || globalDir === 'UP') {
      // Horizontal architectural tier inside a Top-to-Bottom / Bottom-to-Top diagram
      childPositions = layoutSubgraphHorizontalBand(
        subChildren,
        subEdges,
        nodeSpacing,
        layerSpacing,
        { x: padding.left, y: padding.top }
      );
    } else {
      childPositions = layoutHierarchicalGraph(
        subChildren,
        subEdges,
        globalDir,
        nodeSpacing,
        layerSpacing,
        { x: padding.left, y: padding.top }
      );
    }

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
    const calculatedHeight = Math.max(maxY + padding.bottom, frame.data.minHeight || 140);

    subgraphDimensions.set(subId, {
      width: calculatedWidth,
      height: calculatedHeight,
    });
  }

  // 5. Layout Root-Level Graph (lifting cross-subgraph edges to their root-level ancestors)
  const activeNodeMap = new Map<string, NeuroNode>(activeNodes.map((n) => [n.id, n]));
  const rootNodeIdSet = new Set<string>(rootNodes.map((rn) => rn.id));

  const getRootAncestor = (nodeId: string): string | undefined => {
    let curr: string | undefined = nodeId;
    const seen = new Set<string>();
    while (curr && !seen.has(curr)) {
      seen.add(curr);
      if (rootNodeIdSet.has(curr)) return curr;
      curr = activeNodeMap.get(curr)?.parentId;
    }
    return undefined;
  };

  const rootEdges: NeuroEdge[] = [];
  const seenRootEdgePairs = new Set<string>();
  let hasLabeledCrossEdge = false;

  for (const e of activeEdges) {
    const rootSrc = getRootAncestor(e.source);
    const rootTgt = getRootAncestor(e.target);
    if (rootSrc && rootTgt && rootSrc !== rootTgt) {
      if (e.label || e.data?.label) hasLabeledCrossEdge = true;
      const pairKey = `${rootSrc}->${rootTgt}`;
      if (!seenRootEdgePairs.has(pairKey)) {
        seenRootEdgePairs.add(pairKey);
        rootEdges.push({
          ...e,
          id: `root_${e.id}`,
          source: rootSrc,
          target: rootTgt,
        });
      }
    }
  }

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

  const effectiveRootLayerSpacing =
    hasLabeledCrossEdge && rootNodes.some((rn) => rn.type === 'frame')
      ? Math.max(layerSpacing, 185)
      : layerSpacing;

  const rootPositions = layoutHierarchicalGraph(
    rootNodesWithDimensions,
    rootEdges,
    globalDir,
    nodeSpacing,
    effectiveRootLayerSpacing,
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

  // 7. Compute absolute node centers and refine edge handles so horizontal siblings
  // connect left<->right and upward feedback edges connect top->bottom
  const resultNodeMap = new Map<string, NeuroNode>(resultNodes.map((n) => [n.id, n]));
  const getAbsoluteCenter = (nodeId: string): { cx: number; cy: number; w: number; h: number } | null => {
    const n = resultNodeMap.get(nodeId);
    if (!n) return null;
    let absX = n.position.x;
    let absY = n.position.y;
    let currParent = n.parentId;
    const seen = new Set<string>();
    while (currParent && !seen.has(currParent)) {
      seen.add(currParent);
      const p = resultNodeMap.get(currParent);
      if (!p) break;
      absX += p.position.x;
      absY += p.position.y;
      currParent = p.parentId;
    }
    const w = n.width ?? 160;
    const h = n.height ?? 60;
    return { cx: absX + w / 2, cy: absY + h / 2, w, h };
  };

  const finalEdges = activeEdges.map((e) => {
    const srcC = getAbsoluteCenter(e.source);
    const tgtC = getAbsoluteCenter(e.target);
    if (!srcC || !tgtC) return e;

    let sourceHandle = e.sourceHandle;
    let targetHandle = e.targetHandle;

    if (globalDir === 'DOWN' || globalDir === 'UP') {
      const sameHorizontalRow = Math.abs(srcC.cy - tgtC.cy) <= Math.max(srcC.h, tgtC.h) * 0.65;
      if (sameHorizontalRow) {
        sourceHandle = srcC.cx <= tgtC.cx ? 'right' : 'left';
        targetHandle = srcC.cx <= tgtC.cx ? 'left' : 'right';
      } else if (srcC.cy < tgtC.cy) {
        sourceHandle = 'bottom';
        targetHandle = 'top';
      } else {
        sourceHandle = 'top';
        targetHandle = 'bottom';
      }
    } else {
      const sameVerticalCol = Math.abs(srcC.cx - tgtC.cx) <= Math.max(srcC.w, tgtC.w) * 0.65;
      if (sameVerticalCol) {
        sourceHandle = srcC.cy <= tgtC.cy ? 'bottom' : 'top';
        targetHandle = srcC.cy <= tgtC.cy ? 'top' : 'bottom';
      } else if (srcC.cx < tgtC.cx) {
        sourceHandle = 'right';
        targetHandle = 'left';
      } else {
        sourceHandle = 'left';
        targetHandle = 'right';
      }
    }

    return {
      ...e,
      sourceHandle,
      targetHandle,
    };
  });

  return {
    nodes: resultNodes,
    edges: finalEdges,
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

