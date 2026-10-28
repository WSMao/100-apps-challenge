/**
 * Module declaration for ELK.js bundled distribution.
 * Importing 'elkjs/lib/elk.bundled.js' directly in Vite avoids Web Worker URL resolution issues.
 */

declare module 'elkjs/lib/elk.bundled.js' {
  export interface ElkPoint {
    x: number;
    y: number;
  }

  export interface ElkNode {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: ElkNode[];
    edges?: ElkExtendedEdge[];
    layoutOptions?: Record<string, string>;
    [key: string]: unknown;
  }

  export interface ElkExtendedEdge {
    id: string;
    sources: string[];
    targets: string[];
    sections?: Array<{
      id: string;
      startPoint: ElkPoint;
      endPoint: ElkPoint;
      bendPoints?: ElkPoint[];
    }>;
    junctionPoints?: ElkPoint[];
    layoutOptions?: Record<string, string>;
    [key: string]: unknown;
  }

  export interface ELKLayoutArguments {
    layoutOptions?: Record<string, string>;
    logging?: boolean;
    measureExecutionTime?: boolean;
  }

  export interface ELKInstance {
    layout(graph: ElkNode, args?: ELKLayoutArguments): Promise<ElkNode>;
    knownLayoutAlgorithms(): Promise<unknown[]>;
    knownLayoutOptions(): Promise<unknown[]>;
    knownLayoutCategories(): Promise<unknown[]>;
  }

  export interface ElkConstructor {
    new (options?: Record<string, unknown>): ELKInstance;
  }

  const ELK: ElkConstructor;
  export default ELK;
}

declare module 'elkjs' {
  import ELK from 'elkjs/lib/elk.bundled.js';
  export * from 'elkjs/lib/elk.bundled.js';
  export default ELK;
}
