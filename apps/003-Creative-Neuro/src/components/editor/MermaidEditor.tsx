/**
 * Creative-Neuro Editor Subsystem - CodeMirror 6 Mermaid DSL Editor
 * Path: src/components/editor/MermaidEditor.tsx
 *
 * Implements:
 * - CodeMirror 6 with Markdown syntax & OneDark theme
 * - Bi-directional 300ms debounced synchronization
 * - Coordinate preservation via reconcileMermaidAST
 * - Non-blocking syntax error banner with line numbers
 * - Dual-scope support:
 *   1. Controlled mode (value / onChange / error props from FocusDiagramModal)
 *   2. Store-connected mode (Active Page scene graph OR embedded DiagramNode via diagramNodeId)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  dropCursor,
  drawSelection,
} from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  bracketMatching,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';
import {
  AlertCircle,
  Copy,
  Check,
  Code2,
  Minimize2,
  RefreshCw,
} from 'lucide-react';

import {
  useProjectStore,
  useActivePageNodes,
  useActivePageEdges,
} from '../../store/useProjectStore.ts';
import {
  parseMermaid,
  serializeMermaid,
  reconcileMermaidAST,
} from '../../engine/index.ts';
import type { FlowDirection, NeuroNode } from '../../types/index.ts';

export interface MermaidEditorProps {
  /** Controlled mode value (optional, used in FocusDiagramModal) */
  value?: string;
  /** Controlled mode change callback (optional, used in FocusDiagramModal) */
  onChange?: (newCode: string) => void;
  /** External syntax error string (optional) */
  error?: string | null;
  /** Target a specific DiagramNode in the store */
  diagramNodeId?: string;
  /** Whether the editor panel is visible */
  isOpen?: boolean;
  /** Callback when close button is clicked */
  onClose?: () => void;
  /** Optional container className */
  className?: string;
}

export interface SyntaxErrorDetail {
  line: number;
  message: string;
}

export function validateMermaidCode(code: string): SyntaxErrorDetail | null {
  const lines = code.split(/\r?\n/);
  let openSubgraphs = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/%%.*$/, '').trim();
    if (!line) continue;

    if (line.startsWith('subgraph')) openSubgraphs++;
    if (line === 'end') openSubgraphs--;

    // Check unclosed brackets
    const squareOpen = (line.match(/\[/g) || []).length;
    const squareClose = (line.match(/\]/g) || []).length;
    if (squareOpen !== squareClose) {
      return {
        line: i + 1,
        message: 'Unclosed square bracket "[" in node definition',
      };
    }

    const parenOpen = (line.match(/\(/g) || []).length;
    const parenClose = (line.match(/\)/g) || []).length;
    if (parenOpen !== parenClose) {
      return {
        line: i + 1,
        message: 'Unclosed parenthesis "(" in node definition',
      };
    }

    const curlyOpen = (line.match(/\{/g) || []).length;
    const curlyClose = (line.match(/\}/g) || []).length;
    if (curlyOpen !== curlyClose) {
      return {
        line: i + 1,
        message: 'Unclosed curly brace "{" in node definition',
      };
    }

    // Check hanging arrow at end of line without target
    if (/(?:-->|---|-.->|-.-|==>|===)\s*$/.test(line)) {
      return {
        line: i + 1,
        message: 'Hanging connector arrow missing target node',
      };
    }
  }

  if (openSubgraphs > 0) {
    return {
      line: lines.length,
      message: `Missing "end" for ${openSubgraphs} open subgraph(s)`,
    };
  }

  return null;
}

export function MermaidEditor({
  value,
  onChange,
  error: externalError,
  diagramNodeId,
  isOpen = true,
  onClose,
  className = '',
}: MermaidEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Sync state refs
  const isUserTypingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [copied, setCopied] = useState(false);
  const [syntaxError, setSyntaxError] = useState<SyntaxErrorDetail | null>(null);
  const [direction, setDirection] = useState<FlowDirection>('TB');

  // Zustand state
  const nodes = useActivePageNodes();
  const edges = useActivePageEdges();
  const activePageId = useProjectStore((s) => s.activePageId);
  const targetDiagramNode = useProjectStore((s) =>
    diagramNodeId ? s.nodes[diagramNodeId] : undefined
  );
  const updateNodeData = useProjectStore((s) => s.updateNodeData);

  const isControlled = typeof value === 'string' && typeof onChange === 'function';

  // Apply parsed code back to store (or controlled callback)
  const applyMermaidToCanvas = useCallback(
    (code: string) => {
      const err = validateMermaidCode(code);
      if (err) {
        setSyntaxError(err);
        return;
      }

      setSyntaxError(null);

      if (onChangeRef.current) {
        onChangeRef.current(code);
        return;
      }

      try {
        const ast = parseMermaid(code);
        setDirection(ast.direction || 'TB');

        if (diagramNodeId) {
          // Scope A: Embedded DiagramNode update
          updateNodeData(diagramNodeId, {
            mermaidCode: code,
            diagramOrientation: ast.direction,
          });
        } else {
          // Scope B: Entire Page scene graph reconciliation
          const currentStore = useProjectStore.getState();
          const activePage = currentStore.pages[currentStore.activePageId];
          if (!activePage) return;

          const existingNodes = activePage.nodeIds
            .map((id) => currentStore.nodes[id])
            .filter((n): n is NeuroNode => Boolean(n));

          const result = reconcileMermaidAST(ast, existingNodes);

          // Apply changes atomically via Zustand setState
          useProjectStore.setState((state) => {
            const page = state.pages[state.activePageId];
            if (!page) return;

            // 1. Delete removed nodes
            for (const remId of result.removedNodeIds) {
              delete state.nodes[remId];
            }
            page.nodeIds = page.nodeIds.filter(
              (id) => !result.removedNodeIds.includes(id)
            );

            // 2. Add or update nodes
            for (const n of result.nodes) {
              state.nodes[n.id] = n;
              if (!page.nodeIds.includes(n.id)) {
                page.nodeIds.push(n.id);
              }
            }

            // 3. Update edges
            const validNodeSet = new Set(result.nodes.map((n) => n.id));
            const activeEdges = result.edges.filter(
              (e) => validNodeSet.has(e.source) && validNodeSet.has(e.target)
            );

            // Clear old edges on page
            for (const eid of page.edgeIds) {
              delete state.edges[eid];
            }
            page.edgeIds = [];

            // Add reconciled edges
            for (const e of activeEdges) {
              state.edges[e.id] = e;
              page.edgeIds.push(e.id);
            }

            page.updatedAt = Date.now();
            state.project.updatedAt = Date.now();
          });
        }
      } catch (e) {
        setSyntaxError({ line: 1, message: (e as Error).message });
      }
    },
    [diagramNodeId, updateNodeData]
  );

  // Debounced typing handler (300ms)
  const handleEditorChange = useCallback(
    (newCode: string) => {
      isUserTypingRef.current = true;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        applyMermaidToCanvas(newCode);
        setTimeout(() => {
          isUserTypingRef.current = false;
        }, 50);
      }, 300);
    },
    [applyMermaidToCanvas]
  );

  // Compute current code from props or store
  const getCurrentCode = useCallback(() => {
    if (typeof value === 'string') {
      return value;
    }
    if (diagramNodeId && targetDiagramNode) {
      return (
        targetDiagramNode.data?.mermaidCode ||
        'flowchart TB\n  A[Start] --> B[End]'
      );
    }
    return serializeMermaid(nodes, edges, direction);
  }, [value, diagramNodeId, targetDiagramNode, nodes, edges, direction]);

  // Mount CodeMirror 6 EditorView
  useEffect(() => {
    if (!containerRef.current) return;

    const initialCode = getCurrentCode();

    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        dropCursor(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdown(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleEditorChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '13px',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            backgroundColor: '#090d16',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
          '.cm-gutters': {
            backgroundColor: '#060911',
            borderRight: '1px solid #1e293b',
            color: '#475569',
          },
          '.cm-activeLine': {
            backgroundColor: '#1e293b33',
          },
          '.cm-activeLineGutter': {
            backgroundColor: '#1e293b66',
            color: '#cbd5e1',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse Sync: Canvas / Controlled Value -> CodeMirror
  useEffect(() => {
    if (!viewRef.current || isUserTypingRef.current) return;

    const newCode = getCurrentCode();
    const currentCode = viewRef.current.state.doc.toString();

    if (newCode !== currentCode) {
      viewRef.current.dispatch({
        changes: { from: 0, to: currentCode.length, insert: newCode },
      });
    }
  }, [value, nodes, edges, activePageId, getCurrentCode]);

  const handleCopy = () => {
    if (!viewRef.current) return;
    const text = viewRef.current.state.doc.toString();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    if (!viewRef.current) return;
    const formatted = getCurrentCode();
    viewRef.current.dispatch({
      changes: {
        from: 0,
        to: viewRef.current.state.doc.length,
        insert: formatted,
      },
    });
    applyMermaidToCanvas(formatted);
  };

  if (!isOpen) return null;

  const displayError: SyntaxErrorDetail | null =
    syntaxError ||
    (externalError ? { line: 1, message: externalError } : null);

  return (
    <div
      className={`flex flex-col bg-slate-950 border-r border-slate-800 h-full w-full select-none shadow-2xl overflow-hidden ${className}`}
    >
      {/* Editor Header (hidden when embedded in controlled modal that provides its own header) */}
      {!isControlled && (
        <div className="h-11 px-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-200 tracking-tight">
              {diagramNodeId ? 'Diagram CodeMirror' : 'Mermaid DSL Sync'}
            </span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {direction}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleFormat}
              title="Re-format & Sync"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy Code"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close Editor"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Non-Blocking Error Banner */}
      {displayError && (
        <div className="px-3 py-2 bg-red-950/80 border-b border-red-800/80 text-red-200 flex items-start gap-2 text-xs shrink-0">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-red-300">
              Line {displayError.line}:
            </span>{' '}
            <span>{displayError.message}</span>
            <span className="block text-[11px] text-red-400/80 mt-0.5">
              Canvas sync paused until syntax is resolved.
            </span>
          </div>
        </div>
      )}

      {/* CodeMirror 6 Mount Node */}
      <div ref={containerRef} className="flex-1 overflow-hidden text-left" />

      {/* Footer Status */}
      <div className="h-7 px-3 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              displayError ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
            }`}
          />
          <span>
            {displayError ? 'Syntax Issue' : 'Live Sync Active (300ms)'}
          </span>
        </div>
        {!isControlled && (
          <div className="flex items-center gap-2">
            <span>{nodes.length} nodes</span>
            <span>•</span>
            <span>{edges.length} edges</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(MermaidEditor);
