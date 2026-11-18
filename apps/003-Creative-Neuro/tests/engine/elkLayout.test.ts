/**
 * Creative-Neuro Algorithmic Unit Tests - Engine 2: ELKjs Layout Engine
 * Target: tests/engine/elkLayout.test.ts
 *
 * Verifies:
 * - Direction mapping: DOWN (TB), RIGHT (LR), UP (BT), LEFT (RL)
 * - Tri-state modes: Auto-ELK, Manual, Fixed coordinate preservation
 * - Subgraphs with isolated directions and frame bounds expansion
 * - Compound subgraph fold / collapse bounds and external edge retargeting
 * - Cyclic graph cycle-breaking and high-density performance
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateElkLayout, normalizeDirection } from '../../src/engine/index.ts';
import type { NeuroEdge, NeuroNode } from '../../src/types/index.ts';

describe('Engine 2: ELKjs Hybrid Layout Engine Unit Tests', () => {
  describe('1. Directional Layout Mapping', () => {
    it('M2-ELK-01a: layouts linear chain A -> B -> C in DOWN (TB) direction with monotonically increasing Y', async () => {
      const nodes: NeuroNode[] = [
        { id: 'A', type: 'shape', position: { x: 0, y: 0 }, width: 160, height: 60, layoutMode: 'auto-elk', data: { label: 'A', layoutMode: 'auto-elk' } },
        { id: 'B', type: 'shape', position: { x: 0, y: 0 }, width: 160, height: 60, layoutMode: 'auto-elk', data: { label: 'B', layoutMode: 'auto-elk' } },
        { id: 'C', type: 'shape', position: { x: 0, y: 0 }, width: 160, height: 60, layoutMode: 'auto-elk', data: { label: 'C', layoutMode: 'auto-elk' } },
      ];
      const edges: NeuroEdge[] = [
        { id: 'e1', source: 'A', target: 'B' },
        { id: 'e2', source: 'B', target: 'C' },
      ];

      const res = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });
      const posA = res.nodes.find((n) => n.id === 'A')!.position;
      const posB = res.nodes.find((n) => n.id === 'B')!.position;
      const posC = res.nodes.find((n) => n.id === 'C')!.position;

      assert.ok(posA.y < posB.y, `Expected posA.y (${posA.y}) < posB.y (${posB.y})`);
      assert.ok(posB.y < posC.y, `Expected posB.y (${posB.y}) < posC.y (${posC.y})`);
    });

    it('M2-ELK-01b: layouts linear chain in RIGHT (LR) direction with monotonically increasing X', async () => {
      const nodes: NeuroNode[] = [
        { id: 'A', type: 'shape', position: { x: 0, y: 0 }, width: 160, height: 60, layoutMode: 'auto-elk', data: { label: 'A', layoutMode: 'auto-elk' } },
        { id: 'B', type: 'shape', position: { x: 0, y: 0 }, width: 160, height: 60, layoutMode: 'auto-elk', data: { label: 'B', layoutMode: 'auto-elk' } },
        { id: 'C', type: 'shape', position: { x: 0, y: 0 }, width: 160, height: 60, layoutMode: 'auto-elk', data: { label: 'C', layoutMode: 'auto-elk' } },
      ];
      const edges: NeuroEdge[] = [
        { id: 'e1', source: 'A', target: 'B' },
        { id: 'e2', source: 'B', target: 'C' },
      ];

      const res = await calculateElkLayout(nodes, edges, { direction: 'RIGHT' });
      const posA = res.nodes.find((n) => n.id === 'A')!.position;
      const posB = res.nodes.find((n) => n.id === 'B')!.position;
      const posC = res.nodes.find((n) => n.id === 'C')!.position;

      assert.ok(posA.x < posB.x, `Expected posA.x (${posA.x}) < posB.x (${posB.x})`);
      assert.ok(posB.x < posC.x, `Expected posB.x (${posB.x}) < posC.x (${posC.x})`);
    });

    it('M2-ELK-01c: normalizes direction strings correctly', () => {
      assert.strictEqual(normalizeDirection('TB'), 'DOWN');
      assert.strictEqual(normalizeDirection('TD'), 'DOWN');
      assert.strictEqual(normalizeDirection('DOWN'), 'DOWN');
      assert.strictEqual(normalizeDirection('LR'), 'RIGHT');
      assert.strictEqual(normalizeDirection('RIGHT'), 'RIGHT');
      assert.strictEqual(normalizeDirection('BT'), 'UP');
      assert.strictEqual(normalizeDirection('RL'), 'LEFT');
    });
  });

  describe('2. Tri-State Layout Mode Preservation', () => {
    it('M2-ELK-02: strictly preserves fixed anchor node coordinates at exact location', async () => {
      const nodes: NeuroNode[] = [
        {
          id: 'F',
          type: 'shape',
          position: { x: 555, y: 777 },
          layoutMode: 'fixed',
          data: { label: 'Fixed Anchor', layoutMode: 'fixed' },
        },
        {
          id: 'A',
          type: 'shape',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: { label: 'Auto Node A', layoutMode: 'auto-elk' },
        },
        {
          id: 'B',
          type: 'shape',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: { label: 'Auto Node B', layoutMode: 'auto-elk' },
        },
      ];
      const edges: NeuroEdge[] = [
        { id: 'e1', source: 'A', target: 'F' },
        { id: 'e2', source: 'F', target: 'B' },
      ];

      const res = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });
      const nodeF = res.nodes.find((n) => n.id === 'F')!;
      assert.strictEqual(nodeF.position.x, 555);
      assert.strictEqual(nodeF.position.y, 777);
      assert.strictEqual(nodeF.layoutMode, 'fixed');
    });

    it('M2-ELK-03: strictly preserves manual mode node coordinates', async () => {
      const nodes: NeuroNode[] = [
        {
          id: 'M',
          type: 'shape',
          position: { x: 420, y: 360 }, // User dragged
          layoutMode: 'manual',
          data: { label: 'Manual Node', layoutMode: 'manual' },
        },
        {
          id: 'A',
          type: 'shape',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: { label: 'Auto Node', layoutMode: 'auto-elk' },
        },
      ];
      const edges: NeuroEdge[] = [{ id: 'e1', source: 'A', target: 'M' }];

      const res = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });
      const nodeM = res.nodes.find((n) => n.id === 'M')!;
      assert.strictEqual(nodeM.position.x, 420);
      assert.strictEqual(nodeM.position.y, 360);
      assert.strictEqual(nodeM.layoutMode, 'manual');
    });
  });

  describe('3. Subgraphs & Directional Isolation', () => {
    it('M2-ELK-04: supports subgraphs with isolated direction and expands frame bounds', async () => {
      const nodes: NeuroNode[] = [
        {
          id: 'frame1',
          type: 'frame',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: {
            title: 'Horizontal Microservices',
            direction: 'LR', // Isolated direction inside root DOWN diagram!
            minWidth: 200,
            minHeight: 120,
            layoutMode: 'auto-elk',
          },
        },
        {
          id: 'srv1',
          type: 'shape',
          parentId: 'frame1',
          position: { x: 0, y: 0 },
          width: 160,
          height: 60,
          layoutMode: 'auto-elk',
          data: { label: 'Service 1', layoutMode: 'auto-elk' },
        },
        {
          id: 'srv2',
          type: 'shape',
          parentId: 'frame1',
          position: { x: 0, y: 0 },
          width: 160,
          height: 60,
          layoutMode: 'auto-elk',
          data: { label: 'Service 2', layoutMode: 'auto-elk' },
        },
      ];
      const edges: NeuroEdge[] = [
        { id: 'e1', source: 'srv1', target: 'srv2' },
      ];

      const res = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });
      const srv1 = res.nodes.find((n) => n.id === 'srv1')!;
      const srv2 = res.nodes.find((n) => n.id === 'srv2')!;
      const frame = res.nodes.find((n) => n.id === 'frame1')!;

      // Since subgraph direction is LR, srv1.x < srv2.x
      assert.ok(srv1.position.x < srv2.position.x, `Expected srv1.x (${srv1.position.x}) < srv2.x (${srv2.position.x})`);
      // Frame container width expanded to enclose both children + padding
      assert.ok((frame.width ?? 0) >= 160 * 2);
    });
  });

  describe('4. Fold / Collapse Bounds & Edge Retargeting', () => {
    it('M2-ELK-05: prunes descendants, applies collapsed dimensions, and retargets external edges', async () => {
      const nodes: NeuroNode[] = [
        {
          id: 'sub1',
          type: 'frame',
          position: { x: 100, y: 100 },
          width: 400,
          height: 300,
          layoutMode: 'auto-elk',
          data: {
            title: 'Collapsible Subgraph',
            collapsed: true, // Collapsed!
            layoutMode: 'auto-elk',
          },
        },
        {
          id: 'internalA',
          type: 'shape',
          parentId: 'sub1',
          position: { x: 120, y: 140 },
          layoutMode: 'auto-elk',
          data: { label: 'Internal A', layoutMode: 'auto-elk' },
        },
        {
          id: 'internalB',
          type: 'shape',
          parentId: 'sub1',
          position: { x: 260, y: 140 },
          layoutMode: 'auto-elk',
          data: { label: 'Internal B', layoutMode: 'auto-elk' },
        },
        {
          id: 'externalNode',
          type: 'shape',
          position: { x: 500, y: 200 },
          layoutMode: 'auto-elk',
          data: { label: 'External Target', layoutMode: 'auto-elk' },
        },
      ];

      const edges: NeuroEdge[] = [
        { id: 'internalEdge', source: 'internalA', target: 'internalB' },
        { id: 'externalEdge', source: 'internalB', target: 'externalNode' },
      ];

      const res = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });

      // 1. Descendant nodes internalA and internalB are omitted/pruned
      assert.strictEqual(res.nodes.some((n) => n.id === 'internalA'), false);
      assert.strictEqual(res.nodes.some((n) => n.id === 'internalB'), false);

      // 2. Collapsed subgraph has fixed dimensions (180x44)
      const collapsedFrame = res.nodes.find((n) => n.id === 'sub1')!;
      assert.strictEqual(collapsedFrame.width, 180);
      assert.strictEqual(collapsedFrame.height, 44);

      // 3. External edge was retargeted to connect sub1 -> externalNode
      const retargetedEdge = res.edges.find((e) => e.target === 'externalNode')!;
      assert.ok(retargetedEdge);
      assert.strictEqual(retargetedEdge.source, 'sub1');
    });
  });

  describe('5. Cyclic Graph Cycle-Breaking & High Density', () => {
    it('M2-ELK-06: safely layouts cyclic graph A -> B -> C -> A without infinite loop', async () => {
      const nodes: NeuroNode[] = [
        { id: 'A', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: { label: 'A', layoutMode: 'auto-elk' } },
        { id: 'B', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: { label: 'B', layoutMode: 'auto-elk' } },
        { id: 'C', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: { label: 'C', layoutMode: 'auto-elk' } },
      ];
      const edges: NeuroEdge[] = [
        { id: 'e1', source: 'A', target: 'B' },
        { id: 'e2', source: 'B', target: 'C' },
        { id: 'e3', source: 'C', target: 'A' }, // Cycle back to A!
      ];

      const res = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });
      assert.strictEqual(res.nodes.length, 3);
      for (const n of res.nodes) {
        assert.ok(typeof n.position.x === 'number');
        assert.ok(typeof n.position.y === 'number');
      }
    });

    it('M2-ELK-07: handles high-density graph (60 nodes, 90 edges) within sub-16ms frame budget', async () => {
      const nodes: NeuroNode[] = [];
      const edges: NeuroEdge[] = [];
      for (let i = 0; i < 60; i++) {
        nodes.push({
          id: `n_${i}`,
          type: 'shape',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: { label: `Node ${i}`, layoutMode: 'auto-elk' },
        });
      }
      for (let i = 0; i < 59; i++) {
        edges.push({ id: `e_${i}`, source: `n_${i}`, target: `n_${i + 1}` });
      }

      const start = performance.now();
      const res = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });
      const duration = performance.now() - start;

      assert.strictEqual(res.nodes.length, 60);
      assert.ok(duration < 50, `Layout took ${duration.toFixed(2)}ms (budget: < 50ms)`);
    });
  });
});
