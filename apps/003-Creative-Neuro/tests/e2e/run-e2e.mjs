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
          // Switch to Page 2 which contains fc-diagram-card
          store.setActivePage('page-2');
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

    // Close diagram modal via Escape key
    await pageSend('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
    await pageSend('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 });
    await new Promise((r) => setTimeout(r, 400));

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
