// `notabene doctor` core — a READ-ONLY state preflight for the setup tooling (the
// notabene-setup skill and the plugin forwarder route on its JSON). It is the single
// source of resolved defaults: it loads the consumer's config through src/config.mjs,
// so nothing downstream re-encodes a default. Kept Astro-free and glob-free (config.mjs
// only imports node:path/url; the docs walk is hand-rolled) so it stays fast and can run
// before anything heavy is loaded. Nothing here writes; re-run at will.
//
// Plain .mjs (not .ts) on purpose: bin/notabene.mjs runs under raw `node` and must import
// these helpers; the pure ones are also unit-tested from Vitest.
import { spawnSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

// Directories never worth scanning for docs (build outputs, VCS, deps, the store).
export const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "vendor",
  "target",
  "dist",
  "build",
  ".notabene",
  ".astro",
  ".cache",
  ".next",
  ".venv",
]);

/** `"22.12.0"` ≥ `[22, 12, 0]` ? — numeric field compare, tolerant of `-nightly` tails. */
export function isVersionAtLeast(version, [maj, min, pat]) {
  const [a = 0, b = 0, c = 0] = String(version)
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
  if (a !== maj) return a > maj;
  if (b !== min) return b > min;
  return c >= pat;
}

/** Is `cmd` resolvable on PATH? Cross-platform (honors PATHEXT on Windows), no spawn. */
export function hasOnPath(cmd) {
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const names =
    process.platform === "win32"
      ? (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").map((e) => cmd + e)
      : [cmd];
  for (const dir of dirs) {
    for (const name of names) {
      const full = path.join(dir, name);
      try {
        if (process.platform === "win32") {
          if (fs.existsSync(full)) return true;
        } else {
          fs.accessSync(full, fs.constants.X_OK);
          return true;
        }
      } catch {
        /* not in this dir */
      }
    }
  }
  return false;
}

/** Group repo-relative markdown paths by top-level directory (pure). Top-level files
 *  (e.g. a root `README.md`) are not a doc "folder" and are dropped. */
export function groupByTopDir(relPaths) {
  const dirs = new Set();
  for (const rel of relPaths) {
    const norm = String(rel).replace(/\\/g, "/");
    const slash = norm.indexOf("/");
    if (slash > 0) dirs.add(norm.slice(0, slash));
  }
  return [...dirs].sort((a, b) => a.localeCompare(b));
}

/** Recursive fs walk for markdown files (no glob dependency). Returns repo-relative
 *  paths. Skips EXCLUDED_DIRS and any dotdir; does not follow symlinked directories. */
export function findMarkdown(root, extensions = ["md", "mdx", "markdown"]) {
  const exts = new Set(extensions.map((e) => `.${String(e).toLowerCase()}`));
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
        if (EXCLUDED_DIRS.has(e.name) || e.name.startsWith(".")) continue;
        walk(full);
      } else if (e.isFile() && exts.has(path.extname(e.name).toLowerCase())) {
        out.push(path.relative(root, full));
      }
    }
  })(root);
  return out;
}

/** Doc folders detected under `root` — the candidate `roots[]` the skill confirms. */
export function detectDocs(root, extensions) {
  return groupByTopDir(findMarkdown(root, extensions));
}

/** Safe, path-free projection of resolved `roots` for the JSON contract — never leaks
 *  the `abs`/`baseUrl` (a URL object) / `pattern` that config.mjs computes. */
export function projectRoots(roots) {
  return (roots || []).map((r) => ({
    key: r.key,
    label: r.label,
    path: r.path,
    exclude: Array.isArray(r.exclude) ? r.exclude : [],
  }));
}

/** `{ exists, schemaVersion? }` for a store dir (schemaVersion from `<store>/meta.json`). */
export function readStoreState(storeAbs) {
  let exists = false;
  try {
    exists = fs.statSync(storeAbs).isDirectory();
  } catch {
    /* no store dir yet */
  }
  let schemaVersion;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(storeAbs, "meta.json"), "utf8"));
    if (typeof meta.schemaVersion === "number") schemaVersion = meta.schemaVersion;
  } catch {
    /* no / unreadable meta */
  }
  return { exists, schemaVersion };
}

/** Count the ACTIONABLE comments (open AND not on hold) in a store. Reads both v2
 *  (one file per comment) and legacy v1 (one array per page); mirrors the store
 *  contract so doctor stays self-contained. */
export function countOpenComments(storeAbs) {
  const reserved = new Set(["journal.json", "meta.json"]);
  let n = 0;
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
      if (!e.name.endsWith(".json") || (dir === storeAbs && reserved.has(e.name))) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(full, "utf8"));
      } catch {
        continue;
      }
      const arr = Array.isArray(data) ? data : data?.id ? [data] : [];
      for (const c of arr) {
        if (c && c.status === "open" && !c.hold) n++;
      }
    }
  })(storeAbs);
  return n;
}

/** Is a TCP port free to bind on `host`? */
export function isPortFree(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
}

/** First free port ≥ `start` (bounded search). Falls back to `start` if none found —
 *  the caller then lets Astro's own auto-increment take over. */
export async function findFreePort(start, host = "127.0.0.1", limit = 100) {
  for (let p = start; p < start + limit; p++) {
    if (await isPortFree(p, host)) return p;
  }
  return start;
}

function isGitRepo(root) {
  const r = spawnSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], {
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  });
  return !r.error && r.status === 0 && String(r.stdout).trim() === "true";
}

// Load the RESOLVED config through src/config.mjs (the single source of defaults). Env
// must be set before the import — config.mjs reads NOTABENE_ROOT/NOTABENE_CONFIG at
// module-eval (top-level await). Imported dynamically (never statically) so a missing
// config only throws here, where buildReport catches it → `valid:false`.
async function loadResolvedConfig({ repoRoot, configPath }) {
  process.env.NOTABENE_ROOT = repoRoot;
  process.env.NOTABENE_CONFIG = configPath;
  return import(new URL("../config.mjs", import.meta.url).href);
}

/**
 * Assemble the doctor report. READ-ONLY. Shape is a public contract the setup skill
 * routes on. `config`/`store`/`port` are only populated when a config RESOLVES;
 * `docs.detected` only when there is no config yet (the skill re-runs doctor after
 * writing one to get the resolved port/store).
 */
export async function buildReport({ repoRoot, configPath }) {
  const report = {
    node: { version: process.versions.node, ok: isVersionAtLeast(process.versions.node, [22, 12, 0]) },
    npx: { available: hasOnPath("npx") },
    git: { isRepo: isGitRepo(repoRoot) },
    config: { path: configPath, exists: fs.existsSync(configPath) },
  };

  if (!report.config.exists) {
    report.docs = { detected: detectDocs(repoRoot) };
    return report;
  }

  let cfg;
  try {
    cfg = await loadResolvedConfig({ repoRoot, configPath });
  } catch (err) {
    report.config.valid = false;
    report.config.error = err instanceof Error ? err.message : String(err);
    return report;
  }

  Object.assign(report.config, {
    valid: true,
    store: cfg.storeRel,
    roots: projectRoots(cfg.roots),
    format: cfg.format,
    port: cfg.port,
    host: cfg.host,
    review: cfg.reviewMode,
  });

  report.store = { ...readStoreState(cfg.storeAbs), openComments: countOpenComments(cfg.storeAbs) };

  const free = await isPortFree(cfg.port);
  report.port = { number: cfg.port, free, suggested: free ? cfg.port : await findFreePort(cfg.port + 1) };

  return report;
}
