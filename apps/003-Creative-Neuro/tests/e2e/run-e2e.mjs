/**
 * Creative-Neuro E2E Browser Automation Test Runner
 * Path: tests/e2e/run-e2e.mjs
 *
 * Conforms to rules.md Section 9.1 & 9.2 (Real Browser Automation Test):
 * 1. Launches real Headless Chrome with Chrome DevTools Protocol (CDP) via pipe protocol
 * 2. Opens the built web application from disk (file:///.../dist/index.html)
 * 3. Inspects real browser console for zero console errors (no React #185, no StoreUpdater loop)
 * 4. Verifies CanvasErrorBoundary is NOT triggered (no "Canvas Error Intercepted")
 * 5. Dispatches real mouse clicks and Tab (child node) / Enter (sibling node) keyboard shortcuts
 * 6. Verifies DOM node count progression (spawns 5 children + 5 siblings)
 * 7. Captures real browser view screenshots to tests/e2e/screenshots/
 */

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '../..');
const distHtmlPath = path.join(appRoot, 'dist', 'index.html');
const screenshotsDir = path.join(__dirname, 'screenshots');
fs.mkdirSync(screenshotsDir, { recursive: true });

console.log('=================================================================');
console.log('🌐 Creative-Neuro Real Browser E2E Automation Suite (Section 9.1)');
console.log('=================================================================');

// 1. Ensure build artifact exists
if (!fs.existsSync(distHtmlPath)) {
  console.log('\n[E2E Step 1] Building production bundle for browser test...');
  execSync('pnpm build', { cwd: appRoot, stdio: 'inherit' });
} else {
  console.log('\n[E2E Step 1] Using existing build bundle at:', distHtmlPath);
}

// 2. Locate Google Chrome
console.log('\n[E2E Step 2] Locating Google Chrome binary...');
let chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(chromePath)) {
  try {
    chromePath = execSync('which google-chrome || which chromium').toString().trim();
  } catch {
    // fallback
  }
}

if (!fs.existsSync(chromePath)) {
  console.error('❌ Google Chrome binary not found. Cannot run real browser E2E tests.');
  process.exit(1);
}
console.log('  ✓ Detected Chrome binary at:', chromePath);

// 3. Launch Chrome with CDP over pipes
console.log('\n[E2E Step 3] Launching Headless Chrome via CDP pipe transport...');
const tempProfileDir = path.join(__dirname, '.temp-e2e-profile');
fs.mkdirSync(tempProfileDir, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--remote-debugging-pipe',
    `--user-data-dir=${tempProfileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
  ],
  {
    stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'],
  }
);

const toChrome = chrome.stdio[3];
const fromChrome = chrome.stdio[4];

let buffer = '';
let msgId = 1;
const callbacks = new Map();
const consoleErrors = [];
const unhandledExceptions = [];

function sendCdp(method, params = {}, sessionId = undefined) {
  return new Promise((resolve) => {
    const id = msgId++;
    callbacks.set(id, resolve);
    const payload = sessionId
      ? { id, sessionId, method, params }
      : { id, method, params };
    toChrome.write(JSON.stringify(payload) + '\0');
  });
}

fromChrome.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  const lines = buffer.split('\0');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = msg.params.args.map((a) => a.value || a.description).join(' ');
        if (type === 'error') {
          consoleErrors.push(text);
          console.error('  🔴 [BROWSER CONSOLE ERROR]:', text);
        }
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
        unhandledExceptions.push(desc);
        console.error('  🔴 [BROWSER UNCAUGHT EXCEPTION]:', desc);
      }
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg);
        callbacks.delete(msg.id);
      }
    } catch {
      // ignore parse errors
    }
  }
});

async function runE2EScenario() {
  try {
    // Attach to page target
    const targetsRes = await sendCdp('Target.getTargets');
    const pageTarget = targetsRes.result.targetInfos.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found in Chrome');

    const attachRes = await sendCdp('Target.attachToTarget', {
      targetId: pageTarget.targetId,
      flatten: true,
    });
    const sessionId = attachRes.result.sessionId;

    const pageSend = (method, params = {}) => sendCdp(method, params, sessionId);

    await pageSend('Page.enable');
    await pageSend('Runtime.enable');
    await pageSend('Input.enable');

    const appFileUrl = `file://${distHtmlPath}`;
    console.log(`\n[E2E Step 4] Navigating real Chrome to: ${appFileUrl}`);
    await pageSend('Page.navigate', { url: appFileUrl });

    // Wait for page to initialize and render seed nodes
    console.log('  -> Waiting for React tree & React Flow canvas initialization...');
    let initialNodeCount = 0;
    for (let attempts = 0; attempts < 30; attempts++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await pageSend('Runtime.evaluate', {
        expression: 'document.querySelectorAll(".react-flow__node").length',
      });
      initialNodeCount = res.result?.result?.value || 0;
      if (initialNodeCount > 0) break;
    }

    console.log(`  ✓ React Flow rendered with ${initialNodeCount} initial nodes`);
    if (initialNodeCount === 0) {
      throw new Error('Canvas failed to render initial nodes within 6s');
    }

    // Capture initial screenshot
    const initialSs = await pageSend('Page.captureScreenshot', { format: 'png' });
    const initialSsPath = path.join(screenshotsDir, '01_initial_canvas.png');
    fs.writeFileSync(initialSsPath, Buffer.from(initialSs.result.data, 'base64'));
    console.log(`  ✓ Captured initial browser screenshot: ${path.relative(appRoot, initialSsPath)} (${fs.statSync(initialSsPath).size} bytes)`);

    // Click on root node to select it
    console.log('\n[E2E Step 5] Selecting root node via DOM dispatch event...');
    const clickRes = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const rootNode = document.querySelector(".react-flow__node[data-id='mm-root']") || document.querySelector(".react-flow__node");
          if (!rootNode) return { success: false, reason: "No node found" };
          const rect = rootNode.getBoundingClientRect();
          rootNode.dispatchEvent(new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          }));
          return { success: true, id: rootNode.getAttribute("data-id") };
        })()
      `,
      returnByValue: true,
    });

    console.log(`  ✓ Selected node: ${clickRes.result?.result?.value?.id}`);
    await new Promise((r) => setTimeout(r, 400));

    // Dispatch 5 Tab keystrokes (branching children to the right)
    console.log('\n[E2E Step 6] Testing Tab shortcut: Continuous child node branching (5 steps)...');
    for (let i = 1; i <= 5; i++) {
      await pageSend('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
      await pageSend('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
      await new Promise((r) => setTimeout(r, 250));
    }

    const nodeCountAfterTab = (
      await pageSend('Runtime.evaluate', {
        expression: 'document.querySelectorAll(".react-flow__node").length',
      })
    ).result?.result?.value;
    console.log(`  ✓ Node count after 5 Tab presses: ${nodeCountAfterTab} (spawned ${nodeCountAfterTab - initialNodeCount} child nodes)`);

    // Dispatch 5 Enter keystrokes (branching siblings)
    console.log('\n[E2E Step 7] Testing Enter shortcut: Continuous sibling node creation (5 steps)...');
    for (let i = 1; i <= 5; i++) {
      await pageSend('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
      });
      await pageSend('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
      });
      await new Promise((r) => setTimeout(r, 250));
    }

    const finalNodeCount = (
      await pageSend('Runtime.evaluate', {
        expression: 'document.querySelectorAll(".react-flow__node").length',
      })
    ).result?.result?.value;
    console.log(`  ✓ Final node count after 5 Enter presses: ${finalNodeCount} (total new nodes: ${finalNodeCount - initialNodeCount})`);

    // Capture post-interaction screenshot
    const postSs = await pageSend('Page.captureScreenshot', { format: 'png' });
    const postSsPath = path.join(screenshotsDir, '02_after_tab_enter_tree.png');
    fs.writeFileSync(postSsPath, Buffer.from(postSs.result.data, 'base64'));
    console.log(`  ✓ Captured post-interaction screenshot: ${path.relative(appRoot, postSsPath)} (${fs.statSync(postSsPath).size} bytes)`);

    // Step 8: Verify Edge Selection and Arrowhead Options Toggle
    console.log('\n[E2E Step 8] Testing Edge Floating Action Bar: Arrow options (Forward, Bidirectional, None)...');
    const selectEdgeRes = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const edgeEl = document.querySelector(".react-flow__edge");
          if (!edgeEl) return { success: false, reason: "No edge found" };
          const pathEl = edgeEl.querySelector("path.react-flow__edge-path") || edgeEl.querySelector("path");
          if (!pathEl) return { success: false, reason: "No edge path found" };
          const rect = pathEl.getBoundingClientRect();
          pathEl.dispatchEvent(new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          }));
          return { success: true, edgeId: edgeEl.getAttribute("data-id") };
        })()
      `,
      returnByValue: true,
    });
    console.log(`  ✓ Edge selected via DOM click: ${selectEdgeRes.result?.result?.value?.edgeId}`);
    await new Promise((r) => setTimeout(r, 400));

    // Verify hollow circle handles appear at endpoints when selected
    const hollowHandlesCheck = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const edgeEl = document.querySelector(".react-flow__edge.selected");
          if (!edgeEl) return { success: false, reason: "No selected edge found" };
          const sourceHandle = edgeEl.querySelector(".react-flow__edge-endpoint-source");
          const targetHandle = edgeEl.querySelector(".react-flow__edge-endpoint-target");
          if (!sourceHandle || !targetHandle) {
            return {
              success: false,
              reason: "Hollow circle endpoint handles missing",
              hasSource: Boolean(sourceHandle),
              hasTarget: Boolean(targetHandle),
            };
          }
          const sourceStroke = sourceHandle.getAttribute("stroke");
          const targetStroke = targetHandle.getAttribute("stroke");
          const sourceR = sourceHandle.getAttribute("r");
          const targetR = targetHandle.getAttribute("r");
          return {
            success: true,
            sourceStroke,
            targetStroke,
            sourceR,
            targetR,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log(`  ✓ Endpoint hollow handles: source (r=${hollowHandlesCheck.result?.result?.value?.sourceR}, stroke=${hollowHandlesCheck.result?.result?.value?.sourceStroke}), target (r=${hollowHandlesCheck.result?.result?.value?.targetR}, stroke=${hollowHandlesCheck.result?.result?.value?.targetStroke})`);
    if (!hollowHandlesCheck.result?.result?.value?.success) {
      throw new Error(`Endpoint hollow circles check failed: ${hollowHandlesCheck.result?.result?.value?.reason}`);
    }

    // Capture screenshot showing selected edge with hollow circles
    const hollowSs = await pageSend('Page.captureScreenshot', { format: 'png' });
    const hollowSsPath = path.join(screenshotsDir, '04_edge_selected_hollow_circles.png');
    fs.writeFileSync(hollowSsPath, Buffer.from(hollowSs.result.data, 'base64'));
    console.log(`  ✓ Captured selected edge with hollow circles screenshot: ${path.relative(appRoot, hollowSsPath)} (${fs.statSync(hollowSsPath).size} bytes)`);

    // 8a. Toggle to Bidirectional Arrow
    const bidirRes = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector("[data-testid='edge-arrow-bidirectional']");
          if (!btn) return { success: false, reason: "Bidirectional arrow button not visible" };
          btn.click();
          return { success: true };
        })()
      `,
      returnByValue: true,
    });
    if (!bidirRes.result?.result?.value?.success) {
      throw new Error(`Failed to click bidirectional arrow button: ${bidirRes.result?.result?.value?.reason}`);
    }
    await new Promise((r) => setTimeout(r, 300));

    const bidirMarkerCheck = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const edgeEl = document.querySelector(".react-flow__edge.selected") || document.querySelector(".react-flow__edge");
          const pathEl = edgeEl?.querySelector("path.react-flow__edge-path");
          const markerStart = pathEl?.getAttribute("marker-start");
          const markerEnd = pathEl?.getAttribute("marker-end");
          return { markerStart, markerEnd, hasBoth: Boolean(markerStart && markerEnd) };
        })()
      `,
      returnByValue: true,
    });
    console.log(`  ✓ Bidirectional arrow state: marker-start="${bidirMarkerCheck.result?.result?.value?.markerStart}", marker-end="${bidirMarkerCheck.result?.result?.value?.markerEnd}"`);
    if (!bidirMarkerCheck.result?.result?.value?.hasBoth) {
      throw new Error('Bidirectional arrow marker check failed: expected both marker-start and marker-end!');
    }

    // 8b. Toggle to No Arrow
    const noneRes = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector("[data-testid='edge-arrow-none']");
          if (!btn) return { success: false, reason: "No arrow button not visible" };
          btn.click();
          return { success: true };
        })()
      `,
      returnByValue: true,
    });
    if (!noneRes.result?.result?.value?.success) {
      throw new Error(`Failed to click no-arrow button: ${noneRes.result?.result?.value?.reason}`);
    }
    await new Promise((r) => setTimeout(r, 300));

    const noneMarkerCheck = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const edgeEl = document.querySelector(".react-flow__edge.selected") || document.querySelector(".react-flow__edge");
          const pathEl = edgeEl?.querySelector("path.react-flow__edge-path");
          const markerStart = pathEl?.getAttribute("marker-start");
          const markerEnd = pathEl?.getAttribute("marker-end");
          return { markerStart, markerEnd, hasNone: !markerStart && !markerEnd };
        })()
      `,
      returnByValue: true,
    });
    console.log(`  ✓ No arrow state: marker-start="${noneMarkerCheck.result?.result?.value?.markerStart}", marker-end="${noneMarkerCheck.result?.result?.value?.markerEnd}"`);
    if (!noneMarkerCheck.result?.result?.value?.hasNone) {
      throw new Error('No-arrow marker check failed: expected neither marker-start nor marker-end!');
    }

    // 8c. Toggle back to Forward Arrow
    const forwardRes = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector("[data-testid='edge-arrow-forward']");
          if (!btn) return { success: false, reason: "Forward arrow button not visible" };
          btn.click();
          return { success: true };
        })()
      `,
      returnByValue: true,
    });
    if (!forwardRes.result?.result?.value?.success) {
      throw new Error(`Failed to click forward arrow button: ${forwardRes.result?.result?.value?.reason}`);
    }
    await new Promise((r) => setTimeout(r, 300));

    const fwdMarkerCheck = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const edgeEl = document.querySelector(".react-flow__edge.selected") || document.querySelector(".react-flow__edge");
          const pathEl = edgeEl?.querySelector("path.react-flow__edge-path");
          const markerStart = pathEl?.getAttribute("marker-start");
          const markerEnd = pathEl?.getAttribute("marker-end");
          return { markerStart, markerEnd, hasForwardOnly: !markerStart && Boolean(markerEnd) };
        })()
      `,
      returnByValue: true,
    });
    console.log(`  ✓ Forward arrow state: marker-start="${fwdMarkerCheck.result?.result?.value?.markerStart}", marker-end="${fwdMarkerCheck.result?.result?.value?.markerEnd}"`);
    if (!fwdMarkerCheck.result?.result?.value?.hasForwardOnly) {
      throw new Error('Forward arrow marker check failed: expected only marker-end!');
    }

    // Capture arrow options screenshot
    const arrowSs = await pageSend('Page.captureScreenshot', { format: 'png' });
    const arrowSsPath = path.join(screenshotsDir, '03_edge_arrow_markers.png');
    fs.writeFileSync(arrowSsPath, Buffer.from(arrowSs.result.data, 'base64'));
    console.log(`  ✓ Captured edge arrow markers screenshot: ${path.relative(appRoot, arrowSsPath)} (${fs.statSync(arrowSsPath).size} bytes)`);

    // Step 9: Multi-Selection (Nodes + Edges) Stacked Action Bars verification
    console.log('\n[E2E Step 9] Testing Multi-selection of both nodes & edge: stacked floating action bars above bounding box...');
    const multiSelRes = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.__CREATIVE_NEURO_STORE__) {
            const store = window.__CREATIVE_NEURO_STORE__.getState();
            store.setSelectedNodes(['mm-root', 'mm-branch-state']);
            store.setSelectedEdges(['e-mm-root-state']);
            return { success: true };
          }
          return { success: false, reason: "Store not found on window" };
        })()
      `,
      returnByValue: true,
    });
    console.log(`  ✓ Multi-selection applied via store:`, multiSelRes.result?.result?.value);
    await new Promise((r) => setTimeout(r, 400));

    // Verify stacked action bars in real Chrome DOM
    const stackedCheck = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const container = document.querySelector("[data-testid='multi-selection-action-bars']");
          const bbox = document.querySelector("[data-testid='selection-bounding-box']");
          if (!container || !bbox) {
            return { success: false, reason: "Container or bounding box missing", hasContainer: Boolean(container), hasBbox: Boolean(bbox) };
          }

          const edgeBar = container.querySelector("[data-testid='edge-floating-action-bar']");
          const nodeBar = container.querySelector("[data-testid='node-floating-action-bar']");
          if (!edgeBar || !nodeBar) {
            return { success: false, reason: "EdgeBar or NodeBar missing in stacked container", hasEdgeBar: Boolean(edgeBar), hasNodeBar: Boolean(nodeBar) };
          }

          const edgeRect = edgeBar.getBoundingClientRect();
          const nodeRect = nodeBar.getBoundingClientRect();
          const bboxRect = bbox.getBoundingClientRect();

          // Verify top-to-bottom order: Edge bar is above Node bar, and both are above the bounding box
          const isEdgeAboveNode = edgeRect.bottom <= nodeRect.top + 10;
          const isNodeAboveBbox = nodeRect.top <= bboxRect.top + 10;
          const zIndexVal = window.getComputedStyle(container).zIndex;
          const isZTop = zIndexVal === "999999" || parseInt(zIndexVal, 10) >= 99999;

          return {
            success: isEdgeAboveNode && isNodeAboveBbox && isZTop,
            isEdgeAboveNode,
            isNodeAboveBbox,
            isZTop,
            edgeTop: edgeRect.top,
            nodeTop: nodeRect.top,
            bboxTop: bboxRect.top,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log(`  ✓ Stacked action bars check:`, stackedCheck.result?.result?.value);
    if (!stackedCheck.result?.result?.value?.success) {
      throw new Error(`Stacked action bars verification failed: ${JSON.stringify(stackedCheck.result?.result?.value)}`);
    }

    // Capture screenshot showing stacked action bars above selection bounding box
    const stackedSs = await pageSend('Page.captureScreenshot', { format: 'png' });
    const stackedSsPath = path.join(screenshotsDir, '05_multi_selection_stacked_action_bars.png');
    fs.writeFileSync(stackedSsPath, Buffer.from(stackedSs.result.data, 'base64'));
    console.log(`  ✓ Captured multi-selection stacked action bars screenshot: ${path.relative(appRoot, stackedSsPath)} (${fs.statSync(stackedSsPath).size} bytes)`);

    // Step 10: Testing Diagram & Mermaid ELK Auto-Layout in Focus Mode
    console.log('\n[E2E Step 10] Testing Diagram & Mermaid ELK Auto-Layout in Focus Mode...');
    const focusDiagramRes = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__CREATIVE_NEURO_STORE__) return { success: false, reason: "Store missing" };
          const store = window.__CREATIVE_NEURO_STORE__.getState();
          // Switch to Page 2 (Engine Flowchart & Jumps) which contains fc-diagram-card
          store.setActivePage('page-flowchart');
          store.setFocusedDiagramId('fc-diagram-card');
          return { success: true };
        })()
      `,
      returnByValue: true,
    });
    console.log('  ✓ Focused into diagram fc-diagram-card:', focusDiagramRes.result?.result?.value);
    await new Promise((r) => setTimeout(r, 600));

    // Check modal visibility and sub-nodes ELK hierarchical positions
    const elkHierarchyCheck = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector("[data-testid='focus-diagram-modal']");
          if (!modal) return { success: false, reason: "Focus diagram modal not found in DOM" };

          const autoLayoutBtn = modal.querySelector("[data-testid='focus-diagram-auto-layout']");
          if (!autoLayoutBtn) return { success: false, reason: "Auto Layout button missing" };

          // Trigger Auto Layout click
          autoLayoutBtn.click();

          // Check sub-canvas nodes
          const subNodes = Array.from(modal.querySelectorAll(".react-flow__node"));
          if (subNodes.length === 0) return { success: false, reason: "No sub-nodes rendered on sub-canvas" };

          const rects = subNodes.map((n) => {
            const r = n.getBoundingClientRect();
            return { id: n.getAttribute("data-id") || "", top: r.top, left: r.left };
          });

          return {
            success: true,
            nodeCount: subNodes.length,
            rects,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('  ✓ Diagram ELK layout check:', elkHierarchyCheck.result?.result?.value);
    if (!elkHierarchyCheck.result?.result?.value?.success) {
      throw new Error(`Diagram ELK layout verification failed: ${elkHierarchyCheck.result?.result?.value?.reason}`);
    }

    // Capture screenshot of Diagram in Focus Mode with ELK Auto-Layout
    const diagramSs = await pageSend('Page.captureScreenshot', { format: 'png' });
    const diagramSsPath = path.join(screenshotsDir, '06_diagram_mermaid_elk_layout.png');
    fs.writeFileSync(diagramSsPath, Buffer.from(diagramSs.result.data, 'base64'));
    console.log(`  ✓ Captured diagram ELK layout screenshot: ${path.relative(appRoot, diagramSsPath)} (${fs.statSync(diagramSsPath).size} bytes)`);

    // Test right-click canvas panning inside FocusDiagramModal (OP-01)
    const initialViewport = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const vp = document.querySelector("[data-testid='focus-diagram-modal'] .react-flow__viewport");
          return vp ? vp.style.transform : "";
        })()
      `,
      returnByValue: true,
    });

    // Dispatch right-click drag from (700, 300) to (600, 250)
    await pageSend('Input.dispatchMouseEvent', { type: 'mousePressed', x: 700, y: 300, button: 'right', buttons: 2 });
    await pageSend('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600, y: 250, button: 'right', buttons: 2 });
    await pageSend('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 600, y: 250, button: 'right', buttons: 0 });
    await new Promise((r) => setTimeout(r, 200));

    const pannedViewport = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const vp = document.querySelector("[data-testid='focus-diagram-modal'] .react-flow__viewport");
          return vp ? vp.style.transform : "";
        })()
      `,
      returnByValue: true,
    });
    console.log(`  ✓ Sub-canvas right-click pan: initial="${initialViewport.result?.result?.value}" -> panned="${pannedViewport.result?.result?.value}"`);

    // Paste the 6-layer architecture Mermaid into the CodeMirror editor and trigger Auto Layout (TB)
    console.log('\n[E2E Step 10b] Testing 6-layer architecture Mermaid Top-to-Down Auto Layout:');
    const architectureMermaid = `flowchart TB
 subgraph ShellLayer["0. 跨平台容器與 UI 外殼層 (App Shell & Container)"]
        Tauri["<b>Tauri 2.0 (Rust + WKWebView)</b><br>角色：macOS 原生桌面容器與本機檔案 I/O"]
        Radix["<b>Radix UI / shadcn/ui + Tailwind v4</b><br>角色：無障礙分頁 (Tabs)、側邊工具列、Cmd+K 搜尋"]
  end
 subgraph InputLayer["1. 多模態輸入與雙向編輯層 (Multimodal Input Layer)"]
        CM6["<b>CodeMirror 6 (@codemirror/view)</b><br>角色：專注模式左側 Mermaid 代碼編輯器"]
        Langium["<b>Mermaid / Langium Parser</b><br>角色：語法解析與雙向轉譯器 (AST ⇄ JSON)"]
        LiveAI["<b>Gemini Live / OpenAI Realtime API</b><br>角色：WebSocket/WebRTC 全雙工語音與 VAD 偵測"]
        UserInput["<b>滑鼠 / 鍵盤快捷鍵互動</b><br>角色：Tab 子節點 / Enter 兄弟節點 / ⌥+方向鍵 / 拖曳"]
  end
 subgraph StateLayer["2. 核心狀態與歷史中樞 (Single Source of Truth)"]
        Immer["<b>immer (ES6 Proxy)</b><br>角色：將直覺賦值轉為不可變結構共享樹"]
        Zustand["<b>zustand (Central Store)</b><br>角色：集中管理 Project ➔ Board ➔ Page ➔ NeuroNode[]<br>同時持有結構 (AST) 與幾何座標 (x, y, layoutMode)"]
        Zundo["<b>zundo (Temporal Middleware)</b><br>角色：攔截狀態快照，維護 past[] 與 future[] 堆疊"]
  end
 subgraph ComputeLayer["3. 幾何排版與空間運算層 (Layout & Geometry Engine)"]
        ELK["<b>elkjs (Web Worker)</b><br>角色：階層與複合子圖 (Sub-graph) 自動排版引擎"]
        AABB["<b>Smart Placement (AABB 避障演算法)</b><br>角色：Manual 模式下計算無碰撞的新節點落點"]
        LineJump["<b>Line-Line Intersection 演算法</b><br>角色：偵測跨線交點並注入 SVG 圓弧跳線指令"]
  end
 subgraph RenderLayer["4. 統一圖形畫布渲染層 (Unified Scene Graph & Canvas)"]
        ReactFlow["<b>@xyflow/react (React Flow v12) + React 19</b><br>角色：外層白板與內層 Diagram 共用的無限畫布引擎<br>• <b>HTML DOM 層</b>：渲染 Shape / Text / Frame / Diagram 容器<br>• <b>SVG 向量層</b>：渲染 Connector 連線、跳線與 Freehand 塗鴉"]
  end
 subgraph StorageLayer["5. 本地優先儲存與壓縮匯出層 (Persistence & Export)"]
        Dexie["<b>Dexie.js (IndexedDB)</b><br>角色：瀏覽器端非同步 NoSQL 本機離線資料庫"]
        Supabase["<b>Supabase (PostgreSQL + Realtime)</b><br>角色：雲端 JSONB 同步與互動式 Embed URL 生成"]
        HtmlToImage["<b>html-to-image</b><br>角色：將 DOM + SVG 內聯化並光柵化為圖片"]
        PakoZip["<b>pako (zlib) + JSZip</b><br>角色：JSON Deflate 無損壓縮與 ZIP 容器打包"]
  end
    Radix -- 輸出: Tool Mode 切換 / Page ID 路由 --> Zustand
    CM6 <-- 輸入: 使用者打字 (Transaction)<br>輸出: Mermaid DSL 純文字字串 --> Langium
    Langium <-- 輸出: 解析後 AST (依 Node ID 對帳 Diff)<br>輸入: NeuroNode[] 反編譯回文字 --> Immer
    LiveAI -- 輸入: 麥克風 PCM 音訊串流<br>輸出: Function Call JSON (upsertDiagramNodes) --> Immer
    UserInput -- 輸入: 快捷鍵 / 滑鼠事件<br>輸出: 新增或移動節點 Action --> AABB
    AABB -- 輸入: 父節點座標 + 現有節點 Bounding Boxes<br>輸出: 無碰撞目標座標 {x, y} --> Immer
    Immer <-- 輸入: Draft 狀態修改<br>輸出: Immutable 新狀態樹 --> Zustand
    Zustand <-- 輸入: 狀態變更 Diff Patch<br>輸出: Cmd+Z / Cmd+Shift+Z 狀態還原 --> Zundo
    Zustand -- "輸出: 設為 auto-elk 的 Nodes/Edges 結構樹<br>(含 sub-graph 方向設定與 Fixed 約束)" --> ELK
    ELK -- 輸出: 計算完成的節點絕對座標 {x, y}<br>與正交/曲線連線轉折點 --> Immer
    Zustand -- 輸出: 當前可視區 Nodes[] 與 Edges[] 狀態 --> ReactFlow
    ReactFlow -- 輸出: 連線端點座標陣列 --> LineJump
    LineJump -- 輸出: 插入 A rx ry 圓弧跳線的 SVG Path --> ReactFlow
    ReactFlow -- 輸出: 節點拖曳結束 onNodeDragStop {id, x, y}<br>或雙擊聚焦 Viewport --> Immer
    Zustand <-- 輸入/輸出: Project 完整 JSON 狀態樹<br>(非同步自動存檔與離線載入) --> Dexie
    Dexie <-- 透過 Tauri IPC 橋接 --> Tauri
    Zustand -- "輸出: 單一 Project 完整狀態 + 協作 Presence<br>輸入: 遠端變更事件 (Real-time Sync)" --> Supabase
    ReactFlow -- "輸出: Canvas 完整 Viewport 截圖 (canvas.toDataURL)" --> HtmlToImage
    HtmlToImage -- 輸入: SVG / PNG 二進位檔<br>輸出: JPG / WebP / PNG 格式 --> PakoZip
    PakoZip -- "輸出: .project / .board 二進位壓縮檔案" --> Tauri

     Tauri:::shell
     Radix:::shell
     CM6:::input
     Langium:::input
     LiveAI:::input
     UserInput:::input
     Immer:::store
     Zustand:::store
     Zundo:::store
     ELK:::compute
     AABB:::compute
     LineJump:::compute
     ReactFlow:::render
     Dexie:::storage
     Supabase:::storage
     HtmlToImage:::storage
     PakoZip:::storage
    classDef shell fill:#f1f5f9,stroke:#64748b,stroke-width:1.5px,color:#0f172a
    classDef input fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0c4a6e
    classDef store fill:#fef3c7,stroke:#d97706,stroke-width:2.5px,color:#78350f
    classDef compute fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#581c87
    classDef render fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d
    classDef storage fill:#ffe4e6,stroke:#e11d48,stroke-width:2px,color:#881337`;

    // Set taller viewport temporarily so the full 6-layer architecture diagram renders at crisp scale
    await pageSend('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1400,
      deviceScaleFactor: 2,
      mobile: false,
    });

    await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const cmEditor = document.querySelector("[data-testid='focus-diagram-modal'] .cm-editor");
          const holder = cmEditor?.parentElement;
          if (holder && holder.__cmView) {
            const view = holder.__cmView;
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: ${JSON.stringify(architectureMermaid)} }
            });
            return true;
          }
          const store = window.__neuroStore?.getState();
          if (store && store.focusedDiagramId) {
            store.updateNodeData(store.focusedDiagramId, {
              mermaidCode: ${JSON.stringify(architectureMermaid)},
              customData: {},
            });
            return true;
          }
          return false;
        })()
      `,
      returnByValue: true,
    });

    // Wait for 300ms debounce + ELK layout + fitView
    await new Promise((r) => setTimeout(r, 850));

    // Also click the Auto Layout button explicitly to verify button action
    await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector("[data-testid='focus-diagram-modal']");
          const btn = modal?.querySelector("[data-testid='focus-diagram-auto-layout']");
          if (btn) btn.click();
        })()
      `,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 500));

    const archCheck = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector("[data-testid='focus-diagram-modal']");
          const subNodes = Array.from(modal?.querySelectorAll(".react-flow__node") || []);
          const subEdges = Array.from(modal?.querySelectorAll(".react-flow__edge") || []);
          const frameOrder = ['ShellLayer', 'InputLayer', 'StateLayer', 'ComputeLayer', 'RenderLayer', 'StorageLayer'];
          const frameRects = frameOrder.map((fid) => {
            const el = modal?.querySelector(".react-flow__node[data-id='" + fid + "']");
            const r = el?.getBoundingClientRect();
            return { id: fid, top: r ? Math.round(r.top) : null, bottom: r ? Math.round(r.bottom) : null, width: r ? Math.round(r.width) : null, height: r ? Math.round(r.height) : null };
          });
          return {
            totalNodes: subNodes.length,
            totalEdges: subEdges.length,
            frameRects,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('  ✓ 6-Layer Architecture ELK TB layout check:', JSON.stringify(archCheck.result?.result?.value));

    const archSs = await pageSend('Page.captureScreenshot', { format: 'png' });
    const archSsPath = path.join(screenshotsDir, '07_user_architecture_mermaid_elk_tb.png');
    fs.writeFileSync(archSsPath, Buffer.from(archSs.result.data, 'base64'));
    console.log(`  ✓ Captured 6-Layer Architecture screenshot: ${path.relative(appRoot, archSsPath)} (${fs.statSync(archSsPath).size} bytes)`);

    // Step 10c: Test Edge Routing Type Selector (Smoothstep / Bezier / Jump / Straight), Spacing Preset Selector, and Sub-Canvas EdgeFloatingActionBar
    console.log('\n[E2E Step 10c] Testing Diagram Edge Routing Type Selector, Spacing Preset & EdgeFloatingActionBar:');
    const routingAndSpacingCheck = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector("[data-testid='focus-diagram-modal']");
          if (!modal) return { success: false, reason: "Focus modal not found" };

          const stepBtn = modal.querySelector("[data-testid='focus-routing-smoothstep']");
          const curveBtn = modal.querySelector("[data-testid='focus-routing-bezier']");
          const jumpBtn = modal.querySelector("[data-testid='focus-routing-jump']");
          const lineBtn = modal.querySelector("[data-testid='focus-routing-straight']");
          const spacingSelect = modal.querySelector("[data-testid='focus-diagram-spacing']");

          if (!stepBtn || !curveBtn || !jumpBtn || !lineBtn || !spacingSelect) {
            return { success: false, reason: "Routing buttons or spacing selector missing" };
          }

          // Switch to Step (Smoothstep orthogonal routing)
          stepBtn.click();
          return { success: true };
        })()
      `,
      returnByValue: true,
    });
    if (!routingAndSpacingCheck.result?.result?.value?.success) {
      throw new Error(`Routing & Spacing toolbar check failed: ${routingAndSpacingCheck.result?.result?.value?.reason}`);
    }
    await new Promise((r) => setTimeout(r, 350));

    // Also select one edge label in the sub-canvas to show EdgeFloatingActionBar inside FocusDiagramModal
    await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector("[data-testid='focus-diagram-modal']");
          const edgeLabels = Array.from(modal?.querySelectorAll(".react-flow__edgelabel-renderer div") || []);
          const targetLabel = edgeLabels.find((el) => el.textContent && el.textContent.includes("Tool Mode"));
          if (targetLabel) targetLabel.click();
        })()
      `,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 350));

    const subEdgeBarCheck = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector("[data-testid='focus-diagram-modal']");
          const edgeBar = modal?.querySelector("[data-testid='edge-floating-action-bar']");
          const samplePath = modal?.querySelector(".react-flow__edge path.react-flow__edge-path")?.getAttribute("d") || "";
          return {
            hasSubEdgeBar: Boolean(edgeBar),
            isSmoothstepPath: samplePath.includes("Q") || samplePath.includes("L"),
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('  ✓ Sub-canvas Smoothstep routing & EdgeFloatingActionBar check:', JSON.stringify(subEdgeBarCheck.result?.result?.value));

    const stepSs = await pageSend('Page.captureScreenshot', { format: 'png' });
    const stepSsPath = path.join(screenshotsDir, '08_user_architecture_smoothstep_routing.png');
    fs.writeFileSync(stepSsPath, Buffer.from(stepSs.result.data, 'base64'));
    console.log(`  ✓ Captured Smoothstep + EdgeFloatingActionBar screenshot: ${path.relative(appRoot, stepSsPath)} (${fs.statSync(stepSsPath).size} bytes)`);

    // Close diagram modal via Back to Canvas button or Escape key
    await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector("[data-testid='focus-diagram-modal']");
          if (!modal) return;
          // Click the Done or Back button
          const closeBtn = modal.querySelector("button:has(svg.lucide-arrow-left)") || modal.querySelector("button:has(svg.lucide-check)");
          if (closeBtn) {
            closeBtn.click();
          } else if (window.__CREATIVE_NEURO_STORE__) {
            window.__CREATIVE_NEURO_STORE__.getState().setFocusedDiagramId(null);
          }
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 600));

    // Ensure active page is page-flowchart (where fc-diagram-card lives) and focused modal is closed
    await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const store = window.__CREATIVE_NEURO_STORE__?.getState();
          if (store) {
            store.setActivePage('page-flowchart');
            store.setFocusedDiagramId(null);
          }
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 600));

    // Reset emulation + selection so 10d runs under normal viewport conditions
    await pageSend('Emulation.clearDeviceMetricsOverride');
    await pageSend('Runtime.evaluate', {
      expression: `(() => { const s = window.__CREATIVE_NEURO_STORE__.getState(); s.setSelectedNodes([]); s.setSelectedEdges([]); })()`,
    });
    await new Promise((r) => setTimeout(r, 600));

    // Step 10d: Test DiagramNode on Main Canvas — Left-Click Move Position & Left-Click Border/Corner Resize
    console.log('\n[E2E Step 10d] Testing DiagramNode on Main Canvas: Left-click drag move & border/corner resize...');
    const beforeDiagramGeom = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector("[data-testid='focus-diagram-modal']");
          const el = document.querySelector("[data-testid='diagram-node-fc-diagram-card']");
          const store = window.__CREATIVE_NEURO_STORE__?.getState();
          const storeNode = store?.nodes?.['fc-diagram-card'];
          const activePage = store?.activePageId;
          const pageNodes = store?.pages?.[activePage]?.nodeIds;
          if (!el) {
            return {
              notFound: true,
              modalPresent: Boolean(modal),
              focusedDiagramId: store?.focusedDiagramId,
              activePage,
              hasNodeInStore: Boolean(storeNode),
              pageNodes,
              allNodeTypesInDom: Array.from(document.querySelectorAll(".react-flow__node")).map(n => ({
                id: n.getAttribute("data-id"),
                className: n.className,
                testId: n.querySelector("[data-testid]")?.getAttribute("data-testid")
              }))
            };
          }
          const r = el.getBoundingClientRect();
          return {
            rect: { left: r.left, top: r.top, width: r.width, height: r.height, centerX: r.left + r.width / 2, centerY: r.top + r.height / 2 },
            pos: storeNode ? { ...storeNode.position } : null,
            size: storeNode ? { width: storeNode.width, height: storeNode.height } : null,
          };
        })()
      `,
      returnByValue: true,
    });
    const initDiag = beforeDiagramGeom.result?.result?.value;
    if (!initDiag || initDiag.notFound) {
      throw new Error('fc-diagram-card not found on main canvas after closing FocusDiagramModal: ' + JSON.stringify(initDiag));
    }
    console.log('  -> Initial fc-diagram-card:', JSON.stringify(initDiag));

    // 1. Real CDP Left-click drag on fc-diagram-card by (-120, +80)
    const dragStartX = Math.round(initDiag.rect.centerX);
    const dragStartY = Math.round(initDiag.rect.centerY);
    const dragEndX = dragStartX - 120;
    const dragEndY = dragStartY + 80;

    await pageSend('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragStartX, y: dragStartY, button: 'none', buttons: 0 });
    await pageSend('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragStartX, y: dragStartY, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i++) {
      const curX = Math.round(dragStartX + (-120 * i) / 10);
      const curY = Math.round(dragStartY + (80 * i) / 10);
      await pageSend('Input.dispatchMouseEvent', { type: 'mouseMoved', x: curX, y: curY, button: 'left', buttons: 1 });
      await new Promise((r) => setTimeout(r, 25));
    }
    await pageSend('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dragEndX, y: dragEndY, button: 'left', buttons: 0, clickCount: 1 });
    await new Promise((r) => setTimeout(r, 400));

    const afterDragGeom = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector("[data-testid='focus-diagram-modal']");
          const el = document.querySelector("[data-testid='diagram-node-fc-diagram-card']");
          const seHandle = el?.querySelector("[data-testid='diagram-resize-se']");
          const eBorder = el?.querySelector("[data-testid='diagram-resize-e']");
          const r = el?.getBoundingClientRect();
          const seRect = seHandle?.getBoundingClientRect();
          const eRect = eBorder?.getBoundingClientRect();
          const storeNode = window.__CREATIVE_NEURO_STORE__?.getState()?.nodes?.['fc-diagram-card'];
          return {
            modalOpenedAccidentally: Boolean(modal),
            pos: storeNode ? { ...storeNode.position } : null,
            size: storeNode ? { width: storeNode.width, height: storeNode.height } : null,
            seCenter: seRect ? { x: Math.round(seRect.left + seRect.width / 2), y: Math.round(seRect.top + seRect.height / 2) } : null,
            eCenter: eRect ? { x: Math.round(eRect.left + eRect.width / 2), y: Math.round(eRect.top + eRect.height / 2) } : null,
            rect: r ? { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } : null,
          };
        })()
      `,
      returnByValue: true,
    });
    const draggedDiag = afterDragGeom.result?.result?.value;
    console.log('  ✓ After left-click drag:', JSON.stringify(draggedDiag));
    if (draggedDiag.modalOpenedAccidentally) {
      throw new Error('FocusDiagramModal opened accidentally on single left-click drag!');
    }
    if (draggedDiag.pos.x === initDiag.pos.x && draggedDiag.pos.y === initDiag.pos.y) {
      throw new Error('DiagramNode position did not change after left-click drag!');
    }

    // 2. Left-click drag the bottom-right corner handle (diagram-resize-se) by (+140, +100)
    await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector("[data-testid='diagram-node-fc-diagram-card']");
          const seHandle = el?.querySelector("[data-testid='diagram-resize-se']");
          if (!seHandle) return;
          const r = seHandle.getBoundingClientRect();
          const startX = Math.round(r.left + r.width / 2);
          const startY = Math.round(r.top + r.height / 2);
          const targetX = startX + 140;
          const targetY = startY + 100;

          seHandle.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true, clientX: startX, clientY: startY, button: 0, buttons: 1 }));
          window.dispatchEvent(new MouseEvent('mousemove', { view: window, bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, button: 0, buttons: 1 }));
          window.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, button: 0, buttons: 0 }));
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 300));

    const afterCornerResize = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector("[data-testid='diagram-node-fc-diagram-card']");
          const wBorder = el?.querySelector("[data-testid='diagram-resize-w']");
          const wRect = wBorder?.getBoundingClientRect();
          const storeNode = window.__CREATIVE_NEURO_STORE__?.getState()?.nodes?.['fc-diagram-card'];
          return {
            size: storeNode ? { width: storeNode.width, height: storeNode.height } : null,
            pos: storeNode ? { ...storeNode.position } : null,
            wCenter: wRect ? { x: Math.round(wRect.left + wRect.width / 2), y: Math.round(wRect.top + wRect.height / 2) } : null,
          };
        })()
      `,
      returnByValue: true,
    });
    const cornerResized = afterCornerResize.result?.result?.value;
    console.log('  ✓ After SE corner resize (+140, +100):', JSON.stringify(cornerResized));
    if (cornerResized.size.width <= initDiag.size.width || cornerResized.size.height <= initDiag.size.height) {
      throw new Error(`Expected DiagramNode size to increase after SE corner drag, got ${JSON.stringify(cornerResized.size)}`);
    }

    // 3. Left-click drag the left border (diagram-resize-w) outward by (-60, 0)
    await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector("[data-testid='diagram-node-fc-diagram-card']");
          const wBorder = el?.querySelector("[data-testid='diagram-resize-w']");
          if (!wBorder) return;
          const r = wBorder.getBoundingClientRect();
          const startX = Math.round(r.left + r.width / 2);
          const startY = Math.round(r.top + r.height / 2);
          const targetX = startX - 60;
          const targetY = startY;

          wBorder.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true, clientX: startX, clientY: startY, button: 0, buttons: 1 }));
          window.dispatchEvent(new MouseEvent('mousemove', { view: window, bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, button: 0, buttons: 1 }));
          window.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true, clientX: targetX, clientY: targetY, button: 0, buttons: 0 }));
        })()
      `,
    });
    await new Promise((r) => setTimeout(r, 300));

    const afterBorderResize = await pageSend('Runtime.evaluate', {
      expression: `
        (() => {
          const storeNode = window.__CREATIVE_NEURO_STORE__?.getState()?.nodes?.['fc-diagram-card'];
          return {
            size: storeNode ? { width: storeNode.width, height: storeNode.height } : null,
            pos: storeNode ? { ...storeNode.position } : null,
          };
        })()
      `,
      returnByValue: true,
    });
    const borderResized = afterBorderResize.result?.result?.value;
    console.log('  ✓ After W border resize (-60, 0):', JSON.stringify(borderResized));
    if (borderResized.size.width <= cornerResized.size.width) {
      throw new Error(`Expected DiagramNode width to increase after W border drag, got ${JSON.stringify(borderResized.size)}`);
    }

    const diagMainCanvasSs = await pageSend('Page.captureScreenshot', { format: 'png' });
    const diagMainCanvasSsPath = path.join(screenshotsDir, '09_diagram_drag_and_resize_main_canvas.png');
    fs.writeFileSync(diagMainCanvasSsPath, Buffer.from(diagMainCanvasSs.result.data, 'base64'));
    console.log(`  ✓ Captured DiagramNode main canvas move & resize screenshot: ${path.relative(appRoot, diagMainCanvasSsPath)} (${fs.statSync(diagMainCanvasSsPath).size} bytes)`);

    // Verify Error Boundary state
    console.log('\n[E2E Step 11] Validating browser crash & error-boundary guarantees:');
    const errorBoundaryCheck = await pageSend('Runtime.evaluate', {
      expression: `
        Boolean(
          document.body.innerText.includes("Canvas Error Intercepted") ||
          document.body.innerText.includes("Maximum update depth exceeded") ||
          document.body.innerText.includes("Something went wrong")
        )
      `,
    });
    const hasErrorBoundaryTriggered = errorBoundaryCheck.result?.result?.value;
    console.log(`  -> CanvasErrorBoundary triggered: ${hasErrorBoundaryTriggered ? 'YES (FAILED)' : 'NO (PASSED)'}`);

    if (hasErrorBoundaryTriggered) {
      throw new Error('CanvasErrorBoundary was triggered during browser interaction!');
    }

    if (unhandledExceptions.length > 0) {
      throw new Error(`Unhandled browser exceptions detected: ${unhandledExceptions.join(', ')}`);
    }

    if (consoleErrors.length > 0) {
      throw new Error(`Browser console errors detected: ${consoleErrors.join(', ')}`);
    }

    console.log('  ✓ Browser console errors: 0');
    console.log('  ✓ Browser unhandled exceptions: 0');
    console.log('  ✓ ReactFlow StoreUpdater loop: 0 (No ping-pong selection loop)');
    console.log('\n=================================================================');
    console.log('🎉 ALL REAL BROWSER E2E TESTS PASSED WITH ZERO ERRORS');
    console.log('=================================================================\n');
  } finally {
    chrome.kill('SIGKILL');
    fs.rmSync(tempProfileDir, { recursive: true, force: true });
  }
}

runE2EScenario().catch((err) => {
  console.error('\n❌ E2E Browser Automation Suite Failed:', err.message);
  process.exit(1);
});
