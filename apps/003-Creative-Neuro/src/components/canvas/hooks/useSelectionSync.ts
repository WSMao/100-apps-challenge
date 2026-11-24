/**
 * Creative-Neuro Canvas Subsystem - Selection Sync & Edge Reconnect Hook
 * Path: src/components/canvas/hooks/useSelectionSync.ts
 *
 * Encapsulates:
 * 1. Edge endpoint drag reconnection lifecycle (onReconnectStart, onReconnect, onReconnectEnd)
 * 2. Multi-selection bounding box calculation for floating action bars
 */

import { useRef, useCallback, useMemo } from 'react';
import type { Connection, Edge } from '@xyflow/react';
import { useProjectStore } from '../../../store/useProjectStore.ts';
import type { NeuroNode, NeuroEdge, Point } from '../../../types/index.ts';

export interface UseSelectionSyncProps {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  nodes: NeuroNode[];
  edges: NeuroEdge[];
  reconnectEdge: (edgeId: string, newConnection: Connection) => void;
  removeEdge: (id: string) => void;
}

export function useSelectionSync({
  selectedNodeIds,
  selectedEdgeIds,
  nodes,
  edges,
  reconnectEdge,
  removeEdge,
}: UseSelectionSyncProps) {
  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;
      reconnectEdge(oldEdge.id, newConnection);
    },
    [reconnectEdge]
  );

  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        removeEdge(edge.id);
      }
      edgeReconnectSuccessful.current = true;
    },
    [removeEdge]
  );

  // Calculate multi-selection bounding box for floating action bars
  const selectedBoundingBox = useMemo(() => {
    const hasMultipleItems =
      selectedNodeIds.length + selectedEdgeIds.length > 1;
    if (!hasMultipleItems) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const nodeLookup = new Map(nodes.map((n) => [n.id, n]));

    for (const nid of selectedNodeIds) {
      const node = nodeLookup.get(nid);
      if (!node) continue;
      const x = node.position.x;
      const y = node.position.y;
      const w = node.width ?? 160;
      const h = node.height ?? 60;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    const edgeLookup = new Map(edges.map((e) => [e.id, e]));
    for (const eid of selectedEdgeIds) {
      const edge = edgeLookup.get(eid);
      if (!edge) continue;
      const srcNode = nodeLookup.get(edge.source);
      const tgtNode = nodeLookup.get(edge.target);
      if (srcNode) {
        minX = Math.min(minX, srcNode.position.x);
        minY = Math.min(minY, srcNode.position.y);
        maxX = Math.max(maxX, srcNode.position.x + (srcNode.width ?? 160));
        maxY = Math.max(maxY, srcNode.position.y + (srcNode.height ?? 60));
      }
      if (tgtNode) {
        minX = Math.min(minX, tgtNode.position.x);
        minY = Math.min(minY, tgtNode.position.y);
        maxX = Math.max(maxX, tgtNode.position.x + (tgtNode.width ?? 160));
        maxY = Math.max(maxY, tgtNode.position.y + (tgtNode.height ?? 60));
      }
    }

    if (!Number.isFinite(minX)) return null;

    return {
      minX,
      minY,
      maxX,
      maxY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [selectedNodeIds, selectedEdgeIds, nodes, edges]);

  return {
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
    selectedBoundingBox,
  };
}

