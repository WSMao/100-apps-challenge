/**
 * Creative-Neuro Store Subsystem - Initial State Definition
 * Path: src/store/slices/initialState.ts
 */

import { createSeedProject } from '../seedData.ts';
import type { ProjectState } from './types.ts';

export const initialSeed = createSeedProject();

export const initialState: ProjectState = {
  project: initialSeed.project,
  boards: initialSeed.boards,
  pages: initialSeed.pages,
  nodes: initialSeed.nodes,
  edges: initialSeed.edges,
  activePageId: initialSeed.project.activePageId,

  toolMode: 'select',
  selectedNodeIds: [],
  selectedEdgeIds: [],
  focusedDiagramId: null,
  hoveredNodeId: null,
  editingNodeId: null,
  editingInitialValue: null,
  isDragging: false,
  isResizing: false,

  themeMode: 'light',
  lastDirection: 'right',
  connectorSourceNodeId: null,
  defaultEdgeRoutingType: 'smoothstep',
  availableProjects: [
    {
      id: initialSeed.project.id,
      name: initialSeed.project.name,
      updatedAt: initialSeed.project.updatedAt,
      pageCount: initialSeed.project.pageIds.length,
    },
  ],
  selectionFilter: {
    shape: true,
    text: true,
    edge: true,
    frame: true,
    diagram: true,
  },
};

