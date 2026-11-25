import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/store/projectStore.ts';
import {
  CreativeNeuroDB,
  saveProjectToDb,
  initializeDatabase,
} from '../src/db/index.ts';
import {
  exportProjectAsJson,
  importProjectFromJson,
  applyImportedProjectToStore,
  registerExportStore,
} from '../src/utils/exportUtils.ts';

describe('Issue #42: Page Hide/Reopen/Delete Lifecycle & Persistence', () => {
  beforeEach(() => {
    useProjectStore.getState().resetToSeed();
    useProjectStore.temporal.getState().clear();
    registerExportStore(useProjectStore);
  });

  it('hides a Page tab without deleting its data or polluting Undo/Redo history, and switches activePageId if needed', () => {
    const store = useProjectStore.getState();
    const initialPageIds = [...store.project.pageIds];
    expect(initialPageIds.length).toBeGreaterThanOrEqual(2);

    const targetPageId = store.addPage('Scratchpad');
    const nodeId = store.addNode({
      type: 'shape',
      position: { x: 50, y: 80 },
      data: { label: 'Keep Me Safe', layoutMode: 'manual' },
    });
    const historyCountBeforeHide = useProjectStore.temporal.getState().pastStates.length;
    expect(useProjectStore.getState().activePageId).toBe(targetPageId);

    // Hide the active page
    (useProjectStore.getState() as unknown as { hidePage: (id: string) => void }).hidePage(
      targetPageId
    );

    const afterHide = useProjectStore.getState();
    expect(afterHide.pages[targetPageId]).toBeDefined();
    expect(afterHide.pages[targetPageId].hidden).toBe(true);
    expect(afterHide.pages[targetPageId].nodeIds).toContain(nodeId);
    expect(afterHide.nodes[nodeId]?.data.label).toBe('Keep Me Safe');
    expect(afterHide.project.pageIds).toContain(targetPageId);
    // Active page must switch to a visible page
    expect(afterHide.activePageId).not.toBe(targetPageId);
    expect(afterHide.pages[afterHide.activePageId]?.hidden).not.toBe(true);
    // Undo/Redo history must NOT be polluted by hidePage
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(historyCountBeforeHide);
  });

  it('prevents hiding the last remaining visible Page tab', () => {
    const store = useProjectStore.getState();
    const pageIds = [...store.project.pageIds];
    const hidePage = (useProjectStore.getState() as unknown as { hidePage: (id: string) => void })
      .hidePage;

    // Hide all but the last visible page
    for (let i = 0; i < pageIds.length - 1; i++) {
      hidePage(pageIds[i]);
    }

    const lastVisibleId = pageIds[pageIds.length - 1];
    expect(useProjectStore.getState().pages[lastVisibleId]?.hidden).not.toBe(true);

    // Attempt to hide the last visible page -> must be ignored
    hidePage(lastVisibleId);
    expect(useProjectStore.getState().pages[lastVisibleId]?.hidden).not.toBe(true);
    expect(useProjectStore.getState().activePageId).toBe(lastVisibleId);
  });

  it('reopens a hidden Page without polluting Undo/Redo history and activates it', () => {
    const store = useProjectStore.getState();
    const pageId = store.addPage('Hidden Flow');
    const nodeId = store.addNode({
      type: 'shape',
      position: { x: 100, y: 100 },
      data: { label: 'Restored Node', layoutMode: 'manual' },
    });

    const stateApi = useProjectStore.getState() as unknown as {
      hidePage: (id: string) => void;
      reopenPage: (id: string) => void;
    };
    stateApi.hidePage(pageId);
    expect(useProjectStore.getState().pages[pageId].hidden).toBe(true);

    const historyBeforeReopen = useProjectStore.temporal.getState().pastStates.length;
    stateApi.reopenPage(pageId);

    const afterReopen = useProjectStore.getState();
    expect(afterReopen.pages[pageId].hidden).toBe(false);
    expect(afterReopen.activePageId).toBe(pageId);
    expect(afterReopen.nodes[nodeId]?.data.label).toBe('Restored Node');
    expect(useProjectStore.temporal.getState().pastStates.length).toBe(historyBeforeReopen);
  });

  it('preserves last-remaining-page guard on deletePage and unhides remaining page if active visible page is deleted', () => {
    const store = useProjectStore.getState();
    store.createProject('Delete Guard Test');
    const firstPageId = useProjectStore.getState().project.pageIds[0];
    const secondPageId = store.addPage('Second Page');

    const stateApi = useProjectStore.getState() as unknown as {
      hidePage: (id: string) => void;
      deletePage: (id: string) => void;
    };

    // Hide firstPageId, leaving secondPageId as only visible page
    stateApi.hidePage(firstPageId);
    expect(useProjectStore.getState().pages[firstPageId].hidden).toBe(true);

    // Delete secondPageId (2 pages total, so deletion succeeds; firstPageId is now the only page and must become visible & active)
    stateApi.deletePage(secondPageId);
    const afterDelete = useProjectStore.getState();
    expect(afterDelete.pages[secondPageId]).toBeUndefined();
    expect(afterDelete.project.pageIds).toEqual([firstPageId]);
    expect(afterDelete.activePageId).toBe(firstPageId);
    expect(afterDelete.pages[firstPageId].hidden).not.toBe(true);

    // Cannot delete the last remaining page
    stateApi.deletePage(firstPageId);
    expect(useProjectStore.getState().pages[firstPageId]).toBeDefined();
    expect(useProjectStore.getState().project.pageIds).toEqual([firstPageId]);
  });

  it('persists Page.hidden state and .neuro.json imported projects across DB save/load', async () => {
    const testDb = new CreativeNeuroDB();
    await testDb.projects.clear();
    await testDb.settings.clear();

    const store = useProjectStore.getState();
    store.createProject('Persisted Project');
    const p1 = useProjectStore.getState().project.pageIds[0];
    const p2 = store.addPage('Archived Tab');
    store.addNode({
      type: 'shape',
      position: { x: 10, y: 20 },
      data: { label: 'Node On Archived Tab', layoutMode: 'manual' },
    });

    (useProjectStore.getState() as unknown as { hidePage: (id: string) => void }).hidePage(p2);

    // Round-trip through .neuro.json first
    const exportedJson = exportProjectAsJson();
    const importedPayload = importProjectFromJson(exportedJson);
    applyImportedProjectToStore(importedPayload);

    // Save to DB and reload into store
    await saveProjectToDb(useProjectStore.getState(), testDb);
    useProjectStore.getState().resetToSeed();
    expect(useProjectStore.getState().project.name).not.toBe('Persisted Project');

    await initializeDatabase(useProjectStore, testDb);
    const reloaded = useProjectStore.getState();
    expect(reloaded.project.name).toBe('Persisted Project');
    expect(reloaded.pages[p1]?.hidden).not.toBe(true);
    expect(reloaded.pages[p2]?.hidden).toBe(true);
    expect(reloaded.activePageId).toBe(p1);
  });
});
