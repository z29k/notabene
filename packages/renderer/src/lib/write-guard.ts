// Pure decision logic for the write API's request gate — no I/O, no config import,
// so it's unit-testable in isolation (importing api/comments.ts would drag in the
// store + the consumer config loader). api/comments.ts feeds it the request headers
// and the env-derived flags; see there for the HTTP wiring.
//
// It defends the write path (which edits the consumer's git) against:
//  - use outside dev (write API is not part of a deployable artifact),
//  - cross-origin CSRF (a malicious page can fire a no-preflight POST at 127.0.0.1),
//  - DNS-rebinding (a rebound host resolving to loopback),
//  - and, optionally, a shared token when the API is exposed on the LAN (--host).

export interface WriteGuardInput {
  /** Writing enabled at all: import.meta.env.DEV || NOTABENE_ALLOW_WRITE=1. */
  writable: boolean;
  /** NOTABENE_HOST=1 / --host: the API is intentionally exposed beyond loopback. */
  hostMode: boolean;
  /** NOTABENE_TOKEN: required shared secret, or "" to disable the token check. */
  token: string;
  /** Request `Origin` header (null when absent, e.g. some same-origin requests). */
  origin: string | null;
  /** Request `Host` header. */
  host: string | null;
  /** Request `x-notabene-token` header. */
  tokenHeader: string | null;
}

export type WriteGuardVerdict = { ok: true } | { ok: false; status: number; reason: string };

const unwrap = (h: string): string => h.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 [..]

export function isLoopbackHostname(hostname: string): boolean {
  const h = unwrap(hostname);
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

/** Host header → bare hostname (drop `:port`, lowercase, unwrap IPv6 brackets). */
export function hostnameOf(hostHeader: string | null): string {
  return unwrap((hostHeader || "").trim().replace(/:\d+$/, ""));
}

export function writeGuardVerdict(i: WriteGuardInput): WriteGuardVerdict {
  if (!i.writable) {
    return { ok: false, status: 403, reason: "read-only: write API disabled outside dev" };
  }

  // A cross-site page's Origin is neither loopback nor (in --host mode) our own Host.
  if (i.origin) {
    let originHost: string;
    try {
      originHost = unwrap(new URL(i.origin).hostname);
    } catch {
      return { ok: false, status: 403, reason: "write refused: bad Origin" };
    }
    const allowed = isLoopbackHostname(originHost) || (i.hostMode && originHost === hostnameOf(i.host));
    if (!allowed) return { ok: false, status: 403, reason: "write refused: cross-origin" };
  }

  // Loopback mode: the Host header itself must be loopback (blocks DNS-rebinding).
  if (!i.hostMode && !isLoopbackHostname(hostnameOf(i.host))) {
    return { ok: false, status: 403, reason: "write refused: non-loopback Host" };
  }

  if (i.token && i.tokenHeader !== i.token) {
    return { ok: false, status: 403, reason: "write refused: invalid or missing token" };
  }

  return { ok: true };
}
