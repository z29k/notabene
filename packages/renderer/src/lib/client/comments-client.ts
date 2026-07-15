// Shared browser-side helpers for the comment UIs. Imported by both the in-page
// rail (components/Comments.astro) and the global list (pages/comments.astro), which
// previously each carried their own copy of these (esc, fmt, the fetch wrapper, the
// Comment interface, route resolution) — a drift hazard. Pure/isomorphic: no node:*,
// no server-only config; safe to bundle into client scripts.
//
// Types come from the canonical store contract (lib/comment-types) so the client and
// server can't disagree on the shape.
export type { BlockAnchor, Comment, CommentAnchor, CommentReply, CommentScope, CommentStatus } from "../comment-types";
import { decode, routeFor } from "../i18n-content.mjs";

/** HTML-escape for building card markup from user text. */
export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c);

/** ISO timestamp → date+time formatted for the PAGE locale (read from `<html lang>`, set
 *  from notabene.config `locale`) and the VIEWER's local timezone, so FR shows
 *  "7 janv. 2026, 10:00" and EN "Jan 7, 2026, 10:00 AM" for a 09:00Z instant in CET. The
 *  store always keeps the instant in UTC (`new Date().toISOString()` on write) — only the
 *  display is localized. Falls back to a compact ISO form if Intl/locale is unavailable. */
export const fmt = (s: string): string => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 16).replace("T", " ");
  const locale = (typeof document !== "undefined" && document.documentElement.lang) || undefined;
  try {
    return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return s.slice(0, 16).replace("T", " ");
  }
};

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

/** Minimal i18n config as injected client-side via `#notabene-i18n-config` (clientI18n). */
export interface ClientI18n {
  locales: string[];
  defaultLocale: string;
  strategy: "directory" | "suffix";
  enabled: boolean;
}

/**
 * Logical `page` path → site route, given the client-visible roots. Most specific root
 * (longest `path`) first, mirroring config.routeForPage on the server. Pass `i18n`
 * (clientI18n) to emit clean prefixed URLs for a locale-encoded page; omit it for the
 * pre-i18n behavior (`route.test.ts`, mono-language sites).
 */
export function makeRouteFor(roots: { key: string; path: string }[], i18n?: ClientI18n): (page: string) => string {
  const ordered = [...roots].sort((a, b) => b.path.length - a.path.length);
  return (page: string): string => {
    for (const r of ordered) {
      let rawId: string | null = null;
      if (page === r.path) rawId = "";
      else if (page.startsWith(`${r.path}/`)) rawId = page.slice(r.path.length + 1);
      if (rawId === null) continue;
      if (!i18n?.enabled) return rawId ? `/${r.key}/${rawId}` : `/${r.key}`;
      const { locale, id } = decode(rawId, i18n);
      return routeFor({ space: r.key, id, locale }, i18n);
    }
    return "#";
  };
}

// ── Identity (name + optional email) ────────────────────────────────────────────────
// Per-device (localStorage). The email makes an identity UNIQUE (two "Alex" disambiguate)
// and is embedded git-style into the author string sent with each write ("Name <email>")
// — so the store contract (CommentReply.author: string) is UNCHANGED, no schema bump.
// Display strips the email back off (displayName). Keys:
const K_NAME = "notabene:author";
const K_EMAIL = "notabene:email";

export interface Identity {
  name: string;
  email: string;
}

/** git-style author string: "Name <email>" when an email is set, else just "Name". */
export function composeAuthor(name: string, email: string): string {
  const n = name.trim();
  const e = email.trim();
  return e ? `${n} <${e}>` : n;
}

/** Split a stored author back into { name, email } ("Ada <ada@x.io>" → both). */
export function parseAuthor(author: string): Identity {
  const m = author.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: author.trim(), email: "" };
}

/** Just the display name (email stripped) — for rendering author labels. */
export function displayName(author: string): string {
  return parseAuthor(author).name || author;
}

/** Is this host loopback (local)? Drives the "identify before browsing" gate: a
 *  non-loopback host means a LAN/`--host`/deployed access, where attribution matters. */
export function isLoopbackHost(host: string): boolean {
  const h = (host || "").toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  return h === "localhost" || h === "::1" || h === "0.0.0.0" || h.endsWith(".localhost") || h.startsWith("127.");
}

/** This device's identity, falling back to the server default (git user.name/.email,
 *  injected via `#notabene-me`) when the user hasn't set their own. */
export function getIdentity(fallbackName = "you", fallbackEmail = ""): Identity {
  try {
    return {
      name: localStorage.getItem(K_NAME)?.trim() || fallbackName,
      email: localStorage.getItem(K_EMAIL)?.trim() || fallbackEmail,
    };
  } catch {
    return { name: fallbackName, email: fallbackEmail };
  }
}

export function setIdentity(id: Identity): void {
  try {
    const name = id.name.trim();
    const email = id.email.trim();
    if (name) localStorage.setItem(K_NAME, name);
    else localStorage.removeItem(K_NAME);
    if (email) localStorage.setItem(K_EMAIL, email);
    else localStorage.removeItem(K_EMAIL);
  } catch {
    /* localStorage unavailable */
  }
}

/** True once the user has set their OWN name on this device (vs. the server fallback) —
 *  the gate on a remote host prompts until this is true. */
export function hasIdentity(): boolean {
  try {
    return !!localStorage.getItem(K_NAME)?.trim();
  } catch {
    return false;
  }
}

/**
 * The author string sent with every create/reply — the composed "Name <email>" for this
 * device, else the server default. A `--host` deployment attributes per person.
 */
export function getAuthor(fallbackName = "you", fallbackEmail = ""): string {
  const { name, email } = getIdentity(fallbackName, fallbackEmail);
  return composeAuthor(name, email);
}

/** Back-compat: set only the name (leaves any stored email untouched). */
export function setAuthor(name: string): void {
  try {
    const v = name.trim();
    if (v) localStorage.setItem(K_NAME, v);
    else localStorage.removeItem(K_NAME);
  } catch {
    /* localStorage unavailable */
  }
}
