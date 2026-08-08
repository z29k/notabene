// The dev-only safety net that keeps a dev server from serving a render older than the
// files on disk. What matters here is the ONE thing the integration is responsible for:
// noticing the content store changed and re-emitting the watcher event Astro's own
// handler listens for. Astro's side is not mocked — we assert on the emit, which is the
// contract between us and it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { notabeneContentResync, resyncContent } from "../src/integrations/content-resync.mjs";

const TRIGGER = Symbol.for("notabene.resyncContent");

function setup(pollMs = 10) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nb-resync-"));
  fs.mkdirSync(path.join(root, ".astro"));
  const storeFile = path.join(root, ".astro", "data-store.json");
  fs.writeFileSync(storeFile, "[]");

  const emitted: Array<[string, string]> = [];
  const closers: Array<() => void> = [];
  const server = {
    watcher: { emit: (event: string, file: string) => emitted.push([event, file]) },
    httpServer: { on: (_e: string, cb: () => void) => closers.push(cb) },
  };

  const integration = notabeneContentResync({ pollMs });
  integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(`${root}/`) } });
  integration.hooks["astro:server:setup"]({ server, logger: { debug() {} } });
  return {
    storeFile,
    emitted,
    close: () => {
      for (const c of closers) c();
    },
  };
}

const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[TRIGGER];
});

describe("notabeneContentResync", () => {
  it("re-emits `change` for the store when it moves under a watcher that missed it", async () => {
    const { storeFile, emitted, close } = setup();
    expect(emitted).toHaveLength(0);

    // Astro writes the store atomically — temp file then rename, a NEW inode over the
    // watched path. That is the write an fsevents subscription can stop reporting.
    fs.writeFileSync(`${storeFile}.tmp`, '[["x",{}]]');
    fs.renameSync(`${storeFile}.tmp`, storeFile);

    await settle(60);
    close();
    expect(emitted).toContainEqual(["change", storeFile]);
  });

  it("stays quiet while nothing changes — this runs every couple of seconds", async () => {
    const { emitted, close } = setup();
    await settle(60);
    close();
    expect(emitted).toHaveLength(0);
  });

  it("exposes the same trigger to a request, which is how a wedged server heals", () => {
    const { storeFile, emitted, close } = setup();
    expect(resyncContent()).toBe(true);
    expect(emitted).toContainEqual(["change", storeFile]);
    close();
  });

  it("is a no-op outside dev — a build registers nothing, so the route can always call it", () => {
    expect(resyncContent()).toBe(false);
  });

  it("stops polling and unregisters when the server closes", async () => {
    const { storeFile, emitted, close } = setup();
    close();
    fs.writeFileSync(storeFile, '[["y",{}]]');
    await settle(60);
    expect(emitted).toHaveLength(0);
    expect(resyncContent()).toBe(false);
  });
});
