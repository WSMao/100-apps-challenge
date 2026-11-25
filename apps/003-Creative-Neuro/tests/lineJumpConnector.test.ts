import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../src/store/useProjectStore.ts';

describe('Issue #41: Canvas-level Line Jump & Simplified Connector Types', () => {
  beforeEach(() => {
    useProjectStore.getState().resetToSeed();
  });

  it('toggles Page-level lineJump without mutating individual edge routingTypes', () => {
    const store = useProjectStore.getState();
    const pageId = store.activePageId;
    const initialJump = store.pages[pageId]?.lineJump ?? true;

    store.togglePageLineJump(pageId);
    expect(useProjectStore.getState().pages[pageId]?.lineJump).toBe(!initialJump);

    store.setPageLineJump(true, pageId);
    expect(useProjectStore.getState().pages[pageId]?.lineJump).toBe(true);

    store.setPageLineJump(false, pageId);
    expect(useProjectStore.getState().pages[pageId]?.lineJump).toBe(false);
  });

  it('defaults edge routing type to smoothstep and remembers selected connector type', () => {
    const store = useProjectStore.getState();
    expect(store.defaultEdgeRoutingType).toBe('smoothstep');

    store.setDefaultEdgeRoutingType('bezier');
    expect(useProjectStore.getState().defaultEdgeRoutingType).toBe('bezier');

    const n1 = store.addNode({ position: { x: 0, y: 0 }, data: { label: 'A', layoutMode: 'manual' } });
    const n2 = store.addNode({ position: { x: 200, y: 0 }, data: { label: 'B', layoutMode: 'manual' } });

    const edgeId = store.handleConnectorNodeClick(n1) || (store.handleConnectorNodeClick(n2) as string);
    expect(edgeId).toBeTruthy();
    const edge = useProjectStore.getState().edges[edgeId];
    expect(edge.type).toBe('bezier');
    expect(edge.data?.routingType).toBe('bezier');
  });

  it('batchUpdateEdgeData updates routingType, strokeWidth, color, lineStyle, and arrowheads', () => {
    const store = useProjectStore.getState();
    const n1 = store.addNode({ position: { x: 0, y: 0 }, data: { label: 'N1', layoutMode: 'manual' } });
    const n2 = store.addNode({ position: { x: 200, y: 0 }, data: { label: 'N2', layoutMode: 'manual' } });
    const n3 = store.addNode({ position: { x: 400, y: 0 }, data: { label: 'N3', layoutMode: 'manual' } });

    const e1 = store.addEdge({ source: n1, target: n2, type: 'straight' });
    const e2 = store.addEdge({ source: n2, target: n3, type: 'smoothstep' });

    store.batchUpdateEdgeData([e1, e2], {
      routingType: 'bezier',
      strokeWidth: 4,
      color: '#ef4444',
      lineStyle: 'dashed',
      arrowStart: true,
      arrowEnd: true,
    });

    const state = useProjectStore.getState();
    for (const eid of [e1, e2]) {
      const edge = state.edges[eid];
      expect(edge.type).toBe('bezier');
      expect(edge.data?.routingType).toBe('bezier');
      expect(edge.data?.strokeWidth).toBe(4);
      expect(edge.data?.color).toBe('#ef4444');
      expect(edge.data?.lineStyle).toBe('dashed');
      expect(edge.data?.arrowStart).toBe(true);
      expect(edge.data?.arrowEnd).toBe(true);
    }
  });

  it('reconnectEdge updates both source and target endpoints', () => {
    const store = useProjectStore.getState();
    const n1 = store.addNode({ position: { x: 0, y: 0 }, data: { label: 'N1', layoutMode: 'manual' } });
    const n2 = store.addNode({ position: { x: 200, y: 0 }, data: { label: 'N2', layoutMode: 'manual' } });
    const n3 = store.addNode({ position: { x: 200, y: 200 }, data: { label: 'N3', layoutMode: 'manual' } });

    const e1 = store.addEdge({
      source: n1,
      target: n2,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'straight',
    });

    // Reconnect target to n3
    store.reconnectEdge(e1, {
      source: n1,
      sourceHandle: 'bottom',
      target: n3,
      targetHandle: 'top',
    });

    const updated = useProjectStore.getState().edges[e1];
    expect(updated.source).toBe(n1);
    expect(updated.sourceHandle).toBe('bottom');
    expect(updated.target).toBe(n3);
    expect(updated.targetHandle).toBe('top');
  });
});
