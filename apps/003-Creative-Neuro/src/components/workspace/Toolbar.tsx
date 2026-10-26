/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Left Floating Tool Mode Sidebar & Shape Sub-Selector (Toolbar)
 *
 * Modes:
 * - `select` (V): Pointer selection & drag
 * - `shape` (R): Geometric flowchart/mindmap shape node + Shape Sub-Selector
 * - `text` (T): Standalone auto-resizing text block
 * - `connect` (C): Smart JumpConnector edge drawing
 * - `draw` (P): Freehand vector doodle (`perfect-freehand`)
 * - `frame` (F): Grouping container FrameNode
 * - `diagram` (D): Dual-Mode Mermaid DiagramNode card
 */

import React, { useState } from 'react';
import {
  MousePointer2,
  Square,
  Type,
  Spline,
  PenTool,
  Frame,
  FileCode2,
  Circle,
  Diamond,
  Database,
  Hexagon,
  RectangleHorizontal,
  Pill,
  Columns3,
  Plus,
} from 'lucide-react';
import type { ShapeType, ToolMode } from '../../types/index.ts';
import { useProjectStore } from '../../store/projectStore.ts';

export interface ToolbarProps {
  activeShapeType?: ShapeType;
  onShapeTypeChange?: (shape: ShapeType) => void;
  className?: string;
}

interface ToolItemConfig {
  mode: ToolMode;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOOL_ITEMS: ToolItemConfig[] = [
  { mode: 'select', label: 'Select & Move', shortcut: 'V', icon: MousePointer2 },
  { mode: 'shape', label: 'Shape Node', shortcut: 'R', icon: Square },
  { mode: 'text', label: 'Text Block', shortcut: 'T', icon: Type },
  { mode: 'connect', label: 'Connector Line', shortcut: 'C', icon: Spline },
  { mode: 'draw', label: 'Freehand Pen', shortcut: 'P', icon: PenTool },
  { mode: 'frame', label: 'Container Frame', shortcut: 'F', icon: Frame },
  { mode: 'diagram', label: 'Mermaid Diagram', shortcut: 'D', icon: FileCode2 },
];

interface ShapeOptionConfig {
  shape: ShapeType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SHAPE_OPTIONS: ShapeOptionConfig[] = [
  { shape: 'rectangle', label: 'Rectangle', icon: Square },
  { shape: 'rounded', label: 'Rounded Box', icon: RectangleHorizontal },
  { shape: 'diamond', label: 'Decision Diamond', icon: Diamond },
  { shape: 'circle', label: 'Circle Terminal', icon: Circle },
  { shape: 'cylinder', label: 'Cylinder Database', icon: Database },
  { shape: 'hexagon', label: 'Hexagon Step', icon: Hexagon },
  { shape: 'pill', label: 'Pill / Stadium', icon: Pill },
  { shape: 'subroutine', label: 'Subroutine', icon: Columns3 },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  activeShapeType: controlledShape,
  onShapeTypeChange,
  className = '',
}) => {
  const toolMode = useProjectStore((s) => s.toolMode);
  const setToolMode = useProjectStore((s) => s.setToolMode);
  const addNode = useProjectStore((s) => s.addNode);
  const setSelectedNodes = useProjectStore((s) => s.setSelectedNodes);

  const [internalShape, setInternalShape] = useState<ShapeType>('rounded');
  const [showShapeMenu, setShowShapeMenu] = useState<boolean>(false);

  const selectedShape = controlledShape ?? internalShape;

  const handleSelectTool = (mode: ToolMode) => {
    setToolMode(mode);
    if (mode === 'shape') {
      setShowShapeMenu((prev) => (toolMode === 'shape' ? !prev : true));
    } else {
      setShowShapeMenu(false);
    }
  };

  const handleSelectShape = (shape: ShapeType) => {
    setInternalShape(shape);
    onShapeTypeChange?.(shape);
    setToolMode('shape');
  };

  const handleQuickSpawnNode = (mode: ToolMode, shapeOverride?: ShapeType) => {
    const offset = Math.floor(Math.random() * 60);
    if (mode === 'shape') {
      const targetShape = shapeOverride || selectedShape;
      const newId = addNode({
        type: 'shape',
        position: { x: 260 + offset, y: 200 + offset },
        width: targetShape === 'diamond' ? 150 : 160,
        height: targetShape === 'diamond' ? 90 : 60,
        layoutMode: 'manual',
        data: {
          label: `${targetShape.charAt(0).toUpperCase() + targetShape.slice(1)} Node`,
          shapeType: targetShape,
          layoutMode: 'manual',
        },
      });
      setSelectedNodes([newId]);
    } else if (mode === 'text') {
      const newId = addNode({
        type: 'text',
        position: { x: 280 + offset, y: 220 + offset },
        width: 200,
        height: 60,
        layoutMode: 'manual',
        data: {
          label: 'Double-click to edit note...',
          layoutMode: 'manual',
        },
      });
      setSelectedNodes([newId]);
    } else if (mode === 'frame') {
      const newId = addNode({
        type: 'frame',
        position: { x: 220 + offset, y: 160 + offset },
        width: 360,
        height: 260,
        layoutMode: 'manual',
        data: {
          label: 'Container Group',
          title: 'Container Group',
          collapsed: false,
          direction: 'TB',
          layoutMode: 'manual',
        },
      });
      setSelectedNodes([newId]);
    } else if (mode === 'diagram') {
      const newId = addNode({
        type: 'diagram',
        position: { x: 240 + offset, y: 180 + offset },
        width: 340,
        height: 260,
        layoutMode: 'manual',
        data: {
          label: 'Mermaid Diagram',
          title: 'Mermaid Diagram',
          diagramMode: 'embedded',
          diagramOrientation: 'TB',
          mermaidCode: 'flowchart TD\n  Start([Start]) --> Process[Action]\n  Process --> End([Done])',
          layoutMode: 'manual',
        },
      });
      setSelectedNodes([newId]);
    }
  };

  return (
    <aside
      className={`relative z-20 flex flex-col items-center py-3 px-2 gap-1.5 bg-slate-900/95 border-r border-slate-800 backdrop-blur-md select-none shrink-0 ${className}`}
      aria-label="Canvas Tool Sidebar"
      data-testid="workspace-toolbar"
      data-active-shape={selectedShape}
    >
      {TOOL_ITEMS.map(({ mode, label, shortcut, icon: Icon }) => {
        const isActive = toolMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => handleSelectTool(mode)}
            onDoubleClick={() => handleQuickSpawnNode(mode)}
            title={`${label} (${shortcut}) — Double-click to quick-insert`}
            aria-label={`${label} (${shortcut})`}
            aria-pressed={isActive}
            className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
            data-testid={`tool-btn-${mode}`}
          >
            <Icon className="w-4 h-4" />
            <span
              className={`absolute bottom-0.5 right-1 text-[9px] font-bold leading-none ${
                isActive ? 'text-indigo-200' : 'text-slate-500 group-hover:text-slate-400'
              }`}
            >
              {shortcut}
            </span>
          </button>
        );
      })}

      {/* Divider */}
      <div className="w-6 h-px bg-slate-800 my-1" />

      {/* Quick Spawn Active Shape Button */}
      <button
        type="button"
        onClick={() => handleQuickSpawnNode('shape', selectedShape)}
        title={`Quick Insert ${selectedShape} node`}
        aria-label={`Quick Insert ${selectedShape} node`}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/25 transition"
        data-testid="quick-spawn-shape-btn"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Floating Shape Sub-Selector Popover */}
      {(toolMode === 'shape' || showShapeMenu) && (
        <div
          className="absolute left-16 top-12 w-48 p-2 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md space-y-1 z-30"
          data-testid="shape-sub-selector"
        >
          <div className="px-2 py-1 flex items-center justify-between border-b border-slate-800/80 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Shape Type
            </span>
            <span className="text-[10px] text-indigo-400 font-medium">
              {selectedShape}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-0.5">
            {SHAPE_OPTIONS.map(({ shape, label, icon: ShapeIcon }) => {
              const isSelected = selectedShape === shape;
              return (
                <div
                  key={shape}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  onClick={() => handleSelectShape(shape)}
                  data-testid={`shape-option-${shape}`}
                >
                  <div className="flex items-center gap-2">
                    <ShapeIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectShape(shape);
                      handleQuickSpawnNode('shape', shape);
                    }}
                    title={`Insert ${label}`}
                    className="p-0.5 rounded hover:bg-indigo-500/30 text-slate-400 hover:text-white"
                    data-testid={`insert-shape-${shape}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Toolbar;
