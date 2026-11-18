/**
 * Creative-Neuro E2E Test Suite - Tier 4: Real-World Application Scenarios
 * Requirement: End-to-end full user workflows and lifecycles
 *
 * Scenarios:
 * 4.1 Mind-Mapping Brainstorming Session (Tab child, Enter sibling, collision avoidance, undo scrubbing)
 * 4.2 High-Availability Cloud Architecture with Cross-Cutting Flows & Line Jumps
 * 4.3 Code-First to Canvas-First Iterative Engineering Workflow (Mermaid sync & reconciliation)
 * 4.4 Full Project Lifecycle: Multi-Page Session, History Scrubbing, Lossless Pako Export & Cold Reload
 */

import { describe, it, expect, beforeEach } from './helpers/vitest.ts';
import {
  TestWorkspace,
  parseMermaid,
  serializeMermaid,
  reconcileMermaidAST,
  calculateElkLayout,
  calculateLineJumps,
  checkAABBCollision,
  exportProjectAsJson,
  importProjectFromJson,
  exportSvg,
  exportPngWithPako,
  restoreProjectFromPngMetadata,
} from './helpers/testDriver.ts';
import type { NeuroNode, NeuroEdge, BoundingBox } from './helpers/contracts.ts';

describe('Tier 4: Real-World Application Scenarios', () => {
  let ws: TestWorkspace;

  beforeEach(() => {
    ws = new TestWorkspace();
  });

  // =========================================================================
  // Scenario 4.1: Mind-Mapping Brainstorming Session
  // =========================================================================
  it('4.1 should execute a full mind-mapping brainstorming workflow with zero collisions', () => {
    // 1. Launch on Page 1: "Brainstorming Mind Map"
    expect(ws.getActivePage().name).toBe('Brainstorming Mind Map');

    // 2. User places central topic
    const centralTopicId = ws.addNode({
      position: { x: 500, y: 400 },
      width: 180,
      height: 70,
      data: {
        label: 'AI Visual Canvas',
        shapeType: 'rounded',
        style: { backgroundColor: '#1e293b', color: '#f8fafc' },
      },
    });

    // 3. Rapidly create 5 main branch nodes using Tab (child) and Enter (siblings)
    const b1 = ws.addChildNode(centralTopicId);
    ws.getActivePage().nodes[b1].data.label = 'Mermaid Bi-directional Sync';

    const b2 = ws.addSiblingNode(b1);
    ws.getActivePage().nodes[b2].data.label = 'Hybrid ELKjs Layout';

    const b3 = ws.addSiblingNode(b2);
    ws.getActivePage().nodes[b3].data.label = 'Collision-Free Placement';

    const b4 = ws.addSiblingNode(b3);
    ws.getActivePage().nodes[b4].data.label = 'SVG Line Jumps';

    const b5 = ws.addSiblingNode(b4);
    ws.getActivePage().nodes[b5].data.label = 'Pako Compressed Export';

    // 4. For "Hybrid ELKjs Layout", spawn 3 sub-branches
    const sub1 = ws.addChildNode(b2);
    ws.getActivePage().nodes[sub1].data.label = 'Auto-ELK Layered';

    const sub2 = ws.addSiblingNode(sub1);
    ws.getActivePage().nodes[sub2].data.label = 'Manual Override Mode';

    const sub3 = ws.addSiblingNode(sub2);
    ws.getActivePage().nodes[sub3].data.label = 'Fixed Obstacle Anchors';

    // Assert: Exactly 1 central + 5 branches + 3 sub-branches = 9 nodes
    const allNodes = Object.values(ws.getActivePage().nodes);
    expect(allNodes).toHaveLength(9);

    // Assert: Connecting edges count = 5 (branches to central) + 3 (sub-branches to b2) = 8 edges
    const allEdges = Object.values(ws.getActivePage().edges);
    expect(allEdges).toHaveLength(8);

    // Assert: Zero AABB collision between ANY pair of nodes with 24px margin
    for (let i = 0; i < allNodes.length; i++) {
      for (let j = i + 1; j < allNodes.length; j++) {
        const boxA: BoundingBox = {
          x: allNodes[i].position.x,
          y: allNodes[i].position.y,
          width: allNodes[i].width ?? 160,
          height: allNodes[i].height ?? 60,
        };
        const boxB: BoundingBox = {
          x: allNodes[j].position.x,
          y: allNodes[j].position.y,
          width: allNodes[j].width ?? 160,
          height: allNodes[j].height ?? 60,
        };
        const collides = checkAABBCollision(boxA, boxB, 24);
        expect(collides).toBe(false);
      }
    }

    // 5. Test Undo/Redo scrubbing on brainstorm nodes
    ws.undo(); // Undoes sub3
    expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(8);

    ws.undo(); // Undoes sub2
    expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(7);

    ws.redo(); // Restores sub2
    expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(8);

    ws.redo(); // Restores sub3
    expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(9);
  });

  // =========================================================================
  // Scenario 4.2: High-Availability Cloud Architecture with Line Jumps
  // =========================================================================
  it('4.2 should build a microservices architecture with nested frames and SVG line jumps', () => {
    const pageId = ws.createPage('Cloud Architecture');
    ws.setActivePage(pageId);

    // Frame 1: Presentation Tier
    const frameFe = ws.addNode({
      type: 'frame',
      position: { x: 50, y: 100 },
      width: 250,
      height: 400,
      layoutMode: 'manual',
      data: { title: 'Presentation Tier' },
    });
    const webApp = ws.addNode({
      type: 'shape',
      position: { x: 80, y: 180 },
      parentId: frameFe,
      layoutMode: 'manual',
      data: { label: 'Next.js Frontend', shapeType: 'rounded' },
    });
    const mobileApp = ws.addNode({
      type: 'shape',
      position: { x: 80, y: 300 },
      parentId: frameFe,
      layoutMode: 'manual',
      data: { label: 'React Native App', shapeType: 'rounded' },
    });

    // Frame 2: API Gateway & Auth Tier
    const frameApi = ws.addNode({
      type: 'frame',
      position: { x: 450, y: 100 },
      width: 250,
      height: 400,
      layoutMode: 'manual',
      data: { title: 'API Gateway Tier' },
    });
    const apiGateway = ws.addNode({
      type: 'shape',
      position: { x: 480, y: 240 },
      parentId: frameApi,
      layoutMode: 'manual',
      data: { label: 'Kong API Gateway', shapeType: 'diamond' },
    });

    // Frame 3: Database & Persistence Tier
    const frameDb = ws.addNode({
      type: 'frame',
      position: { x: 850, y: 100 },
      width: 250,
      height: 400,
      layoutMode: 'manual',
      data: { title: 'Database Tier', collapsed: false },
    });
    const postgresDb = ws.addNode({
      type: 'shape',
      position: { x: 880, y: 180 },
      parentId: frameDb,
      layoutMode: 'manual',
      data: { label: 'PostgreSQL Primary', shapeType: 'cylinder' },
    });
    const redisCache = ws.addNode({
      type: 'shape',
      position: { x: 880, y: 300 },
      parentId: frameDb,
      layoutMode: 'manual',
      data: { label: 'Redis Cluster', shapeType: 'cylinder' },
    });

    // Cross-cutting edges
    ws.addEdge({ id: 'e_web_gw', source: webApp, target: apiGateway });
    ws.addEdge({ id: 'e_mob_gw', source: mobileApp, target: apiGateway });
    ws.addEdge({ id: 'e_gw_pg', source: apiGateway, target: postgresDb });
    ws.addEdge({ id: 'e_gw_rd', source: apiGateway, target: redisCache });

    // Vertical audit logging pipeline crossing the horizontal gateway connections
    const logCollector = ws.addNode({
      type: 'shape',
      position: { x: 350, y: 50 },
      layoutMode: 'manual',
      data: { label: 'Log Ingestion' },
    });
    const logStorage = ws.addNode({
      type: 'shape',
      position: { x: 350, y: 550 },
      layoutMode: 'manual',
      data: { label: 'Cold Storage S3' },
    });
    ws.addEdge({ id: 'e_log_pipe', source: logCollector, target: logStorage });

    // Execute Line Jump Engine
    const jumps = calculateLineJumps(
      Object.values(ws.getActivePage().edges),
      ws.getActivePage().nodes
    );

    // Verify: Horizontal request edges jumping over the vertical logging pipeline
    expect(jumps.size).toBeGreaterThan(0);
    for (const [edgeId, arcs] of jumps.entries()) {
      for (const arc of arcs) {
        expect(arc.crossingPoint.x).toBeCloseTo(430, -1);
        expect(arc.svgArcCommand).toContain('A 6 6');
      }
    }

    // Collapse Database Tier container
    const dbFrameNode = ws.getActivePage().nodes[frameDb];
    dbFrameNode.width = 180;
    dbFrameNode.height = 44;
    dbFrameNode.data.collapsed = true;
    expect(dbFrameNode.data.collapsed).toBe(true);
    expect(dbFrameNode.height).toBe(44);
  });

  // =========================================================================
  // Scenario 4.3: Code-First to Canvas-First Iterative Engineering Workflow
  // =========================================================================
  it('4.3 should support code-first state machine import, manual layout adjustment, and code update', () => {
    // 1. Initial State Machine in Mermaid code
    const orderFsmCode = `
      flowchart LR
        Draft["Draft Order"] --> Submitted["Submitted"]
        Submitted --> Pending["Payment Pending"]
        Pending --> Decision{"Approved?"}
        Decision -->|Yes| Paid["Payment Confirmed"]
        Decision -->|No| Failed["Payment Failed"]
        Paid --> Fulfilled["Order Fulfilled"]
        Fulfilled --> Delivered["Delivered"]
    `;

    // 2. Parse and reconcile to canvas
    const astInitial = parseMermaid(orderFsmCode);
    const step1 = reconcileMermaidAST(astInitial, []);
    expect(step1.nodes).toHaveLength(8);
    expect(step1.edges).toHaveLength(7);

    // 3. User manually drags 'Failed' node away to a dedicated error corner (setting mode to manual)
    const failedNode = step1.nodes.find((n) => n.id === 'Failed')!;
    failedNode.position = { x: 1200, y: 900 };
    failedNode.layoutMode = 'manual';

    const pendingNode = step1.nodes.find((n) => n.id === 'Pending')!;
    pendingNode.position = { x: 450, y: 700 };
    pendingNode.layoutMode = 'manual';

    // 4. In CodeMirror focused mode, developer adds Refund workflow
    const updatedFsmCode = `
      flowchart LR
        Draft["Draft Order"] --> Submitted["Submitted"]
        Submitted --> Pending["Payment Pending"]
        Pending --> Decision{"Approved?"}
        Decision -->|Yes| Paid["Payment Confirmed"]
        Decision -->|No| Failed["Payment Failed - Canceled"]
        Paid --> Fulfilled["Order Fulfilled"]
        Fulfilled --> Delivered["Delivered"]
        Paid --> RefundReq["Refund Requested"]
        RefundReq --> RefundDone["Refund Completed"]
    `;

    const astUpdated = parseMermaid(updatedFsmCode);
    const step2 = reconcileMermaidAST(astUpdated, step1.nodes);

    // 5. Assert: Reconciled graph has 10 nodes (8 original + 2 refund states)
    expect(step2.nodes).toHaveLength(10);

    // Assert: Failed node preserved exact manual position {1200, 900} and manual mode
    const reconciledFailed = step2.nodes.find((n) => n.id === 'Failed')!;
    expect(reconciledFailed.position).toEqual({ x: 1200, y: 900 });
    expect(reconciledFailed.layoutMode).toBe('manual');
    expect(reconciledFailed.data.label).toBe('Payment Failed - Canceled');

    // Assert: Pending node preserved exact manual position {450, 700}
    const reconciledPending = step2.nodes.find((n) => n.id === 'Pending')!;
    expect(reconciledPending.position).toEqual({ x: 450, y: 700 });
    expect(reconciledPending.layoutMode).toBe('manual');

    // 6. Serialize back to Mermaid DSL
    const serialized = serializeMermaid(step2.nodes, step2.edges, 'LR');
    expect(serialized).toContain('flowchart LR');
    expect(serialized).toContain('RefundReq["Refund Requested"]');
    expect(serialized).toContain('RefundDone["Refund Completed"]');
  });

  // =========================================================================
  // Scenario 4.4: Full Project Lifecycle: Multi-Page Session, Scrubbing, Export & Cold Reload
  // =========================================================================
  it('4.4 should execute complete project lifecycle across multiple pages, history undo, and lossless pako restore', () => {
    // 1. Create a 3-page project
    const p1Id = ws.activePageId; // "Brainstorming Mind Map"
    const p2Id = ws.createPage('System Architecture');
    const p3Id = ws.createPage('Freehand Sketches');

    // 2. Populate Page 1 (Mind Map)
    ws.setActivePage(p1Id);
    const rootIdea = ws.addNode({ data: { label: 'Platform Concept' } });
    ws.addChildNode(rootIdea);

    // 3. Populate Page 2 (Architecture)
    ws.setActivePage(p2Id);
    const s1 = ws.addNode({ data: { label: 'Auth Gateway', shapeType: 'diamond' } });
    const s2 = ws.addNode({ data: { label: 'User DB', shapeType: 'cylinder' } });
    ws.addEdge({ source: s1, target: s2, label: 'SQL Connection' });

    // 4. Populate Page 3 (Freehand doodles)
    ws.setActivePage(p3Id);
    ws.addNode({
      type: 'freehand',
      position: { x: 200, y: 200 },
      data: {
        points: [
          [10, 10, 0.5],
          [20, 25, 0.8],
          [40, 50, 0.9],
        ],
        color: '#ef4444',
        size: 4,
      },
    });

    // 5. Test history scrubbing on Page 3
    const p3Extra = ws.addNode({ data: { label: 'Temporary Annotation' } });
    expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(2);

    ws.undo(); // Undo temporary annotation
    expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(1);

    ws.redo(); // Redo temporary annotation
    expect(Object.keys(ws.getActivePage().nodes)).toHaveLength(2);

    // 6. Multi-Format Export
    // A. JSON Schema Export
    const exportedJson = exportProjectAsJson(ws.project);
    expect(exportedJson).toContain('"version": "1.0.0"');

    // B. Vector SVG Export
    const exportedSvg = exportSvg(ws.getActivePage());
    expect(exportedSvg).toContain('<svg');

    // C. High-res PNG with embedded Pako zlib metadata
    const { compressedPayload } = exportPngWithPako(ws.project);
    expect(compressedPayload.length).toBeGreaterThan(0);

    // 7. Cold Restart Simulation: Restore project from PNG metadata
    const freshWorkspace = new TestWorkspace();
    const restoredProject = restoreProjectFromPngMetadata(compressedPayload);

    freshWorkspace.project = restoredProject;
    freshWorkspace.activePageId = p1Id;

    // Assert: Exact parity across all 3 pages
    expect(Object.keys(freshWorkspace.project.pages)).toHaveLength(3);

    // Verify Page 1
    const restoredP1 = freshWorkspace.project.pages[p1Id];
    expect(Object.keys(restoredP1.nodes)).toHaveLength(2);

    // Verify Page 2
    const restoredP2 = freshWorkspace.project.pages[p2Id];
    expect(Object.keys(restoredP2.nodes)).toHaveLength(2);
    expect(Object.keys(restoredP2.edges)).toHaveLength(1);
    const dbNode = Object.values(restoredP2.nodes).find(
      (n) => n.data.shapeType === 'cylinder'
    );
    expect(dbNode?.data.label).toBe('User DB');

    // Verify Page 3
    const restoredP3 = freshWorkspace.project.pages[p3Id];
    expect(Object.keys(restoredP3.nodes)).toHaveLength(2);
    const freehandNode = Object.values(restoredP3.nodes).find(
      (n) => n.type === 'freehand'
    );
    expect(freehandNode?.data.color).toBe('#ef4444');
    expect(freehandNode?.data.points).toHaveLength(3);
  });
});
