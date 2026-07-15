// Record the i18n demo GIF used in the READMEs (assets/notabene-i18n-demo.gif).
//
// Self-contained and deterministic — mirrors scripts/record-hero-demo.mjs:
//   1. regenerate a clean BILINGUAL .demo fixture (--i18n directory: EN + FR, one page
//      left EN-only to show the fallback),
//   2. spawn `notabene dev` against it on its own port,
//   3. drive desktop Chrome (Playwright): open the header language switcher, pick Français
//      (docs + chrome turn French), visit /comments (an aggregate page follows the chosen
//      language too), then an EN-only page (the "not available in your language" banner),
//   4. convert the video to an optimised GIF with ffmpeg.
//
// The recorded viewport is page content only (no address bar), so the language *redirect*
// isn't visible here — the switcher, the French chrome, and the fallback banner are.
//
// Requirements: Google Chrome (`channel: "chrome"`), ffmpeg on PATH, playwright-core.
// Usage:  node scripts/record-i18n-demo.mjs   (or: npm run gen:i18n-gif)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(REPO, ".demo");
const BIN = path.join(REPO, "packages/renderer/bin/notabene.mjs");
const OUT_GIF = path.join(REPO, "assets/notabene-i18n-demo.gif");
const PORT = 3831;
const VIEWPORT = { width: 1280, height: 820 };
// gen-fixture (--i18n directory, seed 42) leaves exactly this content page EN-only, to
// exercise the fallback + banner. Deterministic; keep in sync with gen-fixture.mjs.
const EN_ONLY = "/reference/guide/cluster-3";

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
      const r = await fetch(`${base}/fr/docs`);
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

  // beat 1 — land on the EN docs, cursor to the header language switcher (globe)
  await page.goto(`${base}/docs`, { waitUntil: "networkidle" });
  await addChrome();
  await wait(1200);
  await moveCursor(".lang-menu summary");

  // beat 2 — open the switcher → the dropdown (EN · English / FR · Français)
  await page.locator(".lang-menu summary").click();
  await page.waitForSelector('.lang-menu a[hreflang="fr"]', { state: "visible" });
  await wait(900);

  // beat 3 — pick Français → the doc + chrome turn French
  await moveCursor('.lang-menu a[hreflang="fr"]');
  await page.locator('.lang-menu a[hreflang="fr"]').click();
  await page.waitForLoadState("networkidle");
  await addChrome();
  await wait(1900);

  // beat 4 — an aggregate page follows the chosen language too: open Commentaires
  await moveCursor('.topbar a[href="/comments"]');
  await page.locator('.topbar a[href="/comments"]').click();
  await page.waitForLoadState("networkidle");
  await addChrome();
  await page.waitForFunction(() => document.documentElement.lang === "fr").catch(() => {});
  await wait(1900);

  // beat 5 — a page with no French version: it stays English with a discreet banner
  await page.goto(`${base}${EN_ONLY}`, { waitUntil: "networkidle" });
  await addChrome();
  await page.waitForSelector("#nb-i18n-banner:not([hidden])", { timeout: 8000 });
  await moveCursor("#nb-i18n-banner");
  await wait(2200);

  await context.close();
  const file = fs.readdirSync(videoDir).find((f) => f.endsWith(".webm"));
  await browser.close();
  if (!file) throw new Error("no video was recorded");
  return path.join(videoDir, file);
}

function toGif(webm) {
  const vf =
    "fps=12,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5";
  return run("ffmpeg", ["-y", "-i", webm, "-vf", vf, OUT_GIF], { stdio: "ignore" });
}

async function main() {
  fs.rmSync(DEMO, { recursive: true, force: true });
  await run("node", [path.join(REPO, "scripts/gen-fixture.mjs"), "--i18n", "directory"]);
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
