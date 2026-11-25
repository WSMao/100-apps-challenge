/**
 * Creative-Neuro Canvas Subsystem - Canvas Gesture & Context Menu Hook
 * Path: src/components/canvas/hooks/useCanvasGestures.ts
 *
 * Encapsulates:
 * 1. Right-click drag pan vs right-click context menu gesture state machine (OP-01)
 * 2. Mouse distance threshold (5px) discrimination
 * 3. Spacebar pan mode toggle
 * 4. Empty pane click-to-add for toolbar tools (shape, text, frame, diagram)
 * 5. Double-click on empty pane to spawn floating node (OP-06)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { ToolMode, Point } from '../../../types/index.ts';
import { createMindMapDiagramPayload } from '../../../engine/index.ts';

export interface ContextMenuState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  targetNodeId: string | null;
}

export interface UseCanvasGesturesProps {
  toolMode: ToolMode;
  screenToFlowPosition: (clientPos: Point) => Point;
  addNode: (node: any) => string;
  setToolMode: (mode: ToolMode) => void;
  setSelectedNodes: (ids: string[]) => void;
  setSelectedEdges: (ids: string[]) => void;
  spawnFloatingNodeAtClientPos: (clientX: number, clientY: number) => void;
  isDark: boolean;
}

export function useCanvasGestures({
  toolMode,
  screenToFlowPosition,
  addNode,
  setToolMode,
  setSelectedNodes,
  setSelectedEdges,
  spawnFloatingNodeAtClientPos,
  isDark,
}: UseCanvasGesturesProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Right-click drag tracking refs
  const rightClickStartRef = useRef<{ x: number; y: number } | null>(null);
  const pendingContextMenuRef = useRef<{
    clientX: number;
    clientY: number;
    targetNodeId: string | null;
  } | null>(null);
  const readyToOpenContextMenuRef = useRef<boolean>(false);
  const lastPaneClickRef = useRef<{ time: number; x: number; y: number } | null>(null);

  // Spacebar pan mode toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !isSpacePressed &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  // Context Menu opener helper
  const openContextMenu = useCallback(
    (clientX: number, clientY: number, targetNodeId: string | null) => {
      const flowPos = screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      setContextMenu({
        x: clientX,
        y: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
        targetNodeId,
      });
    },
    [screenToFlowPosition]
  );

  // Mouse Down: Record initial point for right-click pan vs contextmenu discrimination
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      rightClickStartRef.current = { x: e.clientX, y: e.clientY };
      pendingContextMenuRef.current = null;
      readyToOpenContextMenuRef.current = false;
    }
  }, []);

  const handleRightClickRelease = useCallback(
    (clientX: number, clientY: number) => {
      const start = rightClickStartRef.current;
      rightClickStartRef.current = null;

      if (start) {
        const dist = Math.hypot(clientX - start.x, clientY - start.y);
        if (dist > 5) {
          // It was a pan drag gesture, do not open context menu
          pendingContextMenuRef.current = null;
          readyToOpenContextMenuRef.current = false;
          return;
        }
      }

      // If contextmenu already fired (e.g. on macOS mousedown), show menu upon release
      if (pendingContextMenuRef.current) {
        const { clientX: px, clientY: py, targetNodeId } = pendingContextMenuRef.current;
        pendingContextMenuRef.current = null;
        readyToOpenContextMenuRef.current = false;
        openContextMenu(px, py, targetNodeId);
      } else {
        // If contextmenu hasn't fired yet (e.g. Windows mouseup first), flag ready
        readyToOpenContextMenuRef.current = true;
        setTimeout(() => {
          readyToOpenContextMenuRef.current = false;
        }, 300);
      }
    },
    [openContextMenu]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) {
        handleRightClickRelease(e.clientX, e.clientY);
      }
    },
    [handleRightClickRelease]
  );

  // Global mouseup/mousedown for right-click drag pan vs contextmenu discrimination
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        rightClickStartRef.current = { x: e.clientX, y: e.clientY };
        pendingContextMenuRef.current = null;
        readyToOpenContextMenuRef.current = false;
      }
    };
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        handleRightClickRelease(e.clientX, e.clientY);
      }
    };
    window.addEventListener('mousedown', handleGlobalMouseDown, true);
    window.addEventListener('mouseup', handleGlobalMouseUp, true);

    return () => {
      window.removeEventListener('mousedown', handleGlobalMouseDown, true);
      window.removeEventListener('mouseup', handleGlobalMouseUp, true);
    };
  }, [handleRightClickRelease]);

  // Pane Context Menu (OP-01): Defers opening until right button is released
  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const start = rightClickStartRef.current;
      if (start) {
        const dist = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (dist > 5) {
          return;
        }
      }

      if (readyToOpenContextMenuRef.current) {
        readyToOpenContextMenuRef.current = false;
        pendingContextMenuRef.current = null;
        openContextMenu(event.clientX, event.clientY, null);
      } else {
        pendingContextMenuRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          targetNodeId: null,
        };
      }
    },
    [openContextMenu]
  );

  // Node Context Menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string }) => {
      event.preventDefault();
      event.stopPropagation();

      const start = rightClickStartRef.current;
      if (start) {
        const dist = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (dist > 5) {
          return;
        }
      }

      if (readyToOpenContextMenuRef.current) {
        readyToOpenContextMenuRef.current = false;
        pendingContextMenuRef.current = null;
        openContextMenu(event.clientX, event.clientY, node.id);
      } else {
        pendingContextMenuRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          targetNodeId: node.id,
        };
      }
    },
    [openContextMenu]
  );

  // Canvas click-to-add for toolbar modes & double-click to spawn node
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (contextMenu) setContextMenu(null);

      // OP-06: Detect rapid double-click on empty pane in selectionOnDrag mode
      if (toolMode === 'select' || toolMode === 'connect') {
        setSelectedNodes([]);
        setSelectedEdges([]);
        const now = Date.now();
        const prev = lastPaneClickRef.current;
        if (
          prev &&
          now - prev.time < 320 &&
          Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 10
        ) {
          lastPaneClickRef.current = null;
          spawnFloatingNodeAtClientPos(event.clientX, event.clientY);
          return;
        }
        lastPaneClickRef.current = {
          time: now,
          x: event.clientX,
          y: event.clientY,
        };
        return;
      }

      if (toolMode === 'draw') {
        return;
      }

      if (toolMode === 'mindmap') {
        const now = Date.now();
        const prev = lastPaneClickRef.current;
        if (
          prev &&
          now - prev.time < 380 &&
          Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 12
        ) {
          lastPaneClickRef.current = null;
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          addNode(createMindMapDiagramPayload(position, isDark));
          setToolMode('select');
          return;
        }
        lastPaneClickRef.current = {
          time: now,
          x: event.clientX,
          y: event.clientY,
        };
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (toolMode === 'shape') {
        addNode({
          type: 'shape',
          position,
          width: 160,
          height: 60,
          locked: false,
          data: {
            label: 'New Node',
            locked: false,
            shapeType: 'rounded',
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#475569' : '#cbd5e1',
            color: isDark ? '#f8fafc' : '#0f172a',
          },
        });
        setToolMode('select');
      } else if (toolMode === 'text') {
        addNode({
          type: 'text',
          position,
          width: 160,
          height: 40,
          locked: false,
          data: {
            label: 'Text Note',
            locked: false,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            color: isDark ? '#f8fafc' : '#0f172a',
          },
        });
        setToolMode('select');
      } else if (toolMode === 'frame') {
        addNode({
          type: 'frame',
          position,
          width: 400,
          height: 300,
          locked: false,
          data: {
            label: 'New Frame',
            locked: false,
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.5)',
            borderColor: isDark ? '#475569' : '#cbd5e1',
          },
        });
        setToolMode('select');
      } else if (toolMode === 'diagram') {
        addNode({
          type: 'diagram',
          position,
          width: 320,
          height: 260,
          locked: false,
          data: {
            label: 'Architecture Diagram',
            title: 'Architecture Diagram',
            locked: false,
            mermaidCode:
              'flowchart TD\n  Start([Start]) --> Process[Process]\n  Process --> End([End])',
            diagramOrientation: 'TB',
            diagramMode: 'embedded',
            isFocused: false,
          },
        });
        setToolMode('select');
      } else if (toolMode === 'image') {
        addNode({
          type: 'image',
          position,
          width: 240,
          height: 180,
          locked: false,
          data: {
            label: 'Image',
            locked: false,
          },
        });
        setToolMode('select');
      }
    },
    [
      contextMenu,
      toolMode,
      screenToFlowPosition,
      addNode,
      setToolMode,
      setSelectedNodes,
      setSelectedEdges,
      spawnFloatingNodeAtClientPos,
      isDark,
    ]
  );

  return {
    contextMenu,
    setContextMenu,
    isSpacePressed,
    openContextMenu,
    handleMouseDown,
    handleMouseUp,
    handlePaneContextMenu,
    handleNodeContextMenu,
    handlePaneClick,
  };
}
