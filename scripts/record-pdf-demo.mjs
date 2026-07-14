// Record the PDF-export demo GIF used in the READMEs (assets/notabene-pdf-demo.gif).
//
// Self-contained and deterministic — mirrors scripts/record-mobile-demo.mjs:
//   1. regenerate a clean .demo fixture,
//   2. spawn `notabene dev` against it on its own port (parsed from stdout),
//   3. drive desktop Chrome (Playwright) through the export flow, recording video:
//      open the Export-PDF menu → the four scopes → the print-ready view (cover +
//      clickable table of contents + content, forced-light), with a synthetic cursor
//      so the clicks read clearly,
//   4. convert the video to an optimised GIF with ffmpeg.
//
// Requirements: Google Chrome (driven via `channel: "chrome"` — no browser download),
// ffmpeg on PATH, and the root devDependency `playwright-core`.
//
// Usage:  node scripts/record-pdf-demo.mjs   (or: npm run gen:pdf-gif)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(REPO, ".demo");
const BIN = path.join(REPO, "packages/renderer/bin/notabene.mjs");
const OUT_GIF = path.join(REPO, "assets/notabene-pdf-demo.gif");
const PORT = 3809; // uncommon; astro auto-increments if busy — we parse the real one back.

// Desktop viewport wide enough that the topbar utilities (the printer icon) are shown
// (they collapse into the drawer below 1024px).
const VIEWPORT = { width: 1280, height: 820 };

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
      // Pin a neutral identity so the header chip reads the same for any contributor.
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

// A synthetic pointer (the OS cursor isn't captured in a headless recording) that glides
// to each target so the clicks are legible.
const CURSOR_JS = `
  (() => {
    if (document.getElementById('nb-cursor')) return;
    const c = document.createElement('div');
    c.id = 'nb-cursor';
    c.style.cssText = 'position:fixed;left:50%;top:60%;z-index:2147483647;pointer-events:none;margin:-2px 0 0 -2px;transition:left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))';
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
    await wait(650);
  };

  // beat 1 — land on a nested content page (so the Export menu offers all four scopes)
  await page.goto(`${base}/docs/guide/invoice-3`, { waitUntil: "networkidle" });
  await addChrome();
  await wait(1200);

  // beat 2 — glide to the printer icon and open the Export-PDF menu (the four scopes)
  await moveCursor(".export-summary");
  await page.locator(".export-summary").click();
  await page.waitForSelector(".export-menu[open]");
  await wait(1500);

  // beat 3 — point at "whole documentation", then open the print-ready view
  await moveCursor(".export-menu-pop a:last-child");
  await wait(700);
  await page.goto(`${base}/print`, { waitUntil: "networkidle" });
  await page.waitForSelector("body[data-pg-ready]", { timeout: 30_000 }).catch(() => {});
  await addChrome();

  // beat 4 — the cover
  await wait(1600);

  // beat 5 — scroll to the table of contents (the hierarchical "menu")
  await page.evaluate(() => {
    const toc = document.querySelector(".pg-toc");
    if (toc) window.scrollTo({ top: toc.offsetTop - 40, behavior: "smooth" });
  });
  await wait(2100);

  // beat 6 — scroll into the concatenated content (forced-light, diagrams too)
  await page.evaluate(() => {
    const first = document.querySelector(".pg-doc");
    if (first) window.scrollTo({ top: first.offsetTop - 24, behavior: "smooth" });
  });
  await wait(1900);

  await context.close(); // finalises the video file
  const file = fs.readdirSync(videoDir).find((f) => f.endsWith(".webm"));
  await browser.close();
  if (!file) throw new Error("no video was recorded");
  return path.join(videoDir, file);
}

function toGif(webm) {
  // 12fps, 820px wide, 160-colour diff palette + light Bayer dither — crisp yet compact.
  const vf =
    "fps=12,scale=820:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4";
  return run("ffmpeg", ["-y", "-i", webm, "-vf", vf, OUT_GIF], { stdio: "ignore" });
}

async function main() {
  // 1) fresh, deterministic fixture
  fs.rmSync(DEMO, { recursive: true, force: true });
  await run("node", [path.join(REPO, "scripts/gen-fixture.mjs")]);

  // 2) serve it
  const { child, base } = await startServer();
  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), "notabene-rec-"));
  try {
    await waitReady(base);
    console.log(`recording against ${base} …`);
    // 3) drive + record, 4) encode
    const webm = await record(base, videoDir);
    await toGif(webm);
    console.log(`wrote ${path.relative(REPO, OUT_GIF)}`);
  } finally {
    try {
      process.kill(-child.pid, "SIGTERM"); // kill the whole dev-server process group
    } catch {}
    fs.rmSync(videoDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
