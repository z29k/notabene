// Server side of the in-page editor: read a page's source, splice one block, write it
// back atomically. Server-only (fs/child_process); the decision logic it leans on is pure
// (lib/md-splice.ts) and the path resolution is the existing, containment-guarded
// lib/page-file.ts — this file adds no new way to name a file.
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { REPO_ROOT, roots } from "../config.mjs";
import { extractLinks, stripCode } from "./lint-links.mjs";
import { pageFile } from "./page-file";

const execFileP = promisify(execFile);

export interface BodySpan {
  /** Offset in `raw` where the parsed body begins. */
  start: number;
  /** Its length, i.e. `body.length`. */
  length: number;
}

/**
 * Where the body remark parsed sits inside the raw file — the base every `data-nb-src`
 * offset is relative to.
 *
 * Astro's markdown entry type builds it as `parseFrontmatter(raw).content.trim()`
 * (astro/dist/vite-plugin-markdown/content-entry-type.js). Two things are removed, in
 * that order: one contiguous frontmatter chunk, then the surrounding whitespace. Since
 * whatever precedes the frontmatter is itself whitespace (the delimiter regex only
 * allows `^\s*\n` before it), the trim always starts at or after the chunk — so the body
 * is a single unbroken slice of `raw` and the base is one constant.
 *
 * Pure: `stripped` is injected so this is testable without the Astro import.
 */
export function bodySpan(raw: string, stripped: string): BodySpan {
  const cut = raw.length - stripped.length; // frontmatter chunk, 0 when there is none
  const lead = stripped.length - stripped.trimStart().length;
  return { start: lead + cut, length: stripped.trim().length };
}

/** Rebuild a whole file from a new body, keeping frontmatter and trailing newline verbatim. */
export function withBody(raw: string, nextBody: string, span: BodySpan): string {
  return raw.slice(0, span.start) + nextBody + raw.slice(span.start + span.length);
}

/** Short content hash — advisory only (the UI warns "changed elsewhere"), never a gate. */
export function hashOf(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

export interface PageSource {
  /** Absolute path on disk. */
  file: string;
  /** Repo-relative path (what the UI and git speak). */
  rel: string;
  raw: string;
  /** Exactly what remark parsed — `data-nb-src` offsets index THIS string. */
  body: string;
  span: BodySpan;
  hash: string;
}

/** Resolve + read a logical page. null = no such page under any root. */
export async function readPageSource(page: string): Promise<PageSource | null> {
  const file = pageFile(page);
  if (!file) return null;
  const raw = await fs.readFile(file, "utf8");
  const span = bodySpan(raw, parseFrontmatter(raw).content);
  return {
    file,
    rel: path.relative(REPO_ROOT, file).split(path.sep).join("/"),
    raw,
    body: raw.slice(span.start, span.start + span.length),
    span,
    hash: hashOf(raw),
  };
}

/** Atomic write (temp + rename), so a concurrent reader never sees a half file. */
export async function writePageSource(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now().toString(36)}.tmp`;
  try {
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

/**
 * Is this file tracked by git? The editor writes real content, and git is the only undo
 * it can offer — `notabene dev` does not require a repo, so without this an edit outside
 * one (or of a file the agent just created and never added) is unrecoverable.
 */
export async function isTracked(file: string): Promise<boolean> {
  try {
    await execFileP("git", ["-C", REPO_ROOT, "ls-files", "--error-unmatch", "--", file]);
    return true;
  } catch {
    return false;
  }
}

export interface LinkWarning {
  link: string;
  line: number;
}

/**
 * Relative doc links in the written block that point at no file on disk.
 *
 * An agent pass ends with a build + `notabene lint`; a human editing in the page ends with
 * nothing, and a typo'd `./guide.md` renders as a dead link nobody notices until CI. This
 * is deliberately NOT lint: no route truth is consulted (dev may never have built), only
 * "does the target file exist". Cheap, zero false positives, non-blocking. `notabene lint`
 * remains the exhaustive check. Pure — `exists` and the extension list are injected.
 */
export function checkBlockLinks(
  markdown: string,
  fromDir: string,
  extensions: string[],
  exists: (p: string) => boolean = fsSync.existsSync,
): LinkWarning[] {
  const out: LinkWarning[] = [];
  for (const { target, line } of extractLinks(stripCode(markdown))) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // external scheme
    if (target.startsWith("/") || target.startsWith("#")) continue; // absolute / anchor
    const hash = target.indexOf("#");
    const file = hash === -1 ? target : target.slice(0, hash);
    if (!file) continue;
    const extPattern = new RegExp(`\\.(${extensions.join("|")})$`, "i");
    if (!extPattern.test(file)) continue; // only doc-to-doc links are in scope
    if (!exists(path.resolve(fromDir, decodeURIComponent(file)))) out.push({ link: target, line });
  }
  return out;
}

/** Image types a paste may write into the repo. Deliberately narrower than ASSET_EXTENSIONS. */
export const PASTE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"];

/**
 * A safe, collision-free file name for a pasted image, INSIDE the page's own directory.
 * Pure. The name is slugged (never trusted) and suffixed with a content hash, so pasting
 * the same screenshot twice reuses one file and two different ones never collide.
 */
export function pasteName(filename: string, bytes: Buffer | Uint8Array): string | null {
  const ext = (/\.([a-z0-9]+)$/i.exec(String(filename ?? "")) ?? [])[1]?.toLowerCase();
  if (!ext || !PASTE_EXTENSIONS.includes(ext)) return null;
  const stem =
    String(filename)
      .slice(0, -(ext.length + 1))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "image";
  const digest = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  return `${stem}-${digest}.${ext}`;
}

/** The space a page belongs to, or null — used for the per-root `edit: false` opt-out. */
export function rootForPage(page: string): (typeof roots)[number] | null {
  const ordered = [...roots].sort((a, b) => b.path.length - a.path.length);
  return ordered.find((r) => page === r.path || page.startsWith(`${r.path}/`)) ?? null;
}
