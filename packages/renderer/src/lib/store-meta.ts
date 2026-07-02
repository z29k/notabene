// Store schema-version guard (server, dev-only). The `.notabene` store is a public,
// committed, agent-read contract versioned by `<store>/meta.json`
// (`{ "schemaVersion": <n> }`, cf. comment-types.ts). This module refuses to operate
// on a store whose version is NEWER than this renderer understands, instead of
// silently reading/writing an incompatible shape. Older versions are the future
// migrator's job — hook it in `migrateStore` below when SCHEMA_VERSION bumps.
import fs from "node:fs";
import path from "node:path";
import { storeAbs } from "../config.mjs";
import { SCHEMA_VERSION } from "./comment-types";

/**
 * Pure check: throws if `version` is newer than `supported`. Extracted for testing
 * (no filesystem). An unknown/absent version is treated as compatible (a freshly
 * `init`-ed store, or a hand-made one, carries no obligation).
 */
export function assertVersionSupported(version: unknown, supported: number = SCHEMA_VERSION): void {
  if (typeof version === "number" && version > supported) {
    throw new Error(
      `notabene: store schemaVersion ${version} is newer than this renderer supports ` +
        `(${supported}). Upgrade @z29k/notabene (e.g. \`npm update @z29k/notabene\`) or ` +
        `check out a matching version. Refusing to read/write an unknown store shape.`,
    );
  }
}

let checked = false;

/** Read `<store>/meta.json` once per process and enforce the version guard. */
export function assertStoreCompatible(): void {
  if (checked) return;
  checked = true;
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(storeAbs, "meta.json"), "utf8");
  } catch {
    return; // no meta.json = store not initialized yet; nothing to guard.
  }
  let meta: { schemaVersion?: unknown };
  try {
    meta = JSON.parse(raw);
  } catch {
    return; // unreadable meta = leave it to the writer to overwrite cleanly.
  }
  assertVersionSupported(meta.schemaVersion);
}
