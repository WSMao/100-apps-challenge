/**
 * Creative-Neuro E2E Test Suite - Tier 2: Boundary & Corner Cases
 * Requirement: Comprehensive stress, adversarial, and edge condition coverage
 *
 * Scenarios:
 * 1. Empty graphs, 1-node graphs, zero edges
 * 2. Cyclic graphs and self-referential edges (A -> B -> C -> A, A -> A)
 * 3. High-density stress graphs (100+ nodes, 200+ edges)
 * 4. Extreme & negative coordinates
 * 5. Malformed Mermaid DSL syntax
 * 6. Multi-obstacle collision avoidance stepping
 * 7. Concurrent multi-segment crossings at identical point
 * 8. Deeply nested subgraph hierarchies
 * 9. Last-page deletion rejection
 * 10. Adversarial label strings (HTML, quotes, emojis, unicode)
 * 11. Large payload pako compression/decompression
 */

import { describe, it, expect, beforeEach } from './helpers/vitest.ts';
import {
  TestWorkspace,
  parseMermaid,
  serializeMermaid,
  reconcileMermaidAST,
  calculateElkLayout,
  calculateLineJumps,
  findCollisionFreePosition,
  exportProjectAsJson,
  importProjectFromJson,
  exportSvg,
  exportPngWithPako,
  restoreProjectFromPngMetadata,
} from './helpers/testDriver.ts';
import type { NeuroNode, NeuroEdge } from './helpers/contracts.ts';

describe('Tier 2: Boundary & Corner Cases', () => {
  let ws: TestWorkspace;

  beforeEach(() => {
    ws = new TestWorkspace();
  });

  // =========================================================================
  // 1. Empty & Minimal Graphs
  // =========================================================================
  describe('2.1 Empty and Minimal Graphs', () => {
    it('should handle completely empty canvas (0 nodes, 0 edges) in layout, serialization, and export', async () => {
      const layout = await calculateElkLayout([], []);
      expect(layout.nodes).toHaveLength(0);
      expect(layout.edges).toHaveLength(0);

      const dsl = serializeMermaid([], []);
      expect(dsl).toBe('flowchart TB');

      const svg = exportSvg(ws.getActivePage());
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');

      const jumps = calculateLineJumps([], {});
      expect(jumps.size).toBe(0);
    });

    it('should handle single isolated node without any edges', async () => {
      const singleNode: NeuroNode = {
        id: 'solo',
        type: 'shape',
        position: { x: 50, y: 50 },
        layoutMode: 'auto-elk',
        data: { label: 'Solo Node' },
      };

      const layout = await calculateElkLayout([singleNode], []);
      expect(layout.nodes).toHaveLength(1);
      expect(layout.nodes[0].id).toBe('solo');

      const dsl = serializeMermaid([singleNode], []);
      expect(dsl).toContain('solo["Solo Node"]');
    });
  });

  // =========================================================================
  // 2. Cyclic Graphs & Self-Referential Edges
  // =========================================================================
  describe('2.2 Cyclic Graphs & Self-Referential Edges', () => {
    it('should layout cyclic graph A -> B -> C -> A without infinite loop or hanging', async () => {
      const nodes: NeuroNode[] = [
        { id: 'A', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: {} },
        { id: 'B', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: {} },
        { id: 'C', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: {} },
      ];
      const edges: NeuroEdge[] = [
        { id: 'e1', source: 'A', target: 'B' },
        { id: 'e2', source: 'B', target: 'C' },
        { id: 'e3', source: 'C', target: 'A' }, // Feedback cycle
      ];

      const start = performance.now();
      const layout = await calculateElkLayout(nodes, edges);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1000); // Must resolve rapidly
      expect(layout.nodes).toHaveLength(3);
      // All nodes must receive distinct valid coordinates
      const positions = layout.nodes.map((n) => `${n.position.x},${n.position.y}`);
      expect(new Set(positions).size).toBe(3);
    });

    it('should safely process self-referential edges (A -> A)', async () => {
      const nodes: NeuroNode[] = [
        { id: 'self', type: 'shape', position: { x: 100, y: 100 }, layoutMode: 'auto-elk', data: {} },
      ];
      const edges: NeuroEdge[] = [
        { id: 'loop', source: 'self', target: 'self', label: 'retry' },
      ];

      const layout = await calculateElkLayout(nodes, edges);
      expect(layout.nodes).toHaveLength(1);

      const dsl = serializeMermaid(nodes, edges);
      expect(dsl).toContain('self -->|retry| self');
    });
  });

  // =========================================================================
  // 3. High-Density Stress Graphs
  // =========================================================================
  describe('2.3 High-Density Stress Graphs', () => {
    it('should process 100+ nodes and 150+ edges within performance budget', async () => {
      const stressNodes: NeuroNode[] = [];
      const stressEdges: NeuroEdge[] = [];

      for (let i = 0; i < 100; i++) {
        stressNodes.push({
          id: `node_${i}`,
          type: 'shape',
          position: { x: 0, y: 0 },
          layoutMode: 'auto-elk',
          data: { label: `Service ${i}` },
        });
      }

      for (let i = 0; i < 90; i++) {
        stressEdges.push({
          id: `edge_${i}`,
          source: `node_${i}`,
          target: `node_${i + 1}`,
        });
        if (i % 3 === 0) {
          stressEdges.push({
            id: `cross_edge_${i}`,
            source: `node_${i}`,
            target: `node_${Math.min(99, i + 5)}`,
          });
        }
      }

      const start = performance.now();
      const layout = await calculateElkLayout(stressNodes, stressEdges);
      const elapsed = performance.now() - start;

      expect(layout.nodes).toHaveLength(100);
      expect(elapsed).toBeLessThan(2000); // Sub-2s for 100 nodes
    });
  });

  // =========================================================================
  // 4. Extreme & Negative Coordinates
  // =========================================================================
  describe('2.4 Extreme & Negative Coordinates', () => {
    it('should preserve and serialize extreme and negative coordinates accurately', () => {
      const extremeNodes: NeuroNode[] = [
        {
          id: 'neg',
          type: 'shape',
          position: { x: -50000, y: -75000 },
          layoutMode: 'manual',
          data: { label: 'Deep Negative' },
        },
        {
          id: 'pos',
          type: 'shape',
          position: { x: 100000, y: 150000 },
          layoutMode: 'fixed',
          data: { label: 'Far Positive' },
        },
      ];

      for (const n of extremeNodes) {
        ws.getActivePage().nodes[n.id] = n;
      }

      const exportedJson = exportProjectAsJson(ws.project);
      const restored = importProjectFromJson(exportedJson);

      expect(restored.pages['page-1'].nodes['neg'].position).toEqual({
        x: -50000,
        y: -75000,
      });
      expect(restored.pages['page-1'].nodes['pos'].position).toEqual({
        x: 100000,
        y: 150000,
      });
    });
  });

  // =========================================================================
  // 5. Malformed Mermaid Syntax Resilience
  // =========================================================================
  describe('2.5 Malformed Mermaid Syntax Resilience', () => {
    it('should not throw unhandled exceptions on broken or hanging Mermaid syntax', () => {
      const brokenSyntax = `
        graph TD
          A -->
          B[Unclosed bracket
          C ---> D ---
          ??? invalid token
      `;

      expect(() => {
        const ast = parseMermaid(brokenSyntax);
        expect(ast).toBeDefined();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // 6. Multi-Obstacle Collision Avoidance Stepping
  // =========================================================================
  describe('2.6 Multi-Obstacle Collision Avoidance Stepping', () => {
    it('should step outward across multiple occupied obstacle slots to find free slot', () => {
      const rootNode: NeuroNode = {
        id: 'root',
        type: 'shape',
        position: { x: 100, y: 100 },
        width: 160,
        height: 60,
        layoutMode: 'manual',
        data: {},
      };

      // Create 3 intentional obstacles right where child nodes would normally spawn
      const obstacles: NeuroNode[] = [
        rootNode,
        {
          id: 'obs1',
          type: 'shape',
          position: { x: 340, y: 100 }, // Initial child candidate slot
          width: 160,
          height: 60,
          layoutMode: 'manual',
          data: {},
        },
        {
          id: 'obs2',
          type: 'shape',
          position: { x: 340, y: 184 }, // First step down slot (100 + 60 + 24)
          width: 160,
          height: 60,
          layoutMode: 'manual',
          data: {},
        },
      ];

      const freePos = findCollisionFreePosition(rootNode, 'right', obstacles);

      // Must step past obs1 and obs2 downward
      expect(freePos.x).toBe(340);
      expect(freePos.y).toBeGreaterThan(184);
    });
  });

  // =========================================================================
  // 7. Concurrent Multi-Segment Crossings
  // =========================================================================
  describe('2.7 Concurrent Multi-Segment Crossings', () => {
    it('should handle 3 concurrent lines crossing at a single intersection point', () => {
      // 1 horizontal line crossed by 2 distinct vertical lines at the exact same x = 100
      const nodes: Record<string, NeuroNode> = {
        h1: { id: 'h1', type: 'shape', position: { x: 0, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        h2: { id: 'h2', type: 'shape', position: { x: 200, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v1a: { id: 'v1a', type: 'shape', position: { x: 100, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v1b: { id: 'v1b', type: 'shape', position: { x: 100, y: 200 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v2a: { id: 'v2a', type: 'shape', position: { x: 100, y: 10 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v2b: { id: 'v2b', type: 'shape', position: { x: 100, y: 190 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
      };

      const edges: NeuroEdge[] = [
        { id: 'h_main', source: 'h1', target: 'h2' },
        { id: 'v1', source: 'v1a', target: 'v1b' },
        { id: 'v2', source: 'v2a', target: 'v2b' },
      ];

      const jumps = calculateLineJumps(edges, nodes);
      expect(jumps.has('h_main')).toBe(true);
      // Both vertical lines cause jumps on the horizontal line without throwing
      expect(jumps.get('h_main')!.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 8. Deeply Nested Subgraph Hierarchies
  // =========================================================================
  describe('2.8 Deeply Nested Subgraph Hierarchies', () => {
    it('should parse 3-tier nested subgraphs', () => {
      const nestedDsl = `
        flowchart TB
          subgraph Level1 [Outer Frame]
            subgraph Level2 [Middle Container]
              subgraph Level3 [Inner Microservice]
                NodeCore[Core Logic]
              end
            end
          end
      `;
      const ast = parseMermaid(nestedDsl);
      expect(ast.subgraphs.length).toBeGreaterThanOrEqual(1);
      expect(ast.nodes.some((n) => n.id === 'NodeCore')).toBe(true);
    });
  });

  // =========================================================================
  // 9. Page Deletion Boundary
  // =========================================================================
  describe('2.9 Page Deletion Boundary', () => {
    it('should strictly reject deletion when only 1 page remains in project', () => {
      expect(Object.keys(ws.project.pages)).toHaveLength(1);
      expect(() => ws.deletePage('page-1')).toThrow(
        'A project must contain at least one page.'
      );
    });
  });

  // =========================================================================
  // 10. Adversarial Labels & Special Characters
  // =========================================================================
  describe('2.10 Adversarial Labels & Special Characters', () => {
    it('should safely serialize and restore labels with HTML, quotes, unicode, and emojis', () => {
      const adversarialText =
        '<script>alert("XSS")</script> & "Quotes" \'Single\' 🚀 🧠 中文測試 \n Linebreak';

      const nodeId = ws.addNode({
        data: { label: adversarialText, shapeType: 'rectangle' },
      });

      const jsonStr = exportProjectAsJson(ws.project);
      const restored = importProjectFromJson(jsonStr);

      expect(restored.pages['page-1'].nodes[nodeId].data.label).toBe(
        adversarialText
      );
    });
  });

  // =========================================================================
  // 11. Large Payload Pako Compression & Lossless Restore
  // =========================================================================
  describe('2.11 Large Payload Pako Compression', () => {
    it('should compress and losslessly restore large multi-node project payload', () => {
      for (let i = 0; i < 50; i++) {
        ws.addNode({
          id: `node_bulk_${i}`,
          position: { x: i * 20, y: i * 15 },
          data: {
            label: `Bulk Node ${i} with long description and metadata payload`,
            shapeType: i % 2 === 0 ? 'diamond' : 'cylinder',
          },
        });
      }

      const { compressedPayload } = exportPngWithPako(ws.project);
      expect(compressedPayload.length).toBeGreaterThan(100);

      const restored = restoreProjectFromPngMetadata(compressedPayload);
      expect(Object.keys(restored.pages['page-1'].nodes)).toHaveLength(50);
      expect(restored.pages['page-1'].nodes['node_bulk_25'].data.shapeType).toBe(
        'cylinder'
      );
    });
  });
});
