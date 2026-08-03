import type { APIRoute } from "astro";
import { storeAbs } from "../../config.mjs";
import { readJournal } from "../../lib/journal";
import { appendEntry, newEntryId, normalizeEntry } from "../../lib/journal-write.mjs";
import { writeGuardVerdict } from "../../lib/write-guard";

// On-demand read (the review UI inverts journal changes → per-comment diffs). Read-only,
// so — like GET /api/comments — it isn't write-gated; the store guard still runs.
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export const GET: APIRoute = async () => {
  const entries = await readJournal();
  return new Response(JSON.stringify(entries), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};

// POST — the human half of the loop. When someone fixes a block in the page, the save can
// record WHY, in the same register an agent pass uses: one journal entry, linked from the
// comments it closes. Same write posture as /api/comments (dev-only, anti-CSRF,
// anti-DNS-rebinding, optional token) and the same atomic append as `notabene journal add`.
const WRITABLE = import.meta.env.DEV || process.env.NOTABENE_ALLOW_WRITE === "1";

export const POST: APIRoute = async ({ request }) => {
  const verdict = writeGuardVerdict({
    writable: WRITABLE,
    hostMode: process.env.NOTABENE_HOST === "1",
    token: process.env.NOTABENE_TOKEN || "",
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    tokenHeader: request.headers.get("x-notabene-token"),
  });
  if (!verdict.ok) return json({ error: verdict.reason }, verdict.status);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return json({ error: "a JSON entry is required" }, 400);

  const now = new Date().toISOString();
  const entry = normalizeEntry(body, {
    id: newEntryId(now, Math.random()),
    date: now.slice(0, 10),
  });
  if (!entry.title && !entry.summary) return json({ error: "title or summary required" }, 400);

  try {
    appendEntry(storeAbs, entry);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "append failed" }, 500);
  }
  return json({ id: entry.id }, 201);
};
