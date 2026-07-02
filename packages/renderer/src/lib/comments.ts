// Comment store (server, dev-only). One JSON file per page at `<store>/<page>.json`
// (committed to git, readable by the agent). The store path comes from
// notabene.config (`store`, cf. src/config.mjs) — never hardcoded. The content glob
// excludes the store → it's never interpreted as content.
import fs from "node:fs/promises";
import path from "node:path";
import { author as defaultAuthor, storeAbs } from "../config.mjs";
import { assertStoreCompatible } from "./store-meta";
import { resolveStorePath } from "./store-path";
import type { Comment, CommentAnchor, CommentScope, CommentSpace, CommentStatus } from "./comment-types";

const STORE_ROOT = storeAbs;
// Reserved store files (never comment pages).
const RESERVED = new Set(["journal.json", "meta.json"]);

function fileFor(page: string): string {
  return resolveStorePath(STORE_ROOT, page);
}

async function read(page: string): Promise<Comment[]> {
  assertStoreCompatible();
  try {
    return JSON.parse(await fs.readFile(fileFor(page), "utf8")) as Comment[];
  } catch {
    return [];
  }
}

async function write(page: string, comments: Comment[]): Promise<void> {
  const f = fileFor(page);
  await fs.mkdir(path.dirname(f), { recursive: true });
  if (comments.length === 0) {
    await fs.rm(f, { force: true });
    return;
  }
  // Atomic write (tmp + rename). These files are read directly by the agent while
  // the dev server may be writing them → a reader must never observe a truncated
  // JSON. rename() is atomic within the same directory/filesystem. (Note: this
  // guarantees integrity, not last-writer-wins — concurrent read-modify-write on the
  // same page can still lose an update; a solo dev loop won't hit it in practice.)
  // The `.tmp` suffix keeps stray temp files out of the `*.json` store walkers.
  const tmp = `${f}.${process.pid}.${newId()}.tmp`;
  try {
    await fs.writeFile(tmp, `${JSON.stringify(comments, null, 2)}\n`, "utf8");
    await fs.rename(tmp, f);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
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
          out.push(...(JSON.parse(await fs.readFile(full, "utf8")) as Comment[]));
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
  anchor: CommentAnchor | null;
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
    anchor: input.scope === "selection" ? input.anchor : null,
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
