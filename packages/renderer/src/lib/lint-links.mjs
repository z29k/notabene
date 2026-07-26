// Internal-link lint — pure helpers for `notabene lint` (bin). Raw-Node importable
// on purpose (the CLI runs outside Vite): no astro:*, no TypeScript imports.
//
// Scope (v1, documented): RELATIVE `.md`/`.mdx`/`.markdown` links only — the exact
// set the remark rewriter turns into routes, so source and site can't disagree.
// External links, absolute paths and #anchors are skipped: the guiding rule
// (learned from nimbus) is ZERO false positives — a link checker you can't trust
// is worse than none.

/** Length-preserving blank-out of fenced blocks and inline code, so link regexes
 *  never fire inside code and byte offsets keep mapping to real lines. */
export function stripCode(text) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  return text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank).replace(/`[^`\n]*`/g, blank);
}

/** Markdown link targets with their 1-based line/column: inline `[x](t)` (title
 *  tolerated) + reference definitions `[x]: t`. Runs on stripCode() output. */
export function extractLinks(text) {
  const out = [];
  const push = (target, index) => {
    const before = text.slice(0, index);
    const line = before.split("\n").length;
    const column = index - before.lastIndexOf("\n");
    out.push({ target, line, column });
  };
  for (const m of text.matchAll(/\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
    push(m[1], m.index + m[0].indexOf(m[1]));
  }
  for (const m of text.matchAll(/^[ \t]*\[[^\]]+\]:[ \t]+(\S+)/gm)) {
    push(m[1], m.index + m[0].indexOf(m[1]));
  }
  return out;
}

/** Two-row Levenshtein — small inputs (routes), no need for anything fancier. */
export function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Closest candidate within maxDist edits, or null — the "did you mean" half. */
export function suggest(target, candidates, maxDist = 3) {
  let best = null;
  let bestD = maxDist + 1;
  for (const c of candidates) {
    const d = levenshtein(target, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD <= maxDist ? best : null;
}

/** Minimal glob → RegExp (same semantics as lib/public-filter): `*` within a
 *  segment, `**` across. Used for roots[].exclude + publish.exclude matching. */
export function globToRegExp(glob) {
  const seg = (s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${glob.split("**").map(seg).join(".*")}$`);
}

/**
 * Check one file's links. Everything is injected so this stays pure and testable:
 *   text      — the file's raw source
 *   fromDir   — its directory (absolute)
 *   srcLocale — its content locale (mapper input)
 *   toRoute   — makeLinkMapper().toRoute
 *   resolve   — path.resolve (injected for tests)
 *   routes    — Set of base-less emitted routes (the route truth)
 * Returns diagnostics: { line, column, link, kind: "missing"|"outside", route?, suggestion? }.
 */
export function checkLinks({ text, fromDir, srcLocale, toRoute, resolve, routes }) {
  const diags = [];
  const stripped = stripCode(text);
  for (const { target, line, column } of extractLinks(stripped)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // external (http:, mailto:, …)
    if (target.startsWith("/") || target.startsWith("#")) continue; // absolute/anchor: out of scope v1
    const hashIdx = target.indexOf("#");
    const file = hashIdx === -1 ? target : target.slice(0, hashIdx);
    if (!/\.(mdx?|markdown)$/i.test(file)) continue; // only doc-to-doc links
    const abs = resolve(fromDir, file);
    const route = toRoute(abs, srcLocale);
    if (route == null) {
      // The rewriter leaves it untouched → the rendered site serves a dead relative URL.
      diags.push({ line, column, link: target, kind: "outside" });
      continue;
    }
    if (!routes.has(route)) {
      const suggestion = suggest(route, [...routes]);
      diags.push({ line, column, link: target, kind: "missing", route, ...(suggestion ? { suggestion } : {}) });
    }
  }
  return diags;
}
