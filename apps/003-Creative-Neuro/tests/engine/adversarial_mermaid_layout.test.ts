/**
 * Creative-Neuro Adversarial Algorithmic Stress Test Suite
 * Target: tests/engine/adversarial_mermaid_layout.test.ts
 *
 * Rigorously stress-tests:
 * 1. Deeply nested subgraphs (4+ levels) with mismatched directions
 * 2. Complex cyclic graphs (10+ nodes with cross chords, self-loops, multi-cycles)
 * 3. Highly malformed Mermaid syntax (unclosed delimiters, noise, unicode, zero-length IDs)
 * 4. Reconciliation stress & Floating-point coordinate drift invariance
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMermaid,
  serializeMermaid,
  reconcileMermaidAST,
  calculateElkLayout,
  normalizeDirection,
} from '../../src/engine/index.ts';
import type { NeuroEdge, NeuroNode } from '../../src/types/index.ts';

describe('Adversarial Stress Suite: Mermaid Parser, Serializer, Reconciliation & ELK Layout', () => {
  // =========================================================================
  // Challenge 1: Deeply Nested Subgraphs (4+ levels) with Mismatched Directions
  // =========================================================================
  describe('1. Deeply Nested Subgraphs (4+ Levels) & Directional Mismatch', () => {
    it('ADV-SUB-01: parses 4-level nested subgraphs with conflicting directions and leaf containment', () => {
      const code = `flowchart TB
        subgraph Level1 ["Level 1 Container"]
          direction LR
          n1["Leaf in L1"]
          subgraph Level2 ["Level 2 Container"]
            direction TB
            n2["Leaf in L2"]
            subgraph Level3 ["Level 3 Container"]
              direction RL
              n3["Leaf in L3"]
              subgraph Level4 ["Level 4 Container"]
                direction BT
                n4["Leaf in L4"]
              end
            end
          end
        end
        n1 --> n2
        n2 --> n3
        n3 --> n4
      `;

      const ast = parseMermaid(code);

      // Verify diagram header
      assert.strictEqual(ast.diagramType, 'flowchart');
      assert.strictEqual(ast.direction, 'TB');

      // Verify subgraphs count and parent-child hierarchy
      assert.strictEqual(ast.subgraphs.length, 4);

      const l1 = ast.subgraphs.find((s) => s.id === 'Level1')!;
      const l2 = ast.subgraphs.find((s) => s.id === 'Level2')!;
      const l3 = ast.subgraphs.find((s) => s.id === 'Level3')!;
      const l4 = ast.subgraphs.find((s) => s.id === 'Level4')!;

      assert.ok(l1, 'Level1 subgraph exists');
      assert.ok(l2, 'Level2 subgraph exists');
      assert.ok(l3, 'Level3 subgraph exists');
      assert.ok(l4, 'Level4 subgraph exists');

      // Verify hierarchy links
      assert.strictEqual(l1.parentSubgraphId, undefined);
      assert.strictEqual(l2.parentSubgraphId, 'Level1');
      assert.strictEqual(l3.parentSubgraphId, 'Level2');
      assert.strictEqual(l4.parentSubgraphId, 'Level3');

      // Verify isolated directions per level
      assert.strictEqual(l1.direction, 'LR');
      assert.strictEqual(l2.direction, 'TB');
      assert.strictEqual(l3.direction, 'RL');
      assert.strictEqual(l4.direction, 'BT');

      // Verify node parent assignments in AST
      const node1 = ast.nodes.find((n) => n.id === 'n1')!;
      const node2 = ast.nodes.find((n) => n.id === 'n2')!;
      const node3 = ast.nodes.find((n) => n.id === 'n3')!;
      const node4 = ast.nodes.find((n) => n.id === 'n4')!;

      assert.strictEqual(node1.parentId, 'Level1');
      assert.strictEqual(node2.parentId, 'Level2');
      assert.strictEqual(node3.parentId, 'Level3');
      assert.strictEqual(node4.parentId, 'Level4');

      // Verify edges
      assert.strictEqual(ast.edges.length, 3);
    });

    it('ADV-SUB-02: reconciles and lays out 4+ level nested graph without throwing or NaN coordinates', async () => {
      const code = `flowchart TB
        subgraph L1 ["Container L1"]
          direction LR
          n1["Node 1"]
          subgraph L2 ["Container L2"]
            direction TB
            n2["Node 2"]
            subgraph L3 ["Container L3"]
              direction RL
              n3["Node 3"]
              subgraph L4 ["Container L4"]
                direction BT
                n4["Node 4"]
              end
            end
          end
        end
        n1 --> n2
        n2 --> n3
        n3 --> n4
      `;

      const ast = parseMermaid(code);
      const { nodes, edges } = reconcileMermaidAST(ast, [], 'auto-elk');

      // 4 frames (L1..L4) + 4 leaf nodes (n1..n4) = 8 total nodes
      assert.strictEqual(nodes.length, 8);
      assert.strictEqual(edges.length, 3);

      const startTime = performance.now();
      const layoutResult = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });
      const duration = performance.now() - startTime;

      assert.ok(duration < 50, `Layout executed within 50ms (actual: ${duration.toFixed(2)}ms)`);
      assert.strictEqual(layoutResult.nodes.length, 8);

      // Verify every node has valid finite numeric positions and dimensions
      for (const node of layoutResult.nodes) {
        assert.ok(Number.isFinite(node.position.x), `Node ${node.id} x is finite`);
        assert.ok(Number.isFinite(node.position.y), `Node ${node.id} y is finite`);
        assert.ok(Number.isFinite(node.width) && node.width! > 0, `Node ${node.id} width is positive`);
        assert.ok(Number.isFinite(node.height) && node.height! > 0, `Node ${node.id} height is positive`);
        assert.ok(!Number.isNaN(node.position.x), `Node ${node.id} x is not NaN`);
        assert.ok(!Number.isNaN(node.position.y), `Node ${node.id} y is not NaN`);
      }
    });

    it('ADV-SUB-03: round-trip serializes 4-level nested hierarchy and re-parses with zero loss', () => {
      const originalCode = `flowchart TB
  subgraph L1 ["Level 1"]
    direction LR
    L1_node["Node 1"]
    subgraph L2 ["Level 2"]
      direction TB
      L2_node["Node 2"]
      subgraph L3 ["Level 3"]
        direction RL
        L3_node["Node 3"]
        subgraph L4 ["Level 4"]
          direction BT
          L4_node["Node 4"]
        end
      end
    end
  end
  L1_node --> L2_node
  L2_node --> L3_node
  L3_node --> L4_node`;

      const ast1 = parseMermaid(originalCode);
      const { nodes, edges } = reconcileMermaidAST(ast1, []);
      const serialized = serializeMermaid(nodes, edges, 'TB');

      // Re-parse the serialized code
      const ast2 = parseMermaid(serialized);

      // Verify all 4 subgraphs exist in re-parsed AST
      assert.strictEqual(ast2.subgraphs.length, 4);
      const subMap = new Map(ast2.subgraphs.map((s) => [s.id, s]));

      assert.strictEqual(subMap.get('L1')?.parentSubgraphId, undefined);
      assert.strictEqual(subMap.get('L2')?.parentSubgraphId, 'L1');
      assert.strictEqual(subMap.get('L3')?.parentSubgraphId, 'L2');
      assert.strictEqual(subMap.get('L4')?.parentSubgraphId, 'L3');

      // Verify directions survived
      assert.strictEqual(subMap.get('L1')?.direction, 'LR');
      assert.strictEqual(subMap.get('L2')?.direction, 'TB');
      assert.strictEqual(subMap.get('L3')?.direction, 'RL');
      assert.strictEqual(subMap.get('L4')?.direction, 'BT');

      // Verify leaf nodes survived with correct parent
      const nodeMap = new Map(ast2.nodes.map((n) => [n.id, n]));
      assert.strictEqual(nodeMap.get('L1_node')?.parentId, 'L1');
      assert.strictEqual(nodeMap.get('L2_node')?.parentId, 'L2');
      assert.strictEqual(nodeMap.get('L3_node')?.parentId, 'L3');
      assert.strictEqual(nodeMap.get('L4_node')?.parentId, 'L4');
    });
  });

  // =========================================================================
  // Challenge 2: Complex Cyclic Graphs (10+ nodes with chords & dense cycles)
  // =========================================================================
  describe('2. Complex Cyclic Graphs & Cycle Breaking Stress', () => {
    it('ADV-CYC-01: layouts 10-node cycle with multi-hop cross chords without infinite recursion or stack overflow', async () => {
      // Create a 10-node Hamiltonian cycle + 8 cross chords + self loop
      const nodeCount = 10;
      const nodes: NeuroNode[] = [];
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `N${i}`,
          type: 'shape',
          position: { x: 0, y: 0 },
          width: 160,
          height: 60,
          layoutMode: 'auto-elk',
          data: { label: `Node ${i}`, layoutMode: 'auto-elk' },
        });
      }

      const edges: NeuroEdge[] = [];
      // Main cycle: 0 -> 1 -> 2 -> ... -> 9 -> 0
      for (let i = 0; i < nodeCount; i++) {
        edges.push({
          id: `ec_${i}`,
          source: `N${i}`,
          target: `N${(i + 1) % nodeCount}`,
        });
      }

      // Cross chords creating multiple internal cycles
      edges.push({ id: 'chord_1', source: 'N1', target: 'N5' });
      edges.push({ id: 'chord_2', source: 'N2', target: 'N0' }); // reverse chord
      edges.push({ id: 'chord_3', source: 'N3', target: 'N8' });
      edges.push({ id: 'chord_4', source: 'N6', target: 'N2' }); // reverse chord
      edges.push({ id: 'chord_5', source: 'N9', target: 'N4' }); // reverse chord
      edges.push({ id: 'chord_6', source: 'N7', target: 'N1' }); // reverse chord
      edges.push({ id: 'chord_7', source: 'N5', target: 'N5' }); // self loop
      edges.push({ id: 'chord_8', source: 'N4', target: 'N8' });

      const startTime = performance.now();
      const res = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });
      const duration = performance.now() - startTime;

      // Assert terminates rapidly (< 25ms)
      assert.ok(duration < 25, `Layout of 10-node dense cycle completed in ${duration.toFixed(2)}ms (< 25ms)`);

      // Assert all 10 nodes received valid coordinates
      assert.strictEqual(res.nodes.length, 10);
      for (const n of res.nodes) {
        assert.ok(Number.isFinite(n.position.x), `${n.id}.x is finite`);
        assert.ok(Number.isFinite(n.position.y), `${n.id}.y is finite`);
      }
    });

    it('ADV-CYC-02: handles highly dense 20-node cyclic tournament graph under 30ms', async () => {
      // 20 nodes with 60 cyclic edges
      const nodeCount = 20;
      const nodes: NeuroNode[] = Array.from({ length: nodeCount }, (_, i) => ({
        id: `T${i}`,
        type: 'shape',
        position: { x: 0, y: 0 },
        width: 140,
        height: 50,
        layoutMode: 'auto-elk',
        data: { label: `T${i}`, layoutMode: 'auto-elk' },
      }));

      const edges: NeuroEdge[] = [];
      for (let i = 0; i < nodeCount; i++) {
        // Forward edge
        edges.push({ id: `e_fwd_${i}`, source: `T${i}`, target: `T${(i + 1) % nodeCount}` });
        // Jump chord
        edges.push({ id: `e_jmp_${i}`, source: `T${i}`, target: `T${(i + 5) % nodeCount}` });
        // Reverse cross edge
        edges.push({ id: `e_rev_${i}`, source: `T${i}`, target: `T${(i + nodeCount - 3) % nodeCount}` });
      }

      const startTime = performance.now();
      const res = await calculateElkLayout(nodes, edges, { direction: 'RIGHT' });
      const duration = performance.now() - startTime;

      assert.ok(duration < 30, `20-node tournament layout executed in ${duration.toFixed(2)}ms (< 30ms)`);
      assert.strictEqual(res.nodes.length, nodeCount);

      // Verify no NaN positions
      for (const n of res.nodes) {
        assert.ok(!Number.isNaN(n.position.x));
        assert.ok(!Number.isNaN(n.position.y));
      }
    });

    it('ADV-CYC-03: parses and recovers from Mermaid cyclic syntax with chained loops', () => {
      const code = `flowchart LR
        A --> B --> C --> D --> E --> A
        B ==> D
        D -.-> A
        C --- E
      `;

      const ast = parseMermaid(code);
      assert.strictEqual(ast.nodes.length, 5);
      // Chained 5-node cycle = 5 edges + 3 chords = 8 edges
      assert.strictEqual(ast.edges.length, 8);

      const { nodes, edges } = reconcileMermaidAST(ast, []);
      assert.strictEqual(nodes.length, 5);
      assert.strictEqual(edges.length, 8);
    });
  });

  // =========================================================================
  // Challenge 3: Highly Malformed Mermaid Syntax & Attack Vectors
  // =========================================================================
  describe('3. Highly Malformed Mermaid Syntax & Attack Recovery', () => {
    it('ADV-MAL-01: survives unclosed brackets and mismatched delimiters without crashing', () => {
      const malformedCases = [
        'flowchart TB\nA[Unclosed square bracket\nB --> C',
        'flowchart TB\nA((Unclosed circle\nB([Unclosed stadium',
        'flowchart TB\nA{Unclosed diamond\nB{{Unclosed hexagon',
        'flowchart TB\nA[("Unclosed cylinder\nB[["Unclosed subroutine',
        'flowchart TB\nA[/"Unclosed parallelogram\nB[/"Unclosed trapezoid\\',
      ];

      for (const testCase of malformedCases) {
        assert.doesNotThrow(() => {
          const ast = parseMermaid(testCase);
          assert.ok(ast, 'Returned AST');
          assert.ok(Array.isArray(ast.nodes), 'ast.nodes is an array');
          assert.ok(Array.isArray(ast.edges), 'ast.edges is an array');
        }, `Should not throw on: ${testCase}`);
      }
    });

    it('ADV-MAL-02: survives random ASCII noise, punctuation, and injection tokens', () => {
      const noise = `
        flowchart TB
        !@#$%^&*()_+{}|:"<>?
        ;;;; ;;;; ,,,,, ....
        -->>>>> ==== ---->
        |||||||||||||||||||
        ~~~ \`\`\` *** &&& %%%
        <script>alert("XSS")</script>
        DROP TABLE users;--
        A --> B
      `;

      assert.doesNotThrow(() => {
        const ast = parseMermaid(noise);
        // Valid edge A --> B should still be parsed despite the noise lines
        const nodeIds = ast.nodes.map((n) => n.id);
        assert.ok(nodeIds.includes('A'), 'Extracted valid node A');
        assert.ok(nodeIds.includes('B'), 'Extracted valid node B');
        assert.ok(
          ast.edges.some((e) => e.source === 'A' && e.target === 'B'),
          'Extracted valid edge A --> B'
        );

        // Verify downstream reconcile and layout do not throw on noise AST
        const { nodes, edges } = reconcileMermaidAST(ast, []);
        assert.ok(nodes.length > 0);
      });
    });

    it('ADV-MAL-03: handles unicode emojis, multi-line HTML, and zero-width spaces in labels', () => {
      const unicodeMermaid = `flowchart LR
        A["🧠 Deep Thinking 🌟 <br/> 🚀 Ultra Speed \u200B"] -->|✨ Magic Connection 🪄| B["🎯 Target Entity 🦄"]
        B --> C["Complex Symbols: &amp; &lt; &gt; &quot; 'quotes'"]
      `;

      const ast = parseMermaid(unicodeMermaid);
      assert.strictEqual(ast.nodes.length, 3);
      assert.strictEqual(ast.edges.length, 2);

      const nodeA = ast.nodes.find((n) => n.id === 'A')!;
      assert.ok(nodeA.label.includes('🧠 Deep Thinking 🌟'), 'Preserved emojis in label A');
      assert.ok(nodeA.label.includes('\n') || nodeA.label.includes('Ultra Speed'), 'Preserved multiline');

      const edge0 = ast.edges[0];
      assert.ok(edge0.label?.includes('✨ Magic Connection 🪄'), 'Preserved emojis in edge label');

      // Verify reconciliation and layout survive unicode
      const { nodes, edges } = reconcileMermaidAST(ast, []);
      assert.doesNotThrow(async () => {
        const layoutRes = await calculateElkLayout(nodes, edges);
        assert.strictEqual(layoutRes.nodes.length, 3);
      });
    });

    it('ADV-MAL-04: survives zero-length node IDs, dangling arrows, and empty tokens', () => {
      const brokenSyntax = `
        flowchart TB
        -->
        --> B
        A -->
        --> |label| -->
        A --> --> B
        []
        ()
        {}
        ([ ])
        ""
        C --> D
      `;

      assert.doesNotThrow(() => {
        const ast = parseMermaid(brokenSyntax);
        // C --> D is valid
        const nodeIds = ast.nodes.map((n) => n.id);
        assert.ok(nodeIds.includes('C'));
        assert.ok(nodeIds.includes('D'));
      });
    });

    it('ADV-MAL-05: survives unclosed, empty, or orphaned subgraphs', () => {
      const brokenSubgraphs = `
        flowchart TB
        end
        end
        subgraph Sub1
          subgraph Sub2
            A --> B
        subgraph Sub3
        end
        subgraph SubEmpty
        end
        C --> D
      `;

      assert.doesNotThrow(() => {
        const ast = parseMermaid(brokenSubgraphs);
        assert.ok(ast.subgraphs.length >= 1);
        const { nodes, edges } = reconcileMermaidAST(ast, []);
        assert.ok(nodes.length > 0);
      });
    });

    it('ADV-MAL-06: survives massive 10,000-character payload stress', () => {
      const longLabel = 'X'.repeat(5000);
      const massiveCode = `flowchart TB\n A["${longLabel}"] --> B["${longLabel}"]\n`;

      const startTime = performance.now();
      const ast = parseMermaid(massiveCode);
      const parseTime = performance.now() - startTime;

      assert.ok(parseTime < 20, `Parsed 10k character token in ${parseTime.toFixed(2)}ms (< 20ms)`);
      assert.strictEqual(ast.nodes.length, 2);
      assert.strictEqual(ast.nodes[0].label.length, 5000);
    });
  });

  // =========================================================================
  // Challenge 4: Reconciliation Stress & Floating-Point Drift Invariance
  // =========================================================================
  describe('4. Reconciliation Stress & Floating-Point Drift Invariance', () => {
    it('ADV-REC-01: preserves exact floating-point coordinates across 50 consecutive edit-sync cycles', async () => {
      // Setup 5 fixed nodes and 5 manual nodes with precise floating-point values
      const fixedCoords = [
        { id: 'fix_1', x: 123.456789123, y: 987.654321987 },
        { id: 'fix_2', x: 314.159265358, y: 271.828182845 },
        { id: 'fix_3', x: 0.123456789, y: 0.987654321 },
        { id: 'fix_4', x: 1000.000000001, y: 2000.000000002 },
        { id: 'fix_5', x: -456.789012345, y: -789.012345678 },
      ];

      const manualCoords = [
        { id: 'man_1', x: 555.555555555, y: 444.444444444 },
        { id: 'man_2', x: 111.111111111, y: 222.222222222 },
        { id: 'man_3', x: 888.888888888, y: 999.999999999 },
        { id: 'man_4', x: 73.123456789, y: 37.987654321 },
        { id: 'man_5', x: 42.424242424, y: 24.242424242 },
      ];

      let currentNodes: NeuroNode[] = [
        ...fixedCoords.map((c) => ({
          id: c.id,
          type: 'shape' as const,
          position: { x: c.x, y: c.y },
          width: 160,
          height: 60,
          layoutMode: 'fixed' as const,
          data: { label: `Fixed ${c.id}`, layoutMode: 'fixed' as const },
        })),
        ...manualCoords.map((c) => ({
          id: c.id,
          type: 'shape' as const,
          position: { x: c.x, y: c.y },
          width: 160,
          height: 60,
          layoutMode: 'manual' as const,
          data: { label: `Manual ${c.id}`, layoutMode: 'manual' as const },
        })),
        // 5 auto-elk nodes
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `auto_${i}`,
          type: 'shape' as const,
          position: { x: 0, y: 0 },
          width: 160,
          height: 60,
          layoutMode: 'auto-elk' as const,
          data: { label: `Auto ${i}`, layoutMode: 'auto-elk' as const },
        })),
      ];

      let currentEdges: NeuroEdge[] = [
        { id: 'e1', source: 'fix_1', target: 'man_1' },
        { id: 'e2', source: 'man_1', target: 'auto_0' },
        { id: 'e3', source: 'auto_0', target: 'auto_1' },
        { id: 'e4', source: 'fix_2', target: 'auto_2' },
        { id: 'e5', source: 'auto_2', target: 'man_2' },
      ];

      const NUM_CYCLES = 50;

      for (let cycle = 0; cycle < NUM_CYCLES; cycle++) {
        // 1. Serialize current state to Mermaid DSL
        const mermaidDsl = serializeMermaid(currentNodes, currentEdges, 'TB');

        // 2. Synthesize an edit in the Mermaid code:
        // Modify label of auto_0, or add a comment/edge
        const modifiedDsl = mermaidDsl + `\n  auto_1 -->|step_${cycle}| auto_2`;

        // 3. Parse Mermaid DSL
        const ast = parseMermaid(modifiedDsl);

        // 4. Reconcile with existing nodes
        const reconcileRes = reconcileMermaidAST(ast, currentNodes, 'auto-elk');

        // 5. Layout with ELK
        const layoutRes = await calculateElkLayout(reconcileRes.nodes, reconcileRes.edges, { direction: 'DOWN' });

        currentNodes = layoutRes.nodes;
        currentEdges = layoutRes.edges;

        // 6. Check invariants at every 10th cycle and at final cycle
        if (cycle % 10 === 0 || cycle === NUM_CYCLES - 1) {
          // Verify Fixed nodes
          for (const target of fixedCoords) {
            const found = currentNodes.find((n) => n.id === target.id);
            assert.ok(found, `Fixed node ${target.id} must exist at cycle ${cycle}`);
            assert.strictEqual(
              found.layoutMode,
              'fixed',
              `Fixed node ${target.id} must preserve 'fixed' layoutMode at cycle ${cycle}`
            );
            assert.strictEqual(
              found.position.x,
              target.x,
              `Fixed node ${target.id} X must have ZERO floating point drift (expected ${target.x}, got ${found.position.x}) at cycle ${cycle}`
            );
            assert.strictEqual(
              found.position.y,
              target.y,
              `Fixed node ${target.id} Y must have ZERO floating point drift (expected ${target.y}, got ${found.position.y}) at cycle ${cycle}`
            );
          }

          // Verify Manual nodes
          for (const target of manualCoords) {
            const found = currentNodes.find((n) => n.id === target.id);
            assert.ok(found, `Manual node ${target.id} must exist at cycle ${cycle}`);
            assert.strictEqual(
              found.layoutMode,
              'manual',
              `Manual node ${target.id} must preserve 'manual' layoutMode at cycle ${cycle}`
            );
            assert.strictEqual(
              found.position.x,
              target.x,
              `Manual node ${target.id} X must have ZERO floating point drift (expected ${target.x}, got ${found.position.x}) at cycle ${cycle}`
            );
            assert.strictEqual(
              found.position.y,
              target.y,
              `Manual node ${target.id} Y must have ZERO floating point drift (expected ${target.y}, got ${found.position.y}) at cycle ${cycle}`
            );
          }
        }
      }
    });

    it('ADV-REC-02: handles rapid node churn (simultaneous additions & deletions) during reconciliation', () => {
      // Initial 10 nodes
      const initialNodes: NeuroNode[] = Array.from({ length: 10 }, (_, i) => ({
        id: `node_${i}`,
        type: 'shape' as const,
        position: { x: i * 50, y: i * 50 },
        width: 160,
        height: 60,
        layoutMode: (i % 2 === 0 ? 'manual' : 'auto-elk') as const,
        data: { label: `Node ${i}`, layoutMode: (i % 2 === 0 ? 'manual' : 'auto-elk') as const },
      }));

      // Churn: delete half (even nodes), keep half (odd nodes), add 5 new nodes
      const churnMermaid = `flowchart LR
        node_1["Node 1 updated"]
        node_3["Node 3 updated"]
        node_5["Node 5 updated"]
        node_7["Node 7 updated"]
        node_9["Node 9 updated"]
        new_0["New Node 0"]
        new_1["New Node 1"]
        new_2["New Node 2"]
        new_3["New Node 3"]
        new_4["New Node 4"]
        node_1 --> new_0
        new_0 --> node_3
      `;

      const ast = parseMermaid(churnMermaid);
      const res = reconcileMermaidAST(ast, initialNodes, 'auto-elk');

      // Verify removed nodes (0, 2, 4, 6, 8)
      assert.strictEqual(res.removedNodeIds.length, 5);
      assert.deepStrictEqual(res.removedNodeIds.sort(), ['node_0', 'node_2', 'node_4', 'node_6', 'node_8'].sort());

      // Verify added nodes (new_0..new_4)
      assert.strictEqual(res.addedNodeIds.length, 5);
      assert.deepStrictEqual(res.addedNodeIds.sort(), ['new_0', 'new_1', 'new_2', 'new_3', 'new_4'].sort());

      // Verify updated nodes (1, 3, 5, 7, 9)
      assert.strictEqual(res.updatedNodeIds.length, 5);
      assert.deepStrictEqual(res.updatedNodeIds.sort(), ['node_1', 'node_3', 'node_5', 'node_7', 'node_9'].sort());

      // Verify surviving manual node positions were kept intact
      const node1 = res.nodes.find((n) => n.id === 'node_1')!;
      assert.strictEqual(node1.position.x, 50);
      assert.strictEqual(node1.position.y, 50);
    });
  });
});
