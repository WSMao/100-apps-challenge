import React, { useMemo, useState } from 'react';
import {
  Square,
  Circle,
  Diamond,
  Database,
  Hexagon,
  RectangleHorizontal,
  Pill,
  Columns3,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Trash2,
  Ungroup,
  Group,
  Lock,
  Unlock,
  Shapes,
  Palette,
  Type,
  PenTool,
  BoxSelect,
  AlignLeft,
  AlignCenter,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore.ts';
import type { NeuroNode, ShapeType, NodeStyle } from '../../types/index.ts';
import type { AlignmentActionType } from '../../engine/index.ts';

export interface NodeFloatingActionBarProps {
  nodeId?: string;
  nodeIds?: string[];
  isStacked?: boolean;
}

const COLOR_SWATCHES = [
  { label: 'Transparent', value: 'transparent' },
  { label: 'White', value: '#ffffff' },
  { label: 'Slate', value: '#e2e8f0' },
  { label: 'Dark Slate', value: '#1e293b' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
];

const TEXT_COLOR_SWATCHES = [
  { label: 'Dark', value: '#0f172a' },
  { label: 'Light', value: '#f8fafc' },
  { label: 'Slate', value: '#475569' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
];

const STROKE_WIDTH_OPTIONS = [0, 1, 1.5, 2, 3, 4];

const FONT_SIZE_OPTIONS: { label: string; value: number }[] = [
  { label: 'S', value: 12 },
  { label: 'M', value: 14 },
  { label: 'L', value: 18 },
  { label: 'XL', value: 24 },
];

const TEXT_ALIGN_OPTIONS: { value: 'left' | 'center' | 'right'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'left', label: 'Align Left', icon: AlignLeft },
  { value: 'center', label: 'Align Center', icon: AlignCenter },
  { value: 'right', label: 'Align Right', icon: AlignRight },
];

const OPACITY_PRESETS = [0.25, 0.5, 0.75, 1];

const SHAPE_ITEMS: { type: ShapeType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'rectangle', label: 'Rectangle', icon: Square },
  { type: 'rounded', label: 'Rounded Box', icon: RectangleHorizontal },
  { type: 'circle', label: 'Circle', icon: Circle },
  { type: 'diamond', label: 'Diamond', icon: Diamond },
  { type: 'cylinder', label: 'Database', icon: Database },
  { type: 'hexagon', label: 'Hexagon', icon: Hexagon },
  { type: 'pill', label: 'Pill / Stadium', icon: Pill },
  { type: 'subroutine', label: 'Subroutine', icon: Columns3 },
];

export const NodeFloatingActionBar: React.FC<NodeFloatingActionBarProps> = ({
  nodeId,
  nodeIds,
  isStacked = false,
}) => {
  const nodes = useProjectStore((s) => s.nodes);
  const pages = useProjectStore((s) => s.pages);
  const activePageId = useProjectStore((s) => s.activePageId);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const batchUpdateNodeData = useProjectStore((s) => s.batchUpdateNodeData);
  const bringToFront = useProjectStore((s) => s.bringToFront);
  const sendToBack = useProjectStore((s) => s.sendToBack);
  const bringForward = useProjectStore((s) => s.bringForward);
  const sendBackward = useProjectStore((s) => s.sendBackward);
  const deleteNodes = useProjectStore((s) => s.deleteNodes);
  const setNodeLocked = useProjectStore((s) => s.setNodeLocked);
  const batchSetNodeLocked = useProjectStore((s) => s.batchSetNodeLocked);
  const groupSelectedNodes = useProjectStore((s) => s.groupSelectedNodes);
  const ungroupNodes = useProjectStore((s) => s.ungroupNodes);
  const setGroupStyle = useProjectStore((s) => s.setGroupStyle);
  const alignSelectedNodes = useProjectStore((s) => s.alignSelectedNodes);
  const themeMode = useProjectStore((s) => s.themeMode);

  const [openMenu, setOpenMenu] = useState<'shape' | 'bg' | 'text' | 'stroke' | 'opacity' | 'groupStyle' | 'align' | null>(null);
  const toggleMenu = (menu: 'shape' | 'bg' | 'text' | 'stroke' | 'opacity' | 'groupStyle' | 'align') =>
    setOpenMenu((prev) => (prev === menu ? null : menu));

  // Resolve target nodes (either from multi-selection nodeIds or single nodeId)
  const targetIds = useMemo(() => {
    if (nodeIds && nodeIds.length > 0) return nodeIds;
    if (nodeId) return [nodeId];
    return [];
  }, [nodeId, nodeIds]);

  const targetNodes = useMemo(() => {
    return targetIds.map((id) => nodes[id]).filter((n): n is NeuroNode => Boolean(n));
  }, [targetIds, nodes]);

  if (targetNodes.length === 0) return null;

  const isMulti = targetNodes.length > 1;
  const isDark = themeMode === 'dark';

  const applyStylePatch = (patch: Partial<NodeStyle>) => {
    if (isMulti) {
      batchUpdateNodeData(targetIds, patch);
    } else {
      updateNodeData(targetIds[0], patch);
    }
  };

  const primaryNode = targetNodes[0];
  const currentBg = primaryNode?.data?.backgroundColor || '#ffffff';
  const currentTextColor = primaryNode?.data?.color || '#0f172a';
  const currentStrokeColor = primaryNode?.data?.borderColor || '#94a3b8';
  const currentStrokeWidth = primaryNode?.data?.borderWidth ?? 1.5;
  const currentFontSize = primaryNode?.data?.fontSize ?? primaryNode?.data?.style?.fontSize ?? 14;
  const currentTextAlign = primaryNode?.data?.textAlign ?? primaryNode?.data?.style?.textAlign ?? 'center';
  const currentOpacity = primaryNode?.data?.opacity ?? primaryNode?.data?.style?.opacity ?? 1;

  // Lock status resolution
  const isAllLocked = targetNodes.every((n) => Boolean(n.locked || n.data?.locked));
  const nextLocked = !isAllLocked;

  // Group status resolution
  const firstGid = targetNodes[0]?.groupId || targetNodes[0]?.data?.groupId;
  const isAllGrouped = Boolean(firstGid) && targetNodes.every((n) => (n.groupId || n.data?.groupId) === firstGid);

  // Shape resolution
  const shapeNodes = targetNodes.filter((n) => n.type === 'shape' || !n.type);
  const hasShapeNodes = shapeNodes.length > 0;
  const firstShape = shapeNodes[0]?.data?.shapeType || 'rounded';
  const isUniformShape = shapeNodes.every((n) => (n.data?.shapeType || 'rounded') === firstShape);
  const currentShape = isUniformShape ? firstShape : 'shapes';

  const positionClasses = isStacked
    ? 'flex items-center gap-1 px-2 py-1 rounded-xl shadow-2xl border transition-all select-none pointer-events-auto'
    : 'absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-xl shadow-2xl border transition-all select-none pointer-events-auto';

  return (
    <div
      className={`${positionClasses} z-[999999] ${
        isDark
          ? 'bg-slate-900 border-slate-700 text-slate-100'
          : 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50'
      }`}
      style={{ zIndex: 999999 }}
      onClick={(e) => e.stopPropagation()}
      data-testid="node-floating-action-bar"
      data-is-multi={isMulti ? 'true' : 'false'}
    >
      {/* 0. Lock Toggle - Single or Batch */}
      <button
        type="button"
        onClick={() => {
          if (isMulti) {
            batchSetNodeLocked(targetIds, nextLocked);
          } else {
            setNodeLocked(targetIds[0], nextLocked);
          }
        }}
        title={isAllLocked ? 'Locked (點擊解鎖)' : 'Unlocked (點擊鎖定)'}
        className={`px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-medium cursor-pointer transition ${
          isAllLocked
            ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/40'
            : isDark
            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
        }`}
        data-testid="toggle-node-lock"
      >
        {isAllLocked ? (
          <>
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Locked</span>
          </>
        ) : (
          <>
            <Unlock className="w-3.5 h-3.5 text-slate-400" />
            <span>Lock</span>
          </>
        )}
      </button>

      <div className={`w-[1px] h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* 1. Shape Switcher - Batch applies to all selected nodes */}
      {hasShapeNodes && (
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('shape')}
            title={isMulti ? `Switch Shape (${targetNodes.length} items)` : 'Switch Shape'}
            className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-medium cursor-pointer transition ${
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
            }`}
            data-testid="action-switch-shape"
          >
            {isUniformShape ? (
              <Square className="w-3.5 h-3.5 text-cyan-500" />
            ) : (
              <Shapes className="w-3.5 h-3.5 text-cyan-500" />
            )}
            <span className="capitalize text-[11px]">{currentShape}</span>
          </button>

          {openMenu === 'shape' && (
            <div
              className={`absolute top-full left-0 mt-1 py-1 w-36 rounded-lg shadow-xl border z-[100000] grid grid-cols-1 gap-0.5 ${
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              {SHAPE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      if (isMulti) {
                        batchUpdateNodeData(targetIds, { shapeType: item.type });
                      } else {
                        updateNodeData(targetIds[0], { shapeType: item.type });
                      }
                      setOpenMenu(null);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1 text-xs text-left cursor-pointer transition ${
                      currentShape === item.type
                        ? 'bg-cyan-500/15 text-cyan-500 font-semibold'
                        : isDark
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    data-testid={`shape-option-${item.type}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 1.5 Style Controls: Background Color, Text Color, Stroke Color & Width */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('bg')}
          title="Background Color"
          data-testid="action-style-bg"
          className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span
            className="w-2.5 h-2.5 rounded-full border border-slate-400"
            style={{ backgroundColor: currentBg === 'transparent' ? 'transparent' : currentBg }}
          />
        </button>
        {openMenu === 'bg' && (
          <div
            className={`absolute top-full left-0 mt-1 p-2 w-44 rounded-lg shadow-xl border z-[100000] grid grid-cols-5 gap-1.5 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}
            data-testid="style-bg-palette"
          >
            {COLOR_SWATCHES.map((sw) => (
              <button
                key={sw.value}
                type="button"
                title={sw.label}
                data-testid={`bg-color-${sw.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => {
                  applyStylePatch({ backgroundColor: sw.value });
                  setOpenMenu(null);
                }}
                className={`w-6 h-6 rounded-md border cursor-pointer transition hover:scale-110 ${
                  currentBg === sw.value ? 'ring-2 ring-cyan-400' : 'border-slate-400/50'
                }`}
                style={{
                  backgroundColor: sw.value === 'transparent' ? 'transparent' : sw.value,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('text')}
          title="Text Color"
          data-testid="action-style-text"
          className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span
            className="w-2.5 h-1 rounded-full"
            style={{ backgroundColor: currentTextColor }}
          />
        </button>
        {openMenu === 'text' && (
          <div
            className={`absolute top-full left-0 mt-1 p-2 w-44 rounded-lg shadow-xl border z-[100000] flex flex-col gap-2 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}
            data-testid="style-text-palette"
          >
            <div className="grid grid-cols-4 gap-1.5">
              {TEXT_COLOR_SWATCHES.map((sw) => (
                <button
                  key={sw.value}
                  type="button"
                  title={sw.label}
                  data-testid={`text-color-${sw.label.toLowerCase()}`}
                  onClick={() => {
                    applyStylePatch({ color: sw.value });
                    setOpenMenu(null);
                  }}
                  className={`w-6 h-6 rounded-md border cursor-pointer transition hover:scale-110 ${
                    currentTextColor === sw.value ? 'ring-2 ring-cyan-400' : 'border-slate-400/50'
                  }`}
                  style={{ backgroundColor: sw.value }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 pt-1 border-t border-slate-700/30">
              {FONT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  title={`Font Size: ${opt.label} (${opt.value}px)`}
                  data-testid={`font-size-${opt.value}`}
                  onClick={() => applyStylePatch({ fontSize: opt.value })}
                  className={`flex-1 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition ${
                    currentFontSize === opt.value
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : isDark
                      ? 'hover:bg-slate-800 text-slate-300'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 pt-1 border-t border-slate-700/30">
              {TEXT_ALIGN_OPTIONS.map((opt) => {
                const AlignIcon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    data-testid={`text-align-${opt.value}`}
                    onClick={() => applyStylePatch({ textAlign: opt.value })}
                    className={`flex-1 py-1 rounded flex items-center justify-center cursor-pointer transition ${
                      currentTextAlign === opt.value
                        ? 'bg-cyan-500 text-slate-950'
                        : isDark
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <AlignIcon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('stroke')}
          title="Stroke Color & Width"
          data-testid="action-style-stroke"
          className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono">{currentStrokeWidth}px</span>
        </button>
        {openMenu === 'stroke' && (
          <div
            className={`absolute top-full left-0 mt-1 p-2 w-48 rounded-lg shadow-xl border z-[100000] flex flex-col gap-2 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}
            data-testid="style-stroke-menu"
          >
            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_SWATCHES.map((sw) => (
                <button
                  key={sw.value}
                  type="button"
                  title={`Stroke: ${sw.label}`}
                  data-testid={`stroke-color-${sw.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => {
                    applyStylePatch({ borderColor: sw.value });
                    setOpenMenu(null);
                  }}
                  className={`w-6 h-6 rounded-md border cursor-pointer transition hover:scale-110 ${
                    currentStrokeColor === sw.value ? 'ring-2 ring-cyan-400' : 'border-slate-400/50'
                  }`}
                  style={{
                    backgroundColor: sw.value === 'transparent' ? 'transparent' : sw.value,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 pt-1 border-t border-slate-700/30">
              {STROKE_WIDTH_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  data-testid={`stroke-width-${w}`}
                  onClick={() => {
                    applyStylePatch({ borderWidth: w });
                    setOpenMenu(null);
                  }}
                  className={`flex-1 py-0.5 rounded text-[10px] font-mono cursor-pointer transition ${
                    currentStrokeWidth === w
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : isDark
                      ? 'hover:bg-slate-800 text-slate-300'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('opacity')}
          title="Opacity"
          data-testid="action-style-opacity"
          className={`px-1.5 py-1 rounded-lg flex items-center gap-1 text-[10px] font-mono cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          {Math.round(currentOpacity * 100)}%
        </button>
        {openMenu === 'opacity' && (
          <div
            className={`absolute top-full left-0 mt-1 p-2 w-40 rounded-lg shadow-xl border z-[100000] flex flex-col gap-2 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}
            data-testid="style-opacity-menu"
          >
            <div className="flex items-center gap-1">
              {OPACITY_PRESETS.map((op) => (
                <button
                  key={op}
                  type="button"
                  data-testid={`opacity-preset-${Math.round(op * 100)}`}
                  onClick={() => {
                    applyStylePatch({ opacity: op });
                    setOpenMenu(null);
                  }}
                  className={`flex-1 py-0.5 rounded text-[10px] font-mono cursor-pointer transition ${
                    Math.abs(currentOpacity - op) < 0.01
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : isDark
                      ? 'hover:bg-slate-800 text-slate-300'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {Math.round(op * 100)}%
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={currentOpacity}
              data-testid="opacity-slider"
              onChange={(e) => applyStylePatch({ opacity: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        )}
      </div>

      <div className={`w-[1px] h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* 2. Complete Z-Order Controls (Front, Up, Down, Back) */}
      <button
        type="button"
        onClick={() => bringToFront(targetIds)}
        title={isMulti ? `Bring ${targetNodes.length} items to Front` : 'Bring to Front'}
        className={`p-1.5 rounded-lg cursor-pointer transition ${
          isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
        }`}
        data-testid="action-bring-to-front"
      >
        <ArrowUpToLine className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => bringForward(targetIds)}
        title="Bring Forward (Up)"
        className={`p-1.5 rounded-lg cursor-pointer transition ${
          isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
        }`}
        data-testid="action-bring-forward"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => sendBackward(targetIds)}
        title="Send Backward (Down)"
        className={`p-1.5 rounded-lg cursor-pointer transition ${
          isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
        }`}
        data-testid="action-send-backward"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => sendToBack(targetIds)}
        title={isMulti ? `Send ${targetNodes.length} items to Back` : 'Send to Back'}
        className={`p-1.5 rounded-lg cursor-pointer transition ${
          isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
        }`}
        data-testid="action-send-to-back"
      >
        <ArrowDownToLine className="w-3.5 h-3.5" />
      </button>

      {/* 3. Group / Ungroup & Group Style (FN-04) */}
      {isMulti && (
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('align')}
            title="Align & Distribute Selected Objects"
            className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
            data-testid="action-align-menu"
          >
            <AlignLeft className="w-3.5 h-3.5 text-cyan-500" />
            <span className="text-[11px] font-medium">Align</span>
          </button>
          {openMenu === 'align' && (
            <div
              className={`absolute top-full left-0 mt-1 p-2 w-48 rounded-lg shadow-xl border z-[100000] flex flex-col gap-1.5 ${
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
              data-testid="align-menu"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Align Horizontal
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { action: 'align-left', label: 'Align Left', icon: AlignLeft },
                    { action: 'align-center-h', label: 'Align Center H', icon: AlignCenterHorizontal },
                    { action: 'align-right', label: 'Align Right', icon: AlignRight },
                  ] as const
                ).map(({ action, label, icon: Icon }) => (
                  <button
                    key={action}
                    type="button"
                    title={label}
                    data-testid={action}
                    onClick={() => {
                      alignSelectedNodes(action as AlignmentActionType);
                      setOpenMenu(null);
                    }}
                    className={`p-1.5 rounded-md flex items-center justify-center cursor-pointer transition ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Align Vertical
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { action: 'align-top', label: 'Align Top', icon: AlignStartHorizontal },
                    { action: 'align-center-v', label: 'Align Center V', icon: AlignCenterVertical },
                    { action: 'align-bottom', label: 'Align Bottom', icon: AlignEndHorizontal },
                  ] as const
                ).map(({ action, label, icon: Icon }) => (
                  <button
                    key={action}
                    type="button"
                    title={label}
                    data-testid={action}
                    onClick={() => {
                      alignSelectedNodes(action as AlignmentActionType);
                      setOpenMenu(null);
                    }}
                    className={`p-1.5 rounded-md flex items-center justify-center cursor-pointer transition ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
              {targetNodes.length >= 3 && (
                <>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Distribute
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      title="Distribute Horizontally"
                      data-testid="distribute-h"
                      onClick={() => {
                        alignSelectedNodes('distribute-h');
                        setOpenMenu(null);
                      }}
                      className={`p-1.5 rounded-md flex items-center justify-center gap-1 text-[11px] cursor-pointer transition ${
                        isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <AlignHorizontalDistributeCenter className="w-3.5 h-3.5" />
                      <span>Horiz</span>
                    </button>
                    <button
                      type="button"
                      title="Distribute Vertically"
                      data-testid="distribute-v"
                      onClick={() => {
                        alignSelectedNodes('distribute-v');
                        setOpenMenu(null);
                      }}
                      className={`p-1.5 rounded-md flex items-center justify-center gap-1 text-[11px] cursor-pointer transition ${
                        isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <AlignVerticalDistributeCenter className="w-3.5 h-3.5" />
                      <span>Vert</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isMulti && !isAllGrouped && (
        <button
          type="button"
          onClick={() => groupSelectedNodes()}
          title="Group Selected (⌘G)"
          className={`p-1.5 rounded-lg cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="action-group-nodes"
        >
          <Group className="w-3.5 h-3.5 text-indigo-400" />
        </button>
      )}

      {isAllGrouped && firstGid && (
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('groupStyle')}
            title="Logical Group Border & Background Style"
            className={`p-1.5 rounded-lg cursor-pointer transition ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
            data-testid="action-group-style"
          >
            <BoxSelect className="w-3.5 h-3.5 text-indigo-400" />
          </button>
          {openMenu === 'groupStyle' && (
            <div
              className={`absolute top-full right-0 mt-1 p-2.5 w-48 rounded-lg shadow-xl border z-[100000] flex flex-col gap-2 ${
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
              data-testid="group-style-menu"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Group Background
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_SWATCHES.slice(0, 5).map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    title={sw.label}
                    data-testid={`group-bg-${sw.label.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => {
                      const currentGroupStyle = pages[activePageId]?.groupStyles?.[firstGid];
                      setGroupStyle(firstGid, {
                        ...currentGroupStyle,
                        backgroundColor: sw.value === 'transparent' ? 'transparent' : `${sw.value}26`,
                      });
                      setOpenMenu(null);
                    }}
                    className="w-6 h-6 rounded-md border border-slate-400/50 cursor-pointer hover:scale-110 transition"
                    style={{ backgroundColor: sw.value === 'transparent' ? 'transparent' : sw.value }}
                  />
                ))}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Group Border
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_SWATCHES.slice(4, 9).map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    title={sw.label}
                    data-testid={`group-border-${sw.label.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => {
                      const currentGroupStyle = pages[activePageId]?.groupStyles?.[firstGid];
                      setGroupStyle(firstGid, {
                        ...currentGroupStyle,
                        borderColor: sw.value,
                        borderWidth: currentGroupStyle?.borderWidth ?? 2,
                      });
                      setOpenMenu(null);
                    }}
                    className="w-6 h-6 rounded-md border border-slate-400/50 cursor-pointer hover:scale-110 transition"
                    style={{ backgroundColor: sw.value }}
                  />
                ))}
              </div>
              <button
                type="button"
                data-testid="group-style-reset"
                onClick={() => {
                  setGroupStyle(firstGid, null);
                  setOpenMenu(null);
                }}
                className="text-[10px] py-1 rounded bg-slate-500/15 hover:bg-slate-500/25 text-slate-400 cursor-pointer"
              >
                Reset Transparent
              </button>
            </div>
          )}
        </div>
      )}

      {(isAllGrouped || (!isMulti && (firstGid || targetNodes[0]?.type === 'frame'))) && (
        <button
          type="button"
          onClick={() => {
            const targetGroupId = firstGid || targetIds[0];
            ungroupNodes(targetGroupId);
          }}
          title="Ungroup (⌘⇧G)"
          className={`p-1.5 rounded-lg cursor-pointer transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
          }`}
          data-testid="action-ungroup-nodes"
        >
          <Ungroup className="w-3.5 h-3.5 text-amber-500" />
        </button>
      )}

      <div className={`w-[1px] h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* 4. Delete - Batch deletes all target nodes */}
      <button
        type="button"
        onClick={() => deleteNodes(targetIds)}
        title={isMulti ? `Delete ${targetNodes.length} Selected Nodes` : 'Delete Node'}
        className="p-1.5 rounded-lg cursor-pointer hover:bg-rose-500/15 text-rose-500 transition"
        data-testid="action-delete-nodes"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
