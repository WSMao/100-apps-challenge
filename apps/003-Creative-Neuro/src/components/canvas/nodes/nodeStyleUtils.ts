import type { NeuroNodeData } from '../../../types/index.ts';

export interface ResolvedNodeStyle {
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  opacity: number;
}

export interface NodeStyleDefaults {
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
}

/**
 * Resolves typography and opacity styling from top-level node data or nested `data.style`
 * with consistent defaults across node renderers.
 */
export function resolveNodeStyle(
  data: Partial<NeuroNodeData> | undefined,
  defaults: NodeStyleDefaults
): ResolvedNodeStyle {
  const fontSize = data?.fontSize ?? data?.style?.fontSize ?? defaults.fontSize;
  const textAlign = data?.textAlign ?? data?.style?.textAlign ?? defaults.textAlign;
  const rawOpacity = data?.opacity ?? data?.style?.opacity ?? 1;
  const opacity = Math.min(1, Math.max(0, rawOpacity));
  return { fontSize, textAlign, opacity };
}
