// Record the diagrams demo GIF used in the READMEs (assets/notabene-diagrams-demo.gif).
//
// Self-contained and deterministic — mirrors scripts/record-mobile-demo.mjs:
//   1. regenerate a clean .demo fixture,
//   2. spawn `notabene dev` against it on its own port,
//   3. drive desktop Chrome (Playwright): enlarge a Mermaid diagram in the lightbox,
//      then comment the whole block — the comment lands in the right rail,
//   4. convert the video to an optimised GIF with ffmpeg.
//
// Requirements: Google Chrome (`channel: "chrome"`), ffmpeg on PATH, playwright-core.
// Usage:  node scripts/record-diagrams-demo.mjs   (or: npm run gen:diagrams-gif)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(REPO, ".demo");
const BIN = path.join(REPO, "packages/renderer/bin/notabene.mjs");
const OUT_GIF = path.join(REPO, "assets/notabene-diagrams-demo.gif");
const PORT = 3819;
const VIEWPORT = { width: 1280, height: 820 };
const COMMENT = "Add a note on the retry path here.";

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

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

async function record(base, videoDir) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  const page = await context.newPage();
  const wait = (ms) => page.waitForTimeout(ms);
  context.setDefaultTimeout(8000);
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

  // beat 1 — land on the page that has a Mermaid diagram, bring it into view
  await page.goto(`${base}/docs`, { waitUntil: "networkidle" });
  await addChrome();
  await page.waitForSelector("pre.mermaid svg", { timeout: 15_000 });
  await page.evaluate(() => document.querySelector("pre.mermaid").scrollIntoView({ block: "center" }));
  await wait(1200);

  const diagram = page.locator("pre.mermaid").first();

  // beat 2 — enlarge it in the lightbox (double-click is the big, forgiving target)
  await moveCursor("pre.mermaid");
  await diagram.dblclick();
  await page.waitForSelector(".nb-lightbox, [class*='lightbox']", { timeout: 8000 }).catch(() => {});
  await wait(2000);

  // beat 3 — close the lightbox
  await page.keyboard.press("Escape");
  await wait(900);

  // beat 4 — comment the whole diagram: hover → the block toolbar → 💬
  await diagram.hover();
  await moveCursor('.cmt-blockbar button[data-b="comment"]');
  await page.locator('.cmt-blockbar button[data-b="comment"]').click();
  await page.waitForSelector("#cmt-pop:not([hidden])");
  await wait(700);

  // beat 5 — type + save
  await page.locator("#cmt-pop-input").click();
  await page.locator("#cmt-pop-input").type(COMMENT, { delay: 45 });
  await wait(600);
  await moveCursor("#cmt-pop-save");
  await page.locator("#cmt-pop-save").click();

  // beat 6 — the comment lands in the right rail
  await wait(2200);

  await context.close();
  const file = fs.readdirSync(videoDir).find((f) => f.endsWith(".webm"));
  await browser.close();
  if (!file) throw new Error("no video was recorded");
  return path.join(videoDir, file);
}

function toGif(webm) {
  // The diagram + dark lightbox scrim inflate the palette — cap colours + fps to stay compact.
  const vf =
    "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5";
  return run("ffmpeg", ["-y", "-i", webm, "-vf", vf, OUT_GIF], { stdio: "ignore" });
}

async function main() {
  fs.rmSync(DEMO, { recursive: true, force: true });
  await run("node", [path.join(REPO, "scripts/gen-fixture.mjs")]);
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
