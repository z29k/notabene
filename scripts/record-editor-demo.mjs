// Record the in-page editor demo GIF used by docs/guide/editor.md
// (assets/notabene-editor-demo.gif).
//
// Self-contained and deterministic — mirrors scripts/record-hero-demo.mjs:
//   1. regenerate a clean .demo fixture WITH --git (the editor refuses untracked files),
//   2. seed ONE open text comment anchored on the paragraph the demo edits (and drop the
//      fixture's block-scoped comments so the session card shows exactly that one),
//   3. spawn `notabene dev` against it on its own port,
//   4. drive desktop Chrome (Playwright): hover → ✎ opens the block in place → append a
//      sentence → bold a word from the selection toolbar → tick "closes" + journal note
//      in the card → Done → the save toast over the re-rendered page,
//   5. convert the video to an optimised GIF with ffmpeg.
//
// Requirements: Google Chrome (`channel: "chrome"`), ffmpeg on PATH, playwright-core.
// Usage:  node scripts/record-editor-demo.mjs   (or: npm run gen:editor-gif)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(REPO, ".demo");
const BIN = path.join(REPO, "packages/renderer/bin/notabene.mjs");
const OUT_GIF = path.join(REPO, "assets/notabene-editor-demo.gif");
const PORT = 3839;
const VIEWPORT = { width: 1280, height: 820 };

// The paragraph the demo edits is the one holding this phrase (docs/index, "Overview"),
// the sentence typed into it, and the word the selection toolbar bolds.
const PHRASE = "Renderer node invoice payload replica cursor system pipeline contract service session.";
const TYPED = " The cache keeps replicas warm across regions.";
const BOLD_WORD = "warm";
const NOTE = "Expanded the flow per review.";

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

// Seed the store: one OPEN text comment on the demo paragraph (quote + context computed
// from the page source, so the anchor really resolves), and no other open comment — the
// fixture's block-scoped ones would crowd the card's "closes" list.
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

const CURSOR_JS = `
  (() => {
    if (document.getElementById('nb-cursor')) return;
    const c = document.createElement('div');
    c.id = 'nb-cursor';
    c.style.cssText = 'position:fixed;left:50%;top:60%;z-index:2147483647;pointer-events:none;margin:-2px 0 0 -2px;transition:left .5s cubic-bezier(.4,0,.2,1),top .5s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))';
    c.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"><path d="M4 2 L4 18 L8.4 13.8 L11.4 20.2 L14.1 19 L11.2 12.8 L17 12.6 Z"/></svg>';
    document.body.appendChild(c);
  })()
`;

/** Viewport rect of `needle` inside the open editor's text (for dblclick / caret). */
const wordRect = (page, needle) =>
  page.evaluate((word) => {
    const pm = document.querySelector(".ProseMirror.nb-wysiwyg-area");
    const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.textContent.indexOf(word);
      if (idx !== -1) {
        const r = document.createRange();
        r.setStart(node, idx);
        r.setEnd(node, idx + word.length);
        const b = r.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }
    }
    throw new Error(`word "${word}" not found in the open editor`);
  }, needle);

async function record(base, videoDir) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // Warm-up OUTSIDE the recording: first editor mount triggers Vite's on-demand work;
  // recorded, it reads as a hang. A throwaway context pays that cost.
  {
    const warm = await browser.newContext({ viewport: VIEWPORT });
    const p = await warm.newPage();
    await p.goto(`${base}/docs`, { waitUntil: "networkidle" });
    await p.locator("#doc-content p").first().hover();
    await p.locator(".nb-edit-handle").first().click();
    await p.waitForSelector(".ProseMirror.nb-wysiwyg-area", { timeout: 20_000 });
    await p.keyboard.press("Escape");
    await warm.close();
  }

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  const page = await context.newPage();
  const wait = (ms) => page.waitForTimeout(ms);
  context.setDefaultTimeout(10_000);
  const addChrome = async () => {
    await page.addStyleTag({ content: "astro-dev-toolbar{display:none!important}" });
    await page.evaluate(CURSOR_JS);
  };
  const moveCursor = async (sel) => {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) return;
    await page.evaluate(
      ({ x, y }) => {
        const c = document.getElementById("nb-cursor");
        if (c) {
          c.style.left = `${x}px`;
          c.style.top = `${y}px`;
        }
      },
      { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) },
    );
    await wait(600);
  };

  // beat 1 — land on the page; the seeded comment is highlighted in the paragraph
  await page.goto(`${base}/docs`, { waitUntil: "networkidle" });
  await addChrome();
  await wait(1400);

  // beat 2 — hover the paragraph → the gutter handles appear; ✎ opens the block in place
  const para = page.locator("#doc-content p", { hasText: PHRASE }).first();
  await para.scrollIntoViewIfNeeded();
  await para.hover();
  await page.waitForSelector(".nb-edit-handle:not([hidden])");
  await moveCursor(".nb-edit-handle");
  await page.locator(".nb-edit-handle").first().click();
  await page.waitForSelector(".ProseMirror.nb-wysiwyg-area");
  await wait(900);

  // beat 3 — append a sentence at the end of the block. Click just right of the last
  // character (select-all + ArrowRight was tried: ProseMirror's AllSelection does not
  // collapse on arrow keys here, and the typing REPLACED the whole block).
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
  await page.mouse.click(end.x, end.y);
  await page.keyboard.type(TYPED, { delay: 38 });
  await wait(600);

  // beat 4 — select a word → the floating toolbar appears → bold it
  const w = await wordRect(page, BOLD_WORD);
  await page.mouse.dblclick(w.x, w.y);
  await page.waitForSelector(".nb-edit-float:not([hidden])");
  await moveCursor('.nb-edit-float [data-cmd="strong"]');
  await page.locator('.nb-edit-float [data-cmd="strong"]').click();
  await wait(700);

  // beat 5 — the card under the block: tick the comment this save closes, journal note
  await moveCursor(".nb-edit-close input");
  await page.locator(".nb-edit-close input").first().check();
  await wait(500);
  await moveCursor(".nb-edit-note");
  await page.locator(".nb-edit-note").click();
  await page.locator(".nb-edit-note").type(NOTE, { delay: 40 });
  await wait(600);

  // beat 6 — Done → the save writes, closes the comment, journals the change
  await moveCursor('.nb-edit-card [data-act="done"]');
  await page.locator('.nb-edit-card [data-act="done"]').first().click();
  // the client reloads ~800ms after a successful save; the toast re-shows after it
  try {
    await page.waitForSelector(".nb-toast--save", { timeout: 10_000 });
  } catch (e) {
    const msg = await page
      .evaluate(() => document.querySelector(".nb-edit-msg")?.textContent ?? "(no card message)")
      .catch(() => "(page gone)");
    await page.screenshot({ path: path.join(os.tmpdir(), "nb-editor-demo-fail.png") }).catch(() => {});
    console.error(`save toast never appeared — card says: ${msg}`);
    throw e;
  }
  await page.addStyleTag({ content: "astro-dev-toolbar{display:none!important}" });
  await wait(2400);

  await context.close();
  const file = fs.readdirSync(videoDir).find((f) => f.endsWith(".webm"));
  await browser.close();
  if (!file) throw new Error("no video was recorded");
  return path.join(videoDir, file);
}

function toGif(webm) {
  const vf =
    "fps=11,scale=820:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5";
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
