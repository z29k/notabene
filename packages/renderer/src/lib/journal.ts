// Doc change journal (server, read-only from the site). Written by the agent during
// a review pass (direct edit of `<store>/journal.json`), displayed by the /journal
// page. Store path derived from notabene.config (cf. src/config.mjs) — never hardcoded.
import fs from "node:fs/promises";
import path from "node:path";
import { storeAbs } from "../config.mjs";
import { assertStoreCompatible } from "./store-meta";

export interface JournalChange {
  /** Logical path of the changed page (= data-page), e.g. docs/architecture/billing. */
  page: string;
  /** Comments addressed by this change (ids). */
  commentIds: string[];
  /** What changed. */
  what: string;
  /** Why (from the comment). */
  why: string;
  /** Optional reference (commit sha, etc.). */
  ref?: string;
}

export interface JournalEntry {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: string;
  /** Prose summary of the pass. */
  summary: string;
  changes: JournalChange[];
}

const JOURNAL_FILE = path.join(storeAbs, "journal.json");

export async function readJournal(): Promise<JournalEntry[]> {
  assertStoreCompatible();
  try {
    return JSON.parse(await fs.readFile(JOURNAL_FILE, "utf8")) as JournalEntry[];
  } catch {
    return [];
  }
}
