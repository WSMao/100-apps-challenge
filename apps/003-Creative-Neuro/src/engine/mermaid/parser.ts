/**
 * Creative-Neuro Algorithmic Engine - Mermaid AST Parser
 * Layer 2 Zero-DOM Pure TypeScript Parser
 *
 * Conforms to specifications in algorithms.md §2.1 - §2.3.
 * Supports:
 * - Diagram headers: flowchart / graph with directions TB, TD, BT, RL, LR
 * - 10 node shapes: rectangle, rounded, circle, diamond, cylinder, stadium, subroutine, hexagon, parallelogram, trapezoid
 * - Edge types: solid (-->), dotted (-.->), thick (==>), undirected (---), with or without arrowheads
 * - Edge labels: -->|label| and -- label -->
 * - Chained edges: A --> B --> C --> D
 * - Subgraphs: nested subgraphs, custom direction directives, node containment
 * - Fault tolerance: skips malformed lines, recovers from incomplete syntax without throwing
 */

import type { FlowDirection, ShapeType } from '../../types/index.ts';

export interface MermaidNodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
}

export interface MermaidParsedNode {
  id: string;
  label: string;
  shapeType: ShapeType;
  parentId?: string;
  className?: string;
  style?: MermaidNodeStyle;
}

export interface MermaidParsedEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
  stroke: 'solid' | 'dotted' | 'thick';
  arrowHead: 'arrow' | 'none';
  arrowStart?: boolean;
}

export interface MermaidParsedSubgraph {
  id: string;
  title: string;
  direction?: FlowDirection;
  nodeIds: string[];
  parentSubgraphId?: string;
}

export interface ParsedMermaidAST {
  diagramType: 'flowchart' | 'graph';
  direction: FlowDirection;
  nodes: MermaidParsedNode[];
  edges: MermaidParsedEdge[];
  subgraphs: MermaidParsedSubgraph[];
  classDefs?: Record<string, MermaidNodeStyle>;
}

/**
 * Strips surrounding quotes from string literals, converts <br> to newlines,
 * and removes inline HTML formatting tags (e.g. <b>, </b>, <i>, <span>).
 */
function cleanLabel(raw: string): string {
  let s = raw.trim();
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1);
  }
  // Unescape escaped quotes, convert HTML line breaks, and strip inline HTML formatting tags
  s = s
    .replace(/\\"/g, '"')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:b|i|u|strong|em|span|small|sub|sup|mark|code)[^>]*>/gi, '');
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1);
  }
  return s;
}

/**
 * Parses a Mermaid classDef style string such as:
 * "fill:#f1f5f9,stroke:#64748b,stroke-width:1.5px,color:#0f172a"
 */
function parseClassDefStyle(rawStyle: string): MermaidNodeStyle {
  const style: MermaidNodeStyle = {};
  const parts = rawStyle.split(',');
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim().toLowerCase();
    const val = part.slice(colonIdx + 1).trim();
    if (!val) continue;
    if (key === 'fill') style.fill = val;
    else if (key === 'stroke') style.stroke = val;
    else if (key === 'color') style.color = val;
    else if (key === 'stroke-width') {
      const num = parseFloat(val);
      if (Number.isFinite(num)) style.strokeWidth = num;
    }
  }
  return style;
}

/**
 * Parses node token into id, label, shape type, and optional :::className.
 * Priority order matters for overlapping delimiter patterns (e.g. [() vs [).
 */
export function parseNodeToken(token: string): {
  id: string;
  label: string;
  shapeType: ShapeType;
  className?: string;
} {
  let trimmed = token.trim();
  if (!trimmed) {
    return { id: '', label: '', shapeType: 'rectangle' };
  }

  let className: string | undefined;
  const classMatch = trimmed.match(/^(.+?):::([a-zA-Z0-9_-]+)$/);
  if (classMatch) {
    trimmed = classMatch[1].trim();
    className = classMatch[2];
  }

  const withClass = (res: { id: string; label: string; shapeType: ShapeType }) =>
    className ? { ...res, className } : res;

  // 1. Stadium / Pill: ([text])
  let m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\(\[\s*(.*?)\s*\]\)$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'stadium' });

  // 2. Subroutine: [[text]]
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[\[\s*(.*?)\s*\]\]$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'subroutine' });

  // 3. Cylinder / DB: [(text)]
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[\(\s*(.*?)\s*\)\]$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'cylinder' });

  // 4. Circle: ((text))
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\(\(\s*(.*?)\s*\)\)$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'circle' });

  // 5. Hexagon: {{text}}
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\{\{\s*(.*?)\s*\}\}$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'hexagon' });

  // 6. Parallelogram: [/text/]
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[\/\s*(.*?)\s*\/\]$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'rectangle' }); // maps to shape

  // 7. Trapezoid: [/text\]
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[\/\s*(.*?)\s*\\\]$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'rectangle' });

  // 8. Inverted Trapezoid: [\text/]
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[\\\s*(.*?)\s*\/\]$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'rectangle' });

  // 9. Alternate Parallelogram: [\text\]
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[\\\s*(.*?)\s*\\\]$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'rectangle' });

  // 10. Diamond: {text}
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\{\s*(.*?)\s*\}$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'diamond' });

  // 11. Rounded: (text)
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\(\s*(.*?)\s*\)$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'rounded' });

  // 12. Rectangle: [text]
  m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[\s*(.*?)\s*\]$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[2]), shapeType: 'rectangle' });

  // 13. Plain identifier
  m = trimmed.match(/^([a-zA-Z0-9_-]+)$/);
  if (m) return withClass({ id: m[1], label: cleanLabel(m[1]), shapeType: 'rectangle' });

  // Guard: If not a recognized shape or identifier, return empty id to reject noise
  return { id: '', label: '', shapeType: 'rectangle' };
}

/**
 * Regex for arrow tokens:
 * Supports:
 * - -->, <--> , ---
 * - -.->, <-.->, -.-
 * - ==>, <==>, ===
 * With inline labels: -->|label| or -- label --> or <-- label --> or -. label .-> or == label ==>
 * Supports <br> HTML tags inside labels.
 */
const ARROW_PATTERN =
  /\s*(?:(<--+>(?!>)|--+>(?!>)|---+(?![-|>])|<-\.+->(?!>)|-\.+->(?!>)|-\.+-|<==+>(?!>)|==+>(?!>)|===+(?![=>]))(?:\|([^|]+)\|)?|(<--|--)(?![->])\s*(.+?)\s*-->|(<-.-|-\.)(?![.>-])\s*(.+?)\s*\.->|(<==|==)(?![=>])\s*(.+?)\s*==>)\s*/;

interface ArrowMatch {
  rawArrow: string;
  label?: string;
  stroke: 'solid' | 'dotted' | 'thick';
  arrowHead: 'arrow' | 'none';
  arrowStart?: boolean;
}

function parseArrowDetails(match: RegExpMatchArray): ArrowMatch {
  const directArrow = match[1];
  const pipeLabel = match[2];
  const dashPrefix = match[3];
  const dashLabel = match[4];
  const dotPrefix = match[5];
  const dotLabel = match[6];
  const thickPrefix = match[7];
  const thickLabel = match[8];

  const label = pipeLabel || dashLabel || dotLabel || thickLabel;
  let stroke: 'solid' | 'dotted' | 'thick' = 'solid';
  let arrowHead: 'arrow' | 'none' = 'arrow';
  let arrowStart = false;

  if (directArrow) {
    if (directArrow.startsWith('<')) arrowStart = true;
    const cleanDirect = directArrow.replace(/^</, '');
    if (cleanDirect.startsWith('-.')) stroke = 'dotted';
    else if (cleanDirect.startsWith('==')) stroke = 'thick';
    else stroke = 'solid';

    if (cleanDirect.endsWith('---') || cleanDirect.endsWith('-.-') || cleanDirect.endsWith('===')) {
      arrowHead = 'none';
    } else {
      arrowHead = 'arrow';
    }
  } else if (dashLabel) {
    stroke = 'solid';
    arrowHead = 'arrow';
    if (dashPrefix === '<--') arrowStart = true;
  } else if (dotLabel) {
    stroke = 'dotted';
    arrowHead = 'arrow';
    if (dotPrefix === '<-.-') arrowStart = true;
  } else if (thickLabel) {
    stroke = 'thick';
    arrowHead = 'arrow';
    if (thickPrefix === '<==') arrowStart = true;
  }

  return {
    rawArrow: match[0],
    label: label ? cleanLabel(label) : undefined,
    stroke,
    arrowHead,
    arrowStart: arrowStart ? true : undefined,
  };
}

/**
 * Pure TypeScript Mermaid Flowchart & Graph Parser
 */
export function parseMermaid(code: string): ParsedMermaidAST {
  const lines = code
    .split(/\r?\n/)
    .map((l) => {
      let cleaned = l.replace(/%%.*$/, '').trim();
      cleaned = cleaned.replace(/(?:;\s*)+$/, '').trim();
      return cleaned;
    })
    .filter((l) => l.length > 0);

  let diagramType: 'flowchart' | 'graph' = 'flowchart';
  let direction: FlowDirection = 'TB';

  const nodesMap = new Map<string, MermaidParsedNode>();
  const edges: MermaidParsedEdge[] = [];
  const subgraphs: MermaidParsedSubgraph[] = [];
  const subgraphStack: MermaidParsedSubgraph[] = [];
  const classDefs: Record<string, MermaidNodeStyle> = {};

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    // 1. Diagram Header
    if (line.startsWith('flowchart') || line.startsWith('graph')) {
      const parts = line.split(/\s+/);
      diagramType = parts[0] as 'flowchart' | 'graph';
      if (parts[1] && ['TB', 'TD', 'BT', 'RL', 'LR'].includes(parts[1])) {
        direction = parts[1] as FlowDirection;
      }
      continue;
    }

    // 1b. classDef declaration: classDef shell fill:#f1f5f9,stroke:#64748b,...
    if (line.startsWith('classDef ')) {
      const match = line.match(/^classDef\s+([a-zA-Z0-9_-]+)\s+(.+)$/);
      if (match) {
        classDefs[match[1]] = parseClassDefStyle(match[2]);
      }
      continue;
    }

    // 1c. class assignment statement: class NodeA,NodeB className
    if (line.startsWith('class ')) {
      const match = line.match(/^class\s+([a-zA-Z0-9_,\s-]+)\s+([a-zA-Z0-9_-]+)$/);
      if (match) {
        const targetIds = match[1].split(',').map((s) => s.trim()).filter(Boolean);
        const clsName = match[2].trim();
        for (const tid of targetIds) {
          const existing = nodesMap.get(tid);
          if (existing) {
            existing.className = clsName;
          }
        }
      }
      continue;
    }

    // 2. Subgraph declaration: subgraph id [title] or subgraph id
    if (line.startsWith('subgraph')) {
      const match = line.match(/^subgraph\s+([a-zA-Z0-9_-]+)(?:\s*\[(.*)\])?/);
      if (match) {
        const id = match[1];
        const title = match[2] ? cleanLabel(match[2]) : id;
        const parent = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : undefined;
        const newSub: MermaidParsedSubgraph = {
          id,
          title,
          nodeIds: [],
          parentSubgraphId: parent?.id,
        };
        subgraphs.push(newSub);
        subgraphStack.push(newSub);
      }
      continue;
    }

    // 3. Subgraph direction: direction LR
    if (line.startsWith('direction') && subgraphStack.length > 0) {
      const parts = line.split(/\s+/);
      if (parts[1] && ['TB', 'TD', 'BT', 'RL', 'LR'].includes(parts[1])) {
        subgraphStack[subgraphStack.length - 1].direction = parts[1] as FlowDirection;
      }
      continue;
    }

    // 4. Subgraph end
    if (line === 'end' && subgraphStack.length > 0) {
      subgraphStack.pop();
      continue;
    }

    const currentSubgraph = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : undefined;

    // 5. Edge Statement (supports chained edges A --> B --> C)
    if (ARROW_PATTERN.test(line)) {
      const segments: string[] = [];
      const edgeInfos: ArrowMatch[] = [];

      let remaining = line;
      let match: RegExpMatchArray | null;

      while ((match = remaining.match(ARROW_PATTERN))) {
        const idx = match.index!;
        segments.push(remaining.slice(0, idx).trim());
        edgeInfos.push(parseArrowDetails(match));
        remaining = remaining.slice(idx + match[0].length).trim();
      }
      segments.push(remaining.trim());

      let hasValidEdge = false;
      // Connect each pair in chained segments
      for (let sIdx = 0; sIdx < segments.length - 1; sIdx++) {
        const srcRaw = segments[sIdx];
        const tgtRaw = segments[sIdx + 1];
        if (!srcRaw || !tgtRaw) continue;

        const srcParsed = parseNodeToken(srcRaw);
        const tgtParsed = parseNodeToken(tgtRaw);
        const arrow = edgeInfos[sIdx];

        if (srcParsed.id && tgtParsed.id) {
          hasValidEdge = true;
          if (!nodesMap.has(srcParsed.id)) {
            nodesMap.set(srcParsed.id, {
              id: srcParsed.id,
              label: srcParsed.label,
              shapeType: srcParsed.shapeType,
              parentId: currentSubgraph?.id,
              ...(srcParsed.className ? { className: srcParsed.className } : {}),
            });
          } else if (srcParsed.className) {
            nodesMap.get(srcParsed.id)!.className = srcParsed.className;
          }
          if (!nodesMap.has(tgtParsed.id)) {
            nodesMap.set(tgtParsed.id, {
              id: tgtParsed.id,
              label: tgtParsed.label,
              shapeType: tgtParsed.shapeType,
              parentId: currentSubgraph?.id,
              ...(tgtParsed.className ? { className: tgtParsed.className } : {}),
            });
          } else if (tgtParsed.className) {
            nodesMap.get(tgtParsed.id)!.className = tgtParsed.className;
          }

          if (currentSubgraph) {
            if (!currentSubgraph.nodeIds.includes(srcParsed.id)) {
              currentSubgraph.nodeIds.push(srcParsed.id);
            }
            if (!currentSubgraph.nodeIds.includes(tgtParsed.id)) {
              currentSubgraph.nodeIds.push(tgtParsed.id);
            }
          }

          edges.push({
            id: `edge_${srcParsed.id}_${tgtParsed.id}_${edges.length}`,
            source: srcParsed.id,
            target: tgtParsed.id,
            label: arrow.label,
            stroke: arrow.stroke,
            arrowHead: arrow.arrowHead,
            ...(arrow.arrowStart ? { arrowStart: true } : {}),
          });
        }
      }
      if (hasValidEdge) {
        continue;
      }
    }

    // 6. Standalone Node Statement
    const nodeParsed = parseNodeToken(line);
    if (nodeParsed.id) {
      if (!nodesMap.has(nodeParsed.id)) {
        nodesMap.set(nodeParsed.id, {
          id: nodeParsed.id,
          label: nodeParsed.label,
          shapeType: nodeParsed.shapeType,
          parentId: currentSubgraph?.id,
          ...(nodeParsed.className ? { className: nodeParsed.className } : {}),
        });
      } else {
        // Update label or shape if previously encountered implicitly
        const existing = nodesMap.get(nodeParsed.id)!;
        if (nodeParsed.label !== nodeParsed.id) {
          existing.label = nodeParsed.label;
          existing.shapeType = nodeParsed.shapeType;
        }
        if (nodeParsed.className) {
          existing.className = nodeParsed.className;
        }
        if (currentSubgraph && !existing.parentId) {
          existing.parentId = currentSubgraph.id;
        }
      }

      if (currentSubgraph && !currentSubgraph.nodeIds.includes(nodeParsed.id)) {
        currentSubgraph.nodeIds.push(nodeParsed.id);
      }
    }
  }

  // Attach resolved classDef styles to nodes
  const finalNodes = Array.from(nodesMap.values()).map((node) => {
    if (node.className && classDefs[node.className]) {
      return {
        ...node,
        style: classDefs[node.className],
      };
    }
    return node;
  });

  return {
    diagramType,
    direction,
    nodes: finalNodes,
    edges,
    subgraphs,
    ...(Object.keys(classDefs).length > 0 ? { classDefs } : {}),
  };
}
