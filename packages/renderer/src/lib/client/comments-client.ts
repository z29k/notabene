// Shared browser-side helpers for the comment UIs. Imported by both the in-page
// rail (components/Comments.astro) and the global list (pages/comments.astro), which
// previously each carried their own copy of these (esc, fmt, the fetch wrapper, the
// Comment interface, route resolution) — a drift hazard. Pure/isomorphic: no node:*,
// no server-only config; safe to bundle into client scripts.
//
// Types come from the canonical store contract (lib/comment-types) so the client and
// server can't disagree on the shape.
export type { Comment, CommentAnchor, CommentReply, CommentScope, CommentStatus } from "../comment-types";

/** HTML-escape for building card markup from user text. */
export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c);

/** ISO timestamp → compact "YYYY-MM-DD HH:MM". */
export const fmt = (s: string): string => s.slice(0, 16).replace("T", " ");

/**
 * Build a `/api/comments` fetch wrapper. With a `page` it scopes GET to that page
 * (`?page=`); without one it fetches the whole store (`?all=1`) for the global view.
 * Writes carry `x-notabene-token` from localStorage when present, so a --host deploy
 * guarded by NOTABENE_TOKEN works without ever embedding the secret in the HTML.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fetch().json() is untyped; call sites narrow.
export function createApi(page?: string): (method: string, body?: unknown) => Promise<any> {
  return (method, body) => {
    const qs = method === "GET" ? (page ? `?page=${encodeURIComponent(page)}` : "?all=1") : "";
    const headers: Record<string, string> = { "content-type": "application/json" };
    try {
      const tok = localStorage.getItem("notabene:token");
      if (tok) headers["x-notabene-token"] = tok;
    } catch {
      /* localStorage unavailable (rare) — proceed without a token */
    }
    return fetch(`/api/comments${qs}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json());
  };
}

/**
 * Logical `page` path → site route, given the client-visible roots. Most specific
 * root (longest `path`) first, mirroring config.routeForPage on the server.
 */
export function makeRouteFor(roots: { key: string; path: string }[]): (page: string) => string {
  const ordered = [...roots].sort((a, b) => b.path.length - a.path.length);
  return (page: string): string => {
    for (const r of ordered) {
      if (page === r.path) return `/${r.key}`;
      if (page.startsWith(`${r.path}/`)) return `/${r.key}/${page.slice(r.path.length + 1)}`;
    }
    return "#";
  };
}

/**
 * The comment author for this browser: the per-device name set in localStorage
 * (`notabene:author`), else the server default (`fallback` = config `author` / git
 * user.name / "you", injected via `#notabene-me`). Sent with every create/reply so a
 * `--host` deployment attributes comments per person instead of all "you".
 */
export function getAuthor(fallback = "you"): string {
  try {
    return localStorage.getItem("notabene:author")?.trim() || fallback;
  } catch {
    return fallback;
  }
}
export function setAuthor(name: string): void {
  try {
    const v = name.trim();
    if (v) localStorage.setItem("notabene:author", v);
    else localStorage.removeItem("notabene:author");
  } catch {
    /* localStorage unavailable */
  }
}
