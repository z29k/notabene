import type { APIRoute } from "astro";
import { createComment, listAllComments, listComments, patchComment, removeComment } from "../../lib/comments";

// On-demand (reads/writes files) — no prerender.
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// SAFETY (§3): the write path (it modifies the repo's git) only exists under
// `astro dev`. In build/preview (PROD), mutations are refused — writing is not part
// of the deployable artifact. Explicit override: NOTABENE_ALLOW_WRITE=1.
const WRITABLE = import.meta.env.DEV || process.env.NOTABENE_ALLOW_WRITE === "1";
const denyIfReadOnly = () =>
  WRITABLE ? null : json({ error: "read-only: write API disabled outside dev" }, 403);

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get("all")) return json(await listAllComments());
  const page = url.searchParams.get("page");
  if (!page) return json({ error: "page query param required" }, 400);
  return json(await listComments(page));
};

export const POST: APIRoute = async ({ request }) => {
  const denied = denyIfReadOnly();
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  if (!b || !b.page || !b.space || !b.scope || !b.body) {
    return json({ error: "page, space, scope, body required" }, 400);
  }
  const comment = await createComment({
    space: b.space,
    page: b.page,
    scope: b.scope,
    anchor: b.anchor ?? null,
    author: b.author,
    body: b.body,
  });
  return json(comment, 201);
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = denyIfReadOnly();
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  if (!b || !b.page || !b.id) return json({ error: "page, id required" }, 400);
  const updated = await patchComment(b.page, b.id, {
    status: b.status,
    hold: b.hold,
    resolution: b.resolution,
    reply: b.reply,
    edit: b.edit,
  });
  if (!updated) return json({ error: "not found" }, 404);
  return json(updated);
};

export const DELETE: APIRoute = async ({ request }) => {
  const denied = denyIfReadOnly();
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  if (!b || !b.page || !b.id) return json({ error: "page, id required" }, 400);
  const ok = await removeComment(b.page, b.id);
  return json({ deleted: ok }, ok ? 200 : 404);
};
