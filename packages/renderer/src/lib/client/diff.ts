// Unified-diff parsing + rendering for the review UI. Pure parse (testable); the two
// views (unified / side-by-side) consume the same parsed structure. Browser-side.
import { esc } from "./comments-client";

export type DiffMode = "unified" | "split";
export type DiffLine = { type: "hunk" | "add" | "del" | "ctx"; text: string };
export interface SideRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

const SKIP = /^(diff --git |index |--- |\+\+\+ |new file|deleted file|old mode|new mode|similarity |rename |\\)/;

/** Parse a unified diff into typed lines (file headers dropped, `@@` kept, markers stripped). */
export function parseUnifiedDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("@@")) lines.push({ type: "hunk", text: raw });
    else if (SKIP.test(raw)) continue;
    else if (raw.startsWith("+")) lines.push({ type: "add", text: raw.slice(1) });
    else if (raw.startsWith("-")) lines.push({ type: "del", text: raw.slice(1) });
    else if (raw.startsWith(" ")) lines.push({ type: "ctx", text: raw.slice(1) });
    // trailing empty line etc. → ignored
  }
  return lines;
}

/** Pair deletions with the following additions for a side-by-side view. */
export function toSideBySide(lines: DiffLine[]): SideRow[] {
  const rows: SideRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.type === "hunk" || l.type === "ctx") {
      rows.push({ left: l, right: l });
      i++;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].type === "del") dels.push(lines[i++]);
    while (i < lines.length && lines[i].type === "add") adds.push(lines[i++]);
    if (!dels.length && !adds.length) {
      i++;
      continue;
    }
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) rows.push({ left: dels[k] ?? null, right: adds[k] ?? null });
  }
  return rows;
}

const sign = (t: DiffLine["type"]) => (t === "add" ? "+" : t === "del" ? "-" : " ");

/** Render a diff to an HTML table in the requested mode (empty string if no changes). */
export function renderDiff(diffText: string, mode: DiffMode): string {
  const lines = parseUnifiedDiff(diffText);
  if (!lines.length) return "";
  if (mode === "split") {
    const rows = toSideBySide(lines)
      .map((r) =>
        r.left?.type === "hunk"
          ? `<tr class="hunk"><td colspan="2">${esc(r.left.text)}</td></tr>`
          : `<tr><td class="${r.left?.type ?? "empty"}">${r.left ? esc(r.left.text) : ""}</td>` +
            `<td class="${r.right?.type ?? "empty"}">${r.right ? esc(r.right.text) : ""}</td></tr>`,
      )
      .join("");
    return `<table class="nb-diff nb-diff-split">${rows}</table>`;
  }
  const rows = lines
    .map((l) =>
      l.type === "hunk"
        ? `<tr class="hunk"><td>${esc(l.text)}</td></tr>`
        : `<tr class="${l.type}"><td><span class="sign">${sign(l.type)}</span>${esc(l.text)}</td></tr>`,
    )
    .join("");
  return `<table class="nb-diff nb-diff-unified">${rows}</table>`;
}

// Diff mode persisted across the app (both /review and /comments read/write it).
export function getDiffMode(): DiffMode {
  try {
    return localStorage.getItem("notabene:diffMode") === "split" ? "split" : "unified";
  } catch {
    return "unified";
  }
}
export function setDiffMode(mode: DiffMode): void {
  try {
    localStorage.setItem("notabene:diffMode", mode);
  } catch {
    /* localStorage unavailable */
  }
}
