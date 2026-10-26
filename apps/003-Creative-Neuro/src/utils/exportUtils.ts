/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Multi-Format Exporter & Lossless Importer Utilities
 *
 * Supports:
 * 1. Project JSON (.neuro.json) export & import
 * 2. Mermaid Flowchart DSL (.mmd) export from active page scene graph
 * 3. Standalone Vector SVG (.neuro.svg) with embedded `data-neuro-payload` metadata
 * 4. High-Resolution PNG (.neuro.png) with embedded zlib/pako `tEXt` chunk metadata
 * 5. Unified file/string/binary import & store restoration
 */

import type {
  Project,
  Board,
  Page,
  NeuroNode,
  NeuroEdge,
  FlowDirection,
  SerializedProjectPayload,
} from '../types/index.ts';
import type {
  ProjectRecord,
  ProjectState,
  ProjectActions,
} from '../store/projectStore.ts';
import { createSeedProject } from '../store/seedData.ts';
import { serializeMermaid, calculateLineJumps } from '../engine/index.ts';
import {
  compressPayload,
  decompressPayload,
  deflateToBytes,
  embedPayloadInPngDataUrl,
  embedPayloadInSvg,
  extractPayloadFromPngDataUrl,
  extractPngTextChunk,
  extractPayloadFromSvg,
  FALLBACK_1X1_PNG_BASE64,
  isValidPng,
} from './pakoUtils.ts';

export interface UnifiedExportPayload extends SerializedProjectPayload, ProjectRecord {}

export interface PngExportResult {
  dataUrl: string;
  compressedPayload: Uint8Array;
  base64Payload: string;
}

type StoreAccessor = {
  getState: () => ProjectState & Partial<ProjectActions>;
};

let activeStoreAccessor: StoreAccessor | null = null;

/**
 * Registers the live Zustand store accessor for zero-argument export/import calls.
 */
export function registerExportStore(store: StoreAccessor): void {
  activeStoreAccessor = store;
}

// Non-blocking auto-registration of useProjectStore when running in browser/bundler
void import('../store/projectStore.ts')
  .then((mod) => {
    if (!activeStoreAccessor && mod.useProjectStore) {
      activeStoreAccessor = mod.useProjectStore;
    }
  })
  .catch(() => {
    // Headless Node environment without zustand; explicit arguments or seed fallback used
  });

function getStoreStateFallback(): Partial<ProjectState> {
  if (activeStoreAccessor) {
    return activeStoreAccessor.getState();
  }
  const seed = createSeedProject();
  return {
    project: seed.project,
    boards: seed.boards,
    pages: seed.pages,
    nodes: seed.nodes,
    edges: seed.edges,
    activePageId: seed.project.activePageId,
  };
}

// ============================================================================
// 1. Internal State Normalization Helpers
// ============================================================================

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Normalizes store state, ProjectRecord, or SerializedProjectPayload into a unified payload.
 */
export function buildUnifiedProjectPayload(
  source?: Partial<ProjectState> | Partial<SerializedProjectPayload> | Partial<ProjectRecord>
): UnifiedExportPayload {
  const storeState = source ?? getStoreStateFallback();

  const rawProject: Partial<Project> =
    'project' in storeState && storeState.project
      ? storeState.project
      : (storeState as Partial<Project>);

  const boards: Record<string, Board> =
    ('boards' in storeState && storeState.boards ? storeState.boards : rawProject.boards) ?? {};

  const rawPages: Record<string, Page> =
    ('pages' in storeState && storeState.pages ? storeState.pages : rawProject.pages) ?? {};

  // Collect flat nodes and edges from top-level or nested page records
  const flatNodes: Record<string, NeuroNode> =
    'nodes' in storeState &&
    storeState.nodes &&
    typeof storeState.nodes === 'object' &&
    !Array.isArray(storeState.nodes)
      ? { ...(storeState.nodes as Record<string, NeuroNode>) }
      : {};

  const flatEdges: Record<string, NeuroEdge> =
    'edges' in storeState &&
    storeState.edges &&
    typeof storeState.edges === 'object' &&
    !Array.isArray(storeState.edges)
      ? { ...(storeState.edges as Record<string, NeuroEdge>) }
      : {};

  const normalizedPages: Record<string, Page> = {};

  for (const [pageId, page] of Object.entries(rawPages)) {
    if (!page) continue;

    // Merge any page-nested nodes/edges into flat dictionaries
    if (page.nodes && typeof page.nodes === 'object') {
      for (const [nid, n] of Object.entries(page.nodes)) {
        if (n && !flatNodes[nid]) {
          flatNodes[nid] = n;
        }
      }
    }
    if (page.edges && typeof page.edges === 'object') {
      for (const [eid, e] of Object.entries(page.edges)) {
        if (e && !flatEdges[eid]) {
          flatEdges[eid] = e;
        }
      }
    }

    const nodeIds =
      Array.isArray(page.nodeIds) && page.nodeIds.length > 0
        ? page.nodeIds
        : page.nodes
          ? Object.keys(page.nodes)
          : [];

    const edgeIds =
      Array.isArray(page.edgeIds) && page.edgeIds.length > 0
        ? page.edgeIds
        : page.edges
          ? Object.keys(page.edges)
          : [];

    const pageNodesRecord: Record<string, NeuroNode> = {};
    for (const nid of nodeIds) {
      if (flatNodes[nid]) {
        pageNodesRecord[nid] = flatNodes[nid];
      }
    }

    const pageEdgesRecord: Record<string, NeuroEdge> = {};
    for (const eid of edgeIds) {
      if (flatEdges[eid]) {
        pageEdgesRecord[eid] = flatEdges[eid];
      }
    }

    const title = page.title || page.name || 'Untitled Page';

    normalizedPages[pageId] = {
      ...page,
      id: pageId,
      projectId: page.projectId || rawProject.id || 'proj-1',
      boardId: page.boardId || rawProject.activeBoardId || 'board-1',
      title,
      name: page.name || title,
      order: typeof page.order === 'number' ? page.order : 0,
      viewport: page.viewport || { x: 0, y: 0, zoom: 1 },
      nodeIds,
      edgeIds,
      nodes: pageNodesRecord,
      edges: pageEdgesRecord,
      createdAt: page.createdAt || Date.now(),
      updatedAt: page.updatedAt || Date.now(),
    };
  }

  const pageIds =
    Array.isArray(rawProject.pageIds) && rawProject.pageIds.length > 0
      ? rawProject.pageIds
      : Object.keys(normalizedPages);

  const boardIds =
    Array.isArray(rawProject.boardIds) && rawProject.boardIds.length > 0
      ? rawProject.boardIds
      : Object.keys(boards);

  const activePageId =
    ('activePageId' in storeState && typeof storeState.activePageId === 'string'
      ? storeState.activePageId
      : rawProject.activePageId) ||
    pageIds[0] ||
    'page-1';

  const activeBoardId = rawProject.activeBoardId || boardIds[0] || 'board-1';

  const projectObj: Project = {
    id: rawProject.id || `proj-${Date.now()}`,
    name: rawProject.name || 'Creative-Neuro Project',
    description: rawProject.description || '',
    version: rawProject.version || '1.0.0',
    activeBoardId,
    boardIds,
    activePageId,
    pageIds,
    boards,
    pages: normalizedPages,
    createdAt: rawProject.createdAt || Date.now(),
    updatedAt: rawProject.updatedAt || Date.now(),
  };

  return {
    ...projectObj,
    version: projectObj.version,
    project: projectObj,
    boards,
    pages: normalizedPages,
    nodes: flatNodes,
    edges: flatEdges,
    exportedAt: Date.now(),
  };
}

// ============================================================================
// 2. JSON Export & Import
// ============================================================================

/**
 * Serializes the project into a formatted `.neuro.json` string.
 */
export function exportProjectAsJson(
  source?: Partial<ProjectState> | Partial<SerializedProjectPayload> | Partial<ProjectRecord>
): string {
  const payload = buildUnifiedProjectPayload(source);
  return JSON.stringify(payload, null, 2);
}

/**
 * Parses and validates a `.neuro.json` string, returning a normalized project payload.
 */
export function importProjectFromJson(jsonString: string): UnifiedExportPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON syntax in Creative-Neuro project file');
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid Creative-Neuro project schema');
  }

  const candidate = raw as Record<string, unknown>;
  const hasProjectEnvelope =
    candidate.project && typeof candidate.project === 'object';
  const hasTopLevelProject =
    typeof candidate.id === 'string' &&
    candidate.pages &&
    typeof candidate.pages === 'object';

  if (!hasProjectEnvelope && !hasTopLevelProject) {
    throw new Error('Invalid Creative-Neuro project schema');
  }

  return buildUnifiedProjectPayload(candidate as Partial<UnifiedExportPayload>);
}

/**
 * Applies an imported project payload directly into `useProjectStore`.
 */
export function applyImportedProjectToStore(payload: UnifiedExportPayload): void {
  if (activeStoreAccessor) {
    const state = activeStoreAccessor.getState();
    if (typeof state.setProject === 'function') {
      state.setProject(
        payload.project,
        payload.pages,
        payload.nodes,
        payload.edges,
        payload.boards
      );
    }
  }
}

// ============================================================================
// 3. Mermaid DSL Export
// ============================================================================

/**
 * Exports a page (or the active store page) into valid Mermaid Flowchart syntax.
 */
export function exportPageAsMermaid(
  direction: FlowDirection = 'TB',
  pageId?: string,
  source?: Partial<ProjectState>
): string {
  const state = source ?? getStoreStateFallback();
  const targetPageId = pageId || state.activePageId || 'page-1';
  const page = state.pages?.[targetPageId];

  if (!page) {
    return `flowchart ${direction}`;
  }

  const pageNodes: NeuroNode[] =
    page.nodes && Object.keys(page.nodes).length > 0
      ? Object.values(page.nodes)
      : (page.nodeIds || [])
          .map((id) => state.nodes?.[id])
          .filter((n): n is NeuroNode => Boolean(n));

  const pageEdges: NeuroEdge[] =
    page.edges && Object.keys(page.edges).length > 0
      ? Object.values(page.edges)
      : (page.edgeIds || [])
          .map((id) => state.edges?.[id])
          .filter((e): e is NeuroEdge => Boolean(e));

  return serializeMermaid(pageNodes, pageEdges, direction);
}

export const exportMermaid = exportPageAsMermaid;

// ============================================================================
// 4. Standalone Vector SVG Export (with Embedded Pako Metadata)
// ============================================================================

/**
 * Generates a standalone vector SVG document for a given page or the current active page,
 * including SVG line jumps and embedded compressed project metadata (`data-neuro-payload`).
 */
export function exportCanvasAsSvg(
  pageOrSource?: Page | Partial<ProjectState>,
  includeMetadata: boolean = true
): string {
  const state = getStoreStateFallback();

  let nodes: NeuroNode[] = [];
  let edges: NeuroEdge[] = [];
  let nodeMapRecord: Record<string, NeuroNode> = {};

  if (pageOrSource && 'id' in pageOrSource && ('nodeIds' in pageOrSource || 'nodes' in pageOrSource)) {
    const page = pageOrSource as Page;
    if (page.nodes && Object.keys(page.nodes).length > 0) {
      nodeMapRecord = page.nodes;
      nodes = Object.values(page.nodes);
    } else if (Array.isArray(page.nodeIds)) {
      for (const nid of page.nodeIds) {
        const n = state.nodes?.[nid];
        if (n) {
          nodeMapRecord[nid] = n;
          nodes.push(n);
        }
      }
    }

    if (page.edges && Object.keys(page.edges).length > 0) {
      edges = Object.values(page.edges);
    } else if (Array.isArray(page.edgeIds)) {
      edges = page.edgeIds
        .map((eid) => state.edges?.[eid])
        .filter((e): e is NeuroEdge => Boolean(e));
    }
  } else {
    const activePage = state.pages?.[state.activePageId || ''];
    if (activePage) {
      for (const nid of activePage.nodeIds || []) {
        const n = state.nodes?.[nid];
        if (n) {
          nodeMapRecord[nid] = n;
          nodes.push(n);
        }
      }
      edges = (activePage.edgeIds || [])
        .map((eid) => state.edges?.[eid])
        .filter((e): e is NeuroEdge => Boolean(e));
    }
  }

  // Compute bounding box for viewBox
  let minX = 0;
  let minY = 0;
  let maxX = 2000;
  let maxY = 2000;

  if (nodes.length > 0) {
    minX = Math.min(0, ...nodes.map((n) => n.position.x - 60));
    minY = Math.min(0, ...nodes.map((n) => n.position.y - 60));
    maxX = Math.max(
      1200,
      ...nodes.map((n) => n.position.x + (n.width ?? 160) + 100)
    );
    maxY = Math.max(
      800,
      ...nodes.map((n) => n.position.y + (n.height ?? 60) + 100)
    );
  }

  const viewWidth = Math.max(800, Math.round(maxX - minX));
  const viewHeight = Math.max(600, Math.round(maxY - minY));

  // Compute line jumps for edges
  const jumpMap = calculateLineJumps(edges, nodeMapRecord);

  // Render edges
  const edgeSvgs = edges.map((e) => {
    const src = nodeMapRecord[e.source];
    const tgt = nodeMapRecord[e.target];
    if (!src || !tgt) return '';

    const x1 = src.position.x + (src.width ?? 160) / 2;
    const y1 = src.position.y + (src.height ?? 60) / 2;
    const x2 = tgt.position.x + (tgt.width ?? 160) / 2;
    const y2 = tgt.position.y + (tgt.height ?? 60) / 2;
    const stroke = e.data?.color || e.style?.stroke || '#64748b';
    const strokeWidth = e.data?.strokeWidth || e.style?.strokeWidth || 2;

    const arcs = jumpMap.get(e.id);
    let pathEl: string;
    if (arcs && arcs.length > 0) {
      const dParts = [`M ${x1.toFixed(2)} ${y1.toFixed(2)}`];
      for (const arc of arcs) {
        dParts.push(arc.svgArcCommand);
      }
      dParts.push(`L ${x2.toFixed(2)} ${y2.toFixed(2)}`);
      pathEl = `<path d="${dParts.join(' ')}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" marker-end="url(#neuro-arrow)"/>`;
    } else {
      pathEl = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" marker-end="url(#neuro-arrow)"/>`;
    }

    const edgeLabel = e.data?.label || e.label;
    if (edgeLabel) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      return `${pathEl}<text x="${mx}" y="${my - 6}" fill="#475569" font-family="Inter, system-ui, sans-serif" font-size="11" text-anchor="middle">${escapeXml(edgeLabel)}</text>`;
    }
    return pathEl;
  });

  // Render nodes
  const nodeSvgs = nodes.map((n) => {
    const x = n.position.x;
    const y = n.position.y;
    const w = n.width ?? 160;
    const h = n.height ?? 60;
    const fill =
      n.data.backgroundColor || n.data.style?.backgroundColor || '#2563eb';
    const stroke =
      n.data.borderColor || n.data.style?.borderColor || '#1e40af';
    const textColor = n.data.color || n.data.style?.color || '#ffffff';
    const rawLabel = n.data.label || n.data.title || n.id;
    const safeLabel = escapeXml(rawLabel);

    if (n.type === 'freehand' && Array.isArray(n.data.points) && n.data.points.length > 1) {
      const pts = n.data.points
        .map((pt) => `${(x + pt[0]).toFixed(1)},${(y + pt[1]).toFixed(1)}`)
        .join(' ');
      const freehandColor = n.data.strokeColor || n.data.color || '#ef4444';
      return `<polyline points="${pts}" fill="none" stroke="${freehandColor}" stroke-width="${n.data.strokeWidth || 3}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }

    const rx =
      n.data.shapeType === 'pill' || n.data.shapeType === 'stadium'
        ? Math.round(h / 2)
        : n.data.shapeType === 'circle'
          ? Math.round(Math.min(w, h) / 2)
          : 8;

    return `<g data-node-id="${escapeXml(n.id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${n.data.borderWidth ?? 1.5}" rx="${rx}"/><text x="${x + w / 2}" y="${y + h / 2}" fill="${textColor}" font-family="Inter, system-ui, sans-serif" font-size="${n.data.fontSize ?? 13}" text-anchor="middle" dominant-baseline="middle">${safeLabel}</text></g>`;
  });

  const defs = `<defs><marker id="neuro-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b"/></marker></defs>`;

  const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${viewWidth} ${viewHeight}" width="100%" height="100%">${defs}<g id="edges">${edgeSvgs.join('')}</g><g id="nodes">${nodeSvgs.join('')}</g></svg>`;

  if (!includeMetadata) {
    return baseSvg;
  }

  const jsonPayload = exportProjectAsJson();
  const compressedBase64 = compressPayload(jsonPayload);
  return embedPayloadInSvg(baseSvg, compressedBase64);
}

export const exportSvg = exportCanvasAsSvg;

// ============================================================================
// 5. PNG Export with Embedded Pako Zlib Metadata
// ============================================================================

/**
 * Synchronously generates a PNG with embedded pako compressed metadata.
 * Ideal for fast programmatic export or headless E2E environments.
 */
export function exportPngWithPako(
  source?: Partial<ProjectState> | Partial<SerializedProjectPayload> | Partial<ProjectRecord>,
  basePngDataUrl?: string
): PngExportResult {
  const jsonStr = exportProjectAsJson(source);
  const compressedPayload = deflateToBytes(jsonStr);
  const base64Payload = compressPayload(jsonStr);

  const rawPngUrl =
    basePngDataUrl || `data:image/png;base64,${FALLBACK_1X1_PNG_BASE64}`;

  const embeddedDataUrl = embedPayloadInPngDataUrl(rawPngUrl, base64Payload);

  return {
    dataUrl: embeddedDataUrl,
    compressedPayload,
    base64Payload,
  };
}

/**
 * Renders the live React Flow canvas DOM element (if provided) to a high-DPI PNG
 * and embeds the compressed project JSON into a PNG `tEXt` metadata chunk.
 */
export async function exportCanvasAsPngWithMetadata(
  canvasElement?: HTMLElement | null,
  source?: Partial<ProjectState> | Partial<SerializedProjectPayload> | Partial<ProjectRecord>
): Promise<PngExportResult> {
  let capturedDataUrl: string | undefined;

  if (canvasElement && typeof window !== 'undefined') {
    try {
      const htmlToImageSpecifier = 'html-to-image';
      const mod = (await import(/* @vite-ignore */ htmlToImageSpecifier)) as {
        toPng: (el: HTMLElement, opts?: Record<string, unknown>) => Promise<string>;
      };
      capturedDataUrl = await mod.toPng(canvasElement, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0f172a',
      });
    } catch {
      capturedDataUrl = undefined;
    }
  }

  return exportPngWithPako(source, capturedDataUrl);
}

/**
 * Restores a normalized project payload from PNG metadata bytes or base64 string.
 */
export function restoreProjectFromPngMetadata(
  compressedOrPng: Uint8Array | string
): UnifiedExportPayload {
  if (compressedOrPng instanceof Uint8Array) {
    if (isValidPng(compressedOrPng)) {
      const extractedBase64 = extractPngTextChunk(compressedOrPng);
      if (!extractedBase64) {
        throw new Error('No Creative-Neuro metadata chunk found in PNG file');
      }
      const jsonStr = decompressPayload(extractedBase64);
      return importProjectFromJson(jsonStr);
    }
    const jsonStr = decompressPayload(compressedOrPng);
    return importProjectFromJson(jsonStr);
  }

  if (compressedOrPng.startsWith('data:image/png')) {
    const extracted = extractPayloadFromPngDataUrl(compressedOrPng);
    if (!extracted) {
      throw new Error('No Creative-Neuro metadata found in PNG Data URL');
    }
    const jsonStr = decompressPayload(extracted);
    return importProjectFromJson(jsonStr);
  }

  const jsonStr = decompressPayload(compressedOrPng);
  return importProjectFromJson(jsonStr);
}

// ============================================================================
// 6. Universal Importer (.neuro.json, .neuro.svg, .neuro.png)
// ============================================================================

/**
 * Universal import parser accepting a File, Blob, Uint8Array, or string
 * from `.neuro.json`, `.neuro.svg`, or `.neuro.png`.
 */
export async function importFromPngOrSvgMetadata(
  input: File | Blob | Uint8Array | string
): Promise<UnifiedExportPayload> {
  if (input instanceof Uint8Array) {
    return restoreProjectFromPngMetadata(input);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{')) {
      return importProjectFromJson(trimmed);
    }
    if (trimmed.startsWith('<svg') || trimmed.includes('<svg')) {
      const svgPayload = extractPayloadFromSvg(trimmed);
      if (!svgPayload) {
        throw new Error('SVG file does not contain embedded Creative-Neuro metadata');
      }
      const jsonStr = decompressPayload(svgPayload);
      return importProjectFromJson(jsonStr);
    }
    if (trimmed.startsWith('data:image/png')) {
      return restoreProjectFromPngMetadata(trimmed);
    }
    // Otherwise assume base64 compressed payload
    const jsonStr = decompressPayload(trimmed);
    return importProjectFromJson(jsonStr);
  }

  // Handle File / Blob
  const fileName = 'name' in input ? input.name.toLowerCase() : '';
  const mimeType = input.type.toLowerCase();

  if (
    fileName.endsWith('.png') ||
    mimeType === 'image/png'
  ) {
    const arrayBuffer = await input.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return restoreProjectFromPngMetadata(bytes);
  }

  const textContent = await input.text();
  if (
    fileName.endsWith('.svg') ||
    mimeType === 'image/svg+xml' ||
    textContent.trim().startsWith('<svg') ||
    textContent.includes('<svg')
  ) {
    const svgPayload = extractPayloadFromSvg(textContent);
    if (!svgPayload) {
      throw new Error('SVG file does not contain embedded Creative-Neuro metadata');
    }
    const jsonStr = decompressPayload(svgPayload);
    return importProjectFromJson(jsonStr);
  }

  return importProjectFromJson(textContent);
}

// ============================================================================
// 7. Browser File Download Helpers
// ============================================================================

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string = 'application/json;charset=utf-8'
): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
