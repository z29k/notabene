// Record the theming demo GIF used in the docs (assets/notabene-theme-demo.gif).
//
// Self-contained and deterministic — mirrors scripts/record-i18n-demo.mjs:
//   1. regenerate a clean .demo fixture WITH the site-chrome seeds (--chrome: branding,
//      `--nb-*` token overrides, a consumer stylesheet + its asset folder, and a dual
//      light/dark code theme),
//   2. spawn `notabene dev` against it on its own port,
//   3. drive desktop Chrome (Playwright): flip the header's scheme toggle twice and show
//      what follows the palette — the chrome, then the CODE BLOCK (Shiki ships both
//      palettes as CSS variables), then the MERMAID DIAGRAM (re-rendered from its source
//      on `nb-scheme-change`). No rebuild, no page reload,
//   4. convert the video to an optimised GIF with ffmpeg.
//
// The stored preference is seeded to "light" before the first paint: the toggle cycles
// auto → light → dark → auto, so starting from "light" makes BOTH recorded clicks a
// visible flip (dark, then back) instead of a silent auto→light no-op.
//
// Requirements: Google Chrome (`channel: "chrome"`), ffmpeg on PATH, playwright-core.
// Usage:  node scripts/record-theme-demo.mjs   (or: npm run gen:theme-gif)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(REPO, ".demo");
const BIN = path.join(REPO, "packages/renderer/bin/notabene.mjs");
const OUT_GIF = path.join(REPO, "assets/notabene-theme-demo.gif");
const PORT = 3841;
const VIEWPORT = { width: 1280, height: 820 };
const TOGGLE = ".topbar .js-scheme-toggle";

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
    colorScheme: "light", // deterministic "auto" → light, whatever the recording machine
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  // Seeded before the first paint (same channel the toggle persists to).
  await context.addInitScript(() => {
    try {
      localStorage.setItem("nb-scheme", "light");
    } catch {}
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
  const scrollTo = async (sel) => {
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center", behavior: "smooth" }), sel);
    await wait(1100);
  };
  // Click with the real mouse at the element's viewport coordinates. NOT
  // locator.click(): its actionability step scrolls the target into view, and for an
  // element inside a `position: sticky` topbar that means scrolling back to the header's
  // STATIC position — i.e. to the top of the page, wrecking the before/after framing
  // this whole clip is made of.
  const clickAt = async (sel) => {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) throw new Error(`no box for ${sel}`);
    await page.mouse.click(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
  };
  // Mermaid re-renders asynchronously: the listener drops the per-block guard, then each
  // diagram is rebuilt from its stashed source. Wait for every block to carry both again
  // so no frame catches a half-rendered diagram.
  const flip = async () => {
    await moveCursor(TOGGLE);
    await clickAt(TOGGLE);
    await wait(350);
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("pre.mermaid")].every((el) => el.hasAttribute("data-nb-mermaid") && el.querySelector("svg")),
        { timeout: 8000 },
      )
      .catch(() => {});
  };

  // beat 1 — a themed site: accent tokens, logo, the consumer stylesheet
  await page.goto(`${base}/docs`, { waitUntil: "networkidle" });
  await addChrome();
  await page.waitForSelector("pre.mermaid svg", { timeout: 15_000 });
  await wait(1300);

  // beat 2 — the code block, then one click: the whole page AND Shiki's colors flip
  await scrollTo(".prose pre.astro-code");
  await wait(700);
  await flip();
  await wait(2100);

  // beat 3 — the diagram follows too: click again, it re-renders on the new palette
  await scrollTo("pre.mermaid");
  await wait(1000);
  await flip();
  await wait(2400);

  await context.close();
  const file = fs.readdirSync(videoDir).find((f) => f.endsWith(".webm"));
  await browser.close();
  if (!file) throw new Error("no video was recorded");
  return path.join(videoDir, file);
}

function toGif(webm) {
  // 820px = the width the docs embed these at (no browser resampling). Two full palettes
  // in one clip — keep the colour cap generous enough that the dark frames don't band.
  const vf =
    "fps=10,scale=820:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=144:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5";
  return run("ffmpeg", ["-y", "-i", webm, "-vf", vf, OUT_GIF], { stdio: "ignore" });
}

async function main() {
  fs.rmSync(DEMO, { recursive: true, force: true });
  await run("node", [path.join(REPO, "scripts/gen-fixture.mjs"), "--chrome"]);
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
