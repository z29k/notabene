// Comment store (server, dev-only). v2 layout: ONE FILE PER COMMENT at
// `<store>/<page>/<id>.json` — so two branches adding a comment to the same page touch
// different files and never conflict on merge. Readers stay backward-compatible with the
// v1 layout (one JSON array per page, `<store>/<page>.json`); any write migrates that page
// to v2 (`notabene migrate` converts eagerly). Store path from notabene.config (`store`,
// cf. src/config.mjs) — never hardcoded; the content glob excludes the store.
import fs from "node:fs/promises";
import path from "node:path";
import { author as defaultAuthor, storeAbs } from "../config.mjs";
import { assertStoreCompatible } from "./store-meta";
import { resolveStoreDir, resolveStorePath } from "./store-path";
import {
  type BlockAnchor,
  type Comment,
  type CommentAnchor,
  type CommentScope,
  type CommentSpace,
  type CommentStatus,
  SCHEMA_VERSION,
} from "./comment-types";

const STORE_ROOT = storeAbs;
// Reserved store files (never comment pages).
const RESERVED = new Set(["journal.json", "meta.json"]);

const legacyFileFor = (page: string): string => resolveStorePath(STORE_ROOT, page); // v1 array
const pageDirFor = (page: string): string => resolveStoreDir(STORE_ROOT, page); // v2 dir
const commentFileFor = (page: string, id: string): string =>
  path.join(pageDirFor(page), `${id.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);

async function read(page: string): Promise<Comment[]> {
  assertStoreCompatible();
  const out: Comment[] = [];
  // v2: one file per comment under <store>/<page>/ (skip sub-page dirs and non-json).
  try {
    const dir = pageDirFor(page);
    for (const name of await fs.readdir(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const c = JSON.parse(await fs.readFile(path.join(dir, name), "utf8"));
        if (c && !Array.isArray(c) && c.id) out.push(c as Comment);
      } catch {
        /* skip unreadable file */
      }
    }
  } catch {
    /* no v2 directory */
  }
  // v1 (legacy): the page-array file, if still present.
  try {
    const arr = JSON.parse(await fs.readFile(legacyFileFor(page), "utf8"));
    if (Array.isArray(arr)) out.push(...(arr as Comment[]));
  } catch {
    /* no v1 file */
  }
  return out;
}

// Keep the store's version sidecar in step with the renderer writing it: bump
// `<store>/meta.json` UP to SCHEMA_VERSION (never down) on write, so the read guard
// (store-meta) refuses this store from an OLDER renderer that can't read v3 block
// comments. Never rewrites an already-current/newer meta.
async function ensureMeta(): Promise<void> {
  const metaPath = path.join(STORE_ROOT, "meta.json");
  let current = 0;
  try {
    const m = JSON.parse(await fs.readFile(metaPath, "utf8"));
    if (typeof m.schemaVersion === "number") current = m.schemaVersion;
  } catch {
    /* no / unreadable meta — treat as pre-versioned */
  }
  if (current < SCHEMA_VERSION) {
    await fs.mkdir(STORE_ROOT, { recursive: true });
    await fs.writeFile(metaPath, `${JSON.stringify({ schemaVersion: SCHEMA_VERSION }, null, 2)}\n`, "utf8");
  }
}

// Write the page as v2 (one file per comment), atomically (tmp + rename so a reader —
// the agent — never sees a truncated file), and migrate away from any v1 array file.
async function write(page: string, comments: Comment[]): Promise<void> {
  await ensureMeta();
  const dir = pageDirFor(page);
  const legacy = legacyFileFor(page);
  const rmOwnCommentFiles = async (except?: Set<string>) => {
    try {
      for (const name of await fs.readdir(dir)) {
        // Only this page's own comment files — NEVER sub-page directories.
        if (name.endsWith(".json") && !except?.has(name)) await fs.rm(path.join(dir, name), { force: true });
      }
    } catch {
      /* no dir yet */
    }
  };
  if (comments.length === 0) {
    await rmOwnCommentFiles();
    await fs.rm(legacy, { force: true });
    await fs.rmdir(dir).catch(() => {}); // remove the dir only if now empty (no sub-pages)
    return;
  }
  await fs.mkdir(dir, { recursive: true });
  const keep = new Set<string>();
  for (const c of comments) {
    const f = commentFileFor(page, c.id);
    keep.add(path.basename(f));
    const tmp = `${f}.${process.pid}.${newId()}.tmp`;
    try {
      await fs.writeFile(tmp, `${JSON.stringify(c, null, 2)}\n`, "utf8");
      await fs.rename(tmp, f);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => {});
      throw err;
    }
  }
  await rmOwnCommentFiles(keep); // drop deleted comments
  await fs.rm(legacy, { force: true }); // the page is v2 now
}

function newId(): string {
  return `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function listComments(page: string): Promise<Comment[]> {
  return read(page);
}

/** All comments, all pages (for the global /comments view). */
export async function listAllComments(): Promise<Comment[]> {
  assertStoreCompatible();
  const out: Comment[] = [];
  async function walk(dir: string) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      // Reserved files (journal/meta) at the store root → skipped.
      else if (e.name.endsWith(".json") && !(dir === STORE_ROOT && RESERVED.has(e.name))) {
        try {
          const parsed = JSON.parse(await fs.readFile(full, "utf8"));
          if (Array.isArray(parsed))
            out.push(...(parsed as Comment[])); // v1 page array
          else if (parsed?.id) out.push(parsed as Comment); // v2 comment file
        } catch {
          /* ignore unreadable file */
        }
      }
    }
  }
  await walk(STORE_ROOT);
  return out;
}

export async function createComment(input: {
  space: CommentSpace;
  page: string;
  scope: CommentScope;
  anchor: CommentAnchor | BlockAnchor | null;
  author?: string;
  body: string;
}): Promise<Comment> {
  const comments = await read(input.page);
  const now = new Date().toISOString();
  const comment: Comment = {
    id: newId(),
    space: input.space,
    page: input.page,
    scope: input.scope,
    // Anchor is kept for `selection` (TextQuoteSelector) and `block` (BlockAnchor);
    // a `page` comment has none.
    anchor: input.scope === "page" ? null : input.anchor,
    thread: [{ author: input.author || defaultAuthor, body: input.body, ts: now }],
    status: "open",
    hold: false,
    resolution: null,
    createdAt: now,
    updatedAt: now,
  };
  comments.push(comment);
  await write(input.page, comments);
  return comment;
}

export async function patchComment(
  page: string,
  id: string,
  patch: {
    status?: CommentStatus;
    hold?: boolean;
    resolution?: { note: string; journalEntryId?: string } | null;
    reply?: { author?: string; body: string };
    edit?: { body: string };
  },
): Promise<Comment | null> {
  const comments = await read(page);
  const c = comments.find((x) => x.id === id);
  if (!c) return null;
  // Editing the original message: allowed ONLY if not yet processed (status open)
  // AND has no reply (thread = 1). Server-side enforcement.
  if (patch.edit?.body && c.status === "open" && c.thread.length === 1) {
    c.thread[0].body = patch.edit.body;
  }
  if (patch.status) c.status = patch.status;
  if (patch.hold !== undefined) c.hold = patch.hold;
  if (patch.resolution !== undefined) c.resolution = patch.resolution;
  if (patch.reply?.body) {
    c.thread.push({
      author: patch.reply.author || defaultAuthor,
      body: patch.reply.body,
      ts: new Date().toISOString(),
    });
  }
  c.updatedAt = new Date().toISOString();
  await write(page, comments);
  return c;
}

export async function removeComment(page: string, id: string): Promise<boolean> {
  const comments = await read(page);
  const next = comments.filter((x) => x.id !== id);
  if (next.length === comments.length) return false;
  await write(page, next);
  return true;
}
