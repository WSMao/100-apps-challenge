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

import React, { useState, useRef, useEffect } from 'react';
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
  GitCommit,
  CornerDownRight,
  Minus,
  Check,
  X,
} from 'lucide-react';
import type { EdgeRoutingType, ShapeType, ToolMode, SelectionFilter } from '../../types/index.ts';
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

export interface ConnectorOptionConfig {
  type: EdgeRoutingType;
  label: string;
  tag: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const CONNECTOR_OPTIONS: ConnectorOptionConfig[] = [
  {
    type: 'jump',
    label: 'Jump Arc (避障跳線)',
    tag: 'Jump',
    description: '自動跳過相交連線 (推薦)',
    icon: GitCommit,
  },
  {
    type: 'smoothstep',
    label: 'Smoothstep (直角折線)',
    tag: 'Step',
    description: '標準正交折線幾何',
    icon: CornerDownRight,
  },
  {
    type: 'bezier',
    label: 'Bezier (平滑曲線)',
    tag: 'Bezier',
    description: '優雅貝茲平滑曲度',
    icon: Spline,
  },
  {
    type: 'straight',
    label: 'Straight (直接直線)',
    tag: 'Straight',
    description: '兩端點間直線連接',
    icon: Minus,
  },
];

const CONNECTOR_ICON_MAP: Record<EdgeRoutingType, React.ComponentType<{ className?: string }>> = {
  jump: GitCommit,
  smoothstep: CornerDownRight,
  bezier: Spline,
  straight: Minus,
};

const FILTER_ITEMS: { key: keyof SelectionFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'shape', label: '形狀與節點 (Shapes)', icon: Square },
  { key: 'edge', label: '連接線段 (Lines / Edges)', icon: Spline },
  { key: 'text', label: '文字區塊 (Text Blocks)', icon: Type },
  { key: 'frame', label: '容器外框 (Frames)', icon: Frame },
  { key: 'diagram', label: 'Mermaid 圖表 (Diagrams)', icon: FileCode2 },
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
  const themeMode = useProjectStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';
  const defaultEdgeRoutingType = useProjectStore((s) => s.defaultEdgeRoutingType || 'jump');
  const setDefaultEdgeRoutingType = useProjectStore((s) => s.setDefaultEdgeRoutingType);
  const selectionFilter = useProjectStore((s) => s.selectionFilter);
  const toggleSelectionFilterItem = useProjectStore((s) => s.toggleSelectionFilterItem);
  const resetSelectionFilter = useProjectStore((s) => s.resetSelectionFilter);
  const clearSelectionFilter = useProjectStore((s) => s.clearSelectionFilter);

  const toolbarRef = useRef<HTMLElement | null>(null);

  const [internalShape, setInternalShape] = useState<ShapeType>('rounded');
  const [showShapeMenu, setShowShapeMenu] = useState<boolean>(false);
  const [showConnectorMenu, setShowConnectorMenu] = useState<boolean>(false);
  const [showSelectFilterMenu, setShowSelectFilterMenu] = useState<boolean>(false);

  // Close all submenus when clicking outside of the toolbar
  useEffect(() => {
    if (!showSelectFilterMenu && !showShapeMenu && !showConnectorMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as HTMLElement)) {
        setShowSelectFilterMenu(false);
        setShowShapeMenu(false);
        setShowConnectorMenu(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showSelectFilterMenu, showShapeMenu, showConnectorMenu]);

  const selectedShape = controlledShape ?? internalShape;
  const isAnyFilterDisabled = Object.values(selectionFilter).some((v) => !v);

  const handleSelectTool = (mode: ToolMode) => {
    setToolMode(mode);
    if (mode === 'select') {
      setShowSelectFilterMenu((prev) => !prev);
      setShowShapeMenu(false);
      setShowConnectorMenu(false);
    } else if (mode === 'shape') {
      setShowShapeMenu((prev) => !prev);
      setShowConnectorMenu(false);
      setShowSelectFilterMenu(false);
    } else if (mode === 'connect') {
      setShowConnectorMenu((prev) => !prev);
      setShowShapeMenu(false);
      setShowSelectFilterMenu(false);
    } else {
      setShowShapeMenu(false);
      setShowConnectorMenu(false);
      setShowSelectFilterMenu(false);
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
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
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
      ref={toolbarRef}
      className={`relative z-20 flex flex-col items-center py-3 px-2 gap-1.5 backdrop-blur-md select-none shrink-0 transition-colors duration-200 border-r ${
        isDark
          ? 'bg-slate-900/95 border-slate-800 text-slate-100'
          : 'bg-white/95 border-slate-200 text-slate-800 shadow-sm'
      } ${className}`}
      aria-label="Canvas Tool Sidebar"
      data-testid="workspace-toolbar"
      data-active-shape={selectedShape}
    >
      {TOOL_ITEMS.map(({ mode, label, shortcut, icon: Icon }) => {
        const isActive = toolMode === mode;
        const DynamicIcon =
          mode === 'connect'
            ? CONNECTOR_ICON_MAP[defaultEdgeRoutingType] || Icon
            : Icon;
        const buttonTitle =
          mode === 'connect'
            ? `Connector Tool (${shortcut}) — Preset: ${defaultEdgeRoutingType} (Click to switch type)`
            : `${label} (${shortcut}) — Double-click to quick-insert`;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => handleSelectTool(mode)}
            onDoubleClick={() => handleQuickSpawnNode(mode)}
            title={buttonTitle}
            aria-label={`${label} (${shortcut})`}
            aria-pressed={isActive}
            className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : isDark
                ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            data-testid={`tool-btn-${mode}`}
          >
            <DynamicIcon className="w-4 h-4" />
            {mode === 'select' && isAnyFilterDisabled && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]"
                title="已套用選取物件過濾"
              />
            )}
            <span
              className={`absolute bottom-0.5 right-1 text-[9px] font-bold leading-none ${
                isActive
                  ? 'text-indigo-200'
                  : isDark
                  ? 'text-slate-500 group-hover:text-slate-400'
                  : 'text-slate-400 group-hover:text-slate-600'
              }`}
            >
              {shortcut}
            </span>
          </button>
        );
      })}

      {/* Divider */}
      <div className={`w-6 h-px my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

      {/* Quick Spawn Active Shape Button */}
      <button
        type="button"
        onClick={() => handleQuickSpawnNode('shape', selectedShape)}
        title={`Quick Insert ${selectedShape} node`}
        aria-label={`Quick Insert ${selectedShape} node`}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-500 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/25 transition cursor-pointer"
        data-testid="quick-spawn-shape-btn"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Floating Selection Filter Popover (TL-06) */}
      {showSelectFilterMenu && (
        <div
          className={`absolute left-16 top-2 w-64 p-3 rounded-2xl shadow-2xl backdrop-blur-md space-y-2 z-40 border transition-all ${
            isDark
              ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-black/50'
              : 'bg-white/95 border-slate-200 text-slate-850 shadow-slate-300/40'
          }`}
          data-testid="selection-filter-sub-selector"
        >
          <div
            className={`px-1 py-1 flex items-center justify-between border-b mb-1 ${
              isDark ? 'border-slate-800/80' : 'border-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                可選取物件
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => resetSelectionFilter()}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer font-medium hover:underline"
                data-testid="selection-filter-select-all-btn"
              >
                全選
              </button>
              <button
                type="button"
                onClick={() => clearSelectionFilter()}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer font-medium hover:underline"
                data-testid="selection-filter-clear-all-btn"
              >
                取消全選
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {FILTER_ITEMS.map(({ key, label, icon: FilterIcon }) => {
              const isChecked = selectionFilter[key];
              return (
                <label
                  key={key}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition select-none ${
                    isChecked
                      ? isDark
                        ? 'text-slate-200 hover:bg-slate-800/80'
                        : 'text-slate-700 hover:bg-slate-100'
                      : isDark
                      ? 'text-slate-500 hover:bg-slate-800/40 opacity-60'
                      : 'text-slate-400 hover:bg-slate-50 opacity-60'
                  }`}
                  data-testid={`selection-filter-option-${key}`}
                >
                  <div className="flex items-center gap-2">
                    <FilterIcon className={`w-3.5 h-3.5 ${isChecked ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="font-medium text-xs">{label}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelectionFilterItem(key)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer accent-indigo-600"
                    data-testid={`selection-filter-checkbox-${key}`}
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Shape Sub-Selector Popover */}
      {showShapeMenu && (
        <div
          className={`absolute left-16 top-12 w-48 p-2 rounded-2xl shadow-2xl backdrop-blur-md space-y-1 z-30 border transition-all ${
            isDark
              ? 'bg-slate-900/95 border-slate-800 text-slate-100'
              : 'bg-white/95 border-slate-200 text-slate-850 shadow-slate-300/40'
          }`}
          data-testid="shape-sub-selector"
        >
          <div className={`px-2 py-1 flex items-center justify-between border-b mb-1 ${
            isDark ? 'border-slate-800/80' : 'border-slate-100'
          }`}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Shape Type
            </span>
            <span className="text-[10px] text-indigo-500 font-medium">
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
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold'
                      : isDark
                      ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  onClick={() => handleSelectShape(shape)}
                  data-testid={`shape-option-${shape}`}
                >
                  <div className="flex items-center gap-2">
                    <ShapeIcon className="w-3.5 h-3.5 text-indigo-500" />
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
                    className={`p-0.5 rounded cursor-pointer ${
                      isDark
                        ? 'hover:bg-indigo-500/30 text-slate-400 hover:text-white'
                        : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                    }`}
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

      {/* Floating Connector Sub-Selector Popover (TL-05) */}
      {showConnectorMenu && (
        <div
          className={`absolute left-16 top-32 w-56 p-2 rounded-2xl shadow-2xl backdrop-blur-md space-y-1.5 z-30 border transition-all ${
            isDark
              ? 'bg-slate-900/95 border-slate-800 text-slate-100'
              : 'bg-white/95 border-slate-200 text-slate-850 shadow-slate-300/40'
          }`}
          data-testid="connector-sub-selector"
        >
          <div
            className={`px-2 py-1 flex items-center justify-between border-b mb-1 ${
              isDark ? 'border-slate-800/80' : 'border-slate-100'
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Connector Type
            </span>
            <span className="text-[10px] text-indigo-500 font-medium font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              {defaultEdgeRoutingType}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1">
            {CONNECTOR_OPTIONS.map(({ type, label, description, icon: ConnIcon }) => {
              const isSelected = defaultEdgeRoutingType === type;
              return (
                <div
                  key={type}
                  className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-xs cursor-pointer transition select-none ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold'
                      : isDark
                      ? 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                  }`}
                  onClick={() => {
                    setDefaultEdgeRoutingType(type);
                    setToolMode('connect');
                  }}
                  data-testid={`connector-option-${type}`}
                >
                  <div
                    className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isDark
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <ConnIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{label}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">
                      {description}
                    </div>
                  </div>
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
