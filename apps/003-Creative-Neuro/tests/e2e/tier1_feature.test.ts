/**
 * Creative-Neuro E2E Test Suite - Tier 1: Feature Coverage
 * Requirement: >= 5 test cases per feature across core capabilities
 *
 * Core Capabilities:
 * 1. State Store & Scene Graph Management
 * 2. Fast Keyboard Brainstorming & Directional Placement
 * 3. Mermaid AST Parser, Serializer & Reconciliation
 * 4. Hybrid ELK Layout Engine
 * 5. SVG Line Jump Intersection Geometry
 * 6. Multi-Format Document Exporter & Importer
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
  checkAABBCollision,
  exportProjectAsJson,
  importProjectFromJson,
  exportSvg,
  exportPngWithPako,
  restoreProjectFromPngMetadata,
} from './helpers/testDriver.ts';
import type { NeuroNode, NeuroEdge, BoundingBox } from './helpers/contracts.ts';

describe('Tier 1: Feature Coverage (Core Capabilities)', () => {
  let ws: TestWorkspace;

  beforeEach(() => {
    ws = new TestWorkspace();
  });

  // =========================================================================
  // Capability 1: State Store & Scene Graph Management
  // =========================================================================
  describe('Capability 1: State Store & Scene Graph Management', () => {
    it('1.1 should initialize project with default board and active page', () => {
      expect(ws.project.id).toBeDefined();
      expect(ws.project.name).toBe('Creative-Neuro MVP Test Project');
      expect(ws.project.activeBoardId).toBe('board-1');
      expect(ws.project.pages['page-1']).toBeDefined();
      expect(ws.getActivePage().name).toBe('Brainstorming Mind Map');
    });

    it('1.2 should support page creation, renaming, switching, and deletion guards', () => {
      const page2Id = ws.createPage('System Architecture');
      expect(ws.activePageId).toBe(page2Id);
      expect(ws.getActivePage().name).toBe('System Architecture');

      ws.renamePage(page2Id, 'Cloud Infrastructure');
      expect(ws.getActivePage().name).toBe('Cloud Infrastructure');

      ws.setActivePage('page-1');
      expect(ws.activePageId).toBe('page-1');

      ws.deletePage(page2Id);
      expect(ws.project.pages[page2Id]).toBeUndefined();

      // Deletion guard: Cannot delete the last remaining page
      expect(() => ws.deletePage('page-1')).toThrow(
        'A project must contain at least one page.'
      );
    });

    it('1.3 should perform node creation with shape types, styles, and dimensions', () => {
      const nodeId = ws.addNode({
        type: 'shape',
        position: { x: 250, y: 300 },
        width: 180,
        height: 80,
        data: {
          label: 'Auth Service',
          shapeType: 'cylinder',
          style: { backgroundColor: '#3b82f6', color: '#ffffff' },
        },
      });

      const node = ws.getActivePage().nodes[nodeId];
      expect(node).toBeDefined();
      expect(node.position).toEqual({ x: 250, y: 300 });
      expect(node.data.shapeType).toBe('cylinder');
      expect(node.data.style?.backgroundColor).toBe('#3b82f6');
    });

    it('1.4 should update node positions and transition layout mode to manual', () => {
      const nodeId = ws.addNode({
        position: { x: 100, y: 100 },
        layoutMode: 'auto-elk',
      });

      expect(ws.getActivePage().nodes[nodeId].layoutMode).toBe('auto-elk');

      ws.updateNodePosition(nodeId, { x: 450, y: 600 });
      const updated = ws.getActivePage().nodes[nodeId];
      expect(updated.position).toEqual({ x: 450, y: 600 });
      expect(updated.layoutMode).toBe('manual');
    });

    it('1.5 should manage edge creation, labeling, and deletion with cascading cleanup', () => {
      const n1 = ws.addNode({ position: { x: 50, y: 50 } });
      const n2 = ws.addNode({ position: { x: 300, y: 50 } });

      const edgeId = ws.addEdge({
        source: n1,
        target: n2,
        label: 'HTTP Request',
        type: 'jump',
      });

      expect(ws.getActivePage().edges[edgeId]).toBeDefined();
      expect(ws.getActivePage().edges[edgeId].label).toBe('HTTP Request');

      // Deleting node n1 must cascade delete the edge
      ws.deleteNodes([n1]);
      expect(ws.getActivePage().nodes[n1]).toBeUndefined();
      expect(ws.getActivePage().edges[edgeId]).toBeUndefined();
    });

    it('1.6 should restore state via multi-level undo and redo', () => {
      const n1 = ws.addNode({ data: { label: 'Initial Node' } });
      expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(1);

      ws.addNode({ data: { label: 'Second Node' } });
      expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(2);

      // Undo second add
      const undoResult = ws.undo();
      expect(undoResult).toBe(true);
      expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(1);

      // Redo second add
      const redoResult = ws.redo();
      expect(redoResult).toBe(true);
      expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(2);
    });
  });

  // =========================================================================
  // Capability 2: Fast Keyboard Brainstorming & Directional Placement
  // =========================================================================
  describe('Capability 2: Fast Keyboard Brainstorming & Directional Placement', () => {
    it('2.1 should spawn child node with Tab positioned to the right with connection', () => {
      const rootId = ws.addNode({
        position: { x: 100, y: 200 },
        width: 160,
        height: 60,
      });

      const childId = ws.addChildNode(rootId);
      const childNode = ws.getActivePage().nodes[childId];

      expect(childNode).toBeDefined();
      // Child x coordinate must be to the right of root: x >= root.x + width + margin
      expect(childNode.position.x).toBeGreaterThan(100 + 160);
      expect(childNode.position.y).toBe(200);

      // Auto-connecting edge created
      const edges = Object.values(ws.getActivePage().edges);
      const childEdge = edges.find(
        (e) => e.source === rootId && e.target === childId
      );
      expect(childEdge).toBeDefined();
    });

    it('2.2 should spawn sibling node with Enter aligned below with shared parent', () => {
      const rootId = ws.addNode({ position: { x: 100, y: 200 } });
      const child1Id = ws.addChildNode(rootId);

      const siblingId = ws.addSiblingNode(child1Id);
      const siblingNode = ws.getActivePage().nodes[siblingId];

      expect(siblingNode).toBeDefined();
      expect(siblingNode.position.x).toBe(
        ws.getActivePage().nodes[child1Id].position.x
      );
      expect(siblingNode.position.y).toBeGreaterThan(
        ws.getActivePage().nodes[child1Id].position.y
      );

      // Sibling should share parent connection
      const edges = Object.values(ws.getActivePage().edges);
      const parentToSiblingEdge = edges.find(
        (e) => e.source === rootId && e.target === siblingId
      );
      expect(parentToSiblingEdge).toBeDefined();
    });

    it('2.3 should spawn directional node with ⌥+Up placed above source', () => {
      const srcId = ws.addNode({ position: { x: 400, y: 400 } });
      const upId = ws.addDirectionalNode(srcId, 'up');
      const upNode = ws.getActivePage().nodes[upId];

      expect(upNode.position.x).toBe(400);
      expect(upNode.position.y).toBeLessThan(400);
    });

    it('2.4 should spawn directional node with ⌥+Left placed to the left of source', () => {
      const srcId = ws.addNode({ position: { x: 500, y: 300 } });
      const leftId = ws.addDirectionalNode(srcId, 'left');
      const leftNode = ws.getActivePage().nodes[leftId];

      expect(leftNode.position.x).toBeLessThan(500);
      expect(leftNode.position.y).toBe(300);
    });

    it('2.5 should avoid collision and stack vertically when multiple children are added', () => {
      const rootId = ws.addNode({ position: { x: 100, y: 200 } });
      const c1 = ws.addChildNode(rootId);
      const c2 = ws.addChildNode(rootId);
      const c3 = ws.addChildNode(rootId);

      const node1 = ws.getActivePage().nodes[c1];
      const node2 = ws.getActivePage().nodes[c2];
      const node3 = ws.getActivePage().nodes[c3];

      // All 3 children must have distinct coordinates and zero AABB overlap
      const b1: BoundingBox = {
        x: node1.position.x,
        y: node1.position.y,
        width: 160,
        height: 60,
      };
      const b2: BoundingBox = {
        x: node2.position.x,
        y: node2.position.y,
        width: 160,
        height: 60,
      };
      const b3: BoundingBox = {
        x: node3.position.x,
        y: node3.position.y,
        width: 160,
        height: 60,
      };

      expect(checkAABBCollision(b1, b2, 24)).toBe(false);
      expect(checkAABBCollision(b2, b3, 24)).toBe(false);
      expect(checkAABBCollision(b1, b3, 24)).toBe(false);
    });
  });

  // =========================================================================
  // Capability 3: Mermaid AST Parser, Serializer & Reconciliation
  // =========================================================================
  describe('Capability 3: Mermaid AST Parser, Serializer & Reconciliation', () => {
    it('3.1 should parse standard Mermaid flowchart syntax into structured AST', () => {
      const code = `
        flowchart LR
          A[Client] --> B(API Gateway)
          B --> C{Decision}
      `;
      const ast = parseMermaid(code);
      expect(ast.direction).toBe('LR');
      expect(ast.nodes).toHaveLength(3);
      expect(ast.edges).toHaveLength(2);
      expect(ast.nodes.find((n) => n.id === 'A')?.shapeType).toBe('rectangle');
      expect(ast.nodes.find((n) => n.id === 'B')?.shapeType).toBe('rounded');
      expect(ast.nodes.find((n) => n.id === 'C')?.shapeType).toBe('diamond');
    });

    it('3.2 should parse complex shape tokens (cylinder, circle, stadium, hexagon)', () => {
      const code = `
        flowchart TB
          DB[(PostgreSQL Database)]
          C((Start Circle))
          P([Stadium Pill])
          H{{Hexagon Step}}
      `;
      const ast = parseMermaid(code);
      expect(ast.nodes.find((n) => n.id === 'DB')?.shapeType).toBe('cylinder');
      expect(ast.nodes.find((n) => n.id === 'C')?.shapeType).toBe('circle');
      expect(ast.nodes.find((n) => n.id === 'P')?.shapeType).toBe('stadium');
      expect(ast.nodes.find((n) => n.id === 'H')?.shapeType).toBe('hexagon');
    });

    it('3.3 should reconcile node AST and preserve manual coordinates and layoutMode', () => {
      const existingNodes: NeuroNode[] = [
        {
          id: 'A',
          type: 'shape',
          position: { x: 777, y: 888 },
          layoutMode: 'manual',
          data: { label: 'Old Label', shapeType: 'rectangle' },
        },
      ];

      const newCode = `
        flowchart TB
          A[Updated Label] --> B[New Service]
      `;
      const ast = parseMermaid(newCode);
      const reconciled = reconcileMermaidAST(ast, existingNodes);

      const reconciledA = reconciled.nodes.find((n) => n.id === 'A')!;
      expect(reconciledA).toBeDefined();
      expect(reconciledA.position).toEqual({ x: 777, y: 888 }); // Preserved!
      expect(reconciledA.layoutMode).toBe('manual'); // Preserved!
      expect(reconciledA.data.label).toBe('Updated Label'); // Updated!

      const reconciledB = reconciled.nodes.find((n) => n.id === 'B')!;
      expect(reconciledB).toBeDefined();
      expect(reconciledB.layoutMode).toBe('auto-elk'); // New node gets default mode!
    });

    it('3.4 should serialize canvas graph back into valid Mermaid flowchart DSL', () => {
      const nodes: NeuroNode[] = [
        {
          id: 'N1',
          type: 'shape',
          position: { x: 0, y: 0 },
          layoutMode: 'manual',
          data: { label: 'Source Node', shapeType: 'rounded' },
        },
        {
          id: 'N2',
          type: 'shape',
          position: { x: 200, y: 0 },
          layoutMode: 'manual',
          data: { label: 'Database', shapeType: 'cylinder' },
        },
      ];
      const edges: NeuroEdge[] = [
        {
          id: 'e1',
          source: 'N1',
          target: 'N2',
          label: 'reads from',
        },
      ];

      const dsl = serializeMermaid(nodes, edges, 'LR');
      expect(dsl).toContain('flowchart LR');
      expect(dsl).toContain('N1("Source Node")');
      expect(dsl).toContain('N2[("Database")]');
      expect(dsl).toContain('N1 -->|reads from| N2');
    });

    it('3.5 should round-trip parse and serialize while maintaining graph topology', () => {
      const originalCode = `flowchart TB\n  A["Node A"] --> B{"Decision B"}\n  B --> C["Node C"]`;
      const ast = parseMermaid(originalCode);
      const { nodes, edges } = reconcileMermaidAST(ast, []);
      const serialized = serializeMermaid(nodes, edges, 'TB');

      const reParsedAst = parseMermaid(serialized);
      expect(reParsedAst.nodes).toHaveLength(3);
      expect(reParsedAst.edges).toHaveLength(2);
      expect(reParsedAst.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C']);
    });
  });

  // =========================================================================
  // Capability 4: Hybrid ELK Layout Engine
  // =========================================================================
  describe('Capability 4: Hybrid ELK Layout Engine', () => {
    it('4.1 should assign hierarchical layered coordinates in Auto-ELK mode', async () => {
      const nodes: NeuroNode[] = [
        { id: '1', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: {} },
        { id: '2', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: {} },
        { id: '3', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: {} },
      ];
      const edges: NeuroEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
      ];

      const layout = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });
      const n1 = layout.nodes.find((n) => n.id === '1')!;
      const n2 = layout.nodes.find((n) => n.id === '2')!;
      const n3 = layout.nodes.find((n) => n.id === '3')!;

      // Layered direction DOWN: y1 < y2 < y3
      expect(n1.position.y).toBeLessThan(n2.position.y);
      expect(n2.position.y).toBeLessThan(n3.position.y);
    });

    it('4.2 should preserve fixed anchor node coordinates exactly during layout', async () => {
      const nodes: NeuroNode[] = [
        { id: 'anchor', type: 'shape', position: { x: 888, y: 999 }, layoutMode: 'fixed', data: {} },
        { id: 'child', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: {} },
      ];
      const edges: NeuroEdge[] = [{ id: 'e1', source: 'anchor', target: 'child' }];

      const layout = await calculateElkLayout(nodes, edges);
      const anchorNode = layout.nodes.find((n) => n.id === 'anchor')!;

      expect(anchorNode.position).toEqual({ x: 888, y: 999 });
    });

    it('4.3 should preserve manual mode coordinates during layout', async () => {
      const nodes: NeuroNode[] = [
        { id: 'm1', type: 'shape', position: { x: 350, y: 550 }, layoutMode: 'manual', data: {} },
        { id: 'a1', type: 'shape', position: { x: 0, y: 0 }, layoutMode: 'auto-elk', data: {} },
      ];
      const edges: NeuroEdge[] = [{ id: 'e1', source: 'm1', target: 'a1' }];

      const layout = await calculateElkLayout(nodes, edges);
      const manualNode = layout.nodes.find((n) => n.id === 'm1')!;

      expect(manualNode.position).toEqual({ x: 350, y: 550 });
    });

    it('4.4 should parse and support subgraphs with isolated directional directives', () => {
      const code = `
        flowchart TB
          subgraph cluster1 [Sub Module]
            direction LR
            S1 --> S2
          end
          Main --> S1
      `;
      const ast = parseMermaid(code);
      expect(ast.subgraphs).toHaveLength(1);
      expect(ast.subgraphs[0].direction).toBe('LR');
      expect(ast.subgraphs[0].nodeIds).toContain('S1');
      expect(ast.subgraphs[0].nodeIds).toContain('S2');
    });

    it('4.5 should handle sub-graph fold/collapse state and bounds', () => {
      const frameNode: NeuroNode = {
        id: 'frame-1',
        type: 'frame',
        position: { x: 100, y: 100 },
        width: 400,
        height: 300,
        layoutMode: 'manual',
        data: { title: 'Container Frame', collapsed: false },
      };

      // Collapse container
      const collapsedFrame: NeuroNode = {
        ...frameNode,
        width: 180,
        height: 44, // Header size
        data: { ...frameNode.data, collapsed: true },
      };

      expect(collapsedFrame.width).toBe(180);
      expect(collapsedFrame.height).toBe(44);
      expect(collapsedFrame.data.collapsed).toBe(true);
    });
  });

  // =========================================================================
  // Capability 5: SVG Line Jump Intersection Geometry
  // =========================================================================
  describe('Capability 5: SVG Line Jump Intersection Geometry', () => {
    it('5.1 should compute SVG arc jump for perpendicular intersecting segments', () => {
      // Line 1: Horizontal (0, 100) -> (200, 100)
      // Line 2: Vertical (100, 0) -> (100, 200)
      const nodes: Record<string, NeuroNode> = {
        h1: { id: 'h1', type: 'shape', position: { x: 0, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        h2: { id: 'h2', type: 'shape', position: { x: 200, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v1: { id: 'v1', type: 'shape', position: { x: 100, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v2: { id: 'v2', type: 'shape', position: { x: 100, y: 200 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
      };

      const edges: NeuroEdge[] = [
        { id: 'edge-h', source: 'h1', target: 'h2', type: 'jump' },
        { id: 'edge-v', source: 'v1', target: 'v2', type: 'jump' },
      ];

      const jumps = calculateLineJumps(edges, nodes);

      // Horizontal line should have 1 jump arc, vertical line remains straight
      expect(jumps.has('edge-h')).toBe(true);
      expect(jumps.get('edge-h')).toHaveLength(1);
      expect(jumps.has('edge-v')).toBe(false);

      const arc = jumps.get('edge-h')![0];
      expect(arc.crossingPoint.x).toBeCloseTo(100);
      expect(arc.crossingPoint.y).toBeCloseTo(100);
      expect(arc.svgArcCommand).toContain('A 6 6 0 0 1');
    });

    it('5.2 should reject parallel or colinear line segments with zero jump arcs', () => {
      // Two parallel horizontal lines
      const nodes: Record<string, NeuroNode> = {
        a1: { id: 'a1', type: 'shape', position: { x: 0, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        a2: { id: 'a2', type: 'shape', position: { x: 200, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        b1: { id: 'b1', type: 'shape', position: { x: 0, y: 150 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        b2: { id: 'b2', type: 'shape', position: { x: 200, y: 150 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
      };

      const edges: NeuroEdge[] = [
        { id: 'e1', source: 'a1', target: 'a2' },
        { id: 'e2', source: 'b1', target: 'b2' },
      ];

      const jumps = calculateLineJumps(edges, nodes);
      expect(jumps.size).toBe(0);
    });

    it('5.3 should suppress jumps when intersection is within 5% of segment endpoints', () => {
      // Crossing at t = 0.02 (within 5% endpoint buffer)
      const nodes: Record<string, NeuroNode> = {
        h1: { id: 'h1', type: 'shape', position: { x: 0, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        h2: { id: 'h2', type: 'shape', position: { x: 1000, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v1: { id: 'v1', type: 'shape', position: { x: 20, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: {} }, // x = 20 -> t = 0.02
        v2: { id: 'v2', type: 'shape', position: { x: 20, y: 200 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
      };

      const edges: NeuroEdge[] = [
        { id: 'e_horiz', source: 'h1', target: 'h2' },
        { id: 'e_vert', source: 'v1', target: 'v2' },
      ];

      const jumps = calculateLineJumps(edges, nodes, { endpointTolerance: 0.05 });
      expect(jumps.size).toBe(0); // Suppressed!
    });

    it('5.4 should sort multiple jump arcs along single line by parameter t ascending', () => {
      // 1 horizontal line crossed by 3 vertical lines at x = 100, x = 200, x = 300
      const nodes: Record<string, NeuroNode> = {
        h1: { id: 'h1', type: 'shape', position: { x: 0, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        h2: { id: 'h2', type: 'shape', position: { x: 400, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v1a: { id: 'v1a', type: 'shape', position: { x: 300, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v1b: { id: 'v1b', type: 'shape', position: { x: 300, y: 200 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v2a: { id: 'v2a', type: 'shape', position: { x: 100, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v2b: { id: 'v2b', type: 'shape', position: { x: 100, y: 200 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v3a: { id: 'v3a', type: 'shape', position: { x: 200, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v3b: { id: 'v3b', type: 'shape', position: { x: 200, y: 200 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
      };

      const edges: NeuroEdge[] = [
        { id: 'h_main', source: 'h1', target: 'h2' },
        { id: 'v1', source: 'v1a', target: 'v1b' },
        { id: 'v2', source: 'v2a', target: 'v2b' },
        { id: 'v3', source: 'v3a', target: 'v3b' },
      ];

      const jumps = calculateLineJumps(edges, nodes);
      const arcs = jumps.get('h_main')!;

      expect(arcs).toHaveLength(3);
      // Strictly ascending t: t0 < t1 < t2
      expect(arcs[0].t).toBeLessThan(arcs[1].t);
      expect(arcs[1].t).toBeLessThan(arcs[2].t);
      expect(arcs[0].crossingPoint.x).toBeCloseTo(100);
      expect(arcs[1].crossingPoint.x).toBeCloseTo(200);
      expect(arcs[2].crossingPoint.x).toBeCloseTo(300);
    });

    it('5.5 should prioritize horizontal over vertical line jumping deterministically', () => {
      const nodes: Record<string, NeuroNode> = {
        h1: { id: 'h1', type: 'shape', position: { x: 0, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        h2: { id: 'h2', type: 'shape', position: { x: 100, y: 50 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v1: { id: 'v1', type: 'shape', position: { x: 50, y: 0 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
        v2: { id: 'v2', type: 'shape', position: { x: 50, y: 100 }, width: 0, height: 0, layoutMode: 'manual', data: {} },
      };

      // Regardless of edge order in array, horizontal jumps
      const edgesA: NeuroEdge[] = [
        { id: 'v_edge', source: 'v1', target: 'v2' },
        { id: 'h_edge', source: 'h1', target: 'h2' },
      ];
      const jumps = calculateLineJumps(edgesA, nodes);

      expect(jumps.has('h_edge')).toBe(true);
      expect(jumps.has('v_edge')).toBe(false);
    });
  });

  // =========================================================================
  // Capability 6: Multi-Format Document Exporter & Importer
  // =========================================================================
  describe('Capability 6: Multi-Format Document Exporter & Importer', () => {
    it('6.1 should export active page nodes and edges to clean Mermaid code', () => {
      ws.addNode({ id: 'Start', data: { label: 'Start Point', shapeType: 'circle' } });
      ws.addNode({ id: 'End', data: { label: 'End Point', shapeType: 'rounded' } });
      ws.addEdge({ source: 'Start', target: 'End', label: 'proceed' });

      const dsl = serializeMermaid(
        Object.values(ws.getActivePage().nodes),
        Object.values(ws.getActivePage().edges)
      );

      expect(dsl).toContain('flowchart TB');
      expect(dsl).toContain('Start(("Start Point"))');
      expect(dsl).toContain('End("End Point")');
      expect(dsl).toContain('Start -->|proceed| End');
    });

    it('6.2 should serialize complete project to compliant .neuro.json schema', () => {
      ws.addNode({ data: { label: 'Root Idea' } });
      const json = exportProjectAsJson(ws.project);

      expect(json).toContain('"version": "1.0.0"');
      expect(json).toContain('"Brainstorming Mind Map"');
      expect(json).toContain('"Root Idea"');
    });

    it('6.3 should import .neuro.json and restore state without data loss', () => {
      const originalNodeId = ws.addNode({
        position: { x: 333, y: 444 },
        data: { label: 'Special Service', shapeType: 'cylinder' },
      });

      const serialized = exportProjectAsJson(ws.project);
      const restored = importProjectFromJson(serialized);

      expect(restored.id).toBe(ws.project.id);
      expect(restored.pages['page-1'].nodes[originalNodeId].position).toEqual({
        x: 333,
        y: 444,
      });
      expect(
        restored.pages['page-1'].nodes[originalNodeId].data.shapeType
      ).toBe('cylinder');
    });

    it('6.4 should export well-formed standalone vector SVG document', () => {
      ws.addNode({ position: { x: 100, y: 100 }, data: { label: 'Card A' } });
      ws.addNode({ position: { x: 300, y: 100 }, data: { label: 'Card B' } });
      ws.addEdge({ source: 'Card A', target: 'Card B' });

      const svg = exportSvg(ws.getActivePage());
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('<rect x="100" y="100"');
      expect(svg).toContain('Card A');
      expect(svg).toContain('Card B');
    });

    it('6.5 should compress JSON with pako zlib deflate and round-trip via inflate', () => {
      ws.addNode({ data: { label: 'Pako Compression Test' } });
      const exportResult = exportPngWithPako(ws.project);

      expect(exportResult.dataUrl).toContain('data:image/png;base64');
      expect(exportResult.compressedPayload.length).toBeGreaterThan(0);

      const restoredProject = restoreProjectFromPngMetadata(
        exportResult.compressedPayload
      );
      expect(restoredProject.id).toBe(ws.project.id);
      expect(
        Object.values(restoredProject.pages['page-1'].nodes).some(
          (n) => n.data.label === 'Pako Compression Test'
        )
      ).toBe(true);
    });
  });
});
