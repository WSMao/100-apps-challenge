/**
 * Ticket #44: Image object with IndexedDB Asset store, universal resize, and double-click last-created type
 * Vertical TDD tests following rules.md Section 9.1 & .agents/skills/tdd/SKILL.md
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreativeNeuroDB,
  saveAsset,
  getAsset,
  deleteAsset,
  assetToDataUrl,
  dataUrlToBlob,
} from '../src/db/index.ts';
import {
  exportProjectAsJsonWithAssets,
  importProjectFromJson,
  restoreAssetsFromPayload,
} from '../src/utils/exportUtils.ts';
import { useProjectStore } from '../src/store/projectStore.ts';
import { computeResizedBounds, type ResizeDirection } from '../src/components/canvas/nodes/ResizeHandles.tsx';
import { importImageFileAsNode, importImageUrlAsNode } from '../src/utils/imageImport.ts';

// 1x1 transparent PNG bytes
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SAMPLE_PNG_DATA_URL = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;

describe('Ticket #44 — Slice 1: IndexedDB Asset Store & .neuro.json Round-Trip', () => {
  let testDb: CreativeNeuroDB;

  beforeEach(() => {
    testDb = new CreativeNeuroDB();
    useProjectStore.getState().resetToSeed();
  });

  it('stores and retrieves binary Blob assets in the dedicated IndexedDB assets table', async () => {
    const { blob, mimeType } = dataUrlToBlob(SAMPLE_PNG_DATA_URL);
    expect(mimeType).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);

    const assetId = await saveAsset(
      {
        id: 'asset-test-1',
        projectId: 'proj-1',
        mimeType,
        blob,
        fileName: 'pixel.png',
        width: 1,
        height: 1,
        createdAt: 1700000000000,
      },
      testDb
    );

    expect(assetId).toBe('asset-test-1');
    const fetched = await getAsset('asset-test-1', testDb);
    expect(fetched).toBeDefined();
    expect(fetched?.fileName).toBe('pixel.png');
    expect(fetched?.mimeType).toBe('image/png');

    const roundTrippedUrl = await assetToDataUrl(fetched!);
    expect(roundTrippedUrl.startsWith('data:image/png;base64,')).toBe(true);

    await deleteAsset('asset-test-1', testDb);
    const afterDelete = await getAsset('asset-test-1', testDb);
    expect(afterDelete).toBeUndefined();
  });

  it('embeds IndexedDB assets as Base64 Data URLs on .neuro.json export and restores them into IndexedDB on import', async () => {
    const store = useProjectStore.getState();
    const { blob, mimeType } = dataUrlToBlob(SAMPLE_PNG_DATA_URL);

    await saveAsset(
      {
        id: 'asset-img-42',
        projectId: store.project.id,
        mimeType,
        blob,
        fileName: 'diagram-ref.png',
        width: 320,
        height: 240,
        createdAt: Date.now(),
      },
      testDb
    );

    const imageNodeId = store.addNode({
      type: 'image',
      position: { x: 100, y: 120 },
      width: 320,
      height: 240,
      layoutMode: 'manual',
      data: {
        label: 'diagram-ref.png',
        assetId: 'asset-img-42',
        fileName: 'diagram-ref.png',
        naturalWidth: 320,
        naturalHeight: 240,
        layoutMode: 'manual',
      },
    });

    const urlImageNodeId = store.addNode({
      type: 'image',
      position: { x: 500, y: 120 },
      width: 200,
      height: 150,
      layoutMode: 'manual',
      data: {
        label: 'External Logo',
        src: 'https://example.com/logo.png',
        layoutMode: 'manual',
      },
    });

    const jsonStr = await exportProjectAsJsonWithAssets(useProjectStore.getState(), testDb);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.assets).toBeDefined();
    expect(parsed.assets['asset-img-42']).toBeDefined();
    expect(parsed.assets['asset-img-42'].dataUrl).toBe(SAMPLE_PNG_DATA_URL);
    expect(parsed.nodes[imageNodeId].data.assetId).toBe('asset-img-42');
    expect(parsed.nodes[urlImageNodeId].data.src).toBe('https://example.com/logo.png');

    // Import into a fresh DB
    const freshDb = new CreativeNeuroDB();
    const importedPayload = importProjectFromJson(jsonStr);
    await restoreAssetsFromPayload(importedPayload, freshDb);

    const restoredAsset = await getAsset('asset-img-42', freshDb);
    expect(restoredAsset).toBeDefined();
    expect(restoredAsset?.mimeType).toBe('image/png');
    expect(restoredAsset?.fileName).toBe('diagram-ref.png');
    expect(await assetToDataUrl(restoredAsset!)).toBe(SAMPLE_PNG_DATA_URL);
  });
});

describe('Ticket #44 — Slice 2: SelectionFilter Image Category & Double-Click Last-Created Type', () => {
  beforeEach(() => {
    useProjectStore.getState().resetToSeed();
  });

  it('includes image in SelectionFilter and supports toggling, resetting, and clearing', () => {
    const store = useProjectStore.getState();
    expect(store.selectionFilter.image).toBe(true);

    store.toggleSelectionFilterItem('image');
    expect(useProjectStore.getState().selectionFilter.image).toBe(false);

    store.resetSelectionFilter();
    expect(useProjectStore.getState().selectionFilter.image).toBe(true);

    store.clearSelectionFilter();
    expect(useProjectStore.getState().selectionFilter.image).toBe(false);
  });

  it('tracks lastCreatedNodeType across addNode calls and uses it for blank-canvas double-click creation', () => {
    expect(useProjectStore.getState().lastCreatedNodeType).toBe('shape');

    useProjectStore.getState().addNode({
      type: 'text',
      position: { x: 50, y: 50 },
      width: 200,
      height: 60,
      layoutMode: 'manual',
      data: { label: 'Note', layoutMode: 'manual' },
    });
    expect(useProjectStore.getState().lastCreatedNodeType).toBe('text');

    useProjectStore.getState().addNode({
      type: 'image',
      position: { x: 150, y: 150 },
      width: 240,
      height: 180,
      layoutMode: 'manual',
      data: { label: 'Photo', src: 'https://example.com/a.png', layoutMode: 'manual' },
    });
    expect(useProjectStore.getState().lastCreatedNodeType).toBe('image');

    // Freehand stroke should NOT overwrite lastCreatedNodeType to 'freehand'
    useProjectStore.getState().addNode({
      type: 'freehand',
      position: { x: 0, y: 0 },
      layoutMode: 'manual',
      data: { label: 'stroke', points: [[0, 0, 0.5]], layoutMode: 'manual' },
    });
    expect(useProjectStore.getState().lastCreatedNodeType).toBe('image');

    const spawnedId = useProjectStore.getState().spawnNodeForLastCreatedType({ x: 400, y: 300 });
    const spawned = useProjectStore.getState().nodes[spawnedId];
    expect(spawned).toBeDefined();
    expect(spawned.type).toBe('image');
  });
});

describe('Ticket #44 — Slice 3: Universal 8-Direction Resize & Image Import + Connector Support', () => {
  let testDb: CreativeNeuroDB;

  beforeEach(() => {
    testDb = new CreativeNeuroDB();
    useProjectStore.getState().resetToSeed();
  });

  it('computes corner and edge resize bounds with min/max clamping and origin adjustment', () => {
    const start = { x: 100, y: 100, width: 200, height: 120 };
    const limits = { minWidth: 60, minHeight: 40, maxWidth: 1000, maxHeight: 1000 };

    // East edge
    expect(computeResizedBounds(start, 'e', 50, 30, limits)).toEqual({
      x: 100,
      y: 100,
      width: 250,
      height: 120,
    });

    // North-West corner (moves x/y when shrinking or growing)
    expect(computeResizedBounds(start, 'nw', -40, -20, limits)).toEqual({
      x: 60,
      y: 80,
      width: 240,
      height: 140,
    });

    // Clamping at minWidth when dragging West edge past minWidth
    expect(computeResizedBounds(start, 'w', 180, 0, limits)).toEqual({
      x: 240,
      y: 100,
      width: 60,
      height: 120,
    });

    // All 8 directions produce valid numeric bounds
    const dirs: ResizeDirection[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
    for (const dir of dirs) {
      const res = computeResizedBounds(start, dir, 10, 10, limits);
      expect(res.width).toBeGreaterThanOrEqual(60);
      expect(res.height).toBeGreaterThanOrEqual(40);
    }
  });

  it('imports image File and external URL into Image nodes backed by IndexedDB and connects them with Connectors', async () => {
    const { blob } = dataUrlToBlob(SAMPLE_PNG_DATA_URL);
    const file = new File([blob], 'architecture.png', { type: 'image/png' });

    const { nodeId: fileNodeId, assetId } = await importImageFileAsNode(
      file,
      { x: 120, y: 140 },
      useProjectStore.getState(),
      testDb
    );

    const fileNode = useProjectStore.getState().nodes[fileNodeId];
    expect(fileNode).toBeDefined();
    expect(fileNode.type).toBe('image');
    expect(fileNode.data.assetId).toBe(assetId);
    expect(fileNode.data.fileName).toBe('architecture.png');

    const storedAsset = await getAsset(assetId, testDb);
    expect(storedAsset).toBeDefined();
    expect(storedAsset?.fileName).toBe('architecture.png');

    const urlNodeId = importImageUrlAsNode(
      'https://example.com/diagram.webp',
      { x: 520, y: 140 },
      useProjectStore.getState()
    );
    const urlNode = useProjectStore.getState().nodes[urlNodeId];
    expect(urlNode).toBeDefined();
    expect(urlNode.type).toBe('image');
    expect(urlNode.data.src).toBe('https://example.com/diagram.webp');

    // Connect two Image nodes with a Connector edge
    const edgeId = useProjectStore.getState().addEdge({
      source: fileNodeId,
      target: urlNodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'jump',
    });
    const edge = useProjectStore.getState().edges[edgeId];
    expect(edge).toBeDefined();
    expect(edge.source).toBe(fileNodeId);
    expect(edge.target).toBe(urlNodeId);
  });
});
