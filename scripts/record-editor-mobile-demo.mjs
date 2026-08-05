// Record the mobile in-page editor demo GIF used by docs/guide/editor.md
// (assets/notabene-editor-mobile-demo.gif).
//
// Self-contained and deterministic — mirrors scripts/record-editor-demo.mjs (same
// fixture + seeded comment) driven through the TOUCH product instead:
//   1. regenerate a clean .demo fixture WITH --git, seed the open comment,
//   2. spawn `notabene dev` against it on its own port,
//   3. drive Chrome in iPhone emulation (Playwright): tap ARMS the block → the chip
//      opens it → type → Done reveals the paperwork above the keyboard bar and becomes
//      Confirm (the two-step save) → tick the closure, note → Confirm → the save toast,
//   4. convert the video to an optimised GIF with ffmpeg.
//
// Requirements: Google Chrome (`channel: "chrome"`), ffmpeg on PATH, playwright-core.
// Usage:  node scripts/record-editor-mobile-demo.mjs   (or: npm run gen:editor-mobile-gif)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(REPO, ".demo");
const BIN = path.join(REPO, "packages/renderer/bin/notabene.mjs");
const OUT_GIF = path.join(REPO, "assets/notabene-editor-mobile-demo.gif");
const PORT = 3849;

const DEVICE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

const PHRASE = "Renderer node invoice payload replica cursor system pipeline contract service session.";
const TYPED = " The cache keeps replicas warm across regions.";
const NOTE = "Expanded the flow per review.";

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

// Same seed as the desktop editor demo: one OPEN text comment on the demo paragraph,
// and no other open comment on the page.
function seedComment() {
  const store = path.join(DEMO, "docs/.notabene");
  const pageDir = path.join(store, "docs/index");
  for (const f of fs.readdirSync(pageDir)) {
    const file = path.join(pageDir, f);
    const c = JSON.parse(fs.readFileSync(file, "utf8"));
    if (c.status === "open") fs.rmSync(file);
  }
  const text = fs
    .readFileSync(path.join(DEMO, "docs/index.md"), "utf8")
    .split("\n")
    .find((l) => l.includes(PHRASE));
  const quote = "replica cursor system pipeline";
  const idx = text.indexOf(quote);
  fs.writeFileSync(
    path.join(pageDir, "c_editor.json"),
    `${JSON.stringify(
      {
        id: "c_editor",
        space: "docs",
        page: "docs/index",
        scope: "selection",
        anchor: {
          quote,
          prefix: text.slice(Math.max(0, idx - 30), idx),
          suffix: text.slice(idx + quote.length, idx + quote.length + 30),
          section: "Overview",
        },
        thread: [
          {
            author: "Sam Rivera",
            body: "Can we say what actually keeps these replicas in sync?",
            ts: "2026-01-07T09:00:00.000Z",
          },
        ],
        status: "open",
        hold: false,
        resolution: null,
        createdAt: "2026-01-07T09:00:00.000Z",
        updatedAt: "2026-01-07T09:00:00.000Z",
      },
      null,
      2,
    )}\n`,
  );
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [BIN, "dev", "--root", DEMO, "--port", String(PORT)], {
      cwd: REPO,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NOTABENE_AUTHOR: "notabene demo", NOTABENE_AUTHOR_EMAIL: "demo@notabene.dev" },
    });
    const to = setTimeout(() => reject(new Error("dev server did not start within 60s")), 60_000);
    const onData = (buf) => {
      const m = String(buf).match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
      if (m) {
        clearTimeout(to);
        child.stdout.off("data", onData);
        resolve({ child, base: `http://127.0.0.1:${m[1]}` });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", () => {});
    child.on("error", reject);
  });
}

async function waitReady(base) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/docs/`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${base} never became ready`);
}

async function record(base, videoDir) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // Warm-up OUTSIDE the recording (desktop context — hover is the cheapest way in):
  // the first editor mount triggers Vite's on-demand work, which recorded reads as a hang.
  {
    const warm = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    const p = await warm.newPage();
    await p.goto(`${base}/docs`, { waitUntil: "networkidle" });
    await p.locator("#doc-content p").first().hover();
    await p.locator(".nb-edit-handle").first().click();
    await p.waitForSelector(".ProseMirror.nb-wysiwyg-area", { timeout: 20_000 });
    await p.keyboard.press("Escape");
    await warm.close();
  }

  const context = await browser.newContext({
    ...DEVICE,
    recordVideo: { dir: videoDir, size: DEVICE.viewport },
  });
  const page = await context.newPage();
  const wait = (ms) => page.waitForTimeout(ms);
  context.setDefaultTimeout(10_000);
  const hideToolbar = () => page.addStyleTag({ content: "astro-dev-toolbar{display:none!important}" });

  // beat 1 — land on the page; the seeded comment is highlighted in the paragraph
  await page.goto(`${base}/docs`, { waitUntil: "networkidle" });
  await hideToolbar();
  await wait(1400);

  // beat 2 — a tap ARMS the block: outline + the two chips under the topbar
  const para = page.locator("#doc-content p", { hasText: PHRASE }).first();
  await para.scrollIntoViewIfNeeded();
  await para.tap();
  await page.waitForSelector(".nb-edit-chipbar:not([hidden])");
  await wait(900);

  // beat 3 — the chip opens the block; the keyboard bar docks at the bottom
  await page.locator(".nb-edit-chip").first().tap();
  await page.waitForSelector(".ProseMirror.nb-wysiwyg-area");
  await page.waitForSelector(".nb-edit-dockbar:not([hidden])");
  await wait(900);

  // beat 4 — caret at the end (tap just right of the last character), then type
  const end = await page.evaluate(() => {
    const pm = document.querySelector(".ProseMirror.nb-wysiwyg-area");
    const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
    let last = null;
    let n;
    while ((n = walker.nextNode())) if (n.textContent.trim()) last = n;
    const r = document.createRange();
    r.setStart(last, last.textContent.length - 1);
    r.setEnd(last, last.textContent.length);
    const b = r.getBoundingClientRect();
    return { x: b.right + 1, y: b.y + b.height / 2 };
  });
  await page.touchscreen.tap(end.x, end.y);
  await wait(300);
  await page.keyboard.type(TYPED, { delay: 34 });
  await wait(600);

  // beat 5 — Done REVEALS the paperwork above the bar and becomes Confirm (the two-step)
  await page.locator('.nb-edit-dockbar [data-act="done"]').tap();
  await page.waitForSelector(".nb-edit-note");
  await wait(900);

  // beat 6 — tick the comment this save closes, then the journal note
  await page.locator(".nb-edit-close input").first().tap();
  await wait(400);
  await page.locator(".nb-edit-note").tap();
  await page.keyboard.type(NOTE, { delay: 36 });
  await wait(600);

  // beat 7 — Confirm → the save writes, closes the comment, journals the change
  await page.locator('.nb-edit-dockbar [data-act="done"]').tap();
  try {
    await page.waitForSelector(".nb-toast--save", { timeout: 10_000 });
  } catch (e) {
    const msg = await page
      .evaluate(() => document.querySelector(".nb-edit-msg")?.textContent ?? "(no card message)")
      .catch(() => "(page gone)");
    await page.screenshot({ path: path.join(os.tmpdir(), "nb-editor-mobile-demo-fail.png") }).catch(() => {});
    console.error(`save toast never appeared — card says: ${msg}`);
    throw e;
  }
  await hideToolbar();
  await wait(2200);

  await context.close();
  const file = fs.readdirSync(videoDir).find((f) => f.endsWith(".webm"));
  await browser.close();
  if (!file) throw new Error("no video was recorded");
  return path.join(videoDir, file);
}

function toGif(webm) {
  const vf =
    "fps=12,scale=340:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4";
  return run("ffmpeg", ["-y", "-i", webm, "-vf", vf, OUT_GIF], { stdio: "ignore" });
}

async function main() {
  fs.rmSync(DEMO, { recursive: true, force: true });
  await run("node", [path.join(REPO, "scripts/gen-fixture.mjs"), "--git"]);
  seedComment();
  const { child, base } = await startServer();
  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), "notabene-rec-"));
  try {
    await waitReady(base);
    console.log(`recording against ${base} …`);
    const webm = await record(base, videoDir);
    await toGif(webm);
    console.log(`wrote ${path.relative(REPO, OUT_GIF)}`);
  } finally {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
    fs.rmSync(videoDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
