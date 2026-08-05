import fs from "node:fs/promises";
import path from "node:path";
import type { APIRoute } from "astro";
import { edit } from "../../config.mjs";
import { PASTE_EXTENSIONS, pasteName, readPageSource, rootForPage } from "../../lib/page-write";
import { writeGuardVerdict } from "../../lib/write-guard";

// Pasting an image into the editor writes it into the consumer's repo, beside the page
// that references it — so the doc stays self-contained and the image lands in the same
// commit as the prose. Astro's image pipeline picks up the relative link from there
// (verified: a `./x.png` in a page under a content root is served through /_image).
//
// Same posture as every other write: injected under `astro dev` only, guarded, atomic.
export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

const WRITABLE = import.meta.env.DEV || process.env.NOTABENE_ALLOW_WRITE === "1";
/** 8 MB — a screenshot, not a video. */
const MAX_BYTES = 8 * 1024 * 1024;

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
  if (!edit.enabled) return json({ error: "editing disabled (config `edit.enabled: false`)" }, 403);

  const body = (await request.json().catch(() => null)) as { page?: string; filename?: string; data?: string } | null;
  if (!body?.page || !body.filename || typeof body.data !== "string") {
    return json({ error: "page, filename, data (base64) required" }, 400);
  }
  if (rootForPage(body.page)?.edit === false) return json({ error: "this space is read-only (`edit: false`)" }, 403);

  const bytes = Buffer.from(body.data, "base64");
  if (!bytes.length) return json({ error: "empty payload" }, 400);
  if (bytes.length > MAX_BYTES) return json({ error: "image too large (8 MB max)" }, 413);

  const name = pasteName(body.filename, bytes);
  if (!name) return json({ error: `unsupported image type (allowed: ${PASTE_EXTENSIONS.join(", ")})` }, 415);

  // Resolve against the PAGE's own directory, which pageFile already proved is inside a
  // declared root — so the write cannot escape, and no new path surface is introduced.
  const src = await readPageSource(body.page);
  if (!src) return json({ error: "not found" }, 404);
  const target = path.join(path.dirname(src.file), name);

  try {
    await fs.access(target); // identical content already pasted → reuse it
  } catch {
    const tmp = `${target}.${process.pid}.tmp`;
    try {
      await fs.writeFile(tmp, bytes);
      await fs.rename(tmp, target);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => {});
      return json({ error: err instanceof Error ? err.message : "write failed" }, 500);
    }
  }
  return json({ name, markdown: `![](./${name})` }, 201);
};
