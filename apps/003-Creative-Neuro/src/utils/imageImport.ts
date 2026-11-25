/**
 * Image Asset Import & Runtime Preview URL Resolution Utilities
 * Path: src/utils/imageImport.ts
 */
import type { Point } from '../types/index.ts';
import type { ProjectStore } from '../store/slices/types.ts';
import {
  db,
  CreativeNeuroDB,
  saveAsset,
  getAsset,
  assetToDataUrl,
} from '../db/index.ts';

const previewUrlCache = new Map<string, string>();

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.avif',
]);

export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  const lower = file.name.toLowerCase();
  for (const ext of IMAGE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export function isImageUrlCandidate(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/')
  );
}

export function cacheAssetPreviewUrl(assetId: string, url: string): void {
  previewUrlCache.set(assetId, url);
}

export async function resolveAssetPreviewUrl(
  assetId: string,
  database: CreativeNeuroDB = db
): Promise<string | null> {
  const cached = previewUrlCache.get(assetId);
  if (cached) return cached;

  const asset = await getAsset(assetId, database);
  if (!asset) return null;

  let url: string;
  if (asset.blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    url = URL.createObjectURL(asset.blob);
  } else {
    url = await assetToDataUrl(asset);
  }
  previewUrlCache.set(assetId, url);
  return url;
}

export async function measureImageBlobDimensions(
  blob: Blob
): Promise<{ width: number; height: number }> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return { width: 240, height: 180 };
  }
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return { width: 240, height: 180 };
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || 240,
          height: img.naturalHeight || 180,
        });
      };
      img.onerror = () => resolve({ width: 240, height: 180 });
      img.src = objectUrl;
    });
    return dims;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function fitWithinMaxDimension(
  naturalWidth: number,
  naturalHeight: number,
  maxDim: number = 360
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: 240, height: 180 };
  }
  const scale = Math.min(1, maxDim / Math.max(naturalWidth, naturalHeight));
  return {
    width: Math.max(60, Math.round(naturalWidth * scale)),
    height: Math.max(60, Math.round(naturalHeight * scale)),
  };
}

export async function importImageFileAsNode(
  file: File,
  position: Point,
  store: Pick<ProjectStore, 'project' | 'addNode' | 'setSelectedNodes'>,
  database: CreativeNeuroDB = db
): Promise<{ nodeId: string; assetId: string }> {
  const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { width: naturalWidth, height: naturalHeight } =
    await measureImageBlobDimensions(file);
  const { width, height } = fitWithinMaxDimension(naturalWidth, naturalHeight);

  await saveAsset(
    {
      id: assetId,
      projectId: store.project.id,
      mimeType: file.type || 'image/png',
      blob: file,
      fileName: file.name,
      width: naturalWidth,
      height: naturalHeight,
      createdAt: Date.now(),
    },
    database
  );

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    cacheAssetPreviewUrl(assetId, URL.createObjectURL(file));
  }

  const nodeId = store.addNode({
    type: 'image',
    position,
    width,
    height,
    layoutMode: 'manual',
    data: {
      label: file.name || 'Image',
      assetId,
      fileName: file.name,
      naturalWidth,
      naturalHeight,
      objectFit: 'contain',
      layoutMode: 'manual',
    },
  });

  store.setSelectedNodes([nodeId]);
  return { nodeId, assetId };
}

export function importImageUrlAsNode(
  url: string,
  position: Point,
  store: Pick<ProjectStore, 'addNode' | 'setSelectedNodes'>
): string {
  const trimmed = url.trim();
  const nodeId = store.addNode({
    type: 'image',
    position,
    width: 240,
    height: 180,
    layoutMode: 'manual',
    data: {
      label: 'Image',
      src: trimmed,
      objectFit: 'contain',
      layoutMode: 'manual',
    },
  });
  store.setSelectedNodes([nodeId]);
  return nodeId;
}
