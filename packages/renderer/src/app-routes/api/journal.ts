import type { APIRoute } from "astro";
import { readJournal } from "../../lib/journal";

// On-demand read (the review UI inverts journal changes → per-comment diffs). Read-only,
// so — like GET /api/comments — it isn't write-gated; the store guard still runs.
export const prerender = false;

export const GET: APIRoute = async () => {
  const entries = await readJournal();
  return new Response(JSON.stringify(entries), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
