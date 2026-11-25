import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { NeuroNode, NeuroEdge } from '../../src/types/index.ts';
import {
  calculateMindMapLayout,
  canAttachMindMapNode,
  attachMindMapNode,
  detachMindMapNode,
  swapMindMapNodes,
  findAttachTargetNode,
  serializeMindMapMermaid,
  parseMindMapMermaid,
} from '../../src/engine/index.ts';

function makeNode(
  id: string,
  label: string,
  x = 0,
  y = 0,
  locked = false,
  isRoot = false
): NeuroNode {
  return {
    id,
    type: 'shape',
    position: { x, y },
    width: 140,
    height: 48,
    locked,
    data: {
      label,
      shapeType: 'rounded',
      locked,
      ...(isRoot ? { isMindMapRoot: true } : {}),
    },
  };
}

function makeEdge(source: string, target: string): NeuroEdge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    type: 'bezier',
  };
}

describe('Engine 5: MindMap Mode Layout & Tree Operations', () => {
  it('MM-01: radial layout balances root children evenly to left and right symmetrically', () => {
    const nodes: NeuroNode[] = [
      makeNode('root', 'Central Topic', 0, 0, false, true),
      makeNode('c1', 'Branch 1'),
      makeNode('c2', 'Branch 2'),
      makeNode('c3', 'Branch 3'),
      makeNode('c4', 'Branch 4'),
    ];
    const edges: NeuroEdge[] = [
      makeEdge('root', 'c1'),
      makeEdge('root', 'c2'),
      makeEdge('root', 'c3'),
      makeEdge('root', 'c4'),
    ];

    const result = calculateMindMapLayout(nodes, edges, {
      rootId: 'root',
      direction: 'radial',
      nodeSpacing: 40,
      layerSpacing: 80,
    });

    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    const root = byId.get('root')!;
    const leftNodes = ['c1', 'c2', 'c3', 'c4']
      .map((id) => byId.get(id)!)
      .filter((n) => n.position.x < root.position.x);
    const rightNodes = ['c1', 'c2', 'c3', 'c4']
      .map((id) => byId.get(id)!)
      .filter((n) => n.position.x > root.position.x);

    assert.equal(rightNodes.length, 2, '2 children should be placed to the right of root');
    assert.equal(leftNodes.length, 2, '2 children should be placed to the left of root');

    // Symmetric vertical centering around root.position.y
    const rightAvgY = (rightNodes[0].position.y + rightNodes[1].position.y) / 2;
    const leftAvgY = (leftNodes[0].position.y + leftNodes[1].position.y) / 2;
    assert.ok(Math.abs(rightAvgY - root.position.y) < 1, 'Right children centered around root Y');
    assert.ok(Math.abs(leftAvgY - root.position.y) < 1, 'Left children centered around root Y');

    // Edge handles reflect left vs right side
    const edgeByTarget = new Map(result.edges.map((e) => [e.target, e]));
    for (const rn of rightNodes) {
      const e = edgeByTarget.get(rn.id)!;
      assert.equal(e.sourceHandle, 'right');
      assert.equal(e.targetHandle, 'left');
    }
    for (const ln of leftNodes) {
      const e = edgeByTarget.get(ln.id)!;
      assert.equal(e.sourceHandle, 'left');
      assert.equal(e.targetHandle, 'right');
    }
  });

  it('MM-02: right & down directions, Lock preservation, and neat Floating node arrangement', () => {
    const nodes: NeuroNode[] = [
      makeNode('root', 'Root', 0, 0, false, true),
      makeNode('a', 'A'),
      makeNode('b', 'B', 999, 999, true), // locked
      makeNode('f1', 'Floating 1'),
      makeNode('f2', 'Floating 2'),
    ];
    const edges: NeuroEdge[] = [makeEdge('root', 'a'), makeEdge('root', 'b')];

    const rightRes = calculateMindMapLayout(nodes, edges, {
      rootId: 'root',
      direction: 'right',
    });
    const rightById = new Map(rightRes.nodes.map((n) => [n.id, n]));
    assert.ok(rightById.get('a')!.position.x > rightById.get('root')!.position.x);
    assert.deepEqual(rightById.get('b')!.position, { x: 999, y: 999 }, 'Locked node stays put');
    assert.deepEqual(rightRes.floatingNodeIds, ['f1', 'f2']);
    assert.ok(
      rightById.get('f2')!.position.x > rightById.get('f1')!.position.x,
      'Floating nodes arranged neatly in a row'
    );

    const downRes = calculateMindMapLayout(nodes, edges, {
      rootId: 'root',
      direction: 'down',
    });
    const downById = new Map(downRes.nodes.map((n) => [n.id, n]));
    assert.ok(downById.get('a')!.position.y > downById.get('root')!.position.y);
  });

  it('MM-03: attach/detach, cycle prevention, proximity target, and node swapping', () => {
    const nodes: NeuroNode[] = [
      makeNode('root', 'Root', 0, 0, false, true),
      makeNode('a', 'A', 220, -40),
      makeNode('b', 'B', 220, 40),
      makeNode('c', 'C', 440, -40),
      makeNode('float', 'Float', 230, -30), // near 'a'
    ];
    const edges: NeuroEdge[] = [
      makeEdge('root', 'a'),
      makeEdge('root', 'b'),
      makeEdge('a', 'c'),
    ];

    // Cycle prevention: cannot attach 'a' under its descendant 'c', nor root under 'a'
    assert.equal(canAttachMindMapNode(nodes, edges, 'a', 'c', 'root'), false);
    assert.equal(canAttachMindMapNode(nodes, edges, 'root', 'a', 'root'), false);
    assert.equal(canAttachMindMapNode(nodes, edges, 'float', 'a', 'root'), true);

    // Proximity detection finds 'a' for 'float'
    const target = findAttachTargetNode(nodes, edges, 'float', 'root', 48);
    assert.equal(target?.id, 'a');

    // Attach 'float' to 'a', then re-attach 'c' to 'b' (enforces 1-to-many: old edge a->c removed)
    const attached = attachMindMapNode(nodes, edges, 'float', 'a', { rootId: 'root' });
    assert.ok(attached.edges.some((e) => e.source === 'a' && e.target === 'float'));
    const reParented = attachMindMapNode(attached.nodes, attached.edges, 'c', 'b', { rootId: 'root' });
    const incomingToC = reParented.edges.filter((e) => e.target === 'c');
    assert.equal(incomingToC.length, 1);
    assert.equal(incomingToC[0].source, 'b');

    // Detach 'c' -> becomes floating
    const detachedEdges = detachMindMapNode(reParented.edges, 'c', 'root');
    assert.equal(detachedEdges.some((e) => e.target === 'c'), false);

    // Swap 'a' and 'b' -> swaps positions and sibling order in edges
    const swapped = swapMindMapNodes(nodes, edges, 'a', 'b', { rootId: 'root' });
    const swappedById = new Map(swapped.nodes.map((n) => [n.id, n]));
    assert.deepEqual(swappedById.get('a')!.position, { x: 220, y: 40 });
    assert.deepEqual(swappedById.get('b')!.position, { x: 220, y: -40 });
    const rootChildTargets = swapped.edges.filter((e) => e.source === 'root').map((e) => e.target);
    assert.deepEqual(rootChildTargets, ['b', 'a']);
  });

  it('MM-04: Mermaid mindmap syntax serialization and parsing round-trip', () => {
    const nodes: NeuroNode[] = [
      makeNode('root', 'Product Strategy', 0, 0, false, true),
      makeNode('n1', 'Growth'),
      makeNode('n2', 'Retention'),
      makeNode('n3', 'Referrals'),
    ];
    const edges: NeuroEdge[] = [
      makeEdge('root', 'n1'),
      makeEdge('root', 'n2'),
      makeEdge('n1', 'n3'),
    ];

    const mermaid = serializeMindMapMermaid(nodes, edges, 'root');
    assert.ok(mermaid.startsWith('mindmap'));
    assert.ok(mermaid.includes('Product Strategy'));
    assert.ok(mermaid.includes('Referrals'));

    const parsed = parseMindMapMermaid(mermaid);
    assert.equal(parsed.nodes.length, 4);
    assert.equal(parsed.edges.length, 3);
    assert.equal(parsed.nodes[0].data.isMindMapRoot, true);
    assert.equal(parsed.nodes[0].data.label, 'Product Strategy');
  });
});
