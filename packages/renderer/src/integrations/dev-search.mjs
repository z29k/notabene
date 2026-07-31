// DEV full-text search — the same optional Pagefind engine as `build --public`, fed
// WITHOUT a build: `addCustomRecord` indexes the live content straight from the dev
// server's own `/search-index.json` (an on-demand endpoint rendered from the real
// collections → always fresh, ids/routes/locales/titles already resolved — no
// filesystem re-derivation, no staleness watcher). A Vite middleware serves the
// bundle under `/pagefind/` (dev has no `base` — astro.config sets one only in
// public mode). `pagefind` missing → 404 + a one-time hint; the client's probe
// falls back to the JSON engine. Quality note vs public: custom records carry no
// heading anchors, so per-section sub-results are public-only.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT } from "../config.mjs";
import { resolveBundlePath, searchContentType } from "../lib/dev-search.mjs";

export function notabeneDevSearch() {
  // Stable per-consumer scratch home (mirrors the CLI's workDir hashing).
  const home = path.join(
    os.tmpdir(),
    "notabene-dev-search",
    createHash("sha1").update(REPO_ROOT).digest("hex").slice(0, 16),
  );
  /** Directory of the bundle currently served (versioned per index build — swapping
   *  the pointer is atomic, so in-flight chunk reads of the old bundle stay valid). */
  let currentDir = null;
  let currentHash = "";
  let building = null;
  let hinted = false;

  async function ensureIndex(server) {
    if (building) return building;
    building = (async () => {
      const addr = server.httpServer?.address();
      const port = typeof addr === "object" && addr ? addr.port : null;
      if (!port) throw new Error("dev server not listening yet");
      // Self-fetch (loopback, never the Host header) — the single source of truth.
      const res = await fetch(`http://127.0.0.1:${port}/search-index.json`);
      if (!res.ok) throw new Error(`search-index.json → HTTP ${res.status}`);
      const body = await res.text();
      const hash = createHash("sha1").update(body).digest("hex").slice(0, 12);
      if (hash === currentHash && currentDir && fs.existsSync(path.join(currentDir, "pagefind-entry.json"))) return;

      let pagefind;
      try {
        pagefind = await import("pagefind");
      } catch (err) {
        // "Not installed" is the EXPECTED failure (optional peer dep) — but it must not
        // become the explanation for every failure: an unrelated loader error here once
        // masqueraded as a missing package for a long, wasted debugging session. Report
        // anything else verbatim.
        const missing =
          err?.code === "ERR_MODULE_NOT_FOUND" || /cannot find (package|module)/i.test(err?.message ?? "");
        if (!hinted) {
          hinted = true;
          console.log(
            missing
              ? "notabene: `pagefind` not installed — dev search keeps the built-in JSON index.\n" +
                  "    npm i -D pagefind    # full-text search (stemming, excerpts) in dev + public builds"
              : `notabene: dev search could not load \`pagefind\` — keeping the built-in JSON index.\n    ${err?.message ?? err}`,
          );
        }
        throw new Error(missing ? "pagefind not installed" : `pagefind failed to load: ${err?.message ?? err}`);
      }
      const { index, errors } = await pagefind.createIndex({ verbose: false });
      if (!index) throw new Error(`pagefind createIndex: ${(errors ?? []).join("; ") || "failed"}`);
      const docs = JSON.parse(body);
      for (const d of docs) {
        // Title prepended: a frontmatter-only title (no H1 in the body) must still match.
        await index.addCustomRecord({
          url: String(d.href),
          content: `${d.title}\n\n${d.text || ""}`,
          language: d.locale || undefined,
          meta: { title: String(d.title), space: String(d.space) },
        });
      }
      const next = path.join(home, `pagefind-${hash}`);
      fs.rmSync(next, { recursive: true, force: true });
      const written = await index.writeFiles({ outputPath: next });
      if (written.errors?.length) throw new Error(`pagefind writeFiles: ${written.errors.join("; ")}`);
      await pagefind.close();
      // Swap, then drop superseded bundles (never the one we just left mid-request).
      const previous = currentDir;
      currentDir = next;
      currentHash = hash;
      if (fs.existsSync(home)) {
        for (const entry of fs.readdirSync(home)) {
          const p = path.join(home, entry);
          if (p !== next && p !== previous) fs.rmSync(p, { recursive: true, force: true });
        }
      }
    })().finally(() => {
      building = null;
    });
    return building;
  }

  return {
    name: "notabene-dev-search",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(async (req, res, next) => {
          const url = (req.url || "").split("?")[0];
          if (!url.startsWith("/pagefind/")) return next();
          if (req.method !== "GET" && req.method !== "HEAD") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const sub = url.slice("/pagefind/".length);
          // Engine bootstrap files (re)build the index; chunk requests always serve
          // the bundle the running engine was initialized against (a mid-search swap
          // would 404 the hashes the client already holds).
          if (sub === "pagefind.js" || sub === "pagefind-entry.json") {
            try {
              await ensureIndex(server);
            } catch {
              res.statusCode = 404;
              res.end();
              return;
            }
          }
          const file = currentDir ? resolveBundlePath(currentDir, sub) : null;
          if (!file || !fs.existsSync(file)) {
            res.statusCode = 404;
            res.end();
            return;
          }
          res.setHeader("content-type", searchContentType(file));
          res.setHeader("cache-control", "no-store");
          if (req.method === "HEAD") {
            res.end();
            return;
          }
          res.end(fs.readFileSync(file));
        });
      },
    },
  };
}
