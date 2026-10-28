/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Global Keyboard Shortcuts Listener & Fast Brainstorming Controller
 *
 * Supported Shortcuts:
 * - `Tab`: Spawn child node to the right of selected node using `findCollisionFreePosition` + auto-connect edge
 * - `Enter`: Spawn sibling node below selected node sharing the same parent edge (or below if root)
 * - `Alt/Option + ArrowUp/Down/Left/Right`: Spawn connected node in the specified direction
 * - `Cmd/Ctrl + Z`: Undo via Zundo temporal store
 * - `Cmd/Ctrl + Shift + Z` or `Cmd/Ctrl + Y`: Redo via Zundo temporal store
 * - `Delete` / `Backspace`: Delete selected nodes and edges (when not typing in inputs/CodeMirror)
 * - `Escape`: Exit focused diagram mode (`setFocusedDiagramId(null)`) or reset tool mode to `select`
 * - `V`, `R`, `T`, `C`, `P`, `F`, `D`: Quick tool mode switching
 */

import React, { useEffect } from 'react';
import type { NeuroNode, NeuroEdge, ToolMode, EdgeRoutingType } from '../../types/index.ts';
import { useProjectStore } from '../../store/projectStore.ts';
import {
  findCollisionFreePosition,
  findSiblingPosition,
  type PlacementDirection,
} from '../../engine/index.ts';

/**
 * Checks whether the keyboard event originated inside an editable text field or CodeMirror editor.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (target.closest('.cm-editor') || target.closest('[contenteditable="true"]')) {
    return true;
  }
  return false;
}

/**
 * Spawns a child node from the target/selected node in `lastDirection` (defaulting to 'right').
 * Automatically connects an edge from source to target with matching handles,
 * and updates selection to the newly created child node.
 */
export function spawnChildNode(sourceNodeId?: string, label: string = 'Child Node'): string | null {
  const state = useProjectStore.getState();
  const targetId = sourceNodeId || state.selectedNodeIds[0];
  if (!targetId) return null;

  const targetNode = state.nodes[targetId];
  if (!targetNode) return null;

  const activePage = state.pages[state.activePageId];
  const existingNodes: NeuroNode[] = activePage
    ? activePage.nodeIds
        .map((id) => state.nodes[id])
        .filter((n): n is NeuroNode => Boolean(n))
    : Object.values(state.nodes);

  // Inherit last directional spawn orientation (defaults to 'right')
  const direction: PlacementDirection = state.lastDirection || 'right';
  const newPos = findCollisionFreePosition(targetNode, direction, existingNodes);

  const handlePairs: Record<
    PlacementDirection,
    { sourceHandle: string; targetHandle: string }
  > = {
    top: { sourceHandle: 'top', targetHandle: 'bottom' },
    bottom: { sourceHandle: 'bottom', targetHandle: 'top' },
    left: { sourceHandle: 'left', targetHandle: 'right' },
    right: { sourceHandle: 'right', targetHandle: 'left' },
  };

  const { sourceHandle, targetHandle } = handlePairs[direction];

  const pageEdges: NeuroEdge[] = activePage
    ? activePage.edgeIds
        .map((id) => state.edges[id])
        .filter((e): e is NeuroEdge => Boolean(e))
    : Object.values(state.edges);
  const incomingEdge = pageEdges.find((e) => e.target === targetNode.id);
  const routingType = incomingEdge?.type || (state.defaultEdgeRoutingType || 'smoothstep');
  const edgeColor = incomingEdge?.data?.color;
  const strokeWidth = incomingEdge?.data?.strokeWidth;

  const { nodeId: newChildId } = state.addConnectedNode(
    {
      type: 'shape',
      position: newPos,
      width: targetNode.width ?? 160,
      height: targetNode.height ?? 60,
      parentId: targetNode.parentId,
      extent: targetNode.extent,
      layoutMode: targetNode.layoutMode,
      data: {
        label,
        shapeType: targetNode.data.shapeType || 'rounded',
        layoutMode: targetNode.layoutMode,
        backgroundColor: targetNode.data.backgroundColor,
        borderColor: targetNode.data.borderColor,
        borderWidth: targetNode.data.borderWidth,
        color: targetNode.data.color,
      },
    },
    {
      source: targetNode.id,
      target: '',
      sourceHandle,
      targetHandle,
      type: routingType,
      data: {
        color: edgeColor,
        strokeWidth: strokeWidth,
      },
    }
  );

  // Switch selection to new child node for immediate typing & continuous tree branching
  state.setSelectedNodes([newChildId]);

  return newChildId;
}

/**
 * Spawns a sibling node:
 * Finds the parent node of the current node, and connects the new sibling to that parent.
 * The geometric candidate position is anchored to targetNode (the selected node) using findSiblingPosition.
 * If the current node has no parent (e.g. root node), spawns a child node (Main Topic) connected to targetNode.
 * Automatically updates selection to the newly created sibling node.
 */
export function spawnSiblingNode(sourceNodeId?: string, label: string = 'Sibling Node'): string | null {
  const state = useProjectStore.getState();
  const targetId = sourceNodeId || state.selectedNodeIds[0];
  if (!targetId) return null;

  const targetNode = state.nodes[targetId];
  if (!targetNode) return null;

  const activePage = state.pages[state.activePageId];
  const pageEdges: NeuroEdge[] = activePage
    ? activePage.edgeIds
        .map((id) => state.edges[id])
        .filter((e): e is NeuroEdge => Boolean(e))
    : Object.values(state.edges);

  // 1. Find parent node of current node
  const parentEdge = pageEdges.find((e) => e.target === targetNode.id);
  const parentNode = parentEdge ? state.nodes[parentEdge.source] : null;

  // 2. Root Node (No Parent) Handling:
  // If !parentNode || !parentEdge, spawn a child node (Main Topic) connected to targetNode
  if (!parentNode || !parentEdge) {
    return spawnChildNode(targetNode.id, 'Main Topic');
  }

  // 3. Determine branch direction
  let branchDir: PlacementDirection = state.lastDirection || 'right';
  if (
    parentEdge.sourceHandle &&
    ['left', 'right', 'top', 'bottom'].includes(parentEdge.sourceHandle)
  ) {
    branchDir = parentEdge.sourceHandle as PlacementDirection;
  } else if (parentNode) {
    const dx = targetNode.position.x - parentNode.position.x;
    const dy = targetNode.position.y - parentNode.position.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        branchDir = dx < 0 ? 'left' : 'right';
      } else {
        branchDir = dy < 0 ? 'top' : 'bottom';
      }
    }
  }

  const existingNodes: NeuroNode[] = activePage
    ? activePage.nodeIds
        .map((id) => state.nodes[id])
        .filter((n): n is NeuroNode => Boolean(n))
    : Object.values(state.nodes);

  // 4. Find collision-free sibling position anchored to targetNode
  const newPos = findSiblingPosition(targetNode, branchDir, existingNodes);

  // 5. Determine source and target handles
  const sourceHandle =
    parentEdge.sourceHandle ||
    (branchDir === 'left' ? 'left' : branchDir === 'top' ? 'top' : branchDir === 'bottom' ? 'bottom' : 'right');
  const targetHandle =
    parentEdge.targetHandle ||
    (branchDir === 'left' ? 'right' : branchDir === 'top' ? 'bottom' : branchDir === 'bottom' ? 'top' : 'left');

  const routingType = parentEdge.type || (parentEdge.data?.routingType as EdgeRoutingType) || 'smoothstep';
  const edgeColor = parentEdge.data?.color;
  const strokeWidth = parentEdge.data?.strokeWidth;

  // 6. Create connected sibling node
  const { nodeId: newSiblingId } = state.addConnectedNode(
    {
      type: 'shape',
      position: newPos,
      width: targetNode.width ?? 160,
      height: targetNode.height ?? 60,
      parentId: targetNode.parentId,
      extent: targetNode.extent,
      layoutMode: targetNode.layoutMode,
      data: {
        label,
        shapeType: targetNode.data.shapeType || 'rounded',
        layoutMode: targetNode.layoutMode,
        backgroundColor: targetNode.data.backgroundColor,
        borderColor: targetNode.data.borderColor,
        borderWidth: targetNode.data.borderWidth,
        color: targetNode.data.color,
      },
    },
    {
      source: parentNode.id,
      target: '',
      sourceHandle,
      targetHandle,
      type: routingType,
      data: {
        color: edgeColor,
        strokeWidth: strokeWidth,
      },
    }
  );

  // 7. Select newly created sibling node & update lastDirection
  state.setSelectedNodes([newSiblingId]);
  state.setLastDirection(branchDir);

  return newSiblingId;
}

/**
 * Spawns a connected neighbor node in the requested direction (`top` | `bottom` | `left` | `right`).
 */
export function spawnDirectionalNode(
  direction: PlacementDirection,
  sourceNodeId?: string
): string | null {
  const state = useProjectStore.getState();
  const targetId = sourceNodeId || state.selectedNodeIds[0];
  if (!targetId) return null;

  const targetNode = state.nodes[targetId];
  if (!targetNode) return null;

  // Record last spawn direction for OP-07
  state.setLastDirection(direction);

  const activePage = state.pages[state.activePageId];
  const existingNodes: NeuroNode[] = activePage
    ? activePage.nodeIds
        .map((id) => state.nodes[id])
        .filter((n): n is NeuroNode => Boolean(n))
    : Object.values(state.nodes);

  const newPos = findCollisionFreePosition(targetNode, direction, existingNodes);

  const handlePairs: Record<
    PlacementDirection,
    { sourceHandle: string; targetHandle: string; labelPrefix: string }
  > = {
    top: { sourceHandle: 'top', targetHandle: 'bottom', labelPrefix: 'Up' },
    bottom: { sourceHandle: 'bottom', targetHandle: 'top', labelPrefix: 'Down' },
    left: { sourceHandle: 'left', targetHandle: 'right', labelPrefix: 'Left' },
    right: { sourceHandle: 'right', targetHandle: 'left', labelPrefix: 'Right' },
  };

  const { sourceHandle, targetHandle, labelPrefix } = handlePairs[direction];

  const { nodeId: newId } = state.addConnectedNode(
    {
      type: 'shape',
      position: newPos,
      width: targetNode.width ?? 160,
      height: targetNode.height ?? 60,
      parentId: targetNode.parentId,
      extent: targetNode.extent,
      layoutMode: targetNode.layoutMode,
      data: {
        label: `${labelPrefix} Node`,
        shapeType: targetNode.data.shapeType || 'rounded',
        layoutMode: targetNode.layoutMode,
      },
    },
    {
      source: targetNode.id,
      target: '',
      sourceHandle,
      targetHandle,
    }
  );

  // Switch selection to the newly spawned directional node
  state.setSelectedNodes([newId]);

  return newId;
}

/**
 * OP-08: Directional Node Selection Navigation.
 * Moves selection focus to the closest node in the specified direction.
 */
export function navigateSelectionDirectionally(arrowKey: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): string | null {
  const state = useProjectStore.getState();
  const currentId = state.selectedNodeIds[0];
  if (!currentId) return null;

  const currentNode = state.nodes[currentId];
  if (!currentNode) return null;

  const activePage = state.pages[state.activePageId];
  const candidateIds = activePage ? activePage.nodeIds : Object.keys(state.nodes);

  const cX = currentNode.position.x + (currentNode.width || 160) / 2;
  const cY = currentNode.position.y + (currentNode.height || 60) / 2;

  let bestNodeId: string | null = null;
  let bestDist = Infinity;

  for (const nid of candidateIds) {
    if (nid === currentId) continue;
    const node = state.nodes[nid];
    if (!node) continue;

    const nX = node.position.x + (node.width || 160) / 2;
    const nY = node.position.y + (node.height || 60) / 2;

    const dx = nX - cX;
    const dy = nY - cY;

    // Check angle / direction eligibility with strong primary axis dominance
    let isEligible = false;
    let score = Infinity;

    if (arrowKey === 'ArrowUp' && dy < -5) {
      if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
        isEligible = true;
        score = Math.abs(dy) * 1.0 + Math.abs(dx) * 1.8;
      }
    } else if (arrowKey === 'ArrowDown' && dy > 5) {
      if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
        isEligible = true;
        score = Math.abs(dy) * 1.0 + Math.abs(dx) * 1.8;
      }
    } else if (arrowKey === 'ArrowLeft' && dx < -5) {
      if (Math.abs(dy) <= Math.abs(dx) * 1.2) {
        isEligible = true;
        score = Math.abs(dx) * 1.0 + Math.abs(dy) * 1.8;
      }
    } else if (arrowKey === 'ArrowRight' && dx > 5) {
      if (Math.abs(dy) <= Math.abs(dx) * 1.2) {
        isEligible = true;
        score = Math.abs(dx) * 1.0 + Math.abs(dy) * 1.8;
      }
    }

    if (isEligible && score < bestDist) {
      bestDist = score;
      bestNodeId = nid;
    }
  }

  if (bestNodeId) {
    state.setSelectedNodes([bestNodeId]);
    return bestNodeId;
  }
  return null;
}

/**
 * Global keydown event processor.
 * Exported for deterministic unit testing in node/happy-dom environments.
 */
export function handleGlobalKeyDown(e: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
  preventDefault?: () => void;
  isComposing?: boolean;
}): boolean {
  const state = useProjectStore.getState();
  const isMod = Boolean(e.metaKey || e.ctrlKey);

  // 1. Escape works globally to exit focused diagram mode, cancel inline editing, or reset tool mode
  if (e.key === 'Escape') {
    if (state.editingNodeId) {
      e.preventDefault?.();
      state.setEditingNodeId(null);
      return true;
    }
    if (state.focusedDiagramId) {
      e.preventDefault?.();
      const focusedId = state.focusedDiagramId;
      state.setFocusedDiagramId(null);
      if (state.nodes[focusedId]) {
        state.updateNodeData(focusedId, {
          isFocused: false,
          diagramMode: 'embedded',
        });
      }
      return true;
    }
    if (state.toolMode !== 'select') {
      e.preventDefault?.();
      state.setToolMode('select');
      return true;
    }
    if (state.selectedNodeIds.length > 0 || state.selectedEdgeIds.length > 0) {
      state.setSelectedNodes([]);
      state.setSelectedEdges([]);
      return true;
    }
  }

  // Guard: Do not intercept keys when user is typing in an input, textarea, or CodeMirror editor
  if (isEditableTarget(e.target ?? null)) {
    return false;
  }

  // Guard: When inline text editing is active for a node, suppress all canvas-level hotkeys (e.g. Delete, Tab, navigation)
  if (state.editingNodeId) {
    return false;
  }

  // 2. Undo / Redo (`Cmd/Ctrl + Z`, `Cmd/Ctrl + Shift + Z`, `Cmd/Ctrl + Y`)
  if (isMod && !e.altKey) {
    const lowerKey = e.key.toLowerCase();
    if (lowerKey === 'z') {
      e.preventDefault?.();
      if (e.shiftKey) {
        state.redo();
      } else {
        state.undo();
      }
      return true;
    }
    if (lowerKey === 'y') {
      e.preventDefault?.();
      state.redo();
      return true;
    }
    if (lowerKey === 'g') {
      e.preventDefault?.();
      if (e.shiftKey) {
        if (state.selectedNodeIds.length > 0) {
          state.ungroupNodes(state.selectedNodeIds[0]);
        }
      } else {
        if (state.selectedNodeIds.length > 1) {
          state.groupSelectedNodes();
        }
      }
      return true;
    }
  }

  // 3. Alt / Option + Arrow Keys -> Directional Connected Node Creation
  if (e.altKey && !isMod) {
    if (e.key === 'ArrowUp') {
      e.preventDefault?.();
      spawnDirectionalNode('top');
      return true;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault?.();
      spawnDirectionalNode('bottom');
      return true;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault?.();
      spawnDirectionalNode('left');
      return true;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault?.();
      spawnDirectionalNode('right');
      return true;
    }
  }

  // 3.5 OP-08: Directional Selection Jump with Plain Arrow Keys (when a node is selected)
  if (!isMod && !e.altKey && !e.shiftKey) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (state.selectedNodeIds.length > 0) {
        e.preventDefault?.();
        navigateSelectionDirectionally(e.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight');
        return true;
      }
    }
  }

  // 4. Tab -> Create Child Node to the Right (per README.md)
  if (e.key === 'Tab' && !isMod && !e.altKey && !e.shiftKey) {
    if (state.selectedNodeIds.length > 0) {
      e.preventDefault?.();
      spawnChildNode();
      return true;
    }
  }

  // 5. Enter -> Sibling Node for Shape / Inline Edit for Text & Frame
  if (e.key === 'Enter' && !isMod && !e.altKey && !e.shiftKey) {
    if (state.selectedNodeIds.length === 1) {
      const singleNode = state.nodes[state.selectedNodeIds[0]];
      if (singleNode?.type === 'text' || singleNode?.type === 'frame') {
        e.preventDefault?.();
        state.setEditingNodeId(singleNode.id, null);
        return true;
      }
      e.preventDefault?.();
      spawnSiblingNode();
      return true;
    } else if (state.selectedNodeIds.length > 1) {
      e.preventDefault?.();
      spawnSiblingNode();
      return true;
    }
  }

  // 5.5 F2 or Shift+Enter -> Explicitly Activate Inline Editing
  if ((e.key === 'F2' || (e.key === 'Enter' && e.shiftKey)) && !isMod && !e.altKey) {
    if (state.selectedNodeIds.length === 1) {
      e.preventDefault?.();
      state.setEditingNodeId(state.selectedNodeIds[0], null);
      return true;
    }
  }

  // 6. Delete / Backspace -> Delete Selected Nodes & Edges
  if ((e.key === 'Delete' || e.key === 'Backspace') && !isMod && !e.altKey) {
    if (state.selectedNodeIds.length > 0 || state.selectedEdgeIds.length > 0) {
      e.preventDefault?.();
      state.batchDelete([...state.selectedNodeIds], [...state.selectedEdgeIds]);
      return true;
    }
  }

  // 6.5 Direct Type-to-Edit: Typing on a single selected node enters inline edit mode
  if (!isMod && !e.altKey && state.selectedNodeIds.length === 1) {
    const targetNodeId = state.selectedNodeIds[0];
    const targetNode = state.nodes[targetNodeId];

    // Only shape, text, and frame nodes support inline text editing (exclude diagram nodes)
    if (targetNode && targetNode.type !== 'diagram') {
      // Space key: Append from the last character of existing text
      if (e.key === ' ') {
        e.preventDefault?.();
        state.setEditingNodeId(targetNodeId, ' ');
        return true;
      }

      // Chinese / IME composition or Process key (keyCode 229, Process, isComposing, or non-ASCII)
      const isIme =
        e.key === 'Process' ||
        Boolean(e.isComposing) ||
        (e as KeyboardEvent).keyCode === 229 ||
        /[^\x00-\x7F]/.test(e.key);

      if (isIme) {
        // DO NOT directly receive or display that key as committed text.
        // Enter inline edit mode with clean replacement state so the OS IME stays in composition state
        // and never loses the first character.
        state.setEditingNodeId(targetNodeId, '');
        return true;
      }

      // Printable single character (English letters, numbers, symbols): Directly replace content
      if (e.key.length === 1) {
        e.preventDefault?.();
        state.setEditingNodeId(targetNodeId, e.key);
        return true;
      }
    }
  }

  // 7. Single-Key Tool Mode Shortcuts (V, R, T, C, P, F, D)
  if (!isMod && !e.altKey && !e.shiftKey) {
    const keyMap: Record<string, ToolMode> = {
      v: 'select',
      r: 'shape',
      t: 'text',
      c: 'connect',
      p: 'draw',
      f: 'frame',
      d: 'diagram',
    };
    const mappedMode = keyMap[e.key.toLowerCase()];
    if (mappedMode) {
      e.preventDefault?.();
      state.setToolMode(mappedMode);
      return true;
    }
  }

  return false;
}

export const ShortcutsHandler: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleGlobalKeyDown(e);
    };

    const handleCompositionStart = () => {
      const state = useProjectStore.getState();
      if (state.selectedNodeIds.length === 1) {
        const targetNode = state.nodes[state.selectedNodeIds[0]];
        if (targetNode && targetNode.type !== 'diagram') {
          state.setEditingNodeId(targetNode.id, '');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('compositionstart', handleCompositionStart);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('compositionstart', handleCompositionStart);
    };
  }, []);

  return null;
};

export default ShortcutsHandler;
