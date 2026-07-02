import type { APIRoute } from "astro";
import { createComment, listAllComments, listComments, patchComment, removeComment } from "../../lib/comments";
import { writeGuardVerdict } from "../../lib/write-guard";

// On-demand (reads/writes files) — no prerender.
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// SAFETY (§3): the write path modifies the repo's git. It only exists under `astro
// dev` (build/preview refuse mutations; override NOTABENE_ALLOW_WRITE=1), binds
// loopback unless --host/NOTABENE_HOST=1, and — beyond the bind — every mutating
// request is gated by writeGuardVerdict (anti-CSRF Origin check, anti-DNS-rebinding
// Host check, optional NOTABENE_TOKEN). Pure logic lives in ../../lib/write-guard.
const WRITABLE = import.meta.env.DEV || process.env.NOTABENE_ALLOW_WRITE === "1";
const HOST_MODE = process.env.NOTABENE_HOST === "1";
const TOKEN = process.env.NOTABENE_TOKEN || "";

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

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get("all")) return json(await listAllComments());
  const page = url.searchParams.get("page");
  if (!page) return json({ error: "page query param required" }, 400);
  return json(await listComments(page));
};

export const POST: APIRoute = async ({ request }) => {
  const denied = guardWrite(request);
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  if (!b?.page || !b.space || !b.scope || !b.body) {
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
  const denied = guardWrite(request);
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  if (!b?.page || !b.id) return json({ error: "page, id required" }, 400);
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
  const denied = guardWrite(request);
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  if (!b?.page || !b.id) return json({ error: "page, id required" }, 400);
  const ok = await removeComment(b.page, b.id);
  return json({ deleted: ok }, ok ? 200 : 404);
};
