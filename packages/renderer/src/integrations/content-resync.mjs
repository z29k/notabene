// Dev-only safety net for a stale render.
//
// How a page gets stale, and why nothing recovers on its own:
//   `src/pages/[...path].astro` resolves its entry in `getStaticPaths()` and passes the
//   ENTRY through props, so the HTML a request produces is only as fresh as Astro's
//   per-route getStaticPaths cache (core/render/route-cache.js keys it on module identity
//   and reuses it until told otherwise). The only thing that clears that cache is the
//   `astro:content-changed` HMR event — and Astro sends it from ONE place: a Vite watcher
//   event on `<root>/.astro/data-store.json` (content/vite-plugin-content-virtual-mod.js).
//
//   Every write of that file is a temp file + `rename`, i.e. a new inode over a watched
//   path, and the write is skipped entirely when the serialized store is unchanged. Miss
//   that single event once — a coalesced fsevent, a watcher that didn't survive a sleep —
//   and NOTHING re-arms it: the content layer keeps reloading entries into its store (the
//   `[glob-loader] Reloaded data from …` lines still print, the file on disk is current),
//   while every request keeps rendering the entry captured before the edit. Reloading the
//   browser cannot help, because the staleness is in the server. Only a restart clears it.
//
// So this watches the same file by POLLING — immune to inode replacement and to a dead
// fsevents subscription — and re-emits the event Astro itself listens for. We add no
// invalidation logic of our own: `server.watcher` is an EventEmitter, and emitting
// `change` for that path runs Astro's own handler, exactly as the real event would.
//
// `resyncContent()` is the same trigger, reachable from a request: `/api/page` reads the
// source from DISK, so it can see a stale range for what it is and heal the server before
// telling the browser to reload. The bridge is a `globalThis` symbol because an
// integration and an API route live in different module graphs (Node vs the Vite module
// runner) — same realm, so a shared global is the one thing they both see.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TRIGGER = Symbol.for("notabene.resyncContent");
const POLL_MS = 2000;

/** Identity of the store file as the poll sees it — mtime+size, cheap and enough. */
function stampOf(file) {
  try {
    const s = fs.statSync(file);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return null;
  }
}

/**
 * Force Astro to drop its route cache and re-read the content store. Safe to call from a
 * request handler: a no-op outside `astro dev` (nothing registers the trigger there).
 * Returns whether a dev server was actually there to resync.
 */
export function resyncContent() {
  const fn = globalThis[TRIGGER];
  if (typeof fn !== "function") return false;
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}

/** `pollMs` exists so the test can drive the poll without sleeping two seconds. */
export function notabeneContentResync({ pollMs = POLL_MS } = {}) {
  let storeFile = null;
  return {
    name: "notabene:content-resync",
    hooks: {
      "astro:config:done": ({ config }) => {
        storeFile = path.join(fileURLToPath(config.root), ".astro", "data-store.json");
      },
      // Dev only: this hook does not run for `build` or `preview`, so a build is
      // byte-identical to one without the integration.
      "astro:server:setup": ({ server, logger }) => {
        if (!storeFile) return;
        const fire = () => server.watcher.emit("change", storeFile);
        let seen = stampOf(storeFile);

        const timer = setInterval(() => {
          const now = stampOf(storeFile);
          if (now === null || now === seen) return;
          seen = now;
          logger?.debug?.("content store changed — clearing the route cache");
          fire();
        }, pollMs);
        timer.unref?.(); // never hold the process open

        globalThis[TRIGGER] = () => {
          seen = stampOf(storeFile);
          fire();
        };
        server.httpServer?.on("close", () => {
          clearInterval(timer);
          if (globalThis[TRIGGER]) delete globalThis[TRIGGER];
        });
      },
    },
  };
}
