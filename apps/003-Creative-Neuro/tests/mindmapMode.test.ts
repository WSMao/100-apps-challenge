import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/store/useProjectStore.ts';
import { handleGlobalKeyDown } from '../src/components/workspace/ShortcutsHandler.tsx';
import { DiagramPipeline, createMindMapDiagramPayload } from '../src/engine/index.ts';
import { connectDiagramEdge } from '../src/components/editor/FocusDiagramModal.tsx';
import { runDiagramNodeAutoLayout } from '../src/components/canvas/nodes/DiagramNode.tsx';

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

  it('connectDiagramEdge preserves mindmap syntax when isMindMapMode is true and applies MindMap layout when continuousLayout is enabled', () => {
    const rootNode = {
      id: 'root',
      type: 'shape',
      position: { x: 0, y: 0 },
      width: 140,
      height: 56,
      data: { label: 'Central Topic' },
    } as any;
    const floatingNode = {
      id: 'child1',
      type: 'shape',
      position: { x: 0, y: 0 },
      width: 140,
      height: 56,
      data: { label: 'Branch A' },
    } as any;

    const nonContinuousResult = connectDiagramEdge({
      nodes: [rootNode, floatingNode],
      edges: [],
      connection: { source: 'root', target: 'child1', sourceHandle: null, targetHandle: null },
      isMindMapMode: true,
      continuousLayout: false,
      direction: 'TB',
      mindMapDirection: 'right',
      spacingPreset: 'normal',
      edgeRouting: 'bezier',
      lineJump: false,
    });

    expect(nonContinuousResult.edges).toHaveLength(1);
    expect(nonContinuousResult.code.trimStart().startsWith('mindmap')).toBe(true);
    expect(nonContinuousResult.code).not.toContain('flowchart');
    expect(nonContinuousResult.code).toContain('Central Topic');
    expect(nonContinuousResult.code).toContain('Branch A');

    const continuousResult = connectDiagramEdge({
      nodes: [rootNode, floatingNode],
      edges: [],
      connection: { source: 'root', target: 'child1', sourceHandle: null, targetHandle: null },
      isMindMapMode: true,
      continuousLayout: true,
      direction: 'TB',
      mindMapDirection: 'right',
      spacingPreset: 'normal',
      edgeRouting: 'bezier',
      lineJump: false,
    });

    expect(continuousResult.code.trimStart().startsWith('mindmap')).toBe(true);
    expect(continuousResult.code).not.toContain('flowchart');
    // Continuous layout repositions child1 away from (0, 0)
    const movedChild = continuousResult.nodes.find((n) => n.id === 'child1');
    expect(movedChild?.position.x).not.toBe(0);

    const flowchartResult = connectDiagramEdge({
      nodes: [rootNode, floatingNode],
      edges: [],
      connection: { source: 'root', target: 'child1', sourceHandle: null, targetHandle: null },
      isMindMapMode: false,
      continuousLayout: false,
      direction: 'TB',
      mindMapDirection: 'right',
      spacingPreset: 'normal',
      edgeRouting: 'smoothstep',
      lineJump: false,
    });

    expect(flowchartResult.code.trimStart().startsWith('flowchart')).toBe(true);
  });

  it('runDiagramNodeAutoLayout computes updated subNodes/subEdges for both flowchart and mindmap DiagramNode State A', () => {
    const flowchartPatch = runDiagramNodeAutoLayout({
      label: 'Flow',
      mermaidCode: 'flowchart TD\n  A[Start] --> B[End]',
      diagramOrientation: 'LR',
    });
    expect(Array.isArray(flowchartPatch.customData?.subNodes)).toBe(true);
    expect((flowchartPatch.customData?.subNodes as any[]).length).toBe(2);

    const mindmapPatch = runDiagramNodeAutoLayout({
      label: 'MindMap',
      diagramKind: 'mindmap',
      mindMapDirection: 'right',
      mermaidCode: 'mindmap\n  root((Center))\n    Branch1',
    });
    expect(Array.isArray(mindmapPatch.customData?.subNodes)).toBe(true);
    expect((mindmapPatch.customData?.subNodes as any[]).length).toBe(2);
    expect(mindmapPatch.mermaidCode?.trimStart().startsWith('mindmap')).toBe(true);
  });
});
