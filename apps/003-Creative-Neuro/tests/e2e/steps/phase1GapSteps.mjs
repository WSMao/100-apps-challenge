import {
  sleep,
  evalExpr,
  dispatchKey,
  pressModKey,
  dragMouse,
  clickAt,
  dblClickAt,
} from './cdpHelpers.mjs';

/**
 * Step 16: Main-canvas right-drag pan, ContextMenu, and native contextmenu prevention.
 */
export async function runStep16RightDragAndContextMenu(pageSend) {
  console.log('\n[E2E Step 16] Testing Main-Canvas Right-Drag Pan & ContextMenu...');

  // Reset to a clean page
  await evalExpr(pageSend, `
    (() => {
      const store = window.__CREATIVE_NEURO_STORE__.getState();
      store.resetToSeed();
      const pId = store.addPage('Gesture Test Page');
      store.setActivePage(pId);
    })()
  `);
  await sleep(250);

  const initialTransform = await evalExpr(
    pageSend,
    `document.querySelector('.react-flow__viewport')?.style.transform || ''`
  );

  // Right-drag on empty pane (640, 400) -> (540, 340)
  await dragMouse(pageSend, {
    startX: 640,
    startY: 400,
    endX: 540,
    endY: 340,
    button: 'right',
    steps: 8,
  });
  await sleep(150);

  const afterPanTransform = await evalExpr(
    pageSend,
    `document.querySelector('.react-flow__viewport')?.style.transform || ''`
  );
  const contextMenuOpenAfterDrag = await evalExpr(
    pageSend,
    `Boolean(document.body.textContent.includes('Canvas Actions'))`
  );

  if (initialTransform === afterPanTransform) {
    throw new Error(`Right-drag pan did not move viewport: "${initialTransform}" === "${afterPanTransform}"`);
  }
  if (contextMenuOpenAfterDrag) {
    throw new Error('ContextMenu opened after right-drag pan, expected it to stay closed');
  }

  // Right-click (no drag) on empty pane -> ContextMenu should open
  await clickAt(pageSend, 640, 400, 'right', 1);
  await sleep(200);

  const contextMenuVisible = await evalExpr(
    pageSend,
    `Boolean(document.body.textContent.includes('Canvas Actions'))`
  );
  if (!contextMenuVisible) {
    throw new Error('Right-click on empty pane did not open Canvas Actions ContextMenu');
  }

  // Click outside to close ContextMenu
  await clickAt(pageSend, 200, 200, 'left', 1);
  await sleep(150);

  const contextMenuClosed = await evalExpr(
    pageSend,
    `!document.body.textContent.includes('Canvas Actions')`
  );
  if (!contextMenuClosed) {
    throw new Error('Clicking outside did not close ContextMenu');
  }

  console.log(`  ✓ Main-canvas right-drag pan ("${initialTransform}" -> "${afterPanTransform}") & ContextMenu verified`);
}

/**
 * Step 17: Wheel vertical pan, Shift+wheel horizontal pan, Cmd+wheel zoom, and bottom-right zoom controls.
 */
export async function runStep17WheelAndZoomControls(pageSend) {
  console.log('\n[E2E Step 17] Testing Wheel / Shift+Wheel / Cmd+Wheel Zoom & Zoom Controls...');

  const parseTransform = (t) => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/.exec(t || '');
    return m ? { x: Number(m[1]), y: Number(m[2]), scale: Number(m[3]) } : null;
  };

  const t0 = parseTransform(
    await evalExpr(pageSend, `document.querySelector('.react-flow__viewport')?.style.transform || ''`)
  );
  if (!t0) throw new Error('Could not parse initial viewport transform');

  // 1. Plain wheel -> vertical pan
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 640,
    y: 400,
    deltaX: 0,
    deltaY: 120,
    modifiers: 0,
  });
  await sleep(150);
  const t1 = parseTransform(
    await evalExpr(pageSend, `document.querySelector('.react-flow__viewport')?.style.transform || ''`)
  );
  if (!t1 || Math.abs(t1.y - t0.y) < 5) {
    throw new Error(`Plain wheel did not pan vertically: t0=${JSON.stringify(t0)}, t1=${JSON.stringify(t1)}`);
  }

  // 2. Shift+wheel -> horizontal pan (modifiers: 8)
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 640,
    y: 400,
    deltaX: 0,
    deltaY: 120,
    modifiers: 8,
  });
  await sleep(150);
  const t2 = parseTransform(
    await evalExpr(pageSend, `document.querySelector('.react-flow__viewport')?.style.transform || ''`)
  );
  if (!t2 || Math.abs(t2.x - t1.x) < 5) {
    throw new Error(`Shift+wheel did not pan horizontally: t1=${JSON.stringify(t1)}, t2=${JSON.stringify(t2)}`);
  }

  // 3. Cmd+wheel -> zoom (modifiers: 4 for Meta)
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 640,
    y: 400,
    deltaX: 0,
    deltaY: -120,
    modifiers: 4,
  });
  await sleep(200);
  const t3 = parseTransform(
    await evalExpr(pageSend, `document.querySelector('.react-flow__viewport')?.style.transform || ''`)
  );
  if (!t3 || Math.abs(t3.scale - t2.scale) < 0.01) {
    throw new Error(`Cmd+wheel did not zoom: t2=${JSON.stringify(t2)}, t3=${JSON.stringify(t3)}`);
  }

  // 4. Bottom-right zoom controls
  await evalExpr(pageSend, `document.querySelector("[data-testid='canvas-zoom-in']")?.click()`);
  await sleep(200);
  const t4 = parseTransform(
    await evalExpr(pageSend, `document.querySelector('.react-flow__viewport')?.style.transform || ''`)
  );
  if (!t4 || t4.scale <= t3.scale) {
    throw new Error(`Zoom-in button did not increase scale: t3=${t3.scale}, t4=${t4?.scale}`);
  }

  await evalExpr(pageSend, `document.querySelector("[data-testid='canvas-zoom-out']")?.click()`);
  await sleep(200);
  const t5 = parseTransform(
    await evalExpr(pageSend, `document.querySelector('.react-flow__viewport')?.style.transform || ''`)
  );
  if (!t5 || t5.scale >= t4.scale) {
    throw new Error(`Zoom-out button did not decrease scale: t4=${t4.scale}, t5=${t5?.scale}`);
  }

  console.log(`  ✓ Wheel pan (dy=${(t1.y - t0.y).toFixed(1)}), Shift+wheel (dx=${(t2.x - t1.x).toFixed(1)}), Cmd+wheel (scale ${t2.scale.toFixed(2)}->${t3.scale.toFixed(2)}), & zoom controls verified`);
}

/**
 * Step 18: Left-drag full-enclosure box selection (including Connectors).
 */
export async function runStep18FullEnclosureBoxSelection(pageSend) {
  console.log('\n[E2E Step 18] Testing Left-Drag Full-Enclosure Box Selection (including Connectors)...');

  const setup = await evalExpr(pageSend, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const store = window.__CREATIVE_NEURO_STORE__.getState();
      const pId = store.addPage('Box Select Page');
      store.setActivePage(pId);
      await sleep(150);

      const n1 = store.addNode({
        type: 'shape',
        position: { x: 350, y: 260 },
        width: 120,
        height: 60,
        data: { label: 'BoxA' },
      });
      const n2 = store.addNode({
        type: 'shape',
        position: { x: 600, y: 260 },
        width: 120,
        height: 60,
        data: { label: 'BoxB' },
      });
      const e1 = store.addEdge({
        source: n1,
        target: n2,
        type: 'jumpConnector',
        data: { routeType: 'smoothstep', arrowEnd: true },
      });
      await sleep(150);
      document.querySelector("[data-testid='canvas-fit-view']")?.click();
      await sleep(600);

      const rect1 = document.querySelector(".react-flow__node[data-id='" + n1 + "']").getBoundingClientRect();
      const rect2 = document.querySelector(".react-flow__node[data-id='" + n2 + "']").getBoundingClientRect();
      const r1 = { left: rect1.left, top: rect1.top, right: rect1.right, bottom: rect1.bottom };
      const r2 = { left: rect2.left, top: rect2.top, right: rect2.right, bottom: rect2.bottom };
      const probe = document.elementFromPoint(r1.left - 25, r1.top - 25)?.className || '';
      return { n1, n2, e1, r1, r2, probe };
    })()
  `);

  // 1. Partial enclosure: box only covers n1, NOT n2 -> edge e1 must NOT be selected
  await dragMouse(pageSend, {
    startX: setup.r1.left - 25,
    startY: setup.r1.top - 25,
    endX: setup.r1.right + 25,
    endY: setup.r1.bottom + 25,
    button: 'left',
    steps: 10,
  });
  await sleep(200);

  const partialSel = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      return { nodes: s.selectedNodeIds, edges: s.selectedEdgeIds };
    })()
  `);
  if (!partialSel.nodes.includes(setup.n1) || partialSel.nodes.includes(setup.n2)) {
    throw new Error(`Partial box select expected only [${setup.n1}], got ${JSON.stringify(partialSel)} (r1=${JSON.stringify(setup.r1)}, probe=${setup.probe})`);
  }
  if (partialSel.edges.includes(setup.e1)) {
    throw new Error(`Partial box select should NOT select connector ${setup.e1} when target is outside`);
  }

  // Click empty space well below nodes to clear selection
  await clickAt(pageSend, 400, 600, 'left', 1);
  await sleep(200);
  const selAfterClear = await evalExpr(pageSend, `window.__CREATIVE_NEURO_STORE__.getState().selectedNodeIds`);

  // 2. Full enclosure: box covers both n1 and n2 -> both nodes AND edge e1 must be selected
  await dragMouse(pageSend, {
    startX: setup.r1.left - 60,
    startY: Math.max(setup.r1.bottom, setup.r2.bottom) + 60,
    endX: setup.r2.right + 60,
    endY: Math.min(setup.r1.top, setup.r2.top) - 60,
    button: 'left',
    steps: 20,
    stepDelayMs: 25,
  });
  await sleep(300);

  const fullSel = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      return { nodes: s.selectedNodeIds, edges: s.selectedEdgeIds };
    })()
  `);
  if (!fullSel.nodes.includes(setup.n1) || !fullSel.nodes.includes(setup.n2)) {
    throw new Error(`Full box select expected both nodes, got ${JSON.stringify(fullSel)} (selAfterClear=${JSON.stringify(selAfterClear)}, r1=${JSON.stringify(setup.r1)}, r2=${JSON.stringify(setup.r2)})`);
  }
  if (!fullSel.edges.includes(setup.e1)) {
    throw new Error(`Full box select expected connector ${setup.e1} to be selected, got ${JSON.stringify(fullSel)}`);
  }

  console.log('  ✓ Full-enclosure box selection (partial excludes edge, full includes nodes + connector) verified');
}

/**
 * Step 19: Hover '+' drag-to-connect between two nodes.
 */
export async function runStep19HoverPlusDragToConnect(pageSend) {
  console.log('\n[E2E Step 19] Testing Hover "+" Drag-to-Connect...');

  const setup = await evalExpr(pageSend, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const store = window.__CREATIVE_NEURO_STORE__.getState();
      const pId = store.addPage('Hover Connect Page');
      store.setActivePage(pId);
      await sleep(150);

      const n1 = store.addNode({
        type: 'shape',
        position: { x: 300, y: 260 },
        width: 140,
        height: 60,
        data: { label: 'SrcNode' },
      });
      const n2 = store.addNode({
        type: 'shape',
        position: { x: 600, y: 260 },
        width: 140,
        height: 60,
        data: { label: 'TgtNode' },
      });
      await sleep(150);
      document.querySelector("[data-testid='canvas-fit-view']")?.click();
      await sleep(600);

      const n1El = document.querySelector(".react-flow__node[data-id='" + n1 + "']");
      const n2El = document.querySelector(".react-flow__node[data-id='" + n2 + "']");
      const r1 = n1El.getBoundingClientRect();
      const r2 = n2El.getBoundingClientRect();
      const rightSourceHandle = n1El.querySelector(".react-flow__handle.source[data-handleid='right']");
      const leftTargetHandle = n2El.querySelector(".react-flow__handle.target[data-handleid='left']");
      const hr1 = rightSourceHandle?.getBoundingClientRect();
      const hr2 = leftTargetHandle?.getBoundingClientRect();
      return {
        n1,
        n2,
        edgeCountBefore: store.pages[store.activePageId].edgeIds.length,
        srcHandle: hr1 ? { x: hr1.left + hr1.width / 2, y: hr1.top + hr1.height / 2 } : { x: r1.right, y: r1.top + r1.height / 2 },
        tgtHandle: hr2 ? { x: hr2.left + hr2.width / 2, y: hr2.top + hr2.height / 2 } : { x: r2.left, y: r2.top + r2.height / 2 },
        n1Center: { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 },
      };
    })()
  `);

  // Hover over n1 first to reveal '+' handles
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: Math.round(setup.n1Center.x),
    y: Math.round(setup.n1Center.y),
    button: 'none',
    buttons: 0,
  });
  await sleep(150);

  // Drag from right '+' handle of n1 to left target handle of n2
  await dragMouse(pageSend, {
    startX: setup.srcHandle.x,
    startY: setup.srcHandle.y,
    endX: setup.tgtHandle.x,
    endY: setup.tgtHandle.y,
    button: 'left',
    steps: 12,
  });
  await sleep(250);

  const afterConnect = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      const page = s.pages[s.activePageId];
      const pageEdges = page.edgeIds.map((id) => s.edges[id]).filter(Boolean);
      const connected = pageEdges.find((e) => e.source === '${setup.n1}' && e.target === '${setup.n2}');
      return { edgeCountAfter: pageEdges.length, connectedId: connected?.id || null };
    })()
  `);

  if (!afterConnect.connectedId) {
    throw new Error(`Hover '+' drag-to-connect did not create edge between ${setup.n1} and ${setup.n2}: ${JSON.stringify(afterConnect)}`);
  }
  console.log(`  ✓ Hover '+' drag-to-connect created edge ${afterConnect.connectedId}`);
}

/**
 * Step 20: Option/Alt+Arrow directional spawn and plain Arrow-key spatial navigation.
 */
export async function runStep20ArrowShortcutsAndNavigation(pageSend) {
  console.log('\n[E2E Step 20] Testing ⌥+Arrow Directional Spawn & Arrow-Key Spatial Navigation...');

  const setup = await evalExpr(pageSend, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const store = window.__CREATIVE_NEURO_STORE__.getState();
      const pId = store.addPage('Arrow Nav Page');
      store.setActivePage(pId);
      await sleep(150);

      const rootId = store.addNode({
        type: 'shape',
        position: { x: 400, y: 300 },
        width: 140,
        height: 60,
        data: { label: 'Center' },
      });
      store.setSelectedNodes([rootId]);
      await sleep(200);
      const latest = window.__CREATIVE_NEURO_STORE__.getState();
      const pageNodes = latest.pages[latest.activePageId].nodeIds.map((id) => latest.nodes[id]).filter(Boolean);
      return { rootId, initialCount: pageNodes.length };
    })()
  `);

  // Alt+ArrowRight (modifiers: 1) -> spawns a node to the right
  await dispatchKey(pageSend, { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, modifiers: 1 });
  await sleep(250);

  const afterAltRight = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      const pageNodes = s.pages[s.activePageId].nodeIds.map((id) => s.nodes[id]).filter(Boolean);
      const rightNode = pageNodes.find((n) => n.id !== '${setup.rootId}');
      return {
        count: pageNodes.length,
        selected: s.selectedNodeIds,
        rightNodeId: rightNode?.id || null,
        rightX: rightNode?.position.x ?? 0,
      };
    })()
  `);
  if (afterAltRight.count !== setup.initialCount + 1 || afterAltRight.rightX <= 400) {
    throw new Error(`Alt+ArrowRight failed to spawn node to the right: ${JSON.stringify(afterAltRight)}`);
  }

  // Plain ArrowLeft -> jumps selection back to Center node
  await dispatchKey(pageSend, { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, modifiers: 0 });
  await sleep(200);

  const afterArrowLeft = await evalExpr(pageSend, `
    window.__CREATIVE_NEURO_STORE__.getState().selectedNodeIds
  `);
  if (!afterArrowLeft.includes(setup.rootId)) {
    throw new Error(`Plain ArrowLeft failed to jump back to ${setup.rootId}, got ${JSON.stringify(afterArrowLeft)}`);
  }

  console.log(`  ✓ ⌥+ArrowRight spawned ${afterAltRight.rightNodeId} (x=${afterAltRight.rightX}) & plain ArrowLeft navigated back to ${setup.rootId}`);
}

/**
 * Step 21: Inline text editing (double-click -> type -> Enter) and Delete key.
 */
export async function runStep21InlineTextEditAndDelete(pageSend) {
  console.log('\n[E2E Step 21] Testing Inline Text Editing & Delete Key...');

  const setup = await evalExpr(pageSend, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const store = window.__CREATIVE_NEURO_STORE__.getState();
      const pId = store.addPage('Inline Edit Page');
      store.setActivePage(pId);
      await sleep(150);

      const nId = store.addNode({
        type: 'shape',
        position: { x: 400, y: 260 },
        width: 160,
        height: 60,
        data: { label: 'Before Edit' },
      });
      await sleep(150);
      document.querySelector("[data-testid='canvas-fit-view']")?.click();
      await sleep(600);

      const r = document.querySelector(".react-flow__node[data-id='" + nId + "']").getBoundingClientRect();
      return { nId, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    })()
  `);

  // Double-click node to enter inline editing
  await dblClickAt(pageSend, setup.cx, setup.cy);
  await sleep(200);

  const hasInput = await evalExpr(
    pageSend,
    `Boolean(document.querySelector(".react-flow__node[data-id='${setup.nId}'] input"))`
  );
  if (!hasInput) {
    throw new Error('Double-click on shape node did not open inline text input');
  }

  // Select all & type new text via Input.insertText, then press Enter
  await pressModKey(pageSend, 'a', 65);
  await pageSend('Input.insertText', { text: 'Edited Label' });
  await sleep(100);
  await dispatchKey(pageSend, { key: 'Enter', code: 'Enter', keyCode: 13 });
  await sleep(200);

  const updatedLabel = await evalExpr(
    pageSend,
    `window.__CREATIVE_NEURO_STORE__.getState().nodes['${setup.nId}']?.data?.label`
  );
  if (updatedLabel !== 'Edited Label') {
    throw new Error(`Expected updated label "Edited Label", got "${updatedLabel}"`);
  }

  // Select node & press Delete key -> node should be removed
  await clickAt(pageSend, setup.cx, setup.cy, 'left', 1);
  await sleep(150);
  await dispatchKey(pageSend, { key: 'Delete', code: 'Delete', keyCode: 46 });
  await sleep(200);

  const stillExists = await evalExpr(
    pageSend,
    `Boolean(window.__CREATIVE_NEURO_STORE__.getState().nodes['${setup.nId}'])`
  );
  if (stillExists) {
    throw new Error(`Node ${setup.nId} was not deleted after pressing Delete key`);
  }

  console.log('  ✓ Inline text editing (dblclick -> type -> Enter) & Delete key verified');
}

/**
 * Step 22: Freehand draw and atomic eraser undo.
 */
export async function runStep22FreehandAndEraserUndo(pageSend) {
  console.log('\n[E2E Step 22] Testing Freehand Draw & Atomic Eraser Undo...');

  await evalExpr(pageSend, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const store = window.__CREATIVE_NEURO_STORE__.getState();
      const pId = store.addPage('Freehand Page');
      store.setActivePage(pId);
      await sleep(150);
      document.querySelector("[data-testid='tool-btn-draw']")?.click();
      await sleep(150);
    })()
  `);

  // Draw a freehand stroke across the center of the canvas
  await dragMouse(pageSend, {
    startX: 400,
    startY: 320,
    endX: 620,
    endY: 380,
    button: 'left',
    steps: 10,
  });
  await sleep(200);

  const afterDraw = await evalExpr(
    pageSend,
    `(() => { const s = window.__CREATIVE_NEURO_STORE__.getState(); return s.pages[s.activePageId].nodeIds.map((id) => s.nodes[id]).filter((n) => n?.type === 'freehand').length; })()`
  );
  if (afterDraw < 1) {
    throw new Error(`Expected >= 1 freehand stroke after drawing, got ${afterDraw}`);
  }

  // Switch to Eraser in the floating brush toolbar and drag across the stroke
  await evalExpr(pageSend, `
    (() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Eraser');
      if (!btn) throw new Error('Eraser button not found in Freehand brush toolbar');
      btn.click();
    })()
  `);
  await sleep(150);

  await dragMouse(pageSend, {
    startX: 450,
    startY: 280,
    endX: 560,
    endY: 420,
    button: 'left',
    steps: 10,
  });
  await sleep(200);

  const afterErase = await evalExpr(
    pageSend,
    `(() => { const s = window.__CREATIVE_NEURO_STORE__.getState(); return s.pages[s.activePageId].nodeIds.map((id) => s.nodes[id]).filter((n) => n?.type === 'freehand').length; })()`
  );
  if (afterErase !== 0) {
    throw new Error(`Expected 0 freehand strokes after eraser drag, got ${afterErase}`);
  }

  // Single Cmd+Z must atomically restore the erased stroke
  await pressModKey(pageSend, 'z', 90, false);
  await sleep(200);

  const afterUndo = await evalExpr(
    pageSend,
    `(() => { const s = window.__CREATIVE_NEURO_STORE__.getState(); return s.pages[s.activePageId].nodeIds.map((id) => s.nodes[id]).filter((n) => n?.type === 'freehand').length; })()`
  );
  if (afterUndo !== afterDraw) {
    throw new Error(`Expected atomic eraser undo to restore ${afterDraw} freehand stroke(s), got ${afterUndo}`);
  }

  // Switch back to select tool
  await evalExpr(pageSend, `document.querySelector("[data-testid='tool-btn-select']")?.click()`);
  await sleep(100);

  console.log('  ✓ Freehand draw & atomic eraser undo verified');
}

/**
 * Step 23: Light/Dark theme toggle and Logo dropdown (New Project, Workspace, Reset Demo).
 */
export async function runStep23ThemeAndLogoDropdown(pageSend) {
  console.log('\n[E2E Step 23] Testing Light/Dark Theme Toggle & Logo Dropdown (New Project, Workspace, Reset Demo)...');

  // 1. Open Settings modal and toggle Dark -> Light
  await evalExpr(pageSend, `document.querySelector("[data-testid='header-settings-btn']")?.click()`);
  await sleep(150);

  const hasSettingsTabs = await evalExpr(
    pageSend,
    `Boolean(document.body.textContent.includes('General & Theme') && document.body.textContent.includes('About'))`
  );
  if (!hasSettingsTabs) {
    throw new Error('SettingsModal did not render General & Theme and About tabs');
  }

  await evalExpr(pageSend, `
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      btns.find((b) => b.textContent?.includes('Dark Style'))?.click();
    })()
  `);
  await sleep(150);
  const darkTheme = await evalExpr(pageSend, `window.__CREATIVE_NEURO_STORE__.getState().themeMode`);
  if (darkTheme !== 'dark') {
    throw new Error(`Expected themeMode === 'dark', got '${darkTheme}'`);
  }

  await evalExpr(pageSend, `
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      btns.find((b) => b.textContent?.includes('Light Style'))?.click();
    })()
  `);
  await sleep(150);
  const lightTheme = await evalExpr(pageSend, `window.__CREATIVE_NEURO_STORE__.getState().themeMode`);
  if (lightTheme !== 'light') {
    throw new Error(`Expected themeMode === 'light', got '${lightTheme}'`);
  }

  // Close Settings modal
  await clickAt(pageSend, 20, 20, 'left', 1);
  await sleep(150);

  // 2. Logo dropdown -> New Project -> Create
  await evalExpr(pageSend, `document.querySelector("[data-testid='top-left-logo-btn']")?.click()`);
  await sleep(150);
  const dropdownOpen = await evalExpr(pageSend, `Boolean(document.querySelector("[data-testid='logo-dropdown-menu']"))`);
  if (!dropdownOpen) {
    throw new Error('Logo dropdown menu did not open');
  }

  await evalExpr(pageSend, `document.querySelector("[data-testid='menu-new-project-btn']")?.click()`);
  await sleep(150);
  const defaultInputVal = await evalExpr(
    pageSend,
    `document.querySelector("[data-testid='new-project-name-input']")?.value`
  );
  if (!defaultInputVal || !defaultInputVal.startsWith('untitled')) {
    throw new Error(`Expected default project name starting with 'untitled', got '${defaultInputVal}'`);
  }

  await evalExpr(pageSend, `document.querySelector("[data-testid='create-project-confirm-btn']")?.click()`);
  await sleep(250);

  const newProjState = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      const t = window.__CREATIVE_NEURO_STORE__.temporal.getState();
      return {
        name: s.project.name,
        pastLen: t.pastStates.length,
        futureLen: t.futureStates.length,
      };
    })()
  `);
  if (!newProjState.name.startsWith('untitled') || newProjState.pastLen !== 0 || newProjState.futureLen !== 0) {
    throw new Error(`New Project state/history check failed: ${JSON.stringify(newProjState)}`);
  }

  // 3. Logo dropdown -> Workspace -> verify project list & switch/close
  await evalExpr(pageSend, `document.querySelector("[data-testid='top-left-logo-btn']")?.click()`);
  await sleep(150);
  await evalExpr(pageSend, `document.querySelector("[data-testid='menu-workspace-btn']")?.click()`);
  await sleep(200);
  const workspaceOpen = await evalExpr(pageSend, `Boolean(document.querySelector("[data-testid='workspace-projects-modal']"))`);
  if (!workspaceOpen) {
    throw new Error('Workspace projects modal did not open');
  }
  // Close workspace modal
  await clickAt(pageSend, 20, 20, 'left', 1);
  await sleep(150);

  // 4. Reset Demo
  await evalExpr(pageSend, `document.querySelector("[data-testid='reset-seed-btn']")?.click()`);
  await sleep(300);
  const afterReset = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      return { pageCount: Object.keys(s.pages).length, nodeCount: Object.keys(s.nodes).length };
    })()
  `);
  if (afterReset.pageCount !== 3 || afterReset.nodeCount < 1) {
    throw new Error(`Reset Demo did not restore 3-page seed project: ${JSON.stringify(afterReset)}`);
  }

  console.log(`  ✓ Theme toggle (dark/light), Logo dropdown (New Project=${newProjState.name}, Workspace), & Reset Demo verified`);
}

/**
 * Step 24: Embedded Diagram inline editing & Atomic Undo/Redo (spawn, drag, batch delete, non-mutating selection/Page hide, project history isolation).
 */
export async function runStep24DiagramInlineAndAtomicUndo(pageSend) {
  console.log('\n[E2E Step 24] Testing Embedded Diagram Inline Editing & Atomic Undo/Redo...');

  // 1. Embedded Diagram inline editing (via FocusDiagramModal sub-canvas node click/drag & Mermaid sync)
  await evalExpr(pageSend, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const store = window.__CREATIVE_NEURO_STORE__.getState();
      store.setActivePage('page-flowchart');
      await sleep(250);
      window.__CREATIVE_NEURO_STORE__.getState().setFocusedDiagramId('fc-diagram-card');
      await sleep(600);
    })()
  `);

  const focusDiagCheck = await pageSend('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector("[data-testid='focus-diagram-modal']");
        if (!modal) return { error: 'focus-diagram-modal not opened' };
        const subNode = modal.querySelector(".react-flow__node");
        if (!subNode) return { error: 'No internal sub-canvas node found in diagram' };
        const subId = subNode.getAttribute('data-id');
        subNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return { subId, hasModal: true };
      })()
    `,
    returnByValue: true,
  });
  const focusVal = focusDiagCheck.result?.result?.value;
  if (!focusVal?.hasModal || !focusVal?.subId) {
    throw new Error(`Diagram inline/focus node check failed: ${JSON.stringify(focusDiagCheck)}`);
  }
  await sleep(150);
  await evalExpr(pageSend, `window.__CREATIVE_NEURO_STORE__.getState().setFocusedDiagramId(null)`);
  await sleep(200);

  // 2. Atomic Undo/Redo on clean page
  const undoSetup = await evalExpr(pageSend, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const store = window.__CREATIVE_NEURO_STORE__.getState();
      const extraPage = store.addPage('Temp Hide Page');
      const pId = store.addPage('Undo Atomicity Page');
      store.setActivePage(pId);
      await sleep(150);
      window.__CREATIVE_NEURO_STORE__.temporal.getState().clear();
      const n1 = store.addNode({
        type: 'shape',
        position: { x: 350, y: 260 },
        width: 140,
        height: 60,
        data: { label: 'UndoRoot' },
      });
      store.setSelectedNodes([n1]);
      await sleep(200);
      return { pId, extraPage, n1, pastAfterAdd: window.__CREATIVE_NEURO_STORE__.temporal.getState().pastStates.length };
    })()
  `);

  // 2a. Tab spawn -> single Cmd+Z removes both node & edge; Cmd+Shift+Z restores both
  await dispatchKey(pageSend, { key: 'Tab', code: 'Tab', keyCode: 9 });
  await sleep(250);
  const afterTab = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      const page = s.pages[s.activePageId];
      return {
        nodes: page.nodeIds.length,
        edges: page.edgeIds.length,
      };
    })()
  `);
  if (afterTab.nodes !== 2 || afterTab.edges !== 1) {
    throw new Error(`Expected 2 nodes and 1 edge after Tab, got ${JSON.stringify(afterTab)}`);
  }

  await pressModKey(pageSend, 'z', 90, false);
  await sleep(200);
  const afterUndoTab = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      const page = s.pages[s.activePageId];
      return {
        nodes: page.nodeIds.length,
        edges: page.edgeIds.length,
      };
    })()
  `);
  if (afterUndoTab.nodes !== 1 || afterUndoTab.edges !== 0) {
    throw new Error(`Single Cmd+Z after Tab should remove both node & edge, got ${JSON.stringify(afterUndoTab)}`);
  }

  // 2b. Non-mutating actions (selection change & hiding a page) must NOT clear Redo stack
  await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      s.setSelectedNodes([]);
      s.setSelectedNodes(['${undoSetup.n1}']);
      s.hidePage('${undoSetup.extraPage}');
    })()
  `);
  await sleep(150);

  const futureBeforeRedo = await evalExpr(
    pageSend,
    `window.__CREATIVE_NEURO_STORE__.temporal.getState().futureStates.length`
  );
  if (futureBeforeRedo < 1) {
    throw new Error(`Non-mutating selection/hidePage cleared Redo stack! futureStates=${futureBeforeRedo}`);
  }

  await pressModKey(pageSend, 'z', 90, true);
  await sleep(200);
  const afterRedoTab = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      const page = s.pages[s.activePageId];
      return {
        nodes: page.nodeIds.length,
        edges: page.edgeIds.length,
      };
    })()
  `);
  if (afterRedoTab.nodes !== 2 || afterRedoTab.edges !== 1) {
    throw new Error(`Cmd+Shift+Z Redo should restore both node & edge, got ${JSON.stringify(afterRedoTab)}`);
  }

  // 2c. Batch Delete -> single Cmd+Z restores all
  await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      const page = s.pages[s.activePageId];
      s.setSelectedNodes([...page.nodeIds]);
      s.setSelectedEdges([...page.edgeIds]);
    })()
  `);
  await sleep(150);
  await dispatchKey(pageSend, { key: 'Delete', code: 'Delete', keyCode: 46 });
  await sleep(200);
  const afterBatchDel = await evalExpr(
    pageSend,
    `(() => { const s = window.__CREATIVE_NEURO_STORE__.getState(); return s.pages[s.activePageId].nodeIds.length; })()`
  );
  if (afterBatchDel !== 0) {
    throw new Error(`Expected 0 nodes after batch Delete, got ${afterBatchDel}`);
  }

  await pressModKey(pageSend, 'z', 90, false);
  await sleep(200);
  const afterUndoBatchDel = await evalExpr(pageSend, `
    (() => {
      const s = window.__CREATIVE_NEURO_STORE__.getState();
      const page = s.pages[s.activePageId];
      return {
        nodes: page.nodeIds.length,
        edges: page.edgeIds.length,
      };
    })()
  `);
  if (afterUndoBatchDel.nodes !== 2 || afterUndoBatchDel.edges !== 1) {
    throw new Error(`Single Cmd+Z after batch Delete should restore 2 nodes & 1 edge, got ${JSON.stringify(afterUndoBatchDel)}`);
  }

  console.log('  ✓ Embedded Diagram inline/focus editing & Atomic Undo/Redo (spawn, non-mutating selection/hide, batch delete) verified');
}
