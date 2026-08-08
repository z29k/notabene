import path from "node:path";
import type { APIRoute } from "astro";
import { edit, extensions, storeAbs, verify } from "../../config.mjs";
import { resyncContent } from "../../integrations/content-resync.mjs";
import { listComments, patchComment } from "../../lib/comments";
import { appendEntry, newEntryId, normalizeEntry } from "../../lib/journal-write.mjs";
import { blockRanges, spliceBlock } from "../../lib/md-splice";
import { inferMdStyle } from "../../lib/md-style";
import {
  checkBlockLinks,
  hashOf,
  isTracked,
  readPageSource,
  rootForPage,
  withBody,
  writePageSource,
} from "../../lib/page-write";
import { hostnameOf, isLoopbackHostname, writeGuardVerdict } from "../../lib/write-guard";

// The in-page editor's read/write endpoint. Injected ONLY under `astro dev` (see
// src/integrations/editor.mjs), so it is absent from every build — normal, preview and
// public alike. The guards below are defence in depth for NOTABENE_ALLOW_WRITE runs.
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

const WRITABLE = import.meta.env.DEV || process.env.NOTABENE_ALLOW_WRITE === "1";
const HOST_MODE = process.env.NOTABENE_HOST === "1";
const TOKEN = process.env.NOTABENE_TOKEN || "";

/** Cap on a single block's replacement — a whole page is ~3 kB; 1 MB is absurdly generous. */
const MAX_BODY = 1024 * 1024;

const guardWrite = (request: Request): Response | null => {
  const v = writeGuardVerdict({
    writable: WRITABLE,
    hostMode: HOST_MODE,
    token: TOKEN,
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    tokenHeader: request.headers.get("x-notabene-token"),
  });
  return v.ok ? null : json({ error: v.reason }, v.status);
};

/** Serving a repo's source is a dev action too — same loopback posture as GET /api/diff. */
const guardRead = (request: Request): Response | null => {
  if (!WRITABLE) return json({ error: "editor API disabled outside dev" }, 403);
  if (!HOST_MODE && !isLoopbackHostname(hostnameOf(request.headers.get("host")))) {
    return json({ error: "refused: non-loopback Host" }, 403);
  }
  return null;
};

/** `edit: false` on the space wins over the global default. */
const editableRoot = (page: string) => rootForPage(page)?.edit !== false;

const intParam = (raw: string | null): number | null => {
  if (raw == null || !/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
};

export const GET: APIRoute = async ({ request, url }) => {
  const denied = guardRead(request);
  if (denied) return denied;

  const page = url.searchParams.get("page");
  if (!page) return json({ error: "page query param required" }, 400);

  const src = await readPageSource(page);
  if (!src) return json({ error: "not found" }, 404);

  const editable = edit.enabled && editableRoot(page);
  const base = { page, file: src.rel, hash: src.hash, editable };

  const start = intParam(url.searchParams.get("start"));
  const end = intParam(url.searchParams.get("end"));
  if (start == null || end == null) return json(base);
  if (start > end || end > src.body.length) return json({ error: "range out of bounds" }, 400);

  // The range comes from a `data-nb-src` stamp baked in at render time; the file may have
  // moved since (the agent writes, HMR hasn't run). Serving whatever now sits at those
  // offsets would hand the user someone else's text to edit — so require that the range
  // still aligns with real top-level block frontiers, and say "stale" when it does not.
  const blocks = blockRanges(src.body);
  const first = blocks.findIndex((b) => b.start === start);
  const last = blocks.findIndex((b) => b.end === end);
  if (first === -1 || last < first) {
    // We read the source from DISK, so a range that no longer lands on a block frontier
    // means the HTML that carried it predates the file. Usually the browser is simply
    // behind and a reload is enough — but when the dev server itself is serving a stale
    // render, reloading returns the same dangling stamps forever (see
    // integrations/content-resync.mjs). Heal the server before answering, and tell the
    // client which of the two it was, so the message can promise something that works.
    const resynced = resyncContent();
    return json({ ...base, error: "stale", resynced }, 409);
  }

  // `style` travels with the block so the rich editor serializes it the way the REST of
  // this file is written (lib/md-style.ts) — the difference between an invisible edit and
  // a diff full of re-flowed list markers. `next` lets the UI grow the range by one block
  // when the containment invariant refuses a merge (see the editor client).
  const next = blocks[last + 1];
  return json({
    ...base,
    style: inferMdStyle(src.body),
    block: {
      start,
      end,
      text: src.body.slice(start, end),
      kind: blocks[first].type,
      ...(next ? { nextEnd: next.end } : {}),
    },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const denied = guardWrite(request);
  if (denied) return denied;
  if (!edit.enabled) return json({ error: "editing disabled (config `edit.enabled: false`)" }, 403);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "payload too large" }, 413);
  const b = JSON.parse(raw || "null") as {
    page?: string;
    start?: number;
    end?: number;
    original?: string;
    markdown?: string;
    closes?: unknown;
    journal?: { title?: unknown; summary?: unknown };
  } | null;

  if (!b?.page || typeof b.original !== "string" || typeof b.markdown !== "string") {
    return json({ error: "page, original, markdown required" }, 400);
  }
  if (!Number.isInteger(b.start) || !Number.isInteger(b.end) || (b.start as number) > (b.end as number)) {
    return json({ error: "start/end must be integers with start <= end" }, 400);
  }
  if (!editableRoot(b.page)) return json({ error: "this space is read-only (`edit: false`)" }, 403);

  const src = await readPageSource(b.page);
  if (!src) return json({ error: "not found" }, 404);

  // git is the only undo an editor pointed at real content can offer. Refuse loudly, and
  // say what to do about it — an untracked file is the agent's brand-new page, not a bug.
  if (edit.requireGit && !(await isTracked(src.file))) {
    return json(
      {
        error: "untracked",
        // `file` so the client can say it in the reader's language; `detail` kept for any
        // consumer reading the API directly.
        file: src.rel,
        detail:
          `${src.rel} is not tracked by git, so this edit could not be undone. ` +
          "Run `git add` on it first, or set `edit: { requireGit: false }` in notabene.config.mjs.",
      },
      403,
    );
  }

  const result = spliceBlock({
    body: src.body,
    start: b.start as number,
    end: b.end as number,
    original: b.original,
    markdown: b.markdown,
  });
  if (!result.ok) {
    const status = result.error === "moved" ? 409 : 422;
    const detail =
      result.detail ??
      "the block has changed on disk since this page was rendered — reload to pick up the current source";
    return json({ error: result.error, detail }, status);
  }

  const next = withBody(src.raw, result.next, src.span);
  await writePageSource(src.file, next);

  // The loop half of the save — the journal entry and the comment closures — happens
  // HERE, in the same request as the write, not as client follow-ups: the resync below
  // makes dev push a full reload the moment the write lands, and a follow-up request
  // from a page being torn down may never be sent (observed: the text saved, while the
  // closure, the journal and the toast all silently vanished). Store writes come BEFORE
  // the resync so the reload finds them done.
  const closes = Array.isArray(b.closes)
    ? b.closes.filter((x): x is string => typeof x === "string").slice(0, 200)
    : [];
  const title = typeof b.journal?.title === "string" ? b.journal.title : "";
  const summary = typeof b.journal?.summary === "string" ? b.journal.summary : "";
  let journalEntryId: string | null = null;
  if (title || summary) {
    const first = (await listComments(b.page)).find((c) => closes.includes(c.id))?.thread?.[0];
    const now = new Date().toISOString();
    const entry = normalizeEntry(
      {
        title,
        summary,
        changes: [{ page: b.page, commentIds: closes, what: title || summary, why: first?.body ?? "" }],
      },
      { id: newEntryId(now, Math.random()), date: now.slice(0, 10) },
    );
    try {
      appendEntry(storeAbs, entry);
      journalEntryId = entry.id as string;
    } catch {}
  }
  for (const id of closes) {
    // `resolved`, not `addressed`, even under `review: "approve"` — whoever just edited
    // the page IS the validator that mode waits for.
    await patchComment(b.page, id, {
      status: "resolved",
      resolution: { note: title || summary, ...(journalEntryId ? { journalEntryId } : {}) },
    }).catch(() => null);
  }

  // Resync the content layer BEFORE answering: the consumer's docs sit outside the
  // Astro root and the file watcher over that external directory is not reliable —
  // a write could land on disk while every render kept serving the stale collection
  // ("Saved, but no impact on the page"). With the sync awaited here, a 200 means the
  // NEXT render is fresh; the client's post-save reload can never race it.
  // (Handed over by integrations/editor.mjs at astro:server:setup; absent outside dev.)
  const refreshContent = (globalThis as { __nbRefreshContent?: (o: object) => Promise<void> }).__nbRefreshContent;
  if (refreshContent) await refreshContent({}).catch(() => {});

  // Non-blocking warnings. An agent pass ends with a build + `notabene lint` + the
  // consumer's `verify[]`; a human editing in the page ends with none of that, so say what
  // was skipped rather than let it surface in CI later. Running the consumer's commands
  // from the dev server is deliberately NOT done — a signal, not an execution.
  const links = checkBlockLinks(b.markdown, path.dirname(src.file), extensions);
  const warnings = {
    ...(links.length ? { links } : {}),
    ...(verify.length ? { verifyPending: verify } : {}),
  };
  return json({
    hash: hashOf(next),
    start: result.start,
    end: result.end,
    warnings,
    ...(journalEntryId ? { journalEntryId } : {}),
  });
};
