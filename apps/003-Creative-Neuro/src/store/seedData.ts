/**
 * Creative-Neuro Preloaded Interactive Seed Dataset
 *
 * Showcases:
 * 1. Page 1 ("Mind Map & Concepts"): Hierarchical tree with root, branches, and leaves.
 * 2. Page 2 ("Engine Flowchart & Jumps"): Multi-directional flowchart with decision diamonds,
 *    cylinder databases, line crossings demonstrating SVG line jumps, and an embedded DiagramCard.
 * 3. Page 3 ("Containers & Subgraphs"): Multi-container grouping with nested FrameNodes,
 *    cross-frame connections, and parent-child bounding.
 */

import type {
  Project,
  Board,
  Page,
  NeuroNode,
  NeuroEdge,
  SerializedProjectPayload,
} from '../types/index.ts';

// ============================================================================
// 1. Project & Board Metadata
// ============================================================================

export const SEED_PROJECT_ID = 'proj-creative-neuro-demo';
export const SEED_BOARD_ID = 'board-main';

export const SEED_PAGE_IDS = {
  mindmap: 'page-mindmap',
  flowchart: 'page-flowchart',
  containers: 'page-containers',
} as const;

export const SEED_PROJECT: Project = {
  id: SEED_PROJECT_ID,
  name: 'Demo',
  description: 'Phase 1 All-in-One Visual Thinking MVP (Mind Map + Flowchart + Whiteboard)',
  version: '1.0.0',
  activeBoardId: SEED_BOARD_ID,
  boardIds: [SEED_BOARD_ID],
  activePageId: SEED_PAGE_IDS.mindmap,
  pageIds: [
    SEED_PAGE_IDS.mindmap,
    SEED_PAGE_IDS.flowchart,
    SEED_PAGE_IDS.containers,
  ],
  createdAt: 1735000000000,
  updatedAt: 1735000000000,
};

export const SEED_BOARDS: Record<string, Board> = {
  [SEED_BOARD_ID]: {
    id: SEED_BOARD_ID,
    projectId: SEED_PROJECT_ID,
    name: 'Main Workspace Board',
    description: 'Central brainstorming and systems architecture board',
    activePageId: SEED_PAGE_IDS.mindmap,
    pageIds: [
      SEED_PAGE_IDS.mindmap,
      SEED_PAGE_IDS.flowchart,
      SEED_PAGE_IDS.containers,
    ],
    createdAt: 1735000000000,
    updatedAt: 1735000000000,
  },
};

// ============================================================================
// 2. Page 1: Mind Map & Concepts
// ============================================================================

const page1Nodes: NeuroNode[] = [
  // Root Concept
  {
    id: 'mm-root',
    type: 'shape',
    position: { x: 300, y: 320 },
    width: 240,
    height: 64,
    layoutMode: 'auto-elk',
    data: {
      label: 'Creative-Neuro Platform',
      shapeType: 'pill',
      layoutMode: 'auto-elk',
      backgroundColor: '#4f46e5',
      borderColor: '#4338ca',
      borderWidth: 2,
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },

  // Level 1 Branch A: State & Storage (Top Right)
  {
    id: 'mm-branch-state',
    type: 'shape',
    position: { x: 680, y: 140 },
    width: 200,
    height: 52,
    layoutMode: 'auto-elk',
    data: {
      label: 'Layer 1: Normalized Store',
      shapeType: 'rounded',
      layoutMode: 'auto-elk',
      backgroundColor: '#0284c7',
      borderColor: '#0369a1',
      borderWidth: 2,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },
  // Level 2 Leaves for Branch A
  {
    id: 'mm-leaf-zustand',
    type: 'shape',
    position: { x: 960, y: 80 },
    width: 180,
    height: 44,
    layoutMode: 'auto-elk',
    data: {
      label: 'Zustand + Immer State',
      shapeType: 'rectangle',
      layoutMode: 'auto-elk',
      backgroundColor: '#f0f9ff',
      borderColor: '#bae6fd',
      borderWidth: 1,
      color: '#0369a1',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'mm-leaf-zundo',
    type: 'shape',
    position: { x: 960, y: 140 },
    width: 180,
    height: 44,
    layoutMode: 'auto-elk',
    data: {
      label: 'Zundo Undo / Redo',
      shapeType: 'rectangle',
      layoutMode: 'auto-elk',
      backgroundColor: '#f0f9ff',
      borderColor: '#bae6fd',
      borderWidth: 1,
      color: '#0369a1',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'mm-leaf-dexie',
    type: 'shape',
    position: { x: 960, y: 200 },
    width: 180,
    height: 44,
    layoutMode: 'auto-elk',
    data: {
      label: 'Dexie.js IndexedDB',
      shapeType: 'cylinder',
      layoutMode: 'auto-elk',
      backgroundColor: '#f0f9ff',
      borderColor: '#bae6fd',
      borderWidth: 1,
      color: '#0369a1',
      fontSize: 13,
      textAlign: 'center',
    },
  },

  // Level 1 Branch B: Pure Algorithmic Engines (Middle Right)
  {
    id: 'mm-branch-engine',
    type: 'shape',
    position: { x: 680, y: 326 },
    width: 200,
    height: 52,
    layoutMode: 'auto-elk',
    data: {
      label: 'Layer 2: Pure TS Engines',
      shapeType: 'rounded',
      layoutMode: 'auto-elk',
      backgroundColor: '#059669',
      borderColor: '#047857',
      borderWidth: 2,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },
  // Level 2 Leaves for Branch B
  {
    id: 'mm-leaf-reconcile',
    type: 'shape',
    position: { x: 960, y: 270 },
    width: 180,
    height: 44,
    layoutMode: 'auto-elk',
    data: {
      label: 'Mermaid AST Reconciler',
      shapeType: 'rectangle',
      layoutMode: 'auto-elk',
      backgroundColor: '#ecfdf5',
      borderColor: '#a7f3d0',
      borderWidth: 1,
      color: '#047857',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'mm-leaf-elk',
    type: 'shape',
    position: { x: 960, y: 330 },
    width: 180,
    height: 44,
    layoutMode: 'auto-elk',
    data: {
      label: 'ELK.js Layout Engine',
      shapeType: 'rectangle',
      layoutMode: 'auto-elk',
      backgroundColor: '#ecfdf5',
      borderColor: '#a7f3d0',
      borderWidth: 1,
      color: '#047857',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'mm-leaf-collision',
    type: 'shape',
    position: { x: 960, y: 390 },
    width: 180,
    height: 44,
    layoutMode: 'auto-elk',
    data: {
      label: 'AABB Collision Placement',
      shapeType: 'rectangle',
      layoutMode: 'auto-elk',
      backgroundColor: '#ecfdf5',
      borderColor: '#a7f3d0',
      borderWidth: 1,
      color: '#047857',
      fontSize: 13,
      textAlign: 'center',
    },
  },

  // Level 1 Branch C: Interaction & Canvas (Bottom Right)
  {
    id: 'mm-branch-ui',
    type: 'shape',
    position: { x: 680, y: 510 },
    width: 200,
    height: 52,
    layoutMode: 'auto-elk',
    data: {
      label: 'Layer 3: Canvas Objects',
      shapeType: 'rounded',
      layoutMode: 'auto-elk',
      backgroundColor: '#d97706',
      borderColor: '#b45309',
      borderWidth: 2,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },
  // Level 2 Leaves for Branch C
  {
    id: 'mm-leaf-dualmode',
    type: 'shape',
    position: { x: 960, y: 470 },
    width: 180,
    height: 44,
    layoutMode: 'auto-elk',
    data: {
      label: 'Dual-Mode DiagramCard',
      shapeType: 'rectangle',
      layoutMode: 'auto-elk',
      backgroundColor: '#fffbeb',
      borderColor: '#fde68a',
      borderWidth: 1,
      color: '#b45309',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'mm-leaf-shortcuts',
    type: 'shape',
    position: { x: 960, y: 530 },
    width: 180,
    height: 44,
    layoutMode: 'auto-elk',
    data: {
      label: 'Fast Keyboard Shortcuts',
      shapeType: 'rectangle',
      layoutMode: 'auto-elk',
      backgroundColor: '#fffbeb',
      borderColor: '#fde68a',
      borderWidth: 1,
      color: '#b45309',
      fontSize: 13,
      textAlign: 'center',
    },
  },

  // Floating Note
  {
    id: 'mm-note',
    type: 'text',
    position: { x: 300, y: 440 },
    width: 240,
    height: 80,
    layoutMode: 'manual',
    data: {
      label: '💡 Tip: Select any node and press Tab to spawn a child, or Enter to spawn an aligned sibling!',
      layoutMode: 'manual',
      fontSize: 12,
      color: '#64748b',
      textAlign: 'left',
    },
  },
];

const page1Edges: NeuroEdge[] = [
  // Root -> Branches
  {
    id: 'e-mm-root-state',
    source: 'mm-root',
    target: 'mm-branch-state',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#4f46e5', strokeWidth: 2 },
  },
  {
    id: 'e-mm-root-engine',
    source: 'mm-root',
    target: 'mm-branch-engine',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#4f46e5', strokeWidth: 2 },
  },
  {
    id: 'e-mm-root-ui',
    source: 'mm-root',
    target: 'mm-branch-ui',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#4f46e5', strokeWidth: 2 },
  },

  // Branch A -> Leaves
  {
    id: 'e-mm-state-zustand',
    source: 'mm-branch-state',
    target: 'mm-leaf-zustand',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#0284c7', strokeWidth: 1.5 },
  },
  {
    id: 'e-mm-state-zundo',
    source: 'mm-branch-state',
    target: 'mm-leaf-zundo',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#0284c7', strokeWidth: 1.5 },
  },
  {
    id: 'e-mm-state-dexie',
    source: 'mm-branch-state',
    target: 'mm-leaf-dexie',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#0284c7', strokeWidth: 1.5 },
  },

  // Branch B -> Leaves
  {
    id: 'e-mm-engine-reconcile',
    source: 'mm-branch-engine',
    target: 'mm-leaf-reconcile',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#059669', strokeWidth: 1.5 },
  },
  {
    id: 'e-mm-engine-elk',
    source: 'mm-branch-engine',
    target: 'mm-leaf-elk',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#059669', strokeWidth: 1.5 },
  },
  {
    id: 'e-mm-engine-collision',
    source: 'mm-branch-engine',
    target: 'mm-leaf-collision',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#059669', strokeWidth: 1.5 },
  },

  // Branch C -> Leaves
  {
    id: 'e-mm-ui-dualmode',
    source: 'mm-branch-ui',
    target: 'mm-leaf-dualmode',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#d97706', strokeWidth: 1.5 },
  },
  {
    id: 'e-mm-ui-shortcuts',
    source: 'mm-branch-ui',
    target: 'mm-leaf-shortcuts',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#d97706', strokeWidth: 1.5 },
  },
];

// ============================================================================
// 3. Page 2: Flowchart & Vector Line Jumps
// ============================================================================

const page2Nodes: NeuroNode[] = [
  // Start Terminal
  {
    id: 'fc-start',
    type: 'shape',
    position: { x: 380, y: 60 },
    width: 200,
    height: 48,
    layoutMode: 'manual',
    data: {
      label: 'User Edits Mermaid Code',
      shapeType: 'pill',
      layoutMode: 'manual',
      backgroundColor: '#3b82f6',
      borderColor: '#2563eb',
      borderWidth: 2,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },

  // Process: Lexer & Parser
  {
    id: 'fc-parse',
    type: 'shape',
    position: { x: 380, y: 160 },
    width: 200,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'Lexer & AST Parser',
      shapeType: 'rectangle',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#94a3b8',
      borderWidth: 2,
      color: '#0f172a',
      fontSize: 14,
      textAlign: 'center',
    },
  },

  // Decision Diamond
  {
    id: 'fc-decision',
    type: 'shape',
    position: { x: 405, y: 270 },
    width: 150,
    height: 90,
    layoutMode: 'manual',
    data: {
      label: 'Is Valid AST?',
      shapeType: 'diamond',
      layoutMode: 'manual',
      backgroundColor: '#fef3c7',
      borderColor: '#d97706',
      borderWidth: 2,
      color: '#78350f',
      fontSize: 13,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },

  // Error Branch (Right)
  {
    id: 'fc-error',
    type: 'shape',
    position: { x: 680, y: 290 },
    width: 180,
    height: 50,
    layoutMode: 'manual',
    data: {
      label: 'Show Inline Gutter Error',
      shapeType: 'rectangle',
      layoutMode: 'manual',
      backgroundColor: '#fef2f2',
      borderColor: '#ef4444',
      borderWidth: 2,
      color: '#991b1b',
      fontSize: 13,
      textAlign: 'center',
    },
  },

  // Reconciliation Step (Valid Branch)
  {
    id: 'fc-reconcile',
    type: 'shape',
    position: { x: 380, y: 420 },
    width: 200,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'Node ID Reconciliation',
      shapeType: 'rectangle',
      layoutMode: 'manual',
      backgroundColor: '#ecfdf5',
      borderColor: '#10b981',
      borderWidth: 2,
      color: '#065f46',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },

  // Parallel Branch Left: Preserve Positions
  {
    id: 'fc-preserve',
    type: 'shape',
    position: { x: 180, y: 530 },
    width: 180,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'Preserve Manual (x,y)',
      shapeType: 'rounded',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#3b82f6',
      borderWidth: 1.5,
      color: '#1d4ed8',
      fontSize: 13,
      textAlign: 'center',
    },
  },

  // Parallel Branch Right: ELK Auto-Layout
  {
    id: 'fc-elk',
    type: 'shape',
    position: { x: 580, y: 530 },
    width: 180,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'ELK.js Auto-Layout',
      shapeType: 'rounded',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#10b981',
      borderWidth: 1.5,
      color: '#047857',
      fontSize: 13,
      textAlign: 'center',
    },
  },

  // Convergence: Render Canvas
  {
    id: 'fc-render',
    type: 'shape',
    position: { x: 380, y: 640 },
    width: 200,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'Render @xyflow Canvas',
      shapeType: 'rectangle',
      layoutMode: 'manual',
      backgroundColor: '#4f46e5',
      borderColor: '#4338ca',
      borderWidth: 2,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },

  // End Database Node
  {
    id: 'fc-db',
    type: 'shape',
    position: { x: 390, y: 750 },
    width: 180,
    height: 60,
    layoutMode: 'manual',
    data: {
      label: 'Dexie.js DB Put (500ms)',
      shapeType: 'cylinder',
      layoutMode: 'manual',
      backgroundColor: '#f8fafc',
      borderColor: '#64748b',
      borderWidth: 2,
      color: '#1e293b',
      fontSize: 13,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },

  // Perpendicular Line-Crossing Showcase Nodes
  {
    id: 'fc-telemetry-in',
    type: 'shape',
    position: { x: 100, y: 390 },
    width: 160,
    height: 44,
    layoutMode: 'manual',
    data: {
      label: 'Telemetry Monitor In',
      shapeType: 'rounded',
      layoutMode: 'manual',
      backgroundColor: '#faf5ff',
      borderColor: '#c084fc',
      borderWidth: 1.5,
      color: '#7e22ce',
      fontSize: 12,
      textAlign: 'center',
    },
  },
  {
    id: 'fc-telemetry-out',
    type: 'shape',
    position: { x: 680, y: 390 },
    width: 160,
    height: 44,
    layoutMode: 'manual',
    data: {
      label: 'Metrics Collector Out',
      shapeType: 'rounded',
      layoutMode: 'manual',
      backgroundColor: '#faf5ff',
      borderColor: '#c084fc',
      borderWidth: 1.5,
      color: '#7e22ce',
      fontSize: 12,
      textAlign: 'center',
    },
  },

  // Embedded DiagramCard
  {
    id: 'fc-diagram-card',
    type: 'diagram',
    position: { x: 920, y: 160 },
    width: 320,
    height: 260,
    layoutMode: 'manual',
    data: {
      label: 'Embedded Flowchart Diagram',
      layoutMode: 'manual',
      diagramMode: 'embedded',
      diagramOrientation: 'TB',
      mermaidCode:
`flowchart TD
  A[User Input] --> B{Valid?}
  B -->|Yes| C[Reconcile IDs]
  B -->|No| D[Inline Error]
  C --> E[(Dexie DB)]`,
      backgroundColor: '#ffffff',
      borderColor: '#cbd5e1',
      borderWidth: 1,
    },
  },
];

const page2Edges: NeuroEdge[] = [
  // Start -> Parse
  {
    id: 'e-fc-start-parse',
    source: 'fc-start',
    target: 'fc-parse',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'jump',
    data: { color: '#334155', strokeWidth: 2 },
  },
  // Parse -> Decision
  {
    id: 'e-fc-parse-dec',
    source: 'fc-parse',
    target: 'fc-decision',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'jump',
    data: { color: '#334155', strokeWidth: 2 },
  },
  // Decision -> Error (No)
  {
    id: 'e-fc-dec-error',
    source: 'fc-decision',
    target: 'fc-error',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'jump',
    label: 'No',
    data: { color: '#ef4444', strokeWidth: 2, lineStyle: 'dashed' },
  },
  // Decision -> Reconcile (Yes) — Primary Vertical Spine
  {
    id: 'e-fc-dec-reconcile',
    source: 'fc-decision',
    target: 'fc-reconcile',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'jump',
    label: 'Yes',
    data: { color: '#10b981', strokeWidth: 2 },
  },
  // Reconcile -> Preserve
  {
    id: 'e-fc-rec-preserve',
    source: 'fc-reconcile',
    target: 'fc-preserve',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'jump',
    data: { color: '#3b82f6', strokeWidth: 1.5 },
  },
  // Reconcile -> ELK
  {
    id: 'e-fc-rec-elk',
    source: 'fc-reconcile',
    target: 'fc-elk',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'jump',
    data: { color: '#10b981', strokeWidth: 1.5 },
  },
  // Preserve -> Render
  {
    id: 'e-fc-pres-render',
    source: 'fc-preserve',
    target: 'fc-render',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'jump',
    data: { color: '#3b82f6', strokeWidth: 1.5 },
  },
  // ELK -> Render
  {
    id: 'e-fc-elk-render',
    source: 'fc-elk',
    target: 'fc-render',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'jump',
    data: { color: '#10b981', strokeWidth: 1.5 },
  },
  // Render -> DB
  {
    id: 'e-fc-render-db',
    source: 'fc-render',
    target: 'fc-db',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'jump',
    data: { color: '#4f46e5', strokeWidth: 2 },
  },

  // Perpendicular Cross-Line Intersection:
  {
    id: 'e-fc-telemetry-jump',
    source: 'fc-telemetry-in',
    target: 'fc-telemetry-out',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'jump',
    label: 'SVG Jump Crossing',
    data: {
      color: '#9333ea',
      strokeWidth: 2,
      jumpArc: true,
      lineStyle: 'solid',
    },
  },
];

// ============================================================================
// 4. Page 3: Containers & Subgraphs
// ============================================================================

const page3Nodes: NeuroNode[] = [
  // Container 1: Frontend Workspace Frame
  {
    id: 'frame-client',
    type: 'frame',
    position: { x: 100, y: 80 },
    width: 480,
    height: 340,
    layoutMode: 'manual',
    data: {
      label: 'Frontend Client Workspace',
      title: 'Frontend Client Workspace',
      layoutMode: 'manual',
      backgroundColor: '#f8fafc',
      borderColor: '#94a3b8',
      borderWidth: 2,
      borderStyle: 'solid',
      color: '#0f172a',
      fontSize: 15,
      fontWeight: 'bold',
      collapsed: false,
    },
  },
  // Children of Container 1
  {
    id: 'fn-canvas',
    type: 'shape',
    parentId: 'frame-client',
    extent: 'parent',
    position: { x: 130, y: 150 },
    width: 190,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'Infinite Whiteboard Canvas',
      shapeType: 'rounded',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#3b82f6',
      borderWidth: 1.5,
      color: '#1d4ed8',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'fn-editor',
    type: 'shape',
    parentId: 'frame-client',
    extent: 'parent',
    position: { x: 350, y: 150 },
    width: 190,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'CodeMirror 6 Drawer',
      shapeType: 'rounded',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#3b82f6',
      borderWidth: 1.5,
      color: '#1d4ed8',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'fn-pagetabs',
    type: 'shape',
    parentId: 'frame-client',
    extent: 'parent',
    position: { x: 240, y: 240 },
    width: 200,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'Page Tabs & Navigation',
      shapeType: 'rounded',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#3b82f6',
      borderWidth: 1.5,
      color: '#1d4ed8',
      fontSize: 13,
      textAlign: 'center',
    },
  },

  // Container 2: Algorithmic Engines Frame
  {
    id: 'frame-engines',
    type: 'frame',
    position: { x: 680, y: 80 },
    width: 480,
    height: 340,
    layoutMode: 'manual',
    data: {
      label: 'Layer 2 Algorithmic Subsystem',
      title: 'Layer 2 Algorithmic Subsystem',
      layoutMode: 'manual',
      backgroundColor: '#f0fdf4',
      borderColor: '#86efac',
      borderWidth: 2,
      borderStyle: 'solid',
      color: '#14532d',
      fontSize: 15,
      fontWeight: 'bold',
      collapsed: false,
    },
  },
  // Children of Container 2
  {
    id: 'fn-parser',
    type: 'shape',
    parentId: 'frame-engines',
    extent: 'parent',
    position: { x: 710, y: 150 },
    width: 190,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'Mermaid AST Engine',
      shapeType: 'rectangle',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#10b981',
      borderWidth: 1.5,
      color: '#047857',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'fn-elk',
    type: 'shape',
    parentId: 'frame-engines',
    extent: 'parent',
    position: { x: 930, y: 150 },
    width: 190,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'ELK.js Hybrid Layout',
      shapeType: 'rectangle',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#10b981',
      borderWidth: 1.5,
      color: '#047857',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'fn-jumps',
    type: 'shape',
    parentId: 'frame-engines',
    extent: 'parent',
    position: { x: 820, y: 240 },
    width: 200,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'SVG Line Jump Solver',
      shapeType: 'rectangle',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#10b981',
      borderWidth: 1.5,
      color: '#047857',
      fontSize: 13,
      textAlign: 'center',
    },
  },

  // Container 3: Persistence Subsystem Frame
  {
    id: 'frame-storage',
    type: 'frame',
    position: { x: 390, y: 480 },
    width: 480,
    height: 280,
    layoutMode: 'manual',
    data: {
      label: 'Persistence & Temporal Stack',
      title: 'Persistence & Temporal Stack',
      layoutMode: 'manual',
      backgroundColor: '#f8fafc',
      borderColor: '#cbd5e1',
      borderWidth: 2,
      borderStyle: 'solid',
      color: '#0f172a',
      fontSize: 15,
      fontWeight: 'bold',
      collapsed: false,
    },
  },
  // Children of Container 3
  {
    id: 'fn-zustand',
    type: 'shape',
    parentId: 'frame-storage',
    extent: 'parent',
    position: { x: 420, y: 550 },
    width: 180,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'Zustand Store + Immer',
      shapeType: 'rectangle',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#64748b',
      borderWidth: 1.5,
      color: '#1e293b',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'fn-zundo',
    type: 'shape',
    parentId: 'frame-storage',
    extent: 'parent',
    position: { x: 650, y: 550 },
    width: 180,
    height: 52,
    layoutMode: 'manual',
    data: {
      label: 'Zundo History Middleware',
      shapeType: 'rectangle',
      layoutMode: 'manual',
      backgroundColor: '#ffffff',
      borderColor: '#64748b',
      borderWidth: 1.5,
      color: '#1e293b',
      fontSize: 13,
      textAlign: 'center',
    },
  },
  {
    id: 'fn-dexie',
    type: 'shape',
    parentId: 'frame-storage',
    extent: 'parent',
    position: { x: 535, y: 640 },
    width: 190,
    height: 58,
    layoutMode: 'manual',
    data: {
      label: 'Dexie.js IndexedDB Schema',
      shapeType: 'database',
      layoutMode: 'manual',
      backgroundColor: '#f1f5f9',
      borderColor: '#475569',
      borderWidth: 2,
      color: '#0f172a',
      fontSize: 13,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  },
];

const page3Edges: NeuroEdge[] = [
  // Cross-Frame Connection: Editor -> AST Engine
  {
    id: 'e-fn-editor-parser',
    source: 'fn-editor',
    target: 'fn-parser',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    label: 'Sync Code',
    data: { color: '#3b82f6', strokeWidth: 2, animated: true },
  },
  // Cross-Frame Connection: Canvas -> ELK
  {
    id: 'e-fn-canvas-elk',
    source: 'fn-canvas',
    target: 'fn-elk',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    label: 'Auto-Layout',
    data: { color: '#10b981', strokeWidth: 2 },
  },
  // Internal Frame Connection: Parser -> ELK
  {
    id: 'e-fn-parser-elk',
    source: 'fn-parser',
    target: 'fn-elk',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#10b981', strokeWidth: 1.5 },
  },
  // Internal Frame Connection: ELK -> Jumps
  {
    id: 'e-fn-elk-jumps',
    source: 'fn-elk',
    target: 'fn-jumps',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'smoothstep',
    data: { color: '#10b981', strokeWidth: 1.5 },
  },
  // Cross-Frame Connection: Canvas -> Zustand
  {
    id: 'e-fn-canvas-zustand',
    source: 'fn-canvas',
    target: 'fn-zustand',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'smoothstep',
    label: 'Actions Dispatch',
    data: { color: '#4f46e5', strokeWidth: 2 },
  },
  // Internal Frame Connection: Zustand -> Zundo
  {
    id: 'e-fn-zustand-zundo',
    source: 'fn-zustand',
    target: 'fn-zundo',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'smoothstep',
    data: { color: '#64748b', strokeWidth: 1.5 },
  },
  // Internal Frame Connection: Zustand -> Dexie
  {
    id: 'e-fn-zustand-dexie',
    source: 'fn-zustand',
    target: 'fn-dexie',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'smoothstep',
    label: 'Debounced Save',
    data: { color: '#475569', strokeWidth: 2, animated: true },
  },
];

// ============================================================================
// 5. Aggregate Seed Project Lookup Dictionaries
// ============================================================================

export const SEED_PAGES: Record<string, Page> = {
  [SEED_PAGE_IDS.mindmap]: {
    id: SEED_PAGE_IDS.mindmap,
    projectId: SEED_PROJECT_ID,
    boardId: SEED_BOARD_ID,
    title: 'Mind Map & Concepts',
    name: 'Mind Map & Concepts',
    order: 0,
    viewport: { x: 50, y: 50, zoom: 0.9 },
    nodeIds: page1Nodes.map((n) => n.id),
    edgeIds: page1Edges.map((e) => e.id),
    createdAt: 1735000000000,
    updatedAt: 1735000000000,
  },
  [SEED_PAGE_IDS.flowchart]: {
    id: SEED_PAGE_IDS.flowchart,
    projectId: SEED_PROJECT_ID,
    boardId: SEED_BOARD_ID,
    title: 'Engine Flowchart & Jumps',
    name: 'Engine Flowchart & Jumps',
    order: 1,
    viewport: { x: 50, y: 20, zoom: 0.85 },
    nodeIds: page2Nodes.map((n) => n.id),
    edgeIds: page2Edges.map((e) => e.id),
    createdAt: 1735000000000,
    updatedAt: 1735000000000,
  },
  [SEED_PAGE_IDS.containers]: {
    id: SEED_PAGE_IDS.containers,
    projectId: SEED_PROJECT_ID,
    boardId: SEED_BOARD_ID,
    title: 'Containers & Subgraphs',
    name: 'Containers & Subgraphs',
    order: 2,
    viewport: { x: 50, y: 30, zoom: 0.85 },
    nodeIds: page3Nodes.map((n) => n.id),
    edgeIds: page3Edges.map((e) => e.id),
    createdAt: 1735000000000,
    updatedAt: 1735000000000,
  },
};

export const SEED_NODES: Record<string, NeuroNode> = {
  ...Object.fromEntries(page1Nodes.map((n) => [n.id, n])),
  ...Object.fromEntries(page2Nodes.map((n) => [n.id, n])),
  ...Object.fromEntries(page3Nodes.map((n) => [n.id, n])),
};

export const SEED_EDGES: Record<string, NeuroEdge> = {
  ...Object.fromEntries(page1Edges.map((e) => [e.id, e])),
  ...Object.fromEntries(page2Edges.map((e) => [e.id, e])),
  ...Object.fromEntries(page3Edges.map((e) => [e.id, e])),
};

export const INITIAL_SEED_DATA: SerializedProjectPayload = {
  version: '1.0.0',
  project: SEED_PROJECT,
  boards: SEED_BOARDS,
  pages: SEED_PAGES,
  nodes: SEED_NODES,
  edges: SEED_EDGES,
  exportedAt: 1735000000000,
};

/**
 * Returns a deep clone of the initial seed dataset so tests and resets
 * cannot accidentally mutate the seed definition.
 */
export function createSeedProject(): {
  project: Project;
  boards: Record<string, Board>;
  pages: Record<string, Page>;
  nodes: Record<string, NeuroNode>;
  edges: Record<string, NeuroEdge>;
} {
  return JSON.parse(
    JSON.stringify({
      project: SEED_PROJECT,
      boards: SEED_BOARDS,
      pages: SEED_PAGES,
      nodes: SEED_NODES,
      edges: SEED_EDGES,
    })
  );
}
