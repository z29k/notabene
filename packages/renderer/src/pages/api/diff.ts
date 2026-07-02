import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { APIRoute } from "astro";
import { REPO_ROOT } from "../../config.mjs";
import { pageFile } from "../../lib/page-file";
import { hostnameOf, isLoopbackHostname } from "../../lib/write-guard";

// Working-tree diff for the two-phase review UI: `git diff HEAD -- <files>` = everything
// not yet committed (= the agent's pass, since review happens before committing).
export const prerender = false;

const execFileP = promisify(execFile);
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

// Dev-only (running git against the consumer repo is a dev-review action). No cross-origin
// concern for a GET (CORS blocks reading the response), but require a loopback Host in
// loopback mode to defeat DNS-rebinding exfil — same posture as the write guard.
const WRITABLE = import.meta.env.DEV || process.env.NOTABENE_ALLOW_WRITE === "1";
const HOST_MODE = process.env.NOTABENE_HOST === "1";

/** Split a combined `git diff` into per-file sections keyed by repo-relative (b/) path. */
function splitDiffByFile(diff: string): Map<string, string> {
  const out = new Map<string, string>();
  let current: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current) out.set(current, buf.join("\n"));
  };
  for (const line of diff.split("\n")) {
    const m = line.match(/^diff --git a\/(?:.+?) b\/(.+)$/);
    if (m) {
      flush();
      current = m[1];
      buf = [line];
    } else if (current) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!WRITABLE) return json({ error: "diff API disabled outside dev" }, 403);
  if (!HOST_MODE && !isLoopbackHostname(hostnameOf(request.headers.get("host")))) {
    return json({ error: "diff refused: non-loopback Host" }, 403);
  }

  const pages = url.searchParams.getAll("page").filter(Boolean);
  if (!pages.length) return json({ error: "page query param required" }, 400);

  // page → source file (deduped for a single git call), + repo-relative path for matching.
  const fileByPage = new Map<string, string | null>();
  for (const p of pages) fileByPage.set(p, pageFile(p));
  const files = [...new Set([...fileByPage.values()].filter((f): f is string => !!f))];
  const relByFile = new Map<string, string>();
  for (const f of files) relByFile.set(f, path.relative(REPO_ROOT, f).split(path.sep).join("/"));

  const unresolved = () => pages.map((page) => ({ page, file: null, diff: null, error: "unresolved" }));
  if (!files.length) return json(unresolved());

  let perFile: Map<string, string>;
  try {
    // `--` so a path can never be interpreted as a git option. execFile = no shell.
    const { stdout } = await execFileP("git", ["-C", REPO_ROOT, "diff", "--no-color", "HEAD", "--", ...files], {
      maxBuffer: 16 * 1024 * 1024,
    });
    perFile = splitDiffByFile(stdout);
  } catch {
    // git missing / not a repository → degrade; the UI falls back to the journal narrative.
    return json(
      pages.map((page) => ({
        page,
        file: relByFile.get(fileByPage.get(page) || "") ?? null,
        diff: null,
        error: "git",
      })),
    );
  }

  return json(
    pages.map((page) => {
      const abs = fileByPage.get(page);
      if (!abs) return { page, file: null, diff: null, error: "unresolved" };
      const rel = relByFile.get(abs) as string;
      return { page, file: rel, diff: perFile.get(rel) ?? "" }; // "" = no change
    }),
  );
};
