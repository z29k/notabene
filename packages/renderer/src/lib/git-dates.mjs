// Last-updated dates from git history — the nimbus recipe, adapted: ONE streamed
// `git log` per process (spawn, not execFile — no maxBuffer ceiling on big
// histories), AUTHOR date (%at) so rebases don't churn the value, newest-first with
// first-sighting-wins, rename rows (`R100\told\tnew`) keyed on the NEW path, and
// silent degradation: no git / not a repo / any failure → every lookup is null.
// Server-only (spawns a process); consumed by [...path].astro at render time.
import { spawn } from "node:child_process";

/** Parse the streamed `git log --format=t:%at --name-status` output into a
 *  path → unix-seconds map (pure; unit-tested). First sighting wins. */
export function parseGitLog(text) {
  const dates = new Map();
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("t:")) {
      const t = Number(line.slice(2));
      current = Number.isFinite(t) ? t : null;
      continue;
    }
    if (current == null || line === "") continue;
    // Status rows: "M\tpath" · "A\tpath" · "R100\told\tnew" — the LAST tab field is
    // the path the file lives at after the commit.
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const p = parts[parts.length - 1];
    if (!dates.has(p)) dates.set(p, current);
  }
  return dates;
}

let bulkPromise = null;

/** Author-date map for every file under `pathspecs` (repo-relative), built once per
 *  process. Resolves to an empty Map on ANY failure — dates are decoration, never
 *  a build blocker. */
export function gitDates(repoRoot, pathspecs) {
  if (bulkPromise) return bulkPromise;
  bulkPromise = new Promise((resolve) => {
    let out = "";
    let child;
    try {
      child = spawn(
        "git",
        ["-c", "core.quotePath=false", "log", "--format=t:%at", "--name-status", "--", ...pathspecs],
        { cwd: repoRoot, stdio: ["ignore", "pipe", "ignore"] },
      );
    } catch {
      resolve(new Map());
      return;
    }
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("error", () => resolve(new Map()));
    child.on("close", (code) => resolve(code === 0 ? parseGitLog(out) : new Map()));
  });
  return bulkPromise;
}

/** Test seam: reset the per-process cache. */
export function resetGitDates() {
  bulkPromise = null;
}
