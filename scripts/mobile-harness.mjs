// Mobile test harness — drives a real Chrome over the DevTools Protocol with device
// emulation, so the touch/compact code paths can be exercised for real instead of by
// resizing a window (which does not flip `pointer: coarse`, and therefore never runs the
// branches that matter).
//
// No dependency: Chrome is launched directly and CDP is spoken over Node's built-in
// WebSocket. Puppeteer would do the same but is only an OPTIONAL peer dep here (for
// `notabene pdf`), and this needs to run whether or not it is installed.
//
// KNOWN LIMIT: CDP emulates touch INPUT and the viewport, not the platform's native
// long-press-to-select gesture — headless Chrome will not produce a text selection from a
// long press. Tests that need one set the selection programmatically and dispatch the
// events the platform would (notably `pointercancel`, which is what Android sends when it
// takes the gesture over).
//
// Usage:
//   import { withMobilePage } from "./scripts/mobile-harness.mjs";
//   await withMobilePage("http://127.0.0.1:3009/guide/editor", async ({ evaluate, tap }) => { … });
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;

export async function withMobilePage(url, fn, device = { width: 390, height: 844, dsf: 3 }) {
  const profile = mkdtempSync(join(tmpdir(), "nb-cdp-"));
  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
    ],
    { stdio: "ignore" },
  );

  const targets = await poll(`http://127.0.0.1:${PORT}/json/list`);
  const page = targets.find((t) => t.type === "page") ?? (await get(`http://127.0.0.1:${PORT}/json/new?about:blank`));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  // LE point : émuler un vrai mobile — viewport, densité, ET tactile.
  await send("Emulation.setDeviceMetricsOverride", {
    width: device.width,
    height: device.height,
    deviceScaleFactor: device.dsf,
    mobile: true,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36",
  });

  const evaluate = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };
  const tap = async (x, y) => {
    const pt = [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
    await new Promise((r) => setTimeout(r, 60));
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const longPress = async (x, y, ms = 700) => {
    const pt = [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
    await new Promise((r) => setTimeout(r, ms));
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };

  await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 2500));

  try {
    return await fn({ evaluate, tap, longPress, send });
  } finally {
    ws.close();
    chrome.kill();
  }
}

async function get(u) {
  return (await fetch(u)).json();
}
async function poll(u) {
  for (let i = 0; i < 60; i++) {
    try {
      return await get(u);
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("Chrome n'a pas démarré");
}
