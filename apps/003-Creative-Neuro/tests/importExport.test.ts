import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/store/projectStore.ts';
import * as exportUtils from '../src/utils/exportUtils.ts';

describe('Issue #42: .neuro.json Import/Export & Drop PNG/SVG Import', () => {
  beforeEach(() => {
    useProjectStore.getState().resetToSeed();
    useProjectStore.temporal.getState().clear();
    exportUtils.registerExportStore(useProjectStore);
  });

  it('round-trips a multi-page project through exportProjectAsJson -> importProjectFromJson -> applyImportedProjectToStore without data loss', () => {
    const store = useProjectStore.getState();
    const customPageId = store.addPage('Architecture');
    const nodeId = store.addNode({
      type: 'shape',
      position: { x: 120, y: 240 },
      data: { label: 'API Gateway', shapeType: 'rounded', layoutMode: 'manual' },
    });
    const node2Id = store.addNode({
      type: 'shape',
      position: { x: 360, y: 240 },
      data: { label: 'Auth Service', shapeType: 'cylinder', layoutMode: 'manual' },
    });
    const edgeId = store.addEdge({
      source: nodeId,
      target: node2Id,
      label: 'HTTPS',
    });

    // Export current store to .neuro.json
    const jsonString = exportUtils.exportProjectAsJson();
    expect(typeof jsonString).toBe('string');

    // Reset store to a blank/different state
    store.createProject('Empty Target');
    expect(Object.keys(useProjectStore.getState().pages)).toHaveLength(1);

    // Import back from JSON
    const parsed = exportUtils.importProjectFromJson(jsonString);
    exportUtils.applyImportedProjectToStore(parsed);

    const restored = useProjectStore.getState();
    expect(restored.pages[customPageId]).toBeDefined();
    expect(restored.pages[customPageId].title).toBe('Architecture');
    expect(restored.nodes[nodeId]?.data.label).toBe('API Gateway');
    expect(restored.nodes[node2Id]?.data.label).toBe('Auth Service');
    expect(restored.edges[edgeId]?.label).toBe('HTTPS');
    expect(restored.activePageId).toBe(customPageId);
    // Temporal history should be cleared after project import
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it('imports .neuro.json File via importProjectFromFile and rejects PNG/SVG files', async () => {
    const jsonString = exportUtils.exportProjectAsJson();
    const jsonFile = new File([jsonString], 'workspace.neuro.json', {
      type: 'application/json',
    });

    const importFileFn = (exportUtils as Record<string, unknown>).importProjectFromFile as
      | ((input: File | Blob | string) => Promise<exportUtils.UnifiedExportPayload>)
      | undefined;

    expect(typeof importFileFn).toBe('function');
    const restored = await importFileFn!(jsonFile);
    expect(restored.project.id).toBe(useProjectStore.getState().project.id);

    const pngFile = new File([new Uint8Array([137, 80, 78, 71])], 'diagram.neuro.png', {
      type: 'image/png',
    });
    await expect(importFileFn!(pngFile)).rejects.toThrow(/\.neuro\.json/i);

    const svgFile = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'diagram.neuro.svg', {
      type: 'image/svg+xml',
    });
    await expect(importFileFn!(svgFile)).rejects.toThrow(/\.neuro\.json/i);
  });

  it('removes PNG/SVG project-restoration import functions from exportUtils', () => {
    expect((exportUtils as Record<string, unknown>).importFromPngOrSvgMetadata).toBeUndefined();
    expect((exportUtils as Record<string, unknown>).restoreProjectFromPngMetadata).toBeUndefined();
  });
});
