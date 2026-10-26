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
import type { NeuroNode, NeuroEdge, ToolMode } from '../../types/index.ts';
import { useProjectStore } from '../../store/projectStore.ts';
import {
  findCollisionFreePosition,
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
 * Spawns a child node to the right of `sourceNodeId` with collision avoidance and auto-connection.
 */
export function spawnChildNode(sourceNodeId?: string): string | null {
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

  const newPos = findCollisionFreePosition(targetNode, 'right', existingNodes);

  const newChildId = state.addNode({
    type: 'shape',
    position: newPos,
    width: targetNode.width ?? 160,
    height: targetNode.height ?? 60,
    parentId: targetNode.parentId,
    extent: targetNode.extent,
    layoutMode: targetNode.layoutMode,
    data: {
      label: 'Child Node',
      shapeType: targetNode.data.shapeType || 'rounded',
      layoutMode: targetNode.layoutMode,
    },
  });

  state.addEdge({
    source: targetNode.id,
    target: newChildId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'jump',
  });

  state.setSelectedNodes([newChildId]);
  state.setSelectedEdges([]);
  return newChildId;
}

/**
 * Spawns a sibling node below `sourceNodeId` sharing the same parent connection (or unattached if root).
 */
export function spawnSiblingNode(sourceNodeId?: string): string | null {
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

  const pageEdges: NeuroEdge[] = activePage
    ? activePage.edgeIds
        .map((id) => state.edges[id])
        .filter((e): e is NeuroEdge => Boolean(e))
    : Object.values(state.edges);

  const newPos = findCollisionFreePosition(targetNode, 'bottom', existingNodes);

  const newSiblingId = state.addNode({
    type: 'shape',
    position: newPos,
    width: targetNode.width ?? 160,
    height: targetNode.height ?? 60,
    parentId: targetNode.parentId,
    extent: targetNode.extent,
    layoutMode: targetNode.layoutMode,
    data: {
      label: 'Sibling Node',
      shapeType: targetNode.data.shapeType || 'rounded',
      layoutMode: targetNode.layoutMode,
    },
  });

  // Connect to shared parent if targetNode has an incoming parent edge
  const parentEdge = pageEdges.find((e) => e.target === targetNode.id);
  if (parentEdge) {
    state.addEdge({
      source: parentEdge.source,
      target: newSiblingId,
      sourceHandle: parentEdge.sourceHandle || 'right',
      targetHandle: parentEdge.targetHandle || 'left',
      type: 'jump',
    });
  }

  state.setSelectedNodes([newSiblingId]);
  state.setSelectedEdges([]);
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

  const newId = state.addNode({
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
  });

  state.addEdge({
    source: targetNode.id,
    target: newId,
    sourceHandle,
    targetHandle,
    type: 'jump',
  });

  state.setSelectedNodes([newId]);
  state.setSelectedEdges([]);
  return newId;
}

export const ShortcutsHandler: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useProjectStore.getState();
      const isMod = e.metaKey || e.ctrlKey;

      // 1. Escape works globally to exit focused diagram mode or reset tool mode
      if (e.key === 'Escape') {
        if (state.focusedDiagramId) {
          e.preventDefault();
          const focusedId = state.focusedDiagramId;
          state.setFocusedDiagramId(null);
          if (state.nodes[focusedId]) {
            state.updateNodeData(focusedId, {
              isFocused: false,
              diagramMode: 'embedded',
            });
          }
          return;
        }
        if (state.toolMode !== 'select') {
          e.preventDefault();
          state.setToolMode('select');
          return;
        }
        if (state.selectedNodeIds.length > 0 || state.selectedEdgeIds.length > 0) {
          state.setSelectedNodes([]);
          state.setSelectedEdges([]);
          return;
        }
      }

      // Guard: Do not intercept keys when user is typing in an input, textarea, or CodeMirror editor
      if (isEditableTarget(e.target)) {
        return;
      }

      // 2. Undo / Redo (`Cmd/Ctrl + Z`, `Cmd/Ctrl + Shift + Z`, `Cmd/Ctrl + Y`)
      if (isMod && !e.altKey) {
        const lowerKey = e.key.toLowerCase();
        if (lowerKey === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            state.redo();
          } else {
            state.undo();
          }
          return;
        }
        if (lowerKey === 'y') {
          e.preventDefault();
          state.redo();
          return;
        }
      }

      // 3. Alt / Option + Arrow Keys -> Directional Connected Node Creation
      if (e.altKey && !isMod) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          spawnDirectionalNode('top');
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          spawnDirectionalNode('bottom');
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          spawnDirectionalNode('left');
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          spawnDirectionalNode('right');
          return;
        }
      }

      // 4. Tab -> Create Child Node to the Right
      if (e.key === 'Tab' && !isMod && !e.altKey && !e.shiftKey) {
        if (state.selectedNodeIds.length > 0) {
          e.preventDefault();
          spawnChildNode();
          return;
        }
      }

      // 5. Enter -> Create Sibling Node Below
      if (e.key === 'Enter' && !isMod && !e.altKey && !e.shiftKey) {
        if (state.selectedNodeIds.length > 0) {
          e.preventDefault();
          spawnSiblingNode();
          return;
        }
      }

      // 6. Delete / Backspace -> Delete Selected Nodes & Edges
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isMod && !e.altKey) {
        if (state.selectedNodeIds.length > 0 || state.selectedEdgeIds.length > 0) {
          e.preventDefault();
          if (state.selectedNodeIds.length > 0) {
            state.deleteNodes([...state.selectedNodeIds]);
          }
          if (state.selectedEdgeIds.length > 0) {
            state.deleteEdges([...state.selectedEdgeIds]);
          }
          return;
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
          e.preventDefault();
          state.setToolMode(mappedMode);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
};

export default ShortcutsHandler;
