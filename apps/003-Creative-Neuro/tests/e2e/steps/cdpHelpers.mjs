/**
 * Shared CDP input and DOM assertion helpers for Creative-Neuro E2E suite.
 */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function evalExpr(pageSend, expression) {
  const res = await pageSend('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    const msg =
      res.exceptionDetails.exception?.description ||
      res.exceptionDetails.text ||
      JSON.stringify(res.exceptionDetails);
    throw new Error(`CDP Runtime.evaluate exception: ${msg}`);
  }
  return res.result?.result?.value;
}

export async function dispatchKey(pageSend, { key, code, keyCode, modifiers = 0, text = undefined }) {
  await pageSend('Input.dispatchKeyEvent', {
    type: text ? 'keyDown' : 'rawKeyDown',
    key,
    code: code || key,
    windowsVirtualKeyCode: keyCode,
    modifiers,
    ...(text ? { text } : {}),
  });
  await pageSend('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code: code || key,
    windowsVirtualKeyCode: keyCode,
    modifiers,
  });
}

export async function pressModKey(pageSend, key, keyCode, shift = false) {
  // On macOS Chrome CDP, Meta = 4; Ctrl = 2. ShortcutsHandler checks e.metaKey || e.ctrlKey.
  const modifiers = 4 | (shift ? 8 : 0);
  await dispatchKey(pageSend, {
    key,
    code: `Key${key.toUpperCase()}`,
    keyCode,
    modifiers,
  });
}

export async function dragMouse(pageSend, { startX, startY, endX, endY, button = 'left', steps = 10, stepDelayMs = 20 }) {
  const buttons = button === 'right' ? 2 : 1;
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: Math.round(startX),
    y: Math.round(startY),
    button: 'none',
    buttons: 0,
  });
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: Math.round(startX),
    y: Math.round(startY),
    button,
    buttons,
    clickCount: 1,
  });
  await sleep(30);
  for (let i = 1; i <= steps; i++) {
    const mx = Math.round(startX + ((endX - startX) * i) / steps);
    const my = Math.round(startY + ((endY - startY) * i) / steps);
    await pageSend('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: mx,
      y: my,
      button,
      buttons,
    });
    await sleep(stepDelayMs);
  }
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: Math.round(endX),
    y: Math.round(endY),
    button,
    buttons: 0,
  });
  await sleep(100);
}

export async function clickAt(pageSend, x, y, button = 'left', clickCount = 1) {
  const buttons = button === 'right' ? 2 : 1;
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: Math.round(x),
    y: Math.round(y),
    button: 'none',
    buttons: 0,
  });
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: Math.round(x),
    y: Math.round(y),
    button,
    buttons,
    clickCount,
  });
  await sleep(30);
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: Math.round(x),
    y: Math.round(y),
    button,
    buttons: 0,
    clickCount,
  });
  await sleep(80);
}

export async function dblClickAt(pageSend, x, y) {
  await clickAt(pageSend, x, y, 'left', 1);
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: Math.round(x),
    y: Math.round(y),
    button: 'left',
    buttons: 1,
    clickCount: 2,
  });
  await pageSend('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: Math.round(x),
    y: Math.round(y),
    button: 'left',
    buttons: 0,
    clickCount: 2,
  });
  await sleep(120);
}
