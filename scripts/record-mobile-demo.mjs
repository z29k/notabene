// Record the mobile/touch demo GIF used in the READMEs (assets/notabene-mobile-demo.gif).
//
// Self-contained and deterministic — mirrors scripts/gen-fixture.mjs:
//   1. regenerate a clean .demo fixture,
//   2. spawn `notabene dev` against it on its own port (parsed from stdout),
//   3. drive Chrome in iPhone emulation (Playwright) through the touch-review flow,
//      recording video: responsive nav drawer → touch-select → docked action bar →
//      compose sheet → type → save → the 💬 anchored-comments bottom sheet,
//   4. convert the video to an optimised GIF with ffmpeg.
//
// Requirements: Google Chrome (driven via `channel: "chrome"` — no browser download),
// ffmpeg on PATH, and the root devDependency `playwright-core`.
//
// Usage:  node scripts/record-mobile-demo.mjs   (or: npm run gen:mobile-gif)

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(REPO, ".demo");
const BIN = path.join(REPO, "packages/renderer/bin/notabene.mjs");
const OUT_GIF = path.join(REPO, "assets/notabene-mobile-demo.gif");
const PORT = 3799; // uncommon; astro auto-increments if busy — we parse the real one back.

// The passage a reviewer touch-selects, and the comment they leave.
const PHRASE = "Renderer node invoice payload replica cursor system pipeline contract service session.";
const COMMENT = "Can we ground this in a concrete example?";

// iPhone-class viewport (recognisably a phone; keeps the GIF small).
const DEVICE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

// Spawn the dev server (detached, so we can kill the whole process group) and resolve
// the actual URL once astro prints it — astro auto-increments the port when it's busy.
function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [BIN, "dev", "--root", DEMO, "--port", String(PORT)], {
      cwd: REPO,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      // Pin a neutral author so the recorded comment reads the same for any contributor
      // who regenerates the GIF (otherwise it falls back to their local git user.name).
      env: { ...process.env, NOTABENE_AUTHOR: "notabene demo" },
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
  const context = await browser.newContext({ ...DEVICE, recordVideo: { dir: videoDir, size: DEVICE.viewport } });
  const page = await context.newPage();
  const wait = (ms) => page.waitForTimeout(ms);

  await page.goto(`${base}/docs/`, { waitUntil: "networkidle" });
  // The Astro dev toolbar docks bottom-centre — it pollutes the frame and intercepts
  // taps on the docked action bar. Remove it for the recording.
  await page.addStyleTag({ content: "astro-dev-toolbar{display:none!important}" });
  context.setDefaultTimeout(8000);

  // beat 1 — land on the mobile viewer
  await wait(1300);

  // beat 2 — responsive nav: open the off-canvas drawer, then dismiss via the scrim
  await page.locator("#nb-nav-toggle").tap();
  await wait(1500);
  await page.locator("#nb-scrim").tap({ position: { x: 360, y: 430 } });
  await wait(800);

  // beat 3 — touch-select a passage → the docked action bar slides up
  await page.evaluate((phrase) => {
    const article = document.getElementById("doc-content");
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.textContent.indexOf(phrase);
      if (idx !== -1) {
        node.parentElement.scrollIntoView({ block: "center" });
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + phrase.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
    }
    throw new Error("selection phrase not found in the demo page");
  }, PHRASE);
  await page.waitForSelector("#cmt-float:not([hidden])");
  await wait(1400);

  // beat 4 — tap Comment → the compose sheet rises
  await page.locator("#cmt-float").tap();
  await page.waitForSelector("#cmt-pop:not([hidden])");
  await wait(700);

  // beat 5 — type the comment
  await page.locator("#cmt-pop-input").tap();
  await page.locator("#cmt-pop-input").type(COMMENT, { delay: 55 });
  await wait(700);

  // beat 6 — save → the passage becomes a persistent highlight
  await page.locator("#cmt-pop-save").tap();
  await wait(1500);

  // beat 7 — open the 💬 anchored-comments bottom sheet
  await page.locator("#nb-cmt-sheet-btn").tap();
  await wait(1900);

  await context.close(); // finalises the video file
  const file = fs.readdirSync(videoDir).find((f) => f.endsWith(".webm"));
  await browser.close();
  if (!file) throw new Error("no video was recorded");
  return path.join(videoDir, file);
}

function toGif(webm) {
  // 12fps, 340px wide, 128-colour diff palette + light Bayer dither — small yet crisp
  // (the flat UI needs few colours; capping them shrinks the file with no visible loss).
  const vf =
    "fps=12,scale=340:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4";
  return run("ffmpeg", ["-y", "-i", webm, "-vf", vf, OUT_GIF], { stdio: "ignore" });
}

async function main() {
  // 1) fresh, deterministic fixture (approve mode → a Review badge shows in the drawer)
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
