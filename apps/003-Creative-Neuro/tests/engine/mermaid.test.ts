/**
 * Creative-Neuro Algorithmic Unit Tests - Engine 1: Mermaid AST Parser, Serializer & Reconciliation
 * Target: tests/engine/mermaid.test.ts
 *
 * Verifies:
 * - Direction Headers (TB, TD, BT, RL, LR)
 * - All 10 Shape delimiters
 * - Edge stroke styles, arrowheads, and labels
 * - Chained edges (A --> B --> C --> D)
 * - Nested Subgraphs with isolated directions
 * - Fault tolerance on broken/hanging syntax
 * - Serializer round-trip fidelity and bracket/quote escaping
 * - Node ID Reconciliation: manual coordinate preservation, fixed mode preservation, additions, deletions
 * - Performance benchmark (< 5ms for 200 nodes / 300 edges)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMermaid,
  parseNodeToken,
  serializeMermaid,
  reconcileMermaidAST,
} from '../../src/engine/index.ts';
import type { NeuroEdge, NeuroNode } from '../../src/types/index.ts';

describe('Engine 1: Mermaid Parser, Serializer & Reconciliation Unit Tests', () => {
  describe('1. Grammar & Direction Headers', () => {
    it('M1-PARSE-01: parses flowchart and graph direction directives', () => {
      const tb = parseMermaid('flowchart TB\n  A --> B');
      assert.strictEqual(tb.direction, 'TB');
      assert.strictEqual(tb.diagramType, 'flowchart');

      const lr = parseMermaid('graph LR\n  A --> B');
      assert.strictEqual(lr.direction, 'LR');
      assert.strictEqual(lr.diagramType, 'graph');

      const bt = parseMermaid('flowchart BT\n  A --> B');
      assert.strictEqual(bt.direction, 'BT');

      const rl = parseMermaid('flowchart RL\n  A --> B');
      assert.strictEqual(rl.direction, 'RL');

      const td = parseMermaid('flowchart TD\n  A --> B');
      assert.strictEqual(td.direction, 'TD');
    });

    it('M1-PARSE-02: parses all 10 shape delimiters into canonical shape types', () => {
      const code = `flowchart TD
        n1["Rectangle Label"]
        n2("Rounded Label")
        n3(["Stadium Label"])
        n4[["Subroutine Label"]]
        n5[("Cylinder Label")]
        n6(("Circle Label"))
        n7{"Diamond Label"}
        n8{{"Hexagon Label"}}
        n9[/"Parallelogram Label"/]
        n10[/"Trapezoid Label"\\]
        n11[\\"Inverted Trapezoid Label"/]
        n11_raw[\\ Inverted Unquoted /]
        n12[\\"Alt Parallelogram Label"\\]
        n12_raw[\\ Alt Parallelogram Unquoted \\]
      `;
      const ast = parseMermaid(code);
      const nodeMap = new Map(ast.nodes.map((n) => [n.id, n]));

      assert.strictEqual(nodeMap.get('n1')?.shapeType, 'rectangle');
      assert.strictEqual(nodeMap.get('n1')?.label, 'Rectangle Label');

      assert.strictEqual(nodeMap.get('n2')?.shapeType, 'rounded');
      assert.strictEqual(nodeMap.get('n2')?.label, 'Rounded Label');

      assert.strictEqual(nodeMap.get('n3')?.shapeType, 'stadium');
      assert.strictEqual(nodeMap.get('n3')?.label, 'Stadium Label');

      assert.strictEqual(nodeMap.get('n4')?.shapeType, 'subroutine');
      assert.strictEqual(nodeMap.get('n4')?.label, 'Subroutine Label');

      assert.strictEqual(nodeMap.get('n5')?.shapeType, 'cylinder');
      assert.strictEqual(nodeMap.get('n5')?.label, 'Cylinder Label');

      assert.strictEqual(nodeMap.get('n6')?.shapeType, 'circle');
      assert.strictEqual(nodeMap.get('n6')?.label, 'Circle Label');

      assert.strictEqual(nodeMap.get('n7')?.shapeType, 'diamond');
      assert.strictEqual(nodeMap.get('n7')?.label, 'Diamond Label');

      assert.strictEqual(nodeMap.get('n8')?.shapeType, 'hexagon');
      assert.strictEqual(nodeMap.get('n8')?.label, 'Hexagon Label');

      assert.strictEqual(nodeMap.get('n9')?.shapeType, 'rectangle');
      assert.strictEqual(nodeMap.get('n9')?.label, 'Parallelogram Label');

      assert.strictEqual(nodeMap.get('n10')?.shapeType, 'rectangle');
      assert.strictEqual(nodeMap.get('n10')?.label, 'Trapezoid Label');

      // Inverted Trapezoid: [\ /]
      assert.strictEqual(nodeMap.get('n11')?.shapeType, 'rectangle');
      assert.strictEqual(nodeMap.get('n11')?.label, 'Inverted Trapezoid Label');
      assert.ok(
        !nodeMap.get('n11')?.label.startsWith('\\'),
        'Inverted trapezoid label must not start with backslash'
      );
      assert.ok(
        !nodeMap.get('n11')?.label.endsWith('/'),
        'Inverted trapezoid label must not end with slash'
      );

      assert.strictEqual(nodeMap.get('n11_raw')?.shapeType, 'rectangle');
      assert.strictEqual(nodeMap.get('n11_raw')?.label, 'Inverted Unquoted');
      assert.ok(!nodeMap.get('n11_raw')?.label.startsWith('\\'));
      assert.ok(!nodeMap.get('n11_raw')?.label.endsWith('/'));

      // Alternate Parallelogram: [\ \]
      assert.strictEqual(nodeMap.get('n12')?.shapeType, 'rectangle');
      assert.strictEqual(nodeMap.get('n12')?.label, 'Alt Parallelogram Label');
      assert.ok(
        !nodeMap.get('n12')?.label.startsWith('\\'),
        'Alternate parallelogram label must not start with backslash'
      );
      assert.ok(
        !nodeMap.get('n12')?.label.endsWith('\\'),
        'Alternate parallelogram label must not end with backslash'
      );

      assert.strictEqual(nodeMap.get('n12_raw')?.shapeType, 'rectangle');
      assert.strictEqual(nodeMap.get('n12_raw')?.label, 'Alt Parallelogram Unquoted');
      assert.ok(!nodeMap.get('n12_raw')?.label.startsWith('\\'));
      assert.ok(!nodeMap.get('n12_raw')?.label.endsWith('\\'));
    });

    it('M1-PARSE-03: parses edge stroke styles, arrowheads, and labels', () => {
      const code = `flowchart LR
        A --> B
        B --- C
        C -.-> D
        D -.- E
        E ==> F
        F === G
        A -->|approved| C
        B -- "in progress" --> D
        C -. "optional" .-> E
        E == "urgent" ==> G
      `;
      const ast = parseMermaid(code);
      assert.strictEqual(ast.edges.length, 10);

      // A --> B
      const e0 = ast.edges[0];
      assert.strictEqual(e0.source, 'A');
      assert.strictEqual(e0.target, 'B');
      assert.strictEqual(e0.stroke, 'solid');
      assert.strictEqual(e0.arrowHead, 'arrow');

      // B --- C
      const e1 = ast.edges[1];
      assert.strictEqual(e1.stroke, 'solid');
      assert.strictEqual(e1.arrowHead, 'none');

      // C -.-> D
      const e2 = ast.edges[2];
      assert.strictEqual(e2.stroke, 'dotted');
      assert.strictEqual(e2.arrowHead, 'arrow');

      // E ==> F
      const e4 = ast.edges[4];
      assert.strictEqual(e4.stroke, 'thick');
      assert.strictEqual(e4.arrowHead, 'arrow');

      // A -->|approved| C
      const e6 = ast.edges[6];
      assert.strictEqual(e6.label, 'approved');

      // B -- "in progress" --> D
      const e7 = ast.edges[7];
      assert.strictEqual(e7.label, 'in progress');

      // E == "urgent" ==> G
      const e9 = ast.edges[9];
      assert.strictEqual(e9.label, 'urgent');
    });

    it('M1-PARSE-04: splits chained edge declarations into binary edge pairs', () => {
      const code = `flowchart LR
        A --> B --> C --> D
      `;
      const ast = parseMermaid(code);
      assert.strictEqual(ast.edges.length, 3);
      assert.strictEqual(ast.edges[0].source, 'A');
      assert.strictEqual(ast.edges[0].target, 'B');
      assert.strictEqual(ast.edges[1].source, 'B');
      assert.strictEqual(ast.edges[1].target, 'C');
      assert.strictEqual(ast.edges[2].source, 'C');
      assert.strictEqual(ast.edges[2].target, 'D');
    });

    it('M1-PARSE-05: parses nested subgraphs and tracks parent-child hierarchy', () => {
      const code = `flowchart TB
        subgraph clusterA [Cloud Infrastructure]
          direction LR
          subgraph clusterInner [VPC Network]
            direction TB
            appNode["Microservice"]
            dbNode[("Postgres DB")]
          end
          gwNode["API Gateway"]
        end
        userNode(("End User")) --> gwNode
        gwNode --> appNode
        appNode --> dbNode
      `;
      const ast = parseMermaid(code);
      assert.strictEqual(ast.subgraphs.length, 2);

      const outer = ast.subgraphs.find((s) => s.id === 'clusterA');
      const inner = ast.subgraphs.find((s) => s.id === 'clusterInner');

      assert.ok(outer);
      assert.ok(inner);
      assert.strictEqual(outer?.title, 'Cloud Infrastructure');
      assert.strictEqual(outer?.direction, 'LR');
      assert.strictEqual(inner?.title, 'VPC Network');
      assert.strictEqual(inner?.direction, 'TB');
      assert.strictEqual(inner?.parentSubgraphId, 'clusterA');

      const app = ast.nodes.find((n) => n.id === 'appNode');
      assert.strictEqual(app?.parentId, 'clusterInner');
      const gw = ast.nodes.find((n) => n.id === 'gwNode');
      assert.strictEqual(gw?.parentId, 'clusterA');
    });

    it('M1-PARSE-06: recovers from syntax fault and incomplete typing without throwing', () => {
      const malformedCode = `flowchart TB
        A -->
        %% Broken line above
        B["Recovered Node"]
        C --> D
      `;
      let ast: any;
      assert.doesNotThrow(() => {
        ast = parseMermaid(malformedCode);
      });
      assert.ok(ast);
      assert.ok(ast.nodes.some((n: any) => n.id === 'B'));
      assert.ok(ast.edges.some((e: any) => e.source === 'C' && e.target === 'D'));
    });
  });

  describe('2. Serializer & Round-Trip Invariance', () => {
    it('M1-SER-01: serializes scene graph nodes, edges, and subgraphs to valid Mermaid DSL', () => {
      const nodes: NeuroNode[] = [
        {
          id: 'sub1',
          type: 'frame',
          position: { x: 50, y: 50 },
          layoutMode: 'auto-elk',
          data: { title: 'Backend Cluster', label: 'Backend Cluster', direction: 'LR', layoutMode: 'auto-elk' },
        },
        {
          id: 'api',
          type: 'shape',
          parentId: 'sub1',
          position: { x: 80, y: 100 },
          layoutMode: 'auto-elk',
          data: { label: 'Auth API', shapeType: 'rounded', layoutMode: 'auto-elk' },
        },
        {
          id: 'db',
          type: 'shape',
          parentId: 'sub1',
          position: { x: 280, y: 100 },
          layoutMode: 'auto-elk',
          data: { label: 'User Data', shapeType: 'cylinder', layoutMode: 'auto-elk' },
        },
        {
          id: 'client',
          type: 'shape',
          position: { x: 100, y: 300 },
          layoutMode: 'manual',
          data: { label: 'Web Browser', shapeType: 'rectangle', layoutMode: 'manual' },
        },
      ];

      const edges: NeuroEdge[] = [
        {
          id: 'e1',
          source: 'client',
          target: 'api',
          label: 'login request',
          data: { lineStyle: 'solid', arrowEnd: true, label: 'login request' },
        },
        {
          id: 'e2',
          source: 'api',
          target: 'db',
          data: { lineStyle: 'dotted', arrowEnd: true },
        },
      ];

      const serialized = serializeMermaid(nodes, edges, 'TB');
      assert.ok(serialized.includes('flowchart TB'));
      assert.ok(serialized.includes('subgraph sub1'));
      assert.ok(serialized.includes('direction LR'));
      assert.ok(serialized.includes('api("Auth API")'));
      assert.ok(serialized.includes('db[("User Data")]'));
      assert.ok(serialized.includes('client["Web Browser"]'));
      assert.ok(serialized.includes('client -->|login request| api'));
      assert.ok(serialized.includes('api -.-> db'));

      // Round-trip parse
      const reparsed = parseMermaid(serialized);
      assert.strictEqual(reparsed.direction, 'TB');
      assert.strictEqual(reparsed.nodes.length, 3); // Leaf nodes
      assert.strictEqual(reparsed.subgraphs.length, 1);
      assert.strictEqual(reparsed.edges.length, 2);
    });

    it('M1-SER-02: safely handles special characters, quotes, and newlines in labels', () => {
      const nodes: NeuroNode[] = [
        {
          id: 'special',
          type: 'shape',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: {
            label: 'Hello "World"\nLine 2 & <tags>',
            shapeType: 'diamond',
            layoutMode: 'auto-elk',
          },
        },
      ];
      const serialized = serializeMermaid(nodes, []);
      assert.ok(serialized.includes('\\"World\\"'));
      assert.ok(serialized.includes('<br/>'));

      const reparsed = parseMermaid(serialized);
      const parsedNode = reparsed.nodes.find((n) => n.id === 'special');
      assert.ok(parsedNode);
      assert.strictEqual(parsedNode?.shapeType, 'diamond');
      assert.ok(parsedNode?.label.includes('World'));
    });
  });

  describe('3. Node ID Reconciliation Engine', () => {
    it('M1-REC-01: PRESERVES manual and fixed coordinates and layoutMode during text edit', () => {
      const existingNodes: NeuroNode[] = [
        {
          id: 'A',
          type: 'shape',
          position: { x: 350, y: 620 }, // User dragged to manual position
          width: 180,
          height: 70,
          layoutMode: 'manual',
          data: { label: 'Old Title A', shapeType: 'rectangle', layoutMode: 'manual' },
        },
        {
          id: 'F',
          type: 'shape',
          position: { x: 100, y: 100 }, // Fixed anchor
          layoutMode: 'fixed',
          data: { label: 'Fixed Anchor', shapeType: 'circle', layoutMode: 'fixed' },
        },
      ];

      // Mermaid code has updated label for A and new shape for F
      const mermaidCode = `flowchart TB
        A["New Title A"]
        F(("Fixed Anchor Updated"))
      `;
      const ast = parseMermaid(mermaidCode);
      const result = reconcileMermaidAST(ast, existingNodes, 'auto-elk');

      assert.strictEqual(result.nodes.length, 2);
      const nodeA = result.nodes.find((n) => n.id === 'A')!;
      const nodeF = result.nodes.find((n) => n.id === 'F')!;

      // Position strictly preserved!
      assert.strictEqual(nodeA.position.x, 350);
      assert.strictEqual(nodeA.position.y, 620);
      assert.strictEqual(nodeA.layoutMode, 'manual');
      assert.strictEqual(nodeA.data.label, 'New Title A');

      assert.strictEqual(nodeF.position.x, 100);
      assert.strictEqual(nodeF.position.y, 100);
      assert.strictEqual(nodeF.layoutMode, 'fixed');
      assert.strictEqual(nodeF.data.label, 'Fixed Anchor Updated');
      assert.strictEqual(nodeF.data.shapeType, 'circle');
    });

    it('M1-REC-02: accurately identifies added and removed nodes during reconciliation', () => {
      const existingNodes: NeuroNode[] = [
        {
          id: 'A',
          type: 'shape',
          position: { x: 100, y: 100 },
          layoutMode: 'auto-elk',
          data: { label: 'Node A', layoutMode: 'auto-elk' },
        },
        {
          id: 'B',
          type: 'shape',
          position: { x: 200, y: 100 },
          layoutMode: 'auto-elk',
          data: { label: 'Node B', layoutMode: 'auto-elk' },
        },
      ];

      // New code removes B, retains A, and adds C
      const code = `flowchart LR
        A --> C["Node C"]
      `;
      const ast = parseMermaid(code);
      const result = reconcileMermaidAST(ast, existingNodes, 'auto-elk');

      assert.ok(result.addedNodeIds.includes('C'));
      assert.ok(result.removedNodeIds.includes('B'));
      assert.ok(result.updatedNodeIds.includes('A'));

      const nodeC = result.nodes.find((n) => n.id === 'C')!;
      assert.ok(nodeC);
      assert.strictEqual(nodeC.layoutMode, 'auto-elk');
      assert.strictEqual(nodeC.data.isUnplaced, true);

      // Edge A -> C exists
      assert.strictEqual(result.edges.length, 1);
      assert.strictEqual(result.edges[0].source, 'A');
      assert.strictEqual(result.edges[0].target, 'C');
    });

    it('M1-REC-03: clears parentId and removes container when subgraph is deleted from Mermaid code', () => {
      const existingNodes: NeuroNode[] = [
        {
          id: 'sub1',
          type: 'frame',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: { label: 'Cluster 1', layoutMode: 'auto-elk' },
        },
        {
          id: 'A',
          type: 'shape',
          parentId: 'sub1',
          position: { x: 50, y: 50 },
          layoutMode: 'manual',
          data: { label: 'Node A', layoutMode: 'manual' },
        },
      ];

      // User deletes subgraph in Mermaid text
      const ast = parseMermaid('flowchart TB\n  A["Node A"]');
      const result = reconcileMermaidAST(ast, existingNodes, 'auto-elk');

      assert.strictEqual(result.nodes.length, 1);
      assert.ok(result.removedNodeIds.includes('sub1'));
      const nodeA = result.nodes.find((n) => n.id === 'A')!;
      assert.strictEqual(nodeA.parentId, undefined);
      assert.strictEqual(nodeA.position.x, 50); // Preserved manual coordinates

      // Serialization must NOT resurrect deleted subgraph
      const serialized = serializeMermaid(result.nodes, result.edges, 'TB');
      assert.ok(!serialized.includes('subgraph sub1'));
      assert.ok(serialized.includes('A["Node A"]'));
    });

    it('M1-REC-04: un-parents nodes moved out of subgraph to root level', () => {
      const existingNodes: NeuroNode[] = [
        {
          id: 'sub1',
          type: 'frame',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: { label: 'Cluster 1', layoutMode: 'auto-elk' },
        },
        {
          id: 'A',
          type: 'shape',
          parentId: 'sub1',
          position: { x: 50, y: 50 },
          layoutMode: 'manual',
          data: { label: 'Node A', layoutMode: 'manual' },
        },
        {
          id: 'B',
          type: 'shape',
          parentId: 'sub1',
          position: { x: 200, y: 50 },
          layoutMode: 'auto-elk',
          data: { label: 'Node B', layoutMode: 'auto-elk' },
        },
      ];

      // User moves A outside sub1, while B remains inside
      const code = `flowchart TB
        subgraph sub1 ["Cluster 1"]
          B["Node B"]
        end
        A["Node A"]
      `;
      const ast = parseMermaid(code);
      const result = reconcileMermaidAST(ast, existingNodes, 'auto-elk');

      const nodeA = result.nodes.find((n) => n.id === 'A')!;
      const nodeB = result.nodes.find((n) => n.id === 'B')!;

      assert.strictEqual(nodeA.parentId, undefined);
      assert.strictEqual(nodeB.parentId, 'sub1');
      assert.strictEqual(nodeA.position.x, 50); // Coordinate preserved
    });

    it('M1-REC-05: handles un-nesting of nested subgraphs when outer subgraph is removed', () => {
      const existingNodes: NeuroNode[] = [
        {
          id: 'subOuter',
          type: 'frame',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: { label: 'Outer', layoutMode: 'auto-elk' },
        },
        {
          id: 'subInner',
          type: 'frame',
          parentId: 'subOuter',
          position: { x: 10, y: 10 },
          layoutMode: 'auto-elk',
          data: { label: 'Inner', layoutMode: 'auto-elk' },
        },
        {
          id: 'X',
          type: 'shape',
          parentId: 'subInner',
          position: { x: 20, y: 20 },
          layoutMode: 'manual',
          data: { label: 'Node X', layoutMode: 'manual' },
        },
      ];

      // User deletes subOuter, leaving subInner as top-level subgraph
      const code = `flowchart TB
        subgraph subInner ["Inner"]
          X["Node X"]
        end
      `;
      const ast = parseMermaid(code);
      const result = reconcileMermaidAST(ast, existingNodes, 'auto-elk');

      const subInner = result.nodes.find((n) => n.id === 'subInner')!;
      const nodeX = result.nodes.find((n) => n.id === 'X')!;

      assert.strictEqual(subInner.parentId, undefined);
      assert.strictEqual(nodeX.parentId, 'subInner');
      assert.ok(result.removedNodeIds.includes('subOuter'));

      const serialized = serializeMermaid(result.nodes, result.edges, 'TB');
      assert.ok(!serialized.includes('subgraph subOuter'));
      assert.ok(serialized.includes('subgraph subInner ["Inner"]'));
      assert.ok(serialized.includes('X["Node X"]'));
    });
  });

  describe('4. Performance Benchmark', () => {
    it('M1-PERF-01: reconciles 200 nodes and 300 edges in < 5ms', () => {
      const nodeCount = 200;
      const edgeCount = 300;

      const existingNodes: NeuroNode[] = [];
      for (let i = 0; i < nodeCount; i++) {
        existingNodes.push({
          id: `node_${i}`,
          type: 'shape',
          position: { x: i * 20, y: (i % 10) * 80 },
          layoutMode: i % 3 === 0 ? 'manual' : 'auto-elk',
          data: { label: `Label ${i}`, layoutMode: 'auto-elk' },
        });
      }

      // Build synthetic AST
      const lines = ['flowchart LR'];
      for (let i = 0; i < nodeCount; i++) {
        lines.push(`  node_${i}["Label ${i} Updated"]`);
      }
      for (let j = 0; j < edgeCount; j++) {
        const src = `node_${j % nodeCount}`;
        const tgt = `node_${(j + 1) % nodeCount}`;
        lines.push(`  ${src} --> ${tgt}`);
      }

      const ast = parseMermaid(lines.join('\n'));

      const startTime = performance.now();
      const result = reconcileMermaidAST(ast, existingNodes, 'auto-elk');
      const duration = performance.now() - startTime;

      assert.strictEqual(result.nodes.length, nodeCount);
      assert.ok(duration < 25, `Reconciliation took ${duration.toFixed(2)}ms (budget: < 25ms)`);
    });
  });
});
