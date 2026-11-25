import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/store/useProjectStore.ts';
import { handleGlobalKeyDown } from '../src/components/workspace/ShortcutsHandler.tsx';
import { DiagramPipeline, createMindMapDiagramPayload } from '../src/engine/index.ts';

describe('Issue #46: MindMap Mode Integration & Page Tab/Enter Coexistence', () => {
  beforeEach(() => {
    useProjectStore.getState().resetToSeed();
  });

  it('switches to mindmap tool via M shortcut and preserves regular Page Tab/Enter quick-spawn', () => {
    const store = useProjectStore.getState();

    // Press M -> toolMode becomes 'mindmap'
    const handledM = handleGlobalKeyDown({ key: 'm' });
    expect(handledM).toBe(true);
    expect(useProjectStore.getState().toolMode).toBe('mindmap');

    // Regular Page node Tab & Enter quick-spawn still works
    const rootId = store.addNode({
      type: 'shape',
      position: { x: 100, y: 100 },
      data: { label: 'Regular Page Node' },
    });
    store.setSelectedNodes([rootId]);

    const handledTab = handleGlobalKeyDown({ key: 'Tab', preventDefault: () => {} });
    expect(handledTab).toBe(true);
    const afterTabId = useProjectStore.getState().selectedNodeIds[0];
    expect(afterTabId).not.toBe(rootId);
    expect(useProjectStore.getState().nodes[afterTabId]?.data.label).toBe('Child Node');

    const handledEnter = handleGlobalKeyDown({ key: 'Enter', preventDefault: () => {} });
    expect(handledEnter).toBe(true);
    const afterEnterId = useProjectStore.getState().selectedNodeIds[0];
    expect(afterEnterId).not.toBe(afterTabId);
    expect(useProjectStore.getState().nodes[afterEnterId]?.data.label).toBe('Sibling Node');
  });

  it('creates a MindMap Mode Diagram node payload and compiles via DiagramPipeline', () => {
    const payload = createMindMapDiagramPayload({ x: 300, y: 200 }, false);
    expect(payload.type).toBe('diagram');
    expect(payload.data.diagramKind).toBe('mindmap');
    expect(payload.data.mindMapDirection).toBe('radial');
    expect(payload.data.continuousLayout).toBe(true);
    expect(Array.isArray(payload.data.customData?.subNodes)).toBe(true);

    const compiled = DiagramPipeline.compile({
      mermaidCode: payload.data.mermaidCode!,
      savedSubNodes: payload.data.customData?.subNodes as any,
      savedSubEdges: payload.data.customData?.subEdges as any,
      diagramKind: 'mindmap',
      mindMapDirection: 'radial',
      continuousLayout: true,
    });
    expect(compiled.syntaxError).toBeNull();
    expect(compiled.nodes.length).toBeGreaterThanOrEqual(1);
    expect(compiled.preview.nodes.length).toBeGreaterThanOrEqual(1);
  });
});
