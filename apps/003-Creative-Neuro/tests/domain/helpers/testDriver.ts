/**
 * Creative-Neuro E2E Test Suite - Test Driver & Reference Contract Engines
 * Authoritative Source: PROJECT.md, specs.md, algorithms.md, ORIGINAL_REQUEST.md
 *
 * Provides headless, opaque-box interaction drivers exercising store mutations,
 * algorithmic engines, and export/import transformations.
 */

import zlib from 'zlib';
import type {
  Project,
  Board,
  Page,
  NeuroNode,
  NeuroEdge,
  Point,
  BoundingBox,
  ElkLayoutOptions,
  PlacementConfig,
  LineJumpConfig,
  JumpArc,
  LayoutMode,
  ShapeType,
  FlowDirection,
} from './contracts.ts';

export interface ParsedMermaidAST {
  direction: FlowDirection;
  nodes: Array<{
    id: string;
    label: string;
    shapeType: ShapeType;
    parentId?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
    style?: string;
  }>;
  subgraphs: Array<{
    id: string;
    title: string;
    direction?: FlowDirection;
    nodeIds: string[];
  }>;
}

/**
 * Pure 2D Vector Cross Product: Cross(A, B) = A.x * B.y - A.y * B.x
 */
export function crossProduct2D(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

/**
 * AABB Collision Detection between two bounding boxes with safety margin M
 */
export function checkAABBCollision(
  boxA: BoundingBox,
  boxB: BoundingBox,
  margin: number = 24
): boolean {
  const centerAX = boxA.x + boxA.width / 2;
  const centerAY = boxA.y + boxA.height / 2;
  const centerBX = boxB.x + boxB.width / 2;
  const centerBY = boxB.y + boxB.height / 2;

  const overlapX =
    Math.abs(centerAX - centerBX) < (boxA.width + boxB.width) / 2 + margin;
  const overlapY =
    Math.abs(centerAY - centerBY) < (boxA.height + boxB.height) / 2 + margin;

  return overlapX && overlapY;
}

/**
 * Smart Collision-Free Position Calculator (specs.md §4.3)
 */
export function findCollisionFreePosition(
  targetNode: NeuroNode,
  direction: 'right' | 'bottom' | 'left' | 'top',
  existingNodes: NeuroNode[],
  config: PlacementConfig = {}
): Point {
  const margin = config.margin ?? 24;
  const newWidth = config.defaultWidth ?? 160;
  const newHeight = config.defaultHeight ?? 60;
  const maxIterations = config.maxIterations ?? 50;

  const targetW = targetNode.width ?? 160;
  const targetH = targetNode.height ?? 60;

  let candX = targetNode.position.x;
  let candY = targetNode.position.y;
  let stepX = 0;
  let stepY = 0;

  switch (direction) {
    case 'right': // Child placement (Tab)
      candX = targetNode.position.x + targetW + 80;
      candY = targetNode.position.y;
      stepX = 0;
      stepY = newHeight + margin;
      break;
    case 'bottom': // Sibling placement (Enter)
      candX = targetNode.position.x;
      candY = targetNode.position.y + targetH + 40;
      stepX = 0;
      stepY = newHeight + margin;
      break;
    case 'top':
      candX = targetNode.position.x;
      candY = targetNode.position.y - (newHeight + 40);
      stepX = 0;
      stepY = -(newHeight + margin);
      break;
    case 'left':
      candX = targetNode.position.x - (newWidth + 80);
      candY = targetNode.position.y;
      stepX = -(newWidth + margin);
      stepY = 0;
      break;
  }

  const obstacles: BoundingBox[] = existingNodes.map((n) => ({
    x: n.position.x,
    y: n.position.y,
    width: n.width ?? 160,
    height: n.height ?? 60,
  }));

  for (let i = 0; i < maxIterations; i++) {
    const candidateBox: BoundingBox = {
      x: candX,
      y: candY,
      width: newWidth,
      height: newHeight,
    };

    const hasCollision = obstacles.some((obs) =>
      checkAABBCollision(candidateBox, obs, margin)
    );

    if (!hasCollision) {
      return { x: candX, y: candY };
    }

    candX += stepX;
    candY += stepY;
  }

  return { x: candX, y: candY };
}

/**
 * 2D Vector Cross-Product Line Jump Engine (specs.md §4.4)
 */
export function calculateLineJumps(
  edges: NeuroEdge[],
  nodes: Record<string, NeuroNode>,
  config: LineJumpConfig = {}
): Map<string, JumpArc[]> {
  const jumpRadius = config.jumpRadius ?? 6;
  const endpointTol = config.endpointTolerance ?? 0.05;
  const results = new Map<string, JumpArc[]>();

  // Helper to extract center coordinates of nodes as segment endpoints
  const getSegment = (
    e: NeuroEdge
  ): { p1: Point; p2: Point; edgeId: string } | null => {
    const src = nodes[e.source];
    const tgt = nodes[e.target];
    if (!src || !tgt) return null;
    const p1: Point = {
      x: src.position.x + (src.width ?? 160) / 2,
      y: src.position.y + (src.height ?? 60) / 2,
    };
    const p2: Point = {
      x: tgt.position.x + (tgt.width ?? 160) / 2,
      y: tgt.position.y + (tgt.height ?? 60) / 2,
    };
    return { p1, p2, edgeId: e.id };
  };

  const segments = edges
    .map(getSegment)
    .filter(
      (s): s is { p1: Point; p2: Point; edgeId: string } => s !== null
    );

  for (let i = 0; i < segments.length; i++) {
    const s1 = segments[i];
    const u: Point = { x: s1.p2.x - s1.p1.x, y: s1.p2.y - s1.p1.y };
    const uLen = Math.hypot(u.x, u.y);
    if (uLen < 1e-6) continue;

    for (let j = 0; j < segments.length; j++) {
      if (i === j) continue;
      const s2 = segments[j];
      const v: Point = { x: s2.p2.x - s2.p1.x, y: s2.p2.y - s2.p1.y };
      const vLen = Math.hypot(v.x, v.y);
      if (vLen < 1e-6) continue;

      const D = crossProduct2D(u, v);
      // Parallel or colinear
      if (Math.abs(D) < 1e-6) continue;

      const w: Point = { x: s2.p1.x - s1.p1.x, y: s2.p1.y - s1.p1.y };
      const t = crossProduct2D(w, v) / D;
      const s = crossProduct2D(w, u) / D;

      // Endpoint tolerance threshold check
      if (
        t >= endpointTol &&
        t <= 1 - endpointTol &&
        s >= endpointTol &&
        s <= 1 - endpointTol
      ) {
        // Priority check: horizontal jumps over vertical; otherwise lexicographical edge ID
        const s1IsHorizontal = Math.abs(u.y) < 1e-3;
        const s2IsVertical = Math.abs(v.x) < 1e-3;

        let s1ShouldJump = false;
        if (s1IsHorizontal && s2IsVertical) {
          s1ShouldJump = true;
        } else if (
          Math.abs(u.x) < 1e-3 &&
          Math.abs(v.y) < 1e-3
        ) {
          s1ShouldJump = false; // s2 is horizontal, s1 is vertical
        } else {
          s1ShouldJump = s1.edgeId < s2.edgeId;
        }

        if (s1ShouldJump) {
          const crossX = s1.p1.x + t * u.x;
          const crossY = s1.p1.y + t * u.y;
          const normU: Point = { x: u.x / uLen, y: u.y / uLen };

          const startPt: Point = {
            x: crossX - jumpRadius * normU.x,
            y: crossY - jumpRadius * normU.y,
          };
          const endPt: Point = {
            x: crossX + jumpRadius * normU.x,
            y: crossY + jumpRadius * normU.y,
          };

          const arcCmd = `L ${startPt.x.toFixed(2)} ${startPt.y.toFixed(2)} A ${jumpRadius} ${jumpRadius} 0 0 1 ${endPt.x.toFixed(2)} ${endPt.y.toFixed(2)}`;

          const jump: JumpArc = {
            crossingPoint: { x: crossX, y: crossY },
            startPoint: startPt,
            endPoint: endPt,
            t,
            radius: jumpRadius,
            svgArcCommand: arcCmd,
          };

          if (!results.has(s1.edgeId)) {
            results.set(s1.edgeId, []);
          }
          results.get(s1.edgeId)!.push(jump);
        }
      }
    }
  }

  // Sort jump arcs on each edge by parameter t ascending
  for (const [edgeId, arcs] of results.entries()) {
    arcs.sort((a, b) => a.t - b.t);
  }

  return results;
}

function cleanLabel(raw: string): string {
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s;
}

function parseNodeToken(token: string): { id: string; label: string; shapeType: ShapeType } {
  token = token.trim();
  let m = token.match(/^([a-zA-Z0-9_-]+)\s*\[\(\s*(.*?)\s*\)\]$/);
  if (m) return { id: m[1], label: cleanLabel(m[2]), shapeType: 'cylinder' };

  m = token.match(/^([a-zA-Z0-9_-]+)\s*\(\(\s*(.*?)\s*\)\)$/);
  if (m) return { id: m[1], label: cleanLabel(m[2]), shapeType: 'circle' };

  m = token.match(/^([a-zA-Z0-9_-]+)\s*\(\[\s*(.*?)\s*\]\)$/);
  if (m) return { id: m[1], label: cleanLabel(m[2]), shapeType: 'stadium' };

  m = token.match(/^([a-zA-Z0-9_-]+)\s*\[\[\s*(.*?)\s*\]\]$/);
  if (m) return { id: m[1], label: cleanLabel(m[2]), shapeType: 'subroutine' };

  m = token.match(/^([a-zA-Z0-9_-]+)\s*\{\{\s*(.*?)\s*\}\}$/);
  if (m) return { id: m[1], label: cleanLabel(m[2]), shapeType: 'hexagon' };

  m = token.match(/^([a-zA-Z0-9_-]+)\s*\{\s*(.*?)\s*\}$/);
  if (m) return { id: m[1], label: cleanLabel(m[2]), shapeType: 'diamond' };

  m = token.match(/^([a-zA-Z0-9_-]+)\s*\(\s*(.*?)\s*\)$/);
  if (m) return { id: m[1], label: cleanLabel(m[2]), shapeType: 'rounded' };

  m = token.match(/^([a-zA-Z0-9_-]+)\s*\[\s*(.*?)\s*\]$/);
  if (m) return { id: m[1], label: cleanLabel(m[2]), shapeType: 'rectangle' };

  m = token.match(/^([a-zA-Z0-9_-]+)$/);
  if (m) return { id: m[1], label: cleanLabel(m[1]), shapeType: 'rectangle' };

  return { id: token, label: token, shapeType: 'rectangle' };
}

/**
 * Mermaid DSL Parser & AST Extractor (specs.md §4.1)
 */
export function parseMermaid(code: string): ParsedMermaidAST {
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  let direction: FlowDirection = 'TB';
  const nodesMap = new Map<
    string,
    { id: string; label: string; shapeType: ShapeType; parentId?: string }
  >();
  const edges: ParsedMermaidAST['edges'] = [];
  const subgraphs: ParsedMermaidAST['subgraphs'] = [];

  let currentSubgraph: {
    id: string;
    title: string;
    direction?: FlowDirection;
    nodeIds: string[];
  } | null = null;

  const arrowRegex = /\s*(?:(-->|---|-.->|==>)(?:\|([^|]+)\|)?|--\s*([^>]+?)\s*-->)\s*/;

  for (const line of lines) {
    if (line.startsWith('flowchart') || line.startsWith('graph')) {
      const parts = line.split(/\s+/);
      if (parts[1] && ['TB', 'TD', 'BT', 'RL', 'LR'].includes(parts[1])) {
        direction = parts[1] as FlowDirection;
      }
      continue;
    }

    if (line.startsWith('subgraph')) {
      const match = line.match(/^subgraph\s+([a-zA-Z0-9_-]+)(?:\s*\[(.*)\])?/);
      if (match) {
        currentSubgraph = {
          id: match[1],
          title: match[2] || match[1],
          nodeIds: [],
        };
      }
      continue;
    }

    if (line.startsWith('direction') && currentSubgraph) {
      const parts = line.split(/\s+/);
      if (parts[1] && ['TB', 'TD', 'BT', 'RL', 'LR'].includes(parts[1])) {
        currentSubgraph.direction = parts[1] as FlowDirection;
      }
      continue;
    }

    if (line === 'end' && currentSubgraph) {
      subgraphs.push(currentSubgraph);
      currentSubgraph = null;
      continue;
    }

    // Check if line contains an edge arrow
    if (arrowRegex.test(line)) {
      const segments: string[] = [];
      const edgeLabels: (string | undefined)[] = [];
      let remaining = line;
      let match;
      while ((match = remaining.match(arrowRegex))) {
        const idx = match.index!;
        segments.push(remaining.slice(0, idx).trim());
        const label = match[2] || match[3];
        edgeLabels.push(label ? cleanLabel(label) : undefined);
        remaining = remaining.slice(idx + match[0].length).trim();
      }
      segments.push(remaining.trim());

      for (let sIdx = 0; sIdx < segments.length - 1; sIdx++) {
        const srcParsed = parseNodeToken(segments[sIdx]);
        const tgtParsed = parseNodeToken(segments[sIdx + 1]);
        const edgeLabel = edgeLabels[sIdx];

        if (!nodesMap.has(srcParsed.id)) {
          nodesMap.set(srcParsed.id, {
            id: srcParsed.id,
            label: srcParsed.label,
            shapeType: srcParsed.shapeType,
            parentId: currentSubgraph?.id,
          });
        }
        if (!nodesMap.has(tgtParsed.id)) {
          nodesMap.set(tgtParsed.id, {
            id: tgtParsed.id,
            label: tgtParsed.label,
            shapeType: tgtParsed.shapeType,
            parentId: currentSubgraph?.id,
          });
        }

        if (currentSubgraph) {
          if (!currentSubgraph.nodeIds.includes(srcParsed.id))
            currentSubgraph.nodeIds.push(srcParsed.id);
          if (!currentSubgraph.nodeIds.includes(tgtParsed.id))
            currentSubgraph.nodeIds.push(tgtParsed.id);
        }

        edges.push({
          source: srcParsed.id,
          target: tgtParsed.id,
          label: edgeLabel,
        });
      }
      continue;
    }

    // Standalone node
    const nodeParsed = parseNodeToken(line);
    if (nodeParsed.id && !nodesMap.has(nodeParsed.id)) {
      nodesMap.set(nodeParsed.id, {
        id: nodeParsed.id,
        label: nodeParsed.label,
        shapeType: nodeParsed.shapeType,
        parentId: currentSubgraph?.id,
      });
      if (currentSubgraph && !currentSubgraph.nodeIds.includes(nodeParsed.id)) {
        currentSubgraph.nodeIds.push(nodeParsed.id);
      }
    }
  }

  return {
    direction,
    nodes: Array.from(nodesMap.values()),
    edges,
    subgraphs,
  };
}

/**
 * Node ID Reconciliation Engine (specs.md §4.1.2)
 * Preserves manually placed or fixed node coordinates during Mermaid sync
 */
export function reconcileMermaidAST(
  ast: ParsedMermaidAST,
  existingNodes: NeuroNode[],
  defaultMode: LayoutMode = 'auto-elk'
): { nodes: NeuroNode[]; edges: NeuroEdge[] } {
  const existingMap = new Map<string, NeuroNode>(
    existingNodes.map((n) => [n.id, n])
  );

  let autoX = 100;
  let autoY = 100;

  const reconciledNodes: NeuroNode[] = ast.nodes.map((parsed) => {
    const existing = existingMap.get(parsed.id);

    if (existing) {
      // PRESERVE coordinates and layoutMode, update semantic properties
      return {
        ...existing,
        parentId: parsed.parentId ?? existing.parentId,
        data: {
          ...existing.data,
          label: parsed.label,
          shapeType: parsed.shapeType,
        },
      };
    } else {
      // NEW Node: assign incremental position and auto-elk mode
      const pos: Point = { x: autoX, y: autoY };
      autoX += 180;
      if (autoX > 800) {
        autoX = 100;
        autoY += 120;
      }
      return {
        id: parsed.id,
        type: 'shape',
        position: pos,
        width: 160,
        height: 60,
        parentId: parsed.parentId,
        layoutMode: defaultMode,
        data: {
          label: parsed.label,
          shapeType: parsed.shapeType,
        },
      };
    }
  });

  const reconciledEdges: NeuroEdge[] = ast.edges.map((e, idx) => ({
    id: `e_${e.source}_${e.target}_${idx}`,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'jump',
  }));

  return { nodes: reconciledNodes, edges: reconciledEdges };
}

/**
 * Mermaid Serializer
 */
export function serializeMermaid(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  direction: FlowDirection = 'TB'
): string {
  const lines: string[] = [`flowchart ${direction}`];

  // Group nodes by parentId (for subgraphs)
  const rootNodes = nodes.filter((n) => !n.parentId);
  const subgraphNodes = new Map<string, NeuroNode[]>();

  for (const n of nodes) {
    if (n.parentId) {
      if (!subgraphNodes.has(n.parentId)) {
        subgraphNodes.set(n.parentId, []);
      }
      subgraphNodes.get(n.parentId)!.push(n);
    }
  }

  const formatNode = (n: NeuroNode): string => {
    const label = n.data.label || n.id;
    switch (n.data.shapeType) {
      case 'rounded':
        return `${n.id}("${label}")`;
      case 'circle':
        return `${n.id}(("${label}"))`;
      case 'diamond':
        return `${n.id}{"${label}"}`;
      case 'cylinder':
        return `${n.id}[("${label}")]`;
      case 'stadium':
        return `${n.id}(["${label}"])`;
      case 'subroutine':
        return `${n.id}[["${label}"]]`;
      case 'hexagon':
        return `${n.id}{{"${label}"}}`;
      default:
        return `${n.id}["${label}"]`;
    }
  };

  // Subgraphs
  for (const [subId, sNodes] of subgraphNodes.entries()) {
    lines.push(`  subgraph ${subId}`);
    for (const sn of sNodes) {
      lines.push(`    ${formatNode(sn)}`);
    }
    lines.push(`  end`);
  }

  // Root nodes
  for (const rn of rootNodes) {
    if (rn.type === 'frame' || rn.type === 'diagram') continue;
    lines.push(`  ${formatNode(rn)}`);
  }

  // Edges
  for (const e of edges) {
    if (e.label) {
      lines.push(`  ${e.source} -->|${e.label}| ${e.target}`);
    } else {
      lines.push(`  ${e.source} --> ${e.target}`);
    }
  }

  return lines.join('\n');
}

/**
 * Headless ELK Layout Simulator (specs.md §4.2)
 * Ranks nodes into hierarchical layers, preserving 'fixed' and 'manual' nodes
 */
export async function calculateElkLayout(
  nodes: NeuroNode[],
  edges: NeuroEdge[],
  options: ElkLayoutOptions = {}
): Promise<{ nodes: NeuroNode[]; edges: NeuroEdge[] }> {
  const dir = options.direction ?? 'DOWN';
  const nodeSpacing = options.nodeSpacing ?? 50;
  const layerSpacing = options.layerSpacing ?? 80;

  // Build adjacency
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (adj.has(e.source) && inDegree.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  }

  // Layer assignment via Kahn's / Topological sort (reversing feedback edges for cycles)
  const queue: string[] = [];
  const layerMap = new Map<string, number>();

  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
      layerMap.set(id, 0);
    }
  }

  // Cycle fallback
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
        layerMap.set(
          neighbor,
          Math.max(layerMap.get(neighbor) || 0, currLayer + 1)
        );
        queue.push(neighbor);
      }
    }
  }

  // Assign layers to remaining unvisited nodes
  let maxL = 0;
  for (const l of layerMap.values()) maxL = Math.max(maxL, l);
  for (const n of nodes) {
    if (!layerMap.has(n.id)) {
      maxL++;
      layerMap.set(n.id, maxL);
    }
  }

  // Group nodes by layer
  const layers = new Map<number, NeuroNode[]>();
  for (const n of nodes) {
    const l = layerMap.get(n.id) || 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(n);
  }

  const resultNodes: NeuroNode[] = [];
  const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);

  for (const l of sortedLayers) {
    const layerNodes = layers.get(l)!;
    const layerY = 100 + l * ((layerNodes[0]?.height ?? 60) + layerSpacing);

    layerNodes.forEach((node, idx) => {
      // PRESERVE fixed and manual nodes
      if (node.layoutMode === 'fixed' || node.layoutMode === 'manual') {
        resultNodes.push({ ...node });
      } else {
        const layerX =
          100 + idx * ((node.width ?? 160) + nodeSpacing);
        resultNodes.push({
          ...node,
          position: dir === 'DOWN' ? { x: layerX, y: layerY } : { x: layerY, y: layerX },
        });
      }
    });
  }

  return { nodes: resultNodes, edges };
}

/**
 * Exporter Utilities (specs.md §6.2)
 */
export function exportProjectAsJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function importProjectFromJson(jsonString: string): Project {
  const parsed = JSON.parse(jsonString) as Project;
  if (!parsed.id || !parsed.boards || !parsed.pages) {
    throw new Error('Invalid Creative-Neuro project schema');
  }
  return parsed;
}

export function exportSvg(page: Page): string {
  const nodeSvgs = Object.values(page.nodes).map((n) => {
    return `<rect x="${n.position.x}" y="${n.position.y}" width="${n.width ?? 160}" height="${n.height ?? 60}" fill="#2563eb" rx="8"/><text x="${n.position.x + (n.width ?? 160)/2}" y="${n.position.y + (n.height ?? 60)/2}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${n.data.label || n.id}</text>`;
  });
  const edgeSvgs = Object.values(page.edges).map((e) => {
    const src = page.nodes[e.source];
    const tgt = page.nodes[e.target];
    if (!src || !tgt) return '';
    const x1 = src.position.x + (src.width ?? 160) / 2;
    const y1 = src.position.y + (src.height ?? 60) / 2;
    const x2 = tgt.position.x + (tgt.width ?? 160) / 2;
    const y2 = tgt.position.y + (tgt.height ?? 60) / 2;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="2"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="100%" height="100%"><g id="edges">${edgeSvgs.join('')}</g><g id="nodes">${nodeSvgs.join('')}</g></svg>`;
}

export function exportPngWithPako(project: Project): {
  dataUrl: string;
  compressedPayload: Uint8Array;
} {
  const jsonStr = JSON.stringify(project);
  const compressed = zlib.deflateSync(Buffer.from(jsonStr, 'utf-8'));
  const base64Metadata = Buffer.from(compressed).toString('base64');
  const dummyDataUrl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==#metadata=${base64Metadata}`;
  return {
    dataUrl: dummyDataUrl,
    compressedPayload: compressed,
  };
}

export function restoreProjectFromPngMetadata(
  compressedPayload: Uint8Array
): Project {
  const decompressed = zlib.inflateSync(compressedPayload);
  const jsonStr = decompressed.toString('utf-8');
  return JSON.parse(jsonStr) as Project;
}

/**
 * Workspace Test Harness Class
 */
export class TestWorkspace {
  project: Project;
  activePageId: string;
  historyStack: Project[] = [];
  redoStack: Project[] = [];

  constructor(initialProject?: Partial<Project>) {
    const page1: Page = {
      id: 'page-1',
      boardId: 'board-1',
      name: 'Brainstorming Mind Map',
      nodes: {},
      edges: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const board1: Board = {
      id: 'board-1',
      projectId: 'proj-1',
      name: 'Main Board',
      activePageId: 'page-1',
      pageIds: ['page-1'],
    };

    this.project = {
      id: 'proj-1',
      name: 'Creative-Neuro MVP Test Project',
      version: '1.0.0',
      activeBoardId: 'board-1',
      boards: { 'board-1': board1 },
      pages: { 'page-1': page1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...initialProject,
    };
    this.activePageId = 'page-1';
  }

  private isBatching: boolean = false;

  private recordSnapshot() {
    if (this.isBatching) return;
    this.historyStack.push(JSON.parse(JSON.stringify(this.project)));
    this.redoStack = [];
  }

  getActivePage(): Page {
    return this.project.pages[this.activePageId];
  }

  createPage(name: string = 'Untitled Page'): string {
    this.recordSnapshot();
    const id = `page-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newPage: Page = {
      id,
      boardId: this.project.activeBoardId,
      name,
      nodes: {},
      edges: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.project.pages[id] = newPage;
    const board = this.project.boards[this.project.activeBoardId];
    if (board && !board.pageIds.includes(id)) {
      board.pageIds.push(id);
    }
    this.activePageId = id;
    return id;
  }

  deletePage(pageId: string): boolean {
    const board = this.project.boards[this.project.activeBoardId];
    if (!board || board.pageIds.length <= 1) {
      throw new Error('A project must contain at least one page.');
    }
    this.recordSnapshot();
    delete this.project.pages[pageId];
    board.pageIds = board.pageIds.filter((id) => id !== pageId);
    if (this.activePageId === pageId) {
      this.activePageId = board.pageIds[0];
    }
    return true;
  }

  renamePage(pageId: string, name: string) {
    this.recordSnapshot();
    if (this.project.pages[pageId]) {
      this.project.pages[pageId].name = name;
    }
  }

  setActivePage(pageId: string) {
    if (this.project.pages[pageId]) {
      this.activePageId = pageId;
    }
  }

  addNode(node: Partial<NeuroNode>): string {
    this.recordSnapshot();
    const page = this.getActivePage();
    const id = node.id || `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fullNode: NeuroNode = {
      id,
      type: node.type || 'shape',
      position: node.position || { x: 100, y: 100 },
      width: node.width || 160,
      height: node.height || 60,
      layoutMode: node.layoutMode || 'auto-elk',
      data: node.data || { label: 'New Node', shapeType: 'rectangle' },
      parentId: node.parentId,
      selected: node.selected || false,
    };
    page.nodes[id] = fullNode;
    return id;
  }

  updateNodePosition(id: string, position: Point) {
    this.recordSnapshot();
    const page = this.getActivePage();
    if (page.nodes[id]) {
      page.nodes[id].position = { ...position };
      page.nodes[id].layoutMode = 'manual';
    }
  }

  deleteNodes(ids: string[]) {
    this.recordSnapshot();
    const page = this.getActivePage();
    for (const id of ids) {
      delete page.nodes[id];
    }
    // Delete incident edges
    for (const [edgeId, edge] of Object.entries(page.edges)) {
      if (ids.includes(edge.source) || ids.includes(edge.target)) {
        delete page.edges[edgeId];
      }
    }
  }

  addEdge(edge: Partial<NeuroEdge> & { source: string; target: string }): string {
    this.recordSnapshot();
    const page = this.getActivePage();
    const id = edge.id || `edge-${edge.source}-${edge.target}-${Date.now()}`;
    const fullEdge: NeuroEdge = {
      id,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'jump',
      label: edge.label,
      animated: edge.animated,
      style: edge.style,
      data: edge.data,
    };
    page.edges[id] = fullEdge;
    return id;
  }

  // Fast Keyboard Flow Actions (specs.md §3.2, §6.1)
  addChildNode(parentId: string): string {
    this.recordSnapshot();
    this.isBatching = true;
    try {
      const page = this.getActivePage();
      const parentNode = page.nodes[parentId];
      if (!parentNode) throw new Error(`Parent node ${parentId} not found`);

      const existingNodes = Object.values(page.nodes);
      const newPos = findCollisionFreePosition(parentNode, 'right', existingNodes);

      const childId = this.addNode({
        position: newPos,
        data: { label: 'Child Node', shapeType: parentNode.data.shapeType || 'rectangle' },
        layoutMode: parentNode.layoutMode,
        parentId: parentNode.parentId,
      });
      this.addEdge({ source: parentId, target: childId });
      return childId;
    } finally {
      this.isBatching = false;
    }
  }

  addSiblingNode(siblingId: string): string {
    this.recordSnapshot();
    this.isBatching = true;
    try {
      const page = this.getActivePage();
      const siblingNode = page.nodes[siblingId];
      if (!siblingNode) throw new Error(`Sibling node ${siblingId} not found`);

      const existingNodes = Object.values(page.nodes);
      const newPos = findCollisionFreePosition(siblingNode, 'bottom', existingNodes);

      // Find parent edge if exists
      let parentEdge = Object.values(page.edges).find((e) => e.target === siblingId);

      const newSiblingId = this.addNode({
        position: newPos,
        data: { label: 'Sibling Node', shapeType: siblingNode.data.shapeType || 'rectangle' },
        layoutMode: siblingNode.layoutMode,
        parentId: siblingNode.parentId,
      });

      if (parentEdge) {
        this.addEdge({ source: parentEdge.source, target: newSiblingId });
      }
      return newSiblingId;
    } finally {
      this.isBatching = false;
    }
  }

  addDirectionalNode(sourceId: string, direction: 'up' | 'down' | 'left' | 'right'): string {
    this.recordSnapshot();
    this.isBatching = true;
    try {
      const page = this.getActivePage();
      const srcNode = page.nodes[sourceId];
      if (!srcNode) throw new Error(`Source node ${sourceId} not found`);

      const dirMap: Record<string, 'right' | 'bottom' | 'left' | 'top'> = {
        up: 'top',
        down: 'bottom',
        left: 'left',
        right: 'right',
      };

      const existingNodes = Object.values(page.nodes);
      const newPos = findCollisionFreePosition(
        srcNode,
        dirMap[direction],
        existingNodes
      );

      const newId = this.addNode({
        position: newPos,
        data: { label: `${direction} Node`, shapeType: srcNode.data.shapeType },
        layoutMode: srcNode.layoutMode,
      });

      this.addEdge({ source: sourceId, target: newId });
      return newId;
    } finally {
      this.isBatching = false;
    }
  }

  undo(): boolean {
    if (this.historyStack.length === 0) return false;
    this.redoStack.push(JSON.parse(JSON.stringify(this.project)));
    this.project = this.historyStack.pop()!;
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.historyStack.push(JSON.parse(JSON.stringify(this.project)));
    this.project = this.redoStack.pop()!;
    return true;
  }
}
