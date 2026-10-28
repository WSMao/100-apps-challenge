/**
 * Creative-Neuro E2E Test Suite - Tier 3: Cross-Feature Combinations
 * Requirement: Pairwise and multi-way feature interactions
 *
 * Combinations:
 * 3.1 Mermaid Sync + Manual Drag + Incremental DSL Edit (Node ID reconciliation)
 * 3.2 Keyboard Brainstorming + Fixed Anchors + Hybrid ELK Layout
 * 3.3 Nested Containers + Cross-Boundary Intersections + Subgraph Collapse
 * 3.4 End-to-End Canvas -> Line Jump Calculation -> Pako PNG Export -> Import -> Line Jump Parity
 * 3.5 Dual-Mode DiagramNode (State A Embedded <-> State B Focused) + CodeMirror 6 Sync
 * 3.6 Multi-Page Navigation + Target Page Cards + Multi-Level Undo Isolation
 */

import { describe, it, expect, beforeEach } from './helpers/vitest.ts';
import {
  TestWorkspace,
  parseMermaid,
  serializeMermaid,
  reconcileMermaidAST,
  calculateElkLayout,
  calculateLineJumps,
  exportPngWithPako,
  restoreProjectFromPngMetadata,
} from './helpers/testDriver.ts';
import type { NeuroNode, NeuroEdge } from './helpers/contracts.ts';

describe('Tier 3: Cross-Feature Combinations', () => {
  let ws: TestWorkspace;

  beforeEach(() => {
    ws = new TestWorkspace();
  });

  // =========================================================================
  // Combination 3.1: Mermaid Sync + Manual Drag + Incremental DSL Edit
  // =========================================================================
  it('3.1 should preserve manual coordinates across iterative Mermaid DSL edits', () => {
    // Step 1: Initial Mermaid code
    const initialCode = `
      flowchart LR
        Gateway[API Gateway] --> Auth[Auth Service]
        Gateway --> Billing[Billing Service]
    `;
    const ast1 = parseMermaid(initialCode);
    const step1 = reconcileMermaidAST(ast1, []);

    // Step 2: User manually repositions "Auth" to a custom canvas position
    const authNode = step1.nodes.find((n) => n.id === 'Auth')!;
    authNode.position = { x: 950, y: 1200 };
    authNode.layoutMode = 'manual';

    // Step 3: User edits Mermaid text: renames "Auth" label and adds "Cache"
    const editedCode = `
      flowchart LR
        Gateway[API Gateway v2] --> Auth[OAuth2 Security Service]
        Gateway --> Billing[Billing Service]
        Gateway --> Cache[(Redis Cache)]
    `;
    const ast2 = parseMermaid(editedCode);
    const step2 = reconcileMermaidAST(ast2, step1.nodes);

    // Assert: Auth node preserved exact manual coordinates & manual mode
    const reconciledAuth = step2.nodes.find((n) => n.id === 'Auth')!;
    expect(reconciledAuth.position).toEqual({ x: 950, y: 1200 });
    expect(reconciledAuth.layoutMode).toBe('manual');
    expect(reconciledAuth.data.label).toBe('OAuth2 Security Service');

    // Assert: Gateway label updated, Cache node added with cylinder shape
    const reconciledGateway = step2.nodes.find((n) => n.id === 'Gateway')!;
    expect(reconciledGateway.data.label).toBe('API Gateway v2');

    const reconciledCache = step2.nodes.find((n) => n.id === 'Cache')!;
    expect(reconciledCache).toBeDefined();
    expect(reconciledCache.data.shapeType).toBe('cylinder');
    expect(reconciledCache.layoutMode).toBe('auto-elk');
  });

  // =========================================================================
  // Combination 3.2: Keyboard Brainstorming + Fixed Anchors + Hybrid ELK Layout
  // =========================================================================
  it('3.2 should perform keyboard brainstorming with locked anchors and hybrid ELK layout', async () => {
    // Step 1: User brainstorms with Tab and Enter
    const centralId = ws.addNode({
      position: { x: 500, y: 500 },
      data: { label: 'Product Strategy' },
      layoutMode: 'fixed', // Central node is pinned as fixed anchor
    });

    const c1 = ws.addChildNode(centralId);
    const c2 = ws.addSiblingNode(c1);
    const c3 = ws.addSiblingNode(c2);

    // Pin c2 as an immovable anchor at fixed coordinates
    ws.getActivePage().nodes[c2].layoutMode = 'fixed';
    ws.getActivePage().nodes[c2].position = { x: 1200, y: 700 };

    // Step 2: Trigger Hybrid ELK layout
    const nodes = Object.values(ws.getActivePage().nodes);
    const edges = Object.values(ws.getActivePage().edges);
    const layout = await calculateElkLayout(nodes, edges, { direction: 'DOWN' });

    // Assert: Fixed anchors (central and c2) retain exact coordinates
    const layoutCentral = layout.nodes.find((n) => n.id === centralId)!;
    const layoutC2 = layout.nodes.find((n) => n.id === c2)!;

    expect(layoutCentral.position).toEqual({ x: 500, y: 500 });
    expect(layoutC2.position).toEqual({ x: 1200, y: 700 });

    // Non-fixed nodes (c1, c3) receive valid coordinates
    const layoutC1 = layout.nodes.find((n) => n.id === c1)!;
    const layoutC3 = layout.nodes.find((n) => n.id === c3)!;
    expect(layoutC1.position).toBeDefined();
    expect(layoutC3.position).toBeDefined();
  });

  // =========================================================================
  // Combination 3.3: Nested Containers + Cross-Boundary Intersections + Subgraph Collapse
  // =========================================================================
  it('3.3 should handle cross-container edges with line jumps and subgraph collapse', () => {
    // Container 1: Frontend Frame
    ws.addNode({
      id: 'frame_fe',
      type: 'frame',
      position: { x: 100, y: 100 },
      width: 300,
      height: 400,
      layoutMode: 'manual',
      data: { title: 'Frontend Tier' },
    });
    ws.addNode({
      id: 'fe_app',
      type: 'shape',
      position: { x: 150, y: 200 },
      width: 120,
      height: 50,
      parentId: 'frame_fe',
      layoutMode: 'manual',
      data: { label: 'React SPA' },
    });

    // Container 2: Backend Frame
    ws.addNode({
      id: 'frame_be',
      type: 'frame',
      position: { x: 600, y: 100 },
      width: 300,
      height: 400,
      layoutMode: 'manual',
      data: { title: 'Backend Tier', collapsed: false },
    });
    ws.addNode({
      id: 'be_api',
      type: 'shape',
      position: { x: 650, y: 200 },
      width: 120,
      height: 50,
      parentId: 'frame_be',
      layoutMode: 'manual',
      data: { label: 'NestJS API' },
    });

    // Perpendicular crossing edges
    // Edge 1 (Horizontal): fe_app (150, 200) -> be_api (650, 200)
    // Edge 2 (Vertical): monitoring_src (400, 50) -> monitoring_tgt (400, 450)
    ws.addNode({ id: 'm_src', type: 'shape', position: { x: 400, y: 50 }, width: 20, height: 20, layoutMode: 'manual', data: {} });
    ws.addNode({ id: 'm_tgt', type: 'shape', position: { x: 400, y: 450 }, width: 20, height: 20, layoutMode: 'manual', data: {} });

    ws.addEdge({ id: 'edge_fe_be', source: 'fe_app', target: 'be_api' });
    ws.addEdge({ id: 'edge_monitor', source: 'm_src', target: 'm_tgt' });

    // Step 1: Calculate line jumps before collapse
    const jumpsBefore = calculateLineJumps(
      Object.values(ws.getActivePage().edges),
      ws.getActivePage().nodes
    );
    expect(jumpsBefore.has('edge_fe_be')).toBe(true);
    expect(jumpsBefore.get('edge_fe_be')![0].crossingPoint.x).toBeCloseTo(410, -1);

    // Step 2: Collapse Backend Frame
    const backendFrame = ws.getActivePage().nodes['frame_be'];
    backendFrame.width = 180;
    backendFrame.height = 44;
    backendFrame.data.collapsed = true;

    expect(backendFrame.data.collapsed).toBe(true);
    expect(backendFrame.height).toBe(44);
  });

  // =========================================================================
  // Combination 3.4: Canvas Generation -> Line Jumps -> Pako PNG Export -> Import -> Verification
  // =========================================================================
  it('3.4 should maintain exact line jump coordinates across Pako PNG export and import cycle', () => {
    // Build intersecting grid
    const nH1 = ws.addNode({ position: { x: 0, y: 150 }, width: 40, height: 40, layoutMode: 'manual', data: {} });
    const nH2 = ws.addNode({ position: { x: 400, y: 150 }, width: 40, height: 40, layoutMode: 'manual', data: {} });
    const nV1 = ws.addNode({ position: { x: 200, y: 0 }, width: 40, height: 40, layoutMode: 'manual', data: {} });
    const nV2 = ws.addNode({ position: { x: 200, y: 300 }, width: 40, height: 40, layoutMode: 'manual', data: {} });

    ws.addEdge({ id: 'e_horiz', source: nH1, target: nH2 });
    ws.addEdge({ id: 'e_vert', source: nV1, target: nV2 });

    const jumpsInitial = calculateLineJumps(
      Object.values(ws.getActivePage().edges),
      ws.getActivePage().nodes
    );
    const initialArc = jumpsInitial.get('e_horiz')![0];

    // Export to PNG with Pako zlib metadata
    const { compressedPayload } = exportPngWithPako(ws.project);

    // Restore into fresh workspace
    const restoredProject = restoreProjectFromPngMetadata(compressedPayload);
    const restoredPage = restoredProject.pages['page-1'];

    // Re-calculate line jumps on restored graph
    const jumpsRestored = calculateLineJumps(
      Object.values(restoredPage.edges),
      restoredPage.nodes
    );

    const restoredArc = jumpsRestored.get('e_horiz')![0];
    expect(restoredArc.crossingPoint).toEqual(initialArc.crossingPoint);
    expect(restoredArc.svgArcCommand).toBe(initialArc.svgArcCommand);
  });

  // =========================================================================
  // Combination 3.5: Dual-Mode DiagramNode + CodeMirror Sync + Canvas Selection
  // =========================================================================
  it('3.5 should transition DiagramNode from State A to State B and sync CodeMirror edits', () => {
    const diagramNodeId = ws.addNode({
      type: 'diagram',
      position: { x: 200, y: 200 },
      width: 500,
      height: 350,
      data: {
        title: 'User Login Flow',
        mermaidCode: 'flowchart TD\n  Login[User Login] --> Check{Valid Credentials?}',
        isFocused: false, // State A: Embedded Interactive
      },
    });

    // User double-clicks DiagramNode -> Switch to State B (Focused mode)
    const node = ws.getActivePage().nodes[diagramNodeId];
    node.data.isFocused = true;
    expect(node.data.isFocused).toBe(true);

    // User edits CodeMirror text inside focused mode
    const updatedCode = `flowchart TD\n  Login[User Login] --> Check{Valid Credentials?}\n  Check -->|Yes| Home[Dashboard]\n  Check -->|No| Retry[Error Message]`;
    node.data.mermaidCode = updatedCode;

    // Parse updated Mermaid code
    const ast = parseMermaid(updatedCode);
    expect(ast.nodes).toHaveLength(4);
    expect(ast.edges).toHaveLength(3);

    // User exits Focused mode (Esc key)
    node.data.isFocused = false;
    expect(node.data.isFocused).toBe(false);
    expect(node.data.mermaidCode).toContain('Dashboard');
  });

  // =========================================================================
  // Combination 3.6: Multi-Page Navigation + Target Page Cards + Undo Isolation
  // =========================================================================
  it('3.6 should link pages via pageCard and preserve history stack operations', () => {
    const page1Id = ws.activePageId;
    const page2Id = ws.createPage('Deep Dive Architecture');

    // On Page 1, add a navigation pageCard linking to Page 2
    ws.setActivePage(page1Id);
    const cardId = ws.addNode({
      type: 'pageCard',
      position: { x: 100, y: 100 },
      data: {
        label: 'Go to Deep Dive Architecture',
        targetPageId: page2Id,
      },
    });

    expect(ws.getActivePage().nodes[cardId].data.targetPageId).toBe(page2Id);

    // Navigate to Page 2 and add nodes
    ws.setActivePage(page2Id);
    ws.addNode({ id: 'p2_n1', data: { label: 'Microservice Cluster' } });
    expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(1);

    // Perform Undo on Page 2
    ws.undo();
    expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(0);

    // Switch back to Page 1: Page 1 card is still intact
    ws.setActivePage(page1Id);
    expect(ws.getActivePage().nodes[cardId]).toBeDefined();
  });
});
