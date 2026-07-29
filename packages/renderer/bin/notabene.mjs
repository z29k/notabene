#!/usr/bin/env node
// notabene CLI — run-from-package. Renders a consumer repo's docs from this
// package (no app is copied into the consumer). Only DATA lives in the consumer:
// notabene.config.mjs + the .notabene store.
//
//   notabene doctor        read-only state (JSON) — the setup tooling routes on it
//   notabene init          write notabene.config.mjs + create the store (no-op if present)
//   notabene dev           start the review server (astro dev) over the current repo
//   notabene build         build the site (Node standalone; no write API in the artifact)
//                          --public: read-only STATIC site for public hosting (no
//                          comments/review UI, no API, no store data; llms.txt + .md
//                          twins + sitemap). [--site URL] [--base /sub] [--out DIR]
//   notabene preview       serve the built site
//   notabene lint          validate inter-doc links against the last build's routes
//   notabene pdf           export a PDF via headless Chromium (optional Puppeteer dep)
//   notabene migrate       convert the store to one file per comment (schemaVersion 3)
//   notabene comments ls   list comments [--open] [--json] [--page <p>]
//   notabene comments done mark comment(s) handled — status from config `review`
//   notabene comments reopen  send comment(s) back to open (rejection + reply)
//   notabene comments verify  audit store↔journal coherence (read-only)
//   notabene journal add   append a JSON journal entry read from stdin
//   notabene protocol      print the agent protocol [--path] [--write]
//
// Flags: --config <path> (default <cwd>/notabene.config.mjs), --root <path>
// (consumer repo root, default cwd), --host (expose on the LAN — trusted only).
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { mergeAgentsBlock, renderAgentsBlock } from "../src/lib/agents-md.mjs";
import { applyDone, applyReopen, composeAuthor, statusForReview } from "../src/lib/comment-mutate.mjs";
import { buildReport, findFreePort } from "../src/lib/doctor.mjs";
import {
  PROTOCOL_STORE_SCHEMA,
  PROTOCOL_VERSION,
  isGeneratedProtocol,
  parseProtocolVersion,
} from "../src/lib/protocol-gen.mjs";
import { verifyExitCode, verifyStore } from "../src/lib/store-verify.mjs";
import {
  canConnect,
  isAlive,
  readPidfile,
  removePidfile,
  stopGroup,
  waitForPort,
  writePidfile,
} from "../src/lib/server-process.mjs";

const require = createRequire(import.meta.url);
// bin/ is at <package>/bin → the Astro app root is the package root.
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 ? (argv[i + 1] ?? true) : undefined;
};

const repoRoot = path.resolve(flag("--root") || process.cwd());
const configPath = path.resolve(flag("--config") || path.join(repoRoot, "notabene.config.mjs"));
const exposeHost = argv.includes("--host");
// Public publish mode (`build --public`): a read-only STATIC artifact — no
// comments/review/journal UI, no API, no store data — with the agent surface
// (llms.txt, .md twins, sitemap). --site/--base override the config's `publish`
// block; --out copies the artifact into the consumer tree (CI needs a stable path).
const publicBuild = argv.includes("--public");
const siteFlag = flag("--site");
const baseFlag = flag("--base");

function fail(msg) {
  console.error(`notabene: ${msg}`);
  process.exit(1);
}

// Best-effort default comment author from the consumer repo's git identity (overridden
// by config `author`, and per-device by the browser's localStorage). Never throws.
function gitUserName(cwd) {
  try {
    return (
      execFileSync("git", ["-C", cwd, "config", "user.name"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

// Best-effort default author email from the repo's git identity (a fallback for the
// per-device identity dialog). Never throws.
function gitUserEmail(cwd) {
  try {
    return (
      execFileSync("git", ["-C", cwd, "config", "user.email"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

const TEMPLATE_CONFIG = path.join(APP_DIR, "templates", "notabene.config.mjs");
// The agent protocol, generated from docs/reference/agent-protocol.md and SHIPPED in the package
// (package.json `files`) — so `init` can drop a copy in the consumer's store and any
// agent reads the spec from the repo itself: no npx, no network, no GitHub visit.
const PROTOCOL_FILE = path.join(APP_DIR, "protocol.md");

// Write `text` the way the store contract promises: temp file + rename, so a reader
// (an agent, the dev server) never observes a truncated file.
function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

function readStore(cfgPath) {
  // Best-effort: read the `store` value from an existing config to create it.
  try {
    const txt = fs.readFileSync(cfgPath, "utf8");
    const m = txt.match(/store\s*:\s*["'`]([^"'`]+)["'`]/);
    return m ? m[1] : "docs/.notabene";
  } catch {
    return "docs/.notabene";
  }
}

// Best-effort configured port (a literal number in the data-only config), for the dev
// port pre-probe. Mirrors readStore's regex approach so `dev` needn't import config.mjs.
function readPort(cfgPath) {
  try {
    const m = fs.readFileSync(cfgPath, "utf8").match(/port\s*:\s*(\d+)/);
    return m ? Number(m[1]) : 3009;
  } catch {
    return 3009;
  }
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Render a notabene.config.mjs for `init --detect` (roots discovered at runtime, so the
// static template can't be copied verbatim). Data-only file — zero imports.
function renderConfig({ roots, store, format = "commonmark" }) {
  const rootLines = roots
    .map(
      (r) =>
        `    { key: ${JSON.stringify(r.key)}, label: ${JSON.stringify(r.label)}, ` +
        `path: ${JSON.stringify(r.path)}, exclude: ${JSON.stringify(r.exclude)} },`,
    )
    .join("\n");
  return `// notabene.config.mjs — generated by \`notabene init --detect\`. Points the generic
// docs review tool at YOUR docs. Your data (docs, comments, journal) lives in your git.
export default {
  siteName: "Docs",
  tagline: "docs",
  locale: "en",
  format: ${JSON.stringify(format)},
  roots: [
${rootLines}
  ],
  store: ${JSON.stringify(store)},
  port: 3009,
  host: false,
  verify: [],
  review: "auto",
};
`;
}

// Copy the packaged protocol into `<store>/protocol.md` — the channel that works
// EVERYWHERE (a Rust/Python repo with no node_modules, offline, behind a proxy), unlike
// npm-only or npx-only pointers. Inert for every store reader (they only read `.json`).
// Never overwrites a file we didn't generate; identical content is left untouched.
// Returns the repo-relative path when the copy is in place, else null.
function writeStoreProtocol(storeAbs) {
  let packaged;
  try {
    packaged = fs.readFileSync(PROTOCOL_FILE, "utf8");
  } catch {
    console.error("notabene: protocol.md missing from the package — skipping the store copy.");
    return null;
  }
  const dest = path.join(storeAbs, "protocol.md");
  const rel = path.relative(repoRoot, dest).split(path.sep).join("/");
  if (fs.existsSync(dest)) {
    const current = fs.readFileSync(dest, "utf8");
    if (!isGeneratedProtocol(current)) {
      console.log(`notabene: ${rel} exists and wasn't generated by notabene — left it alone.`);
      return rel;
    }
    if (current === packaged) {
      console.log(`notabene: ${rel} up to date (protocol v${PROTOCOL_VERSION}).`);
      return rel;
    }
    writeAtomic(dest, packaged);
    console.log(`notabene: updated ${rel} (protocol v${parseProtocolVersion(current)} → v${PROTOCOL_VERSION}).`);
    return rel;
  }
  writeAtomic(dest, packaged);
  console.log(`notabene: wrote ${rel} (agent protocol v${PROTOCOL_VERSION}).`);
  return rel;
}

// Write/repair the bounded notabene block in the consumer's AGENTS.md — the entry point
// agents other than Claude Code read at session start (Codex CLI, Cursor, Gemini CLI…).
// Nothing outside the markers is ever touched (see src/lib/agents-md.mjs).
function writeAgentsMd(storeAbs, protocolRel) {
  const file = path.join(repoRoot, "AGENTS.md");
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  const storeRel = path.relative(repoRoot, storeAbs).split(path.sep).join("/");
  const { text, action } = mergeAgentsBlock(existing, renderAgentsBlock({ storeRel, protocolRel }));
  if (action === "unterminated") {
    console.error(
      "notabene: AGENTS.md has an opening <!-- notabene:begin --> with no closing marker — " +
        "left untouched. Fix or remove the block, then re-run `notabene init`.",
    );
    return;
  }
  if (action !== "unchanged") writeAtomic(file, text);
  const said = {
    created: "wrote AGENTS.md (notabene block)",
    appended: "appended the notabene block to AGENTS.md",
    replaced: "refreshed the notabene block in AGENTS.md",
    unchanged: "AGENTS.md block already up to date",
  }[action];
  console.log(`notabene: ${said}.`);
}

// `notabene protocol [--path] [--write]` — the agent protocol as data. Read-only by
// default (print it, or print where it lives); `--write` refreshes `<store>/protocol.md`
// the same way `init` does, so a consumer can pull a newer spec without re-running init.
function doProtocol() {
  if (argv.includes("--path")) {
    console.log(PROTOCOL_FILE);
    return;
  }
  if (argv.includes("--write")) {
    if (!fs.existsSync(configPath)) {
      fail(`no config at ${configPath}. Run \`notabene init\` first.`);
    }
    const store = path.resolve(repoRoot, readStore(configPath));
    if (!fs.existsSync(store)) fail(`no store at ${store}. Run \`notabene init\` first.`);
    writeStoreProtocol(store);
    return;
  }
  try {
    process.stdout.write(fs.readFileSync(PROTOCOL_FILE, "utf8"));
  } catch {
    fail("protocol.md is missing from this installation of the renderer.");
  }
}

async function doInit() {
  if (fs.existsSync(configPath)) {
    console.log(`notabene: ${path.relative(repoRoot, configPath)} already exists — leaving it.`);
  } else if (argv.includes("--detect")) {
    // Materialize the zero-config defaults into an explicit, committable file, with the
    // doc folders auto-detected (same walk `notabene doctor` uses).
    const { detectDocs } = await import("../src/lib/doctor.mjs");
    const detected = detectDocs(repoRoot);
    const roots = (detected.length ? detected : ["docs"]).map((p) => ({
      key: slugify(p) || "docs",
      label: p.charAt(0).toUpperCase() + p.slice(1),
      path: p,
      exclude: [".notabene/**"],
    }));
    const store = `${roots[0].path}/.notabene`;
    fs.writeFileSync(configPath, renderConfig({ roots, store }));
    console.log(
      `notabene: wrote ${path.relative(repoRoot, configPath)} ` +
        `(detected: ${detected.join(", ") || "none — defaulted to docs/"})`,
    );
  } else {
    fs.copyFileSync(TEMPLATE_CONFIG, configPath);
    console.log(`notabene: wrote ${path.relative(repoRoot, configPath)}`);
  }
  const store = path.resolve(repoRoot, readStore(configPath));
  fs.mkdirSync(store, { recursive: true });
  const meta = path.join(store, "meta.json");
  // Keep in sync with SCHEMA_VERSION in src/lib/comment-types.ts (bin can't import the .ts).
  if (!fs.existsSync(meta)) fs.writeFileSync(meta, `${JSON.stringify({ schemaVersion: 3 }, null, 2)}\n`);
  console.log(`notabene: store ready at ${path.relative(repoRoot, store)}/`);
  // The agent-facing scaffold: the protocol next to the comments it describes, and the
  // AGENTS.md pointer that makes a non-Claude agent discover it. Both opt-out-able,
  // both idempotent — `init` is also the repair path when the config changes.
  const protocolRel = argv.includes("--no-protocol") ? null : writeStoreProtocol(store);
  if (!argv.includes("--no-agents-md")) writeAgentsMd(store, protocolRel);
  console.log("notabene: run `notabene dev` to start reviewing.");
}

// Convert a v1 store (one JSON array per page, `<page>.json`) to v2 (one file per comment,
// `<page>/<id>.json`) — conflict-free git merges. Readers already accept both; this just
// converts eagerly so the change shows up as one reviewable diff. Idempotent.
function doMigrate() {
  const store = path.resolve(repoRoot, readStore(configPath));
  if (!fs.existsSync(store)) fail(`no store at ${store}. Run \`notabene init\` first.`);
  const reserved = new Set(["journal.json", "meta.json"]);
  let pages = 0;
  let moved = 0;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!e.name.endsWith(".json") || (dir === store && reserved.has(e.name))) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(full, "utf8"));
      } catch {
        continue;
      }
      if (!Array.isArray(data)) continue; // already v2 (a single comment object)
      const pageDir = full.replace(/\.json$/, "");
      fs.mkdirSync(pageDir, { recursive: true });
      for (const c of data) {
        if (!c?.id) continue;
        const safeId = String(c.id).replace(/[^a-zA-Z0-9_-]/g, "");
        fs.writeFileSync(path.join(pageDir, `${safeId}.json`), `${JSON.stringify(c, null, 2)}\n`);
        moved++;
      }
      fs.rmSync(full, { force: true });
      pages++;
    }
  })(store);
  fs.writeFileSync(path.join(store, "meta.json"), `${JSON.stringify({ schemaVersion: 3 }, null, 2)}\n`);
  console.log(`notabene: migrated ${pages} page file(s) → ${moved} comment file(s) (store schemaVersion 3).`);
}

// Read every comment from the store WITH its provenance — the file it came from, and
// whether it's a member of a legacy v1 array (which must be written back in place).
// `comments ls` / `done` / `reopen` / `verify` all build on this one walk.
function readCommentRecords(store) {
  const reserved = new Set(["journal.json", "meta.json"]);
  const out = [];
  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!e.name.endsWith(".json") || (dir === store && reserved.has(e.name))) continue;
      const file = path.relative(store, full).split(path.sep).join("/");
      let data;
      try {
        data = JSON.parse(fs.readFileSync(full, "utf8"));
      } catch (err) {
        out.push({ file, abs: full, error: err instanceof Error ? err.message : String(err) });
        continue;
      }
      if (Array.isArray(data)) {
        data.forEach((c, index) => {
          out.push({ file, abs: full, data: c, legacy: true, index });
        });
      } else {
        out.push({ file, abs: full, data });
      }
    }
  })(store);
  return out;
}

// Read every comment from the store (both v2 per-comment files and legacy v1 arrays).
function readAllComments(store) {
  return readCommentRecords(store)
    .filter((r) => r.data?.id)
    .map((r) => r.data);
}

// Write one comment back where it came from — replacing the member in place for a
// legacy v1 array, the whole file for a v2 per-comment file. Atomic either way.
function writeCommentRecord(rec, next) {
  if (rec.legacy) {
    const arr = JSON.parse(fs.readFileSync(rec.abs, "utf8"));
    arr[rec.index] = next;
    writeAtomic(rec.abs, `${JSON.stringify(arr, null, 2)}\n`);
    return;
  }
  writeAtomic(rec.abs, `${JSON.stringify(next, null, 2)}\n`);
}

// Flags that consume the next token, so positional ids can be told apart from values.
const VALUE_FLAGS = new Set([
  "--root",
  "--config",
  "--page",
  "--note",
  "--journal",
  "--status",
  "--author",
  "--reply",
  "--port",
  "--out",
  "--scope",
  "--locale",
  "--chrome",
  "--site",
  "--base",
]);

function positionals(from) {
  const out = [];
  for (let i = from; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      if (VALUE_FLAGS.has(a) && argv[i + 1] && !argv[i + 1].startsWith("--")) i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

const strFlag = (name) => {
  const v = flag(name);
  return typeof v === "string" ? v : null;
};

// The RESOLVED config (src/config.mjs — the single source of defaults), or null when it
// can't load. Same env-then-dynamic-import dance as doctor/lint.
async function loadResolvedConfig() {
  try {
    process.env.NOTABENE_ROOT = repoRoot;
    process.env.NOTABENE_CONFIG = configPath;
    return await import(pathToFileURL(path.join(APP_DIR, "src/config.mjs")).href);
  } catch {
    return null;
  }
}

// Best-effort `review` when the config can't be resolved (mirrors readStore/readPort).
function readReview(cfgPath) {
  try {
    const m = fs.readFileSync(cfgPath, "utf8").match(/review\s*:\s*["'`](auto|approve)["'`]/);
    return m ? m[1] : "auto";
  } catch {
    return "auto";
  }
}

function readJournalEntries(store) {
  try {
    return JSON.parse(fs.readFileSync(path.join(store, "journal.json"), "utf8"));
  } catch {
    return null;
  }
}

// `notabene comments ls [--open] [--json] [--page <p>]` — a first-class primitive so any
// agent can shell out instead of re-implementing the store parsing (which is what the
// review protocol tells it to do). --open = the actionable set (open AND not on hold).
function doCommentsLs() {
  const store = path.resolve(repoRoot, readStore(configPath));
  const pageArg = flag("--page");
  let list = readAllComments(store);
  if (pageArg && pageArg !== true) list = list.filter((c) => c.page === pageArg);
  if (argv.includes("--open")) list = list.filter((c) => c.status === "open" && !c.hold);
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(list, null, 2)}\n`);
    return;
  }
  if (!list.length) return console.log("notabene: no comments.");
  for (const c of list) {
    console.log(`\n[${c.id}] ${c.status}${c.hold ? " ⏸" : ""} ${c.scope} page=${c.page}`);
    if (c.anchor && c.scope === "block") console.log(`  §${c.anchor.section} [${c.anchor.kind}] ${c.anchor.label}`);
    else if (c.anchor) console.log(`  §${c.anchor.section}: «${(c.anchor.quote || "").slice(0, 100)}»`);
    (c.thread || []).forEach((t, i) => {
      console.log(`  ${i ? "↳" : "•"} ${t.author}: ${t.body}`);
    });
  }
}

// `notabene comments done <id…>` — mark comments as handled. The STATUS COMES FROM THE
// CONFIG (`review`): "auto" → resolved, "approve" → addressed. That single fact is why
// this command exists: hand-editing JSON is where an agent writes `resolved` in approve
// mode and silently skips the human validation. Everything else on the comment is
// preserved; the write is atomic; legacy v1 arrays are updated in place.
async function doCommentsDone() {
  const ids = positionals(2);
  if (!ids.length) {
    fail("usage: notabene comments done <id…> [--note <text>] [--journal <entryId>] [--status …] [--force] [--json]");
  }
  const store = path.resolve(repoRoot, readStore(configPath));
  const records = readCommentRecords(store);
  const cfg = await loadResolvedConfig();
  const reviewMode = cfg ? cfg.reviewMode : readReview(configPath);
  const status = strFlag("--status") ?? statusForReview(reviewMode);
  const note = strFlag("--note");
  const journalEntryId = strFlag("--journal");
  const now = new Date().toISOString();

  const targets = ids.map((id) => {
    const rec = records.find((r) => r.data?.id === id);
    if (!rec) fail(`comment "${id}" not found under ${path.relative(repoRoot, store) || store}/`);
    if (rec.data.hold && !argv.includes("--force")) {
      fail(`comment "${id}" is on hold (the reviewer's work-in-progress) — leave it, or pass --force.`);
    }
    return rec;
  });

  const updated = [];
  for (const rec of targets) {
    let next;
    try {
      next = applyDone(rec.data, { status, note, journalEntryId, now });
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
    writeCommentRecord(rec, next);
    updated.push(next);
  }

  // Nudges, never blockers: the journal link is what /review inverts to build the diff.
  const journal = readJournalEntries(store);
  if (!journalEntryId) {
    console.error("notabene: no --journal <entryId> — the protocol links every resolution to a journal entry.");
  } else if (Array.isArray(journal) && !journal.some((e) => e?.id === journalEntryId)) {
    console.error(`notabene: journal entry "${journalEntryId}" doesn't exist (yet) — append it with \`journal add\`.`);
  }

  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
    return;
  }
  console.log(`notabene: ${updated.length} comment(s) → ${status} (review: ${reviewMode}).`);
}

// `notabene comments reopen <id…> --reply "<why>"` — the human side of approve mode:
// send a proposed edit back to the agent, with the reason as a normal thread reply
// (that's where the next pass reads it).
async function doCommentsReopen() {
  const ids = positionals(2);
  if (!ids.length) fail("usage: notabene comments reopen <id…> [--reply <text>] [--author <name>] [--json]");
  const store = path.resolve(repoRoot, readStore(configPath));
  const records = readCommentRecords(store);
  const reply = strFlag("--reply");
  const author = strFlag("--author") ?? composeAuthor(gitUserName(repoRoot), gitUserEmail(repoRoot));
  const now = new Date().toISOString();

  const updated = [];
  for (const id of ids) {
    const rec = records.find((r) => r.data?.id === id);
    if (!rec) fail(`comment "${id}" not found under ${path.relative(repoRoot, store) || store}/`);
    const next = applyReopen(rec.data, { reply, author, now });
    writeCommentRecord(rec, next);
    updated.push(next);
  }
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
    return;
  }
  console.log(`notabene: ${updated.length} comment(s) → open${reply ? ` (reply by ${author})` : ""}.`);
}

// `notabene comments verify [--json]` — READ-ONLY audit of the store a (possibly
// third-party) agent just wrote: statuses, resolution↔journal links in BOTH directions,
// layout, duplicates, dangling pages. Exit 1 on errors, 2 with no store, 0 otherwise
// (warnings don't fail — the store still works). Checks live in lib/store-verify.mjs.
async function doCommentsVerify() {
  const store = path.resolve(repoRoot, readStore(configPath));
  if (!fs.existsSync(store)) {
    console.error(`notabene: no store at ${store}. Run \`notabene init\` first.`);
    process.exit(2);
  }
  const records = readCommentRecords(store);
  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(store, "meta.json"), "utf8"));
  } catch {
    /* no meta.json — reported as a warning */
  }
  let journal = readJournalEntries(store);
  if (journal === null && fs.existsSync(path.join(store, "journal.json"))) journal = { unreadable: true };

  // A page whose source file vanished is worth a warning — but only when the config
  // resolves (roots + extensions); otherwise we can't tell and don't guess.
  const cfg = await loadResolvedConfig();
  const pageExists = cfg
    ? (page) => {
        const root = cfg.roots
          .filter((r) => page === r.path || page.startsWith(`${r.path}/`))
          .sort((a, b) => b.path.length - a.path.length)[0];
        if (!root) return true; // outside every declared space: not ours to judge
        const rel = page === root.path ? "" : page.slice(root.path.length + 1);
        return cfg.extensions.some(
          (ext) =>
            (rel && fs.existsSync(path.join(root.abs, `${rel}.${ext}`))) ||
            fs.existsSync(path.join(root.abs, rel, `index.${ext}`)),
        );
      }
    : undefined;

  const findings = verifyStore({
    entries: records.map((r) => ({ file: r.file, data: r.data, legacy: !!r.legacy, error: r.error })),
    journal,
    meta,
    schemaVersion: PROTOCOL_STORE_SCHEMA,
    pageExists,
  });
  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");

  if (argv.includes("--json")) {
    process.stdout.write(
      `${JSON.stringify(
        {
          version: 1,
          store: path.relative(repoRoot, store) || store,
          checked: { comments: records.length, journal: Array.isArray(journal) ? journal.length : 0 },
          errors: errors.length,
          warnings: warnings.length,
          findings,
        },
        null,
        2,
      )}\n`,
    );
    process.exit(verifyExitCode(findings));
  }

  for (const f of [...errors, ...warnings]) {
    const where = f.file ? `${f.file}: ` : "";
    console.log(`  ${f.level === "error" ? "✗" : "!"} ${where}${f.message}  [${f.code}]`);
  }
  const journalCount = Array.isArray(journal) ? journal.length : 0;
  console.log(
    `notabene verify: ${records.length} comment(s), ${journalCount} journal entr(ies) — ` +
      `${errors.length} error(s), ${warnings.length} warning(s).`,
  );
  process.exit(verifyExitCode(findings));
}

// `notabene journal add` — append a JSON journal entry read from stdin. Lets an agent
// record a review pass without hand-editing journal.json.
function doJournalAdd() {
  const store = path.resolve(repoRoot, readStore(configPath));
  let entry;
  try {
    entry = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    fail("journal add: expected a JSON entry on stdin");
  }
  const journalPath = path.join(store, "journal.json");
  let journal = [];
  try {
    journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  } catch {
    /* no journal yet */
  }
  if (!Array.isArray(journal)) journal = [];
  journal.push(entry);
  // Atomic like every other store write (src/lib/comments.ts): an agent appending an
  // entry must never leave a half-written journal.json behind for the next reader.
  writeAtomic(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ id: entry.id ?? null }, null, 2)}\n`);
    return;
  }
  console.log(`notabene: appended journal entry ${entry.id || "(no id)"}.`);
}

// `notabene doctor [--json]` — read-only state for the setup tooling. The state
// contract (config present/valid, store, port, detected docs) lives in src/lib/doctor.mjs
// so it is unit-testable and shared; here we just print JSON or a short human summary.
async function doDoctor() {
  const report = await buildReport({ repoRoot, configPath });
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const c = report.config;
  console.log(`notabene doctor — ${repoRoot}`);
  console.log(
    `  node ${report.node.version}${report.node.ok ? "" : " (need ≥ 22.12)"} · ` +
      `npx ${report.npx.available ? "found" : "MISSING"} · git ${report.git.isRepo ? "repo" : "not a repo"}`,
  );
  if (!c.exists) {
    console.log(`  config: none at ${c.path}`);
    console.log(`  docs detected: ${report.docs.detected.join(", ") || "(none — no .md/.mdx found)"}`);
    console.log("  → run `/notabene:setup` (or the notabene-setup skill) to configure.");
    return;
  }
  if (c.valid === false) {
    console.log(`  config: INVALID at ${c.path}\n    ${c.error}`);
    return;
  }
  console.log(`  config: ${c.path}`);
  console.log(
    `    roots: ${c.roots.map((r) => r.path).join(", ")} · format ${c.format} · review ${c.review} · host ${c.host}`,
  );
  console.log(
    `    store ${c.store} — ${
      report.store.exists
        ? `schema ${report.store.schemaVersion ?? "?"}, ${report.store.openComments} open`
        : "not created (run `notabene init`)"
    }`,
  );
  if (c.publish?.site) {
    console.log(`    publish: ${c.publish.site}${c.publish.base !== "/" ? c.publish.base : ""} (build --public)`);
  }
  const p = report.port;
  console.log(`    port ${p.number} ${p.free ? "free" : `busy → suggested ${p.suggested}`}`);
  const proto = report.protocol.present
    ? `protocol v${report.protocol.version ?? "?"}${report.protocol.current === false ? " (outdated)" : ""}`
    : "protocol MISSING";
  const agents = report.agents.block
    ? "AGENTS.md block"
    : report.agents.present
      ? "AGENTS.md (no block)"
      : "no AGENTS.md";
  console.log(
    `    agent entry: ${proto} · ${agents}${report.protocol.current === false ? " → run `notabene init`" : ""}`,
  );
}

// Per-consumer working dir (build/cache/pidfile/log) — stable for a given repo root, so
// `status`/`stop` recompute it and find the same daemon in a later session.
function workDirFor(root) {
  return path.join(os.tmpdir(), "notabene", createHash("sha1").update(root).digest("hex").slice(0, 16));
}

// `notabene lint [--json]` — validate inter-doc links against the ROUTE TRUTH of the
// LAST build (<workDir>/routes.json, written at astro:build:done by the route-truth
// integration — what Astro actually emitted, never a filesystem reconstruction).
// After a normal build it checks the review site; after `build --public` it also
// catches links from public pages into publish-scoped content — the public truth
// simply doesn't contain those routes. Scope v1: RELATIVE .md/.mdx links (the remark
// rewriter's exact domain); external/absolute/#anchor links are skipped — zero false
// positives is the contract.
async function doLint() {
  const workDir = workDirFor(repoRoot);
  const truthPath = path.join(workDir, "routes.json");
  if (!fs.existsSync(truthPath)) {
    console.error("notabene: no route truth yet — run `notabene build` (or `build --public`) first, then lint.");
    process.exit(2);
  }
  const truth = JSON.parse(fs.readFileSync(truthPath, "utf8"));
  const routes = new Set(truth.routes);

  // Resolved config + shared mapper — same env-then-dynamic-import pattern as doctor.
  process.env.NOTABENE_ROOT = repoRoot;
  process.env.NOTABENE_CONFIG = configPath;
  const appUrl = (rel) => pathToFileURL(path.join(APP_DIR, rel)).href;
  const cfg = await import(appUrl("src/config.mjs"));
  const { makeLinkMapper } = await import(appUrl("src/remark/rewrite-links.mjs"));
  const { checkLinks, globToRegExp } = await import(appUrl("src/lib/lint-links.mjs"));
  const { decode } = await import(appUrl("src/lib/i18n-content.mjs"));
  const mapper = makeLinkMapper({ roots: cfg.roots, i18n: cfg.i18n });

  const extRe = new RegExp(`\\.(${cfg.extensions.join("|")})$`, "i");
  const publishExcludeRes = (cfg.publish.exclude ?? []).map(globToRegExp);
  const fmPrivate = (text) => {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    return m != null && /^publish:\s*false\s*$/m.test(m[1]);
  };

  const diagnostics = [];
  let fileCount = 0;
  for (const root of cfg.roots) {
    // Public truth: publish-scoped sources aren't in the artifact — their links are moot.
    if (truth.publicMode && root.publish === false) continue;
    const excludeRes = root.exclude.map(globToRegExp);
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith(".")) continue; // .notabene, .git, editor droppings
        const abs = path.join(dir, e.name);
        // The store is data, not content — and it holds a `protocol.md`. Skipped here
        // like it is in the content glob (a store path needn't be dot-hidden).
        if (abs === cfg.storeAbs) continue;
        if (e.isDirectory()) {
          walk(abs);
          continue;
        }
        if (!extRe.test(e.name)) continue;
        const rel = path.relative(root.abs, abs).replace(/\\/g, "/");
        if (excludeRes.some((re) => re.test(rel))) continue;
        const canonicalId = decode(rel.replace(/\.(mdx?|markdown)$/i, ""), cfg.i18n).id;
        if (truth.publicMode && publishExcludeRes.some((re) => re.test(`${root.key}/${canonicalId}`))) continue;
        const text = fs.readFileSync(abs, "utf8");
        if (truth.publicMode && fmPrivate(text)) continue;
        fileCount += 1;
        const srcLocale = cfg.i18n.enabled ? mapper.localeOfFile(abs) : cfg.i18n.defaultLocale;
        for (const d of checkLinks({
          text,
          fromDir: path.dirname(abs),
          srcLocale,
          toRoute: mapper.toRoute,
          resolve: path.resolve,
          routes,
        })) {
          diagnostics.push({ file: path.relative(repoRoot, abs).replace(/\\/g, "/"), ...d });
        }
      }
    };
    walk(root.abs);
  }

  diagnostics.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  if (argv.includes("--json")) {
    const out = {
      version: 1,
      truth: { publicMode: truth.publicMode, generatedAt: truth.generatedAt },
      summary: { files: fileCount, broken: diagnostics.length },
      diagnostics,
    };
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  } else {
    for (const d of diagnostics) {
      const where = `${d.file}:${d.line}:${d.column}`;
      const detail =
        d.kind === "outside"
          ? "target is outside every declared space (dead link in the rendered site)"
          : `→ ${d.route} does not exist${d.suggestion ? ` — did you mean ${d.suggestion}?` : ""}`;
      console.log(`${where}  ${d.link}  ${detail}`);
    }
    const mode = truth.publicMode ? "public" : "normal";
    console.log(
      diagnostics.length === 0
        ? `notabene lint: ${fileCount} file(s), no broken internal links (${mode} build of ${truth.generatedAt}).`
        : `notabene lint: ${diagnostics.length} broken link(s) across ${fileCount} file(s) (${mode} build of ${truth.generatedAt}).`,
    );
  }
  process.exit(diagnostics.length > 0 ? 1 : 0);
}

// Shared Astro launch prep (used by `runAstro` and `buildForPdf`): resolve the Astro CLI
// entry, prepare a writable per-consumer outDir/cacheDir off the (possibly read-only)
// package, symlink node_modules beside it so the bundled server resolves deps, and build
// the env the app reads. See the long-form comments in the original `runAstro`.
function astroSetup() {
  // Astro's `exports` blocks deep subpaths → resolve the bin via package.json + `bin`.
  const astroPkgPath = require.resolve("astro/package.json");
  const astroPkg = JSON.parse(fs.readFileSync(astroPkgPath, "utf8"));
  const binRel = typeof astroPkg.bin === "string" ? astroPkg.bin : astroPkg.bin.astro;
  const astroBin = path.join(path.dirname(astroPkgPath), binRel);
  const workDir = workDirFor(repoRoot);
  fs.mkdirSync(workDir, { recursive: true });
  // Expose the real node_modules (the one holding astro) as a sibling of outDir so the
  // Node adapter's prerender step can resolve runtime deps by bare specifier. "junction"
  // works on Windows too.
  const realNodeModules = path.dirname(path.dirname(astroPkgPath));
  const nmLink = path.join(workDir, "node_modules");
  try {
    fs.unlinkSync(nmLink);
  } catch {
    /* not present yet */
  }
  try {
    fs.symlinkSync(realNodeModules, nmLink, "junction");
  } catch {
    /* best-effort: if it fails, Astro falls back to its default resolution */
  }
  const gitAuthor = process.env.NOTABENE_AUTHOR || gitUserName(repoRoot);
  const gitEmail = process.env.NOTABENE_AUTHOR_EMAIL || gitUserEmail(repoRoot);
  const env = {
    ...process.env,
    NOTABENE_ROOT: repoRoot,
    NOTABENE_CONFIG: configPath,
    // Public builds get their OWN outDir: a public build overwriting dist/ used to
    // leave `preview` (which expects dist/server/entry.mjs) broken until the next
    // normal build. Two dirs → the two artifacts coexist.
    NOTABENE_OUT_DIR: path.join(workDir, publicBuild ? "dist-public" : "dist"),
    NOTABENE_CACHE_DIR: path.join(workDir, "cache"),
    ...(gitAuthor ? { NOTABENE_AUTHOR: gitAuthor } : {}),
    ...(gitEmail ? { NOTABENE_AUTHOR_EMAIL: gitEmail } : {}),
    ...(exposeHost ? { NOTABENE_HOST: "1" } : {}),
    ...(publicBuild ? { NOTABENE_PUBLIC: "1" } : {}),
    ...(siteFlag && siteFlag !== true ? { NOTABENE_SITE: String(siteFlag) } : {}),
    ...(baseFlag && baseFlag !== true ? { NOTABENE_BASE: String(baseFlag) } : {}),
  };
  return { astroBin, workDir, env };
}

// Public build epilogue. Without an adapter the static artifact lands directly in
// <workDir>/dist; `--out` copies it to a stable consumer-side path (CI/deploy needs
// one — the hashed tmp workdir is not discoverable). Overwrite is opt-in by marker:
// a non-empty target is only replaced when it contains the marker file from a
// previous public build, so a typo'd --out can never delete user data.
const PUBLIC_MARKER = ".notabene-public-site";

// Remove _astro assets nothing references. Astro emits a chunk for every client
// script in the MODULE GRAPH, rendered or not — in public mode the review-app
// scripts (Comments/ReviewChrome/comments-client) become unreferenced files that
// would ship review code and /api/* paths to the public host. Generic sweep:
// iteratively drop any _astro file whose basename appears in no other emitted text
// file. Runtime-loaded chunks survive — their importers name them in plain text
// (mermaid's lazy chunks, CSS-referenced fonts, HTML-referenced images).
function pruneOrphanAssets(distDir) {
  const astroDir = path.join(distDir, "_astro");
  if (!fs.existsSync(astroDir)) return 0;
  const textExt = new Set([".html", ".js", ".mjs", ".css", ".json", ".xml", ".txt", ".md", ".svg"]);
  const walk = (dir, acc = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, acc);
      else acc.push(p);
    }
    return acc;
  };
  let removed = 0;
  // A dropped orphan can orphan the file it alone referenced → iterate to a fixpoint.
  for (let pass = 0; pass < 5; pass++) {
    const corpus = walk(distDir)
      .filter((p) => textExt.has(path.extname(p)))
      .map((p) => ({ p, text: fs.readFileSync(p, "utf8") }));
    const orphans = fs
      .readdirSync(astroDir)
      .map((n) => path.join(astroDir, n))
      .filter((a) => {
        const name = path.basename(a);
        return !corpus.some((c) => c.p !== a && c.text.includes(name));
      });
    if (orphans.length === 0) break;
    for (const o of orphans) {
      fs.unlinkSync(o);
      removed += 1;
    }
  }
  return removed;
}

// Static full-text search for the public artifact — Pagefind is an OPTIONAL peer dep
// (same contract as puppeteer for `notabene pdf`): installed → index the FINAL artifact
// (post-prune, so the index inherits its truth: private pages are structurally absent);
// missing → keep the built-in JSON search, with an install hint. Only doc pages carry
// `data-pagefind-body` (DocLayout, public mode), which scopes indexing to article content
// and excludes chrome, /print/**, 404 and space/site homes wholesale.
async function indexPublicSearch(distDir) {
  let pagefind;
  try {
    pagefind = await import("pagefind");
  } catch {
    console.log(
      "notabene: `pagefind` not installed — the public site keeps the built-in JSON search.\n" +
        "    npm i -D pagefind    # static full-text search (per-language stemming, excerpts)",
    );
    return;
  }
  // Mermaid sources are stashed in the HTML for client-side rendering — index noise.
  const { index, errors } = await pagefind.createIndex({ excludeSelectors: ["pre.mermaid"], verbose: false });
  if (!index) throw new Error(`pagefind createIndex: ${(errors ?? []).join("; ") || "failed"}`);
  const added = await index.addDirectory({ path: distDir });
  if (added.errors?.length) throw new Error(`pagefind addDirectory: ${added.errors.join("; ")}`);
  const written = await index.writeFiles({ outputPath: path.join(distDir, "pagefind") });
  if (written.errors?.length) throw new Error(`pagefind writeFiles: ${written.errors.join("; ")}`);
  await pagefind.close();
  console.log(`notabene: pagefind search index written (${added.page_count} file(s) scanned).`);
}

async function finishPublicBuild(workDir) {
  const distDir = path.join(workDir, "dist-public");
  const pruned = pruneOrphanAssets(distDir);
  if (pruned > 0) console.log(`notabene: pruned ${pruned} unreferenced asset(s) from the public artifact.`);
  // AFTER the prune (the sweep must never see — or drop — the search bundle).
  await indexPublicSearch(distDir);
  // Jekyll (classic gh-pages branch hosting) drops _astro/** without this. Inert elsewhere.
  fs.writeFileSync(path.join(distDir, ".nojekyll"), "");
  const outFlag = flag("--out");
  if (!outFlag || outFlag === true) {
    console.log(`notabene: public site built at ${distDir} (pass --out <dir> to copy it into your repo).`);
    return;
  }
  const target = path.resolve(String(outFlag));
  if (target === repoRoot || repoRoot.startsWith(target + path.sep)) {
    fail(`--out ${target} contains the repo itself — pick a sub-directory (e.g. --out ./_site).`);
  }
  if (fs.existsSync(target)) {
    const entries = fs.readdirSync(target);
    if (entries.length > 0 && !entries.includes(PUBLIC_MARKER)) {
      fail(`--out ${target} exists and is not a previous public build — pick an empty or new directory.`);
    }
    fs.rmSync(target, { recursive: true, force: true });
  }
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(distDir, target, { recursive: true });
  fs.writeFileSync(
    path.join(target, PUBLIC_MARKER),
    "generated by `notabene build --public` — this directory is replaced on every build\n",
  );
  console.log(`notabene: public site written to ${target}`);
}

async function runAstro(astroCmd) {
  // Zero-config is opt-in (NOTABENE_ALLOW_DEFAULTS=1, set by the plugin forwarder): bare
  // `notabene dev` still fails with a useful message; config.mjs applies its defaults.
  const allowDefaults = process.env.NOTABENE_ALLOW_DEFAULTS === "1";
  if (!fs.existsSync(configPath) && !allowDefaults) {
    fail(`no config at ${configPath}. Run \`notabene init\` first (or pass --config).`);
  }
  if (publicBuild && astroCmd !== "build") {
    fail("--public applies to `notabene build` only (dev/preview always run the full review app).");
  }
  // Shared prep: Astro bin + writable outDir/cacheDir + node_modules symlink + env.
  const { astroBin, workDir, env } = astroSetup();
  const args = [astroBin, astroCmd, "--root", APP_DIR];
  // `dev` gets a DETERMINISTIC port: honor an explicit --port, else pre-probe a free one,
  // so Astro doesn't silently auto-increment and the pidfile's port stays authoritative.
  let devPort;
  if (astroCmd === "dev") {
    const explicit = flag("--port");
    devPort = explicit && explicit !== true ? Number(explicit) : await findFreePort(readPort(configPath));
    args.push("--port", String(devPort));
  }
  if (exposeHost) args.push("--host");

  // Detached daemon (`dev --detach`) — survives this process so `status`/`stop` work
  // across sessions. Idempotent: reuse a live daemon rather than starting a second one.
  if (astroCmd === "dev" && argv.includes("--detach")) {
    const existing = readPidfile(workDir);
    if (existing && isAlive(existing.pid) && (await canConnect(existing.port))) {
      console.log(`notabene: already running on http://127.0.0.1:${existing.port} (pid ${existing.pid}).`);
      process.exit(0);
    }
    if (existing) removePidfile(workDir);
    const logPath = path.join(workDir, "notabene.log");
    const out = fs.openSync(logPath, "a");
    // Own process group (`detached`) so `stop` can kill Astro + its Vite/esbuild workers;
    // stdio → a log file (a silent daemon leaves no trace if it crashes).
    const child = spawn(process.execPath, args, { detached: true, stdio: ["ignore", out, out], cwd: repoRoot, env });
    child.unref();
    writePidfile(workDir, { pid: child.pid, port: devPort, root: repoRoot, startedAt: new Date().toISOString() });
    const ready = await waitForPort(devPort);
    console.log(
      ready
        ? `notabene: review server on http://127.0.0.1:${devPort} (detached, pid ${child.pid}). Logs: ${logPath}`
        : `notabene: launched (pid ${child.pid}) but port ${devPort} isn't responding yet — check ${logPath}.`,
    );
    process.exit(0);
  }

  // Foreground (default) — tied to this terminal, as before. Public builds run from
  // the workDir: Astro's adapterless prerender stages its chunks under
  // <cwd>/.astro/.prerender, and the workDir has the node_modules symlink beside it
  // (same resolution trick as the adapter path) — the consumer repo is never written to.
  const spawnCwd = publicBuild ? workDir : repoRoot;
  const child = spawn(process.execPath, args, { stdio: "inherit", cwd: spawnCwd, env });
  child.on("exit", async (code) => {
    if ((code ?? 0) === 0 && publicBuild) {
      try {
        await finishPublicBuild(workDir);
      } catch (err) {
        fail(`public build epilogue failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    process.exit(code ?? 0);
  });
}

// `notabene status [--json]` — is the detached daemon for this repo alive AND answering?
// Reaps a stale pidfile (process gone). Returns `{ running, pid?, port?, url? }`.
async function doStatus() {
  const workDir = workDirFor(repoRoot);
  const info = readPidfile(workDir);
  const alive = !!info && isAlive(info.pid);
  if (info && !alive) removePidfile(workDir);
  const running = alive && (await canConnect(info.port));
  const out = running
    ? { running: true, pid: info.pid, port: info.port, url: `http://127.0.0.1:${info.port}`, root: info.root }
    : { running: false };
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return;
  }
  console.log(out.running ? `notabene: running (pid ${out.pid}) on ${out.url}` : "notabene: not running.");
}

// `notabene stop` — SIGTERM the detached daemon's process group, clear the pidfile.
function doStop() {
  const workDir = workDirFor(repoRoot);
  const info = readPidfile(workDir);
  if (!info) {
    console.log("notabene: nothing to stop (no daemon on record for this repo).");
    return;
  }
  if (!isAlive(info.pid)) {
    removePidfile(workDir);
    console.log("notabene: not running (cleaned a stale pidfile).");
    return;
  }
  const ok = stopGroup(info.pid);
  removePidfile(workDir);
  console.log(
    ok ? `notabene: stopped (pid ${info.pid}).` : `notabene: could not signal pid ${info.pid} (pidfile cleaned).`,
  );
}

// ── `notabene pdf` — high-fidelity PDF export via headless Chromium ──────────────────
// Renders the static /print route (built here) with Puppeteer (an OPTIONAL peer dep) to a
// PDF that carries a real bookmark outline (the navigable "menu"), running header/footer
// and page numbers — things browser print-to-PDF can't produce. The in-browser "Export
// PDF" button needs none of this; this is the reproducible, CI-friendly artifact.

// --scope value (+ optional --locale) → /print URL.
//   doc | space:<key> | folder:<key>/<path> | page:<key>/<id>
// `--locale <loc>` prefixes doc/space/folder with the language token (omit it for the
// default locale). A page scope encodes the locale in its id, so the token is not added.
function scopeToUrl(scope, locale) {
  const tok = locale ? `${locale}/` : "";
  if (scope === "doc") return locale ? `/print/${locale}` : "/print";
  const m = scope.match(/^(space|folder|page):(.+)$/);
  if (!m) {
    fail(`--scope must be one of: doc | space:<key> | folder:<key>/<path> | page:<key>/<id> (got "${scope}")`);
  }
  const rest = m[2].replace(/^\/+|\/+$/g, "");
  if (m[1] === "page") return `/print/page/${rest}`;
  return `/print/${tok}${m[1]}/${rest}`;
}

// Best-effort path to a system Chrome/Chromium/Edge (for puppeteer-core, which ships no
// browser). Full `puppeteer` bundles its own, so this is only a fallback.
function detectChrome() {
  const byPlatform = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    win32: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ],
  };
  return (byPlatform[process.platform] || []).find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

// Minimal read-only static server over the built client dir (loopback, ephemeral port).
// Maps a directory request to its index.html; refuses paths that escape the root.
function serveStatic(clientDir) {
  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".ico": "image/x-icon",
    ".map": "application/json",
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
        let file = path.resolve(clientDir, `.${rel}`);
        if (file !== clientDir && !file.startsWith(clientDir + path.sep)) {
          res.writeHead(403).end();
          return;
        }
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
        if (!fs.existsSync(file)) {
          res.writeHead(404).end("Not found");
          return;
        }
        res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
      } catch {
        res.writeHead(500).end();
      }
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

// Build the site into the writable workdir and return its client dir (static /print pages).
function buildForPdf() {
  const { astroBin, workDir, env } = astroSetup();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [astroBin, "build", "--root", APP_DIR], {
      stdio: "inherit",
      cwd: repoRoot,
      env,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(path.join(workDir, "dist", "client"))
        : reject(new Error(`astro build failed (exit ${code})`)),
    );
  });
}

async function doPdf() {
  const allowDefaults = process.env.NOTABENE_ALLOW_DEFAULTS === "1";
  if (!fs.existsSync(configPath) && !allowDefaults) {
    fail(`no config at ${configPath}. Run \`notabene init\` first (or pass --config).`);
  }

  // Puppeteer is an OPTIONAL peer dep — lazy-load `puppeteer` (bundles Chromium) or
  // `puppeteer-core` (needs a system Chrome). Absent → a helpful install hint, not a crash.
  let puppeteer;
  for (const mod of ["puppeteer", "puppeteer-core"]) {
    try {
      puppeteer = require(mod);
      break;
    } catch {
      /* not installed — try the next */
    }
  }
  if (!puppeteer) {
    fail(
      "`notabene pdf` needs Puppeteer (an optional dependency). Install one:\n" +
        "    npm i -D puppeteer         # bundles Chromium (simplest)\n" +
        "    npm i -D puppeteer-core    # then pass --chrome <path> or set PUPPETEER_EXECUTABLE_PATH\n" +
        "  (The in-browser “Export PDF” button needs none of this — `pdf` is the high-fidelity artifact.)",
    );
  }

  const scope = flag("--scope") && flag("--scope") !== true ? String(flag("--scope")).trim() : "doc";
  const localeFlag = flag("--locale") && flag("--locale") !== true ? String(flag("--locale")).trim() : undefined;
  const urlPath = scopeToUrl(scope, localeFlag);
  const outFlag = flag("--out");
  const outPath = path.resolve(
    repoRoot,
    outFlag && outFlag !== true
      ? String(outFlag)
      : `notabene-${[scope, localeFlag].filter(Boolean).join("-").replace(/[:/]+/g, "-")}.pdf`,
  );
  const chromePath =
    (flag("--chrome") && flag("--chrome") !== true && String(flag("--chrome"))) ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    detectChrome();

  console.log(`notabene: building the site for PDF export (scope ${scope})…`);
  const clientDir = await buildForPdf();
  const { server, port } = await serveStatic(clientDir);
  const url = `http://127.0.0.1:${port}${urlPath}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    console.log(`notabene: rendering ${url} …`);
    await page.goto(url, { waitUntil: "networkidle0", timeout: 90_000 });
    // print.ts flips this once Mermaid diagrams are rendered and the page is capture-ready.
    await page.waitForSelector("body[data-pg-ready]", { timeout: 90_000 }).catch(() => {});
    await page.pdf({
      path: outPath,
      printBackground: true,
      preferCSSPageSize: true, // honor the @page { size; margin } from PrintLayout
      tagged: true, // required for the bookmark outline
      outline: true, // real PDF bookmark tree from the heading structure (the "menu")
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#8a929e;text-align:center;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
  } catch (err) {
    fail(`PDF render failed: ${err instanceof Error ? err.message : err}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`notabene: wrote ${path.relative(repoRoot, outPath) || outPath} (${kb} KB).`);
}

switch (cmd) {
  case "doctor":
    doDoctor().catch((e) => fail(e instanceof Error ? e.message : String(e)));
    break;
  case "init":
    doInit().catch((e) => fail(e instanceof Error ? e.message : String(e)));
    break;
  case "dev":
  case "build":
  case "preview":
    runAstro(cmd).catch((e) => fail(e instanceof Error ? e.message : String(e)));
    break;
  case "status":
    doStatus().catch((e) => fail(e instanceof Error ? e.message : String(e)));
    break;
  case "stop":
    doStop();
    break;
  case "lint":
    doLint().catch((e) => fail(e instanceof Error ? e.message : String(e)));
    break;
  case "pdf":
    doPdf().catch((e) => fail(e instanceof Error ? e.message : String(e)));
    break;
  case "migrate":
    doMigrate();
    break;
  case "comments": {
    const sub = {
      ls: () => Promise.resolve(doCommentsLs()),
      done: doCommentsDone,
      reopen: doCommentsReopen,
      verify: doCommentsVerify,
    }[argv[1]];
    if (!sub) {
      console.error(
        "usage: notabene comments ls [--open] [--json] [--page <p>]\n" +
          "       notabene comments done <id…> [--note <text>] [--journal <entryId>] [--status …] [--force]\n" +
          "       notabene comments reopen <id…> [--reply <text>] [--author <name>]\n" +
          "       notabene comments verify [--json]",
      );
      process.exit(1);
    }
    sub().catch((e) => fail(e instanceof Error ? e.message : String(e)));
    break;
  }
  case "journal":
    if (argv[1] === "add") doJournalAdd();
    else {
      console.error("usage: notabene journal add   (reads a JSON entry on stdin)");
      process.exit(1);
    }
    break;
  case "protocol":
    doProtocol();
    break;
  default:
    console.log(
      "notabene — docs review tool\n\n" +
        "  notabene doctor          read-only state as JSON  [--json]\n" +
        "  notabene init            write notabene.config.mjs + create the store  [--detect]\n" +
        "                           also writes <store>/protocol.md + the AGENTS.md block\n" +
        "                           [--no-protocol] [--no-agents-md]\n" +
        "  notabene dev             start the review server over this repo's docs  [--port N] [--detach]\n" +
        "  notabene status          is the detached server running?  [--json]\n" +
        "  notabene stop            stop the detached server\n" +
        "  notabene build           build the site (Node standalone)\n" +
        "                           [--public [--site URL] [--base /sub] [--out DIR]]  read-only static site\n" +
        "  notabene preview         serve the built site\n" +
        "  notabene lint            check inter-doc links against the last build  [--json]\n" +
        "  notabene pdf             export a PDF (headless Chromium)  [--scope doc|space:K|folder:K/P|page:K/I] [--locale L] [--out F] [--chrome P]\n" +
        "  notabene migrate         convert the store to one file per comment (schemaVersion 3)\n" +
        "  notabene comments ls     list comments  [--open] [--json] [--page <p>]\n" +
        "  notabene comments done   mark comment(s) handled (status from `review`)  [--note] [--journal] [--status] [--force]\n" +
        "  notabene comments reopen send comment(s) back to open  [--reply <text>] [--author <name>]\n" +
        "  notabene comments verify audit store↔journal coherence  [--json]  (exit 1 on errors)\n" +
        "  notabene journal add     append a JSON journal entry from stdin  [--json]\n" +
        "  notabene protocol        print the agent protocol  [--path] [--write]\n\n" +
        "Flags: --config <path>  --root <path>  --host",
    );
    process.exit(cmd ? 1 : 0);
}
