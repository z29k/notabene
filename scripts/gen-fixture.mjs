#!/usr/bin/env node
// Deterministic fake-docs generator for manual / dev testing (NOT shipped in the npm
// package). Writes a full consumer repo you can point `notabene dev` at:
//   - a multi-space doc tree (nested folders, index pages, headings, lists, a code fence,
//     a GFM table, inter-doc links) so nav / search / link-rewriting have real content;
//   - Mermaid diagrams (flowchart / erDiagram / sequenceDiagram) and images (a base64
//     data-URI + a relative-file SVG) so the block-comment + enlarge features have targets;
//   - a `.notabene` store (schema v3) with comments in EVERY state (open / addressed /
//     resolved, hold, selection + page + block scope, threaded replies) whose text anchors
//     match the generated prose and whose block anchors match the diagram/image keys;
//   - a journal, including a CASCADE (one comment → two pages) and a SHARED page (two
//     comments → one change);
//   - with --git: commit the clean docs, then apply the "agent edits" for `addressed`
//     comments (left uncommitted) so /review shows real git diffs immediately.
//
// Usage:
//   node scripts/gen-fixture.mjs [outDir] [--format mdx|commonmark] [--locale en|fr]
//        [--review auto|approve] [--spaces N] [--pages N] [--seed S] [--git]
//   Defaults: outDir=<repo>/.demo (gitignored), commonmark, en, approve, 2 spaces,
//             4 pages/space, seed=42, git off.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);

// Default: a gitignored `.demo/` inside the repo (browsable, persistent), resolved from
// the repo root so it works regardless of cwd. An explicit path overrides it.
const OUT = positional[0] ? path.resolve(positional[0]) : path.join(REPO_ROOT, ".demo");
const FORMAT = flag("format", "commonmark");
const LOCALE = flag("locale", "en");
const REVIEW = flag("review", "approve");
const N_SPACES = Math.max(1, Number(flag("spaces", 2)));
const N_PAGES = Math.max(2, Number(flag("pages", 4)));
const SEED = Number(flag("seed", 42));
const GIT = has("git");
const EXT = FORMAT === "mdx" ? "mdx" : "md";

// Seeded PRNG (mulberry32) — deterministic output for a given seed (no Date.now/random).
let _s = SEED >>> 0;
const rnd = () => {
  _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const id = (p) => `c_${p}${Math.floor(rnd() * 1e6).toString(36)}`;
// Fixed timestamps (reproducible): derive from an index.
const ts = (i) => new Date(Date.UTC(2026, 0, 1 + i, 9, 0, 0)).toISOString();

const WORDS =
  "system service request token cache queue billing invoice tenant region cluster node retry timeout policy schema migration pipeline webhook payload latency quota session cursor index shard replica backlog throttle idempotent boundary contract adapter renderer anchor journal comment resolve".split(
    " ",
  );
const SPACES = [
  { key: "docs", label: "Docs", path: "docs" },
  { key: "reference", label: "Reference", path: "reference" },
  { key: "runbooks", label: "Runbooks", path: "runbooks" },
];
const SECTIONS = ["Overview", "How it works", "Configuration", "Operations", "Edge cases", "Limits"];
const TITLES = ["Billing", "Ingestion", "Auth tokens", "Rate limits", "Webhooks", "Caching", "Migrations", "Queues"];

const cap = (w) => w[0].toUpperCase() + w.slice(1);
const sentence = () => `${cap(pick(WORDS))} ${Array.from({ length: int(5, 11) }, () => pick(WORDS)).join(" ")}.`;
const paragraph = () => Array.from({ length: int(2, 4) }, sentence).join(" ");

/** Build a page: returns { rel, page, title, body, plainSentences }. */
function makePage(space, slugParts, i, linkTarget) {
  const rel = slugParts.join("/");
  const title = `${pick(TITLES)} ${slugParts[slugParts.length - 1]}`;
  const plain = [];
  let body = `# ${title}\n\n`;
  const nSec = int(2, 4);
  for (let s = 0; s < nSec; s++) {
    body += `## ${SECTIONS[s % SECTIONS.length]}\n\n`;
    const p = paragraph();
    plain.push({ text: p, section: SECTIONS[s % SECTIONS.length] });
    body += `${p}\n\n`;
    if (s === 0) {
      body += `- ${sentence()}\n- ${sentence()}\n- ${sentence()}\n\n`;
    }
    if (s === 1) {
      body += "```js\nconst x = compute(input); // deterministic sample\n```\n\n";
    }
    if (s === 2) {
      body += "| Field | Meaning |\n| --- | --- |\n| ttl | time to live |\n| id | identifier |\n\n";
    }
  }
  if (linkTarget) body += `See also [${linkTarget.title}](${linkTarget.relFromHere}).\n`;
  return { rel, page: `${space.path}/${rel}`, title, body, plain };
}

// ---- generate the doc tree ----
const spaces = SPACES.slice(0, N_SPACES);
const pagesBySpace = new Map();
for (const space of spaces) {
  const pages = [];
  // space home (index)
  pages.push(makePage(space, ["index"], 0));
  const groups = ["guide", "internals", "ops"];
  for (let p = 1; p < N_PAGES; p++) {
    const group = groups[p % groups.length];
    pages.push(makePage(space, [group, `${pick(WORDS)}-${p}`], p));
  }
  pagesBySpace.set(space.key, pages);
}

// pick a real substring from a plain sentence for a selection anchor
function anchorFrom(pagePlain) {
  const s = pick(pagePlain);
  const words = s.text.split(" ");
  const start = int(0, Math.max(0, words.length - 4));
  const quote = words
    .slice(start, start + int(2, 4))
    .join(" ")
    .replace(/\.$/, "");
  const idx = s.text.indexOf(quote);
  return {
    quote,
    prefix: s.text.slice(Math.max(0, idx - 30), idx),
    suffix: s.text.slice(idx + quote.length, idx + quote.length + 30),
    section: s.section,
  };
}

// ---- build comments + journal ----
const commentsByPage = new Map(); // page -> Comment[]
const journal = [];
const addFile = (page, c) => {
  if (!commentsByPage.has(page)) commentsByPage.set(page, []);
  commentsByPage.get(page).push(c);
};
let ci = 0;
const authors = ["you", "alex", "sam"];

// regular pages (skip index) across all spaces, flattened
const contentPages = [...pagesBySpace.values()].flat().filter((p) => !/(^|\/)index$/.test(p.rel));

// 1) a spread of open / hold / resolved / page-wide comments
for (const pg of contentPages) {
  const roll = rnd();
  if (roll < 0.5) {
    const a = anchorFrom(pg.plain);
    addFile(pg.page, {
      id: id("o"),
      space: pg.page.split("/")[0],
      page: pg.page,
      scope: "selection",
      anchor: a,
      thread: [
        {
          author: pick(authors),
          body: `Can we clarify "${a.quote}"?`,
          ts: ts(ci++),
        },
      ],
      status: "open",
      hold: rnd() < 0.2,
      resolution: null,
      createdAt: ts(ci),
      updatedAt: ts(ci),
    });
  } else if (roll < 0.7) {
    addFile(pg.page, {
      id: id("p"),
      space: pg.page.split("/")[0],
      page: pg.page,
      scope: "page",
      anchor: null,
      thread: [
        {
          author: pick(authors),
          body: "This whole page needs a summary at the top.",
          ts: ts(ci++),
        },
        {
          author: pick(authors),
          body: "Agreed — one paragraph is enough.",
          ts: ts(ci++),
        },
      ],
      status: "open",
      hold: false,
      resolution: null,
      createdAt: ts(ci),
      updatedAt: ts(ci),
    });
  }
}

// 2) a resolved comment (already handled) + its journal entry
{
  const pg = contentPages[0];
  const a = anchorFrom(pg.plain);
  const jid = "j_resolved";
  addFile(pg.page, {
    id: id("r"),
    space: pg.page.split("/")[0],
    page: pg.page,
    scope: "selection",
    anchor: a,
    thread: [{ author: "you", body: "Typo here.", ts: ts(ci++) }],
    status: "resolved",
    hold: false,
    resolution: { note: "fixed the typo", journalEntryId: jid },
    createdAt: ts(ci),
    updatedAt: ts(ci),
  });
  journal.push({
    id: jid,
    date: "2026-01-05",
    title: `Fix typo in ${pg.title}`,
    summary: "Corrected a small wording issue.",
    changes: [
      {
        page: pg.page,
        commentIds: [],
        what: "fixed a typo",
        why: "correctness",
      },
    ],
  });
}

// 3) addressed comments (two-phase review): a simple one, a CASCADE, and a SHARED page.
const addressedEdits = []; // { page, appendLine } to apply as uncommitted "agent edits"
function addAddressed({ page, note, jid, changes, ids }) {
  addFile(page, {
    id: ids,
    space: page.split("/")[0],
    page,
    scope: "selection",
    anchor: anchorFrom([...pagesBySpace.values()].flat().find((p) => p.page === page).plain),
    thread: [{ author: "you", body: "Please make this clearer.", ts: ts(ci++) }],
    status: "addressed",
    hold: false,
    resolution: { note, journalEntryId: jid },
    createdAt: ts(ci),
    updatedAt: ts(ci),
  });
  journal.push({
    id: jid,
    date: "2026-01-08",
    title: note,
    summary: note,
    changes,
  });
}
const pA = contentPages[1].page;
const pB = contentPages[2].page;
const pC = contentPages[3 % contentPages.length].page;

// simple: one comment → one page
const idSimple = id("a");
addAddressed({
  page: pA,
  note: "clarified the paragraph",
  jid: "j_simple",
  ids: idSimple,
  changes: [
    {
      page: pA,
      commentIds: [idSimple],
      what: "expanded the paragraph",
      why: "clarity",
    },
  ],
});
addressedEdits.push({
  page: pA,
  line: "> Clarified: added a concrete example.",
});

// cascade: one comment → two pages (pB + pC)
const idCascade = id("a");
addAddressed({
  page: pB,
  note: "renamed the term everywhere",
  jid: "j_cascade",
  ids: idCascade,
  changes: [
    {
      page: pB,
      commentIds: [idCascade],
      what: "renamed the term",
      why: "consistency",
    },
    {
      page: pC,
      commentIds: [idCascade],
      what: "updated the cross-reference",
      why: "consistency (cascade)",
    },
  ],
});
addressedEdits.push({ page: pB, line: "> Renamed the term for consistency." });
addressedEdits.push({ page: pC, line: "> Updated to match the renamed term." });

// shared page: a second addressed comment on pB (same page, different comment)
const idShared = id("a");
addFile(pB, {
  id: idShared,
  space: pB.split("/")[0],
  page: pB,
  scope: "page",
  anchor: null,
  thread: [{ author: "sam", body: "Also add a note about limits.", ts: ts(ci++) }],
  status: "addressed",
  hold: false,
  resolution: { note: "added a limits note", journalEntryId: "j_shared" },
  createdAt: ts(ci),
  updatedAt: ts(ci),
});
journal.push({
  id: "j_shared",
  date: "2026-01-08",
  title: "Add a limits note",
  summary: "Added a short limits paragraph.",
  changes: [
    {
      page: pB,
      commentIds: [idShared],
      what: "added a limits note",
      why: "completeness",
    },
  ],
});
addressedEdits.push({
  page: pB,
  line: "> Limits: capped at 100 requests per minute.",
});

// ---- 4) rich media: Mermaid diagrams + images, with v3 block comments ----
// Diagrams/images are commentable as whole BLOCKS (scope "block", schema v3). Identity is
// by CONTENT: mermaid → hash of the source; image → its rendered `src`. To seed comments
// whose keys MATCH what the client computes from the rendered page, we mirror blocks.ts:
//   - hashSource / mermaidLabel / imageLabel are copied verbatim (keep them in sync);
//   - Mermaid keys are deterministic (the source is verbatim inside the .md fence);
//   - the ONE commented image is a base64 data-URI — Astro rewrites a *relative* image
//     `src` to a non-deterministic /_image|/_astro URL, so a relative image can't carry an
//     exact key; a second relative-file SVG is added for realistic manual comment/enlarge.
// `index` is the block's ordinal among commentable blocks (pre.mermaid + img) on its page.

// djb2 → base36 — mirrors src/lib/client/blocks.ts hashSource (keep identical).
const hashSource = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
const mermaidKey = (src) => `mermaid:${hashSource(src.trim())}`;
const mermaidLabel = (src) => {
  const lines = src
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const type = (lines[0] || "diagram").split(/\s+/)[0];
  const body = lines.slice(1).find(Boolean);
  return (body ? `${type}: ${body}` : type).slice(0, 80);
};
const imageLabel = (src, alt) => {
  if (alt.trim()) return alt.trim().slice(0, 80);
  const base = (src.split(/[?#]/)[0].split("/").pop() || src).trim();
  return (base || src).slice(0, 80);
};
const dataImg = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// diagram sources (verbatim → hashed for the block key)
const FLOWCHART = `flowchart TD
  A[Request] --> B{Cached?}
  B -->|yes| C[Serve from cache]
  B -->|no| D[Query service]
  D --> E[Store in cache]
  E --> C`;
const ERD = `erDiagram
  CLIENT ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  ORDER {
    int id PK
    int client_id FK
  }`;
const SEQ = `sequenceDiagram
  participant U as User
  participant A as API
  participant S as Store
  U->>A: POST /comment
  A->>S: write (atomic)
  S-->>A: ok
  A-->>U: 201 Created`;

// a self-contained dashboard mockup (base64 data-URI → deterministic, exact block key)
const DASH_IMG = dataImg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200">' +
    '<rect width="480" height="200" fill="#0f172a"/>' +
    '<rect x="16" y="16" width="210" height="80" rx="6" fill="#334155"/>' +
    '<rect x="254" y="16" width="210" height="80" rx="6" fill="#334155"/>' +
    '<rect x="16" y="112" width="448" height="72" rx="6" fill="#1e293b"/>' +
    '<text x="24" y="152" font-family="sans-serif" font-size="16" fill="#94a3b8">Dashboard mockup</text></svg>',
);
// a relative-file SVG (realistic authoring; renders offline; manual comment/enlarge target)
const REL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120">' +
  '<rect width="320" height="120" fill="#4f46e5"/>' +
  '<text x="160" y="66" font-family="sans-serif" font-size="20" fill="#fff" text-anchor="middle">sequence overview</text></svg>';

// append a media block under its own heading; return { index, section } for its anchor.
const blockIdx = new Map(); // page -> next block ordinal
const mediaAssets = []; // { rel, content } written after OUT is (re)created
function pushMedia(pageObj, heading, markup) {
  pageObj.body += `\n## ${heading}\n\n${markup}\n`;
  const index = blockIdx.get(pageObj.page) ?? 0;
  blockIdx.set(pageObj.page, index + 1);
  return { index, section: heading };
}
const indexPageOf = (space) => pagesBySpace.get(space.key).find((p) => /(^|\/)index$/.test(p.rel));
const primary = indexPageOf(spaces[0]);
const secondary = spaces[1] ? indexPageOf(spaces[1]) : primary;

function addBlockComment({ pageObj, anchor, thread, status, resolution = null, hold = false }) {
  const cid = id("b");
  addFile(pageObj.page, {
    id: cid,
    space: pageObj.page.split("/")[0],
    page: pageObj.page,
    scope: "block",
    anchor,
    thread,
    status,
    hold,
    resolution,
    createdAt: ts(ci),
    updatedAt: ts(ci),
  });
  return cid;
}

// primary space home: a flowchart (open) + a dashboard image (open)
{
  const m = pushMedia(primary, "Architecture", `\`\`\`mermaid\n${FLOWCHART}\n\`\`\``);
  addBlockComment({
    pageObj: primary,
    anchor: { kind: "mermaid", key: mermaidKey(FLOWCHART), label: mermaidLabel(FLOWCHART), section: m.section, index: m.index },
    thread: [{ author: pick(authors), body: "Should we add a caching layer to this flow?", ts: ts(ci++) }],
    status: "open",
  });
  const im = pushMedia(primary, "Dashboard", `![Dashboard mockup](${DASH_IMG})`);
  addBlockComment({
    pageObj: primary,
    anchor: { kind: "image", key: `image:${DASH_IMG}`, label: imageLabel(DASH_IMG, "Dashboard mockup"), section: im.section, index: im.index },
    thread: [{ author: pick(authors), body: "Update this screenshot to the new UI.", ts: ts(ci++) }],
    status: "open",
  });
}

// secondary space home: an ER diagram (addressed → /review diff), a sequence diagram
// (resolved), and a relative-file image (uncommented, for manual comment/enlarge).
{
  const em = pushMedia(secondary, "Data model", `\`\`\`mermaid\n${ERD}\n\`\`\``);
  const erId = addBlockComment({
    pageObj: secondary,
    anchor: { kind: "mermaid", key: mermaidKey(ERD), label: mermaidLabel(ERD), section: em.section, index: em.index },
    thread: [{ author: "you", body: "Rename ORDER to INVOICE across the model.", ts: ts(ci++) }],
    status: "addressed",
    resolution: { note: "renamed ORDER→INVOICE", journalEntryId: "j_block_er" },
  });
  journal.push({
    id: "j_block_er",
    date: "2026-01-08",
    title: "Rename ORDER→INVOICE in the ER diagram",
    summary: "Renamed the entity in the data model.",
    changes: [{ page: secondary.page, commentIds: [erId], what: "renamed the ORDER entity", why: "domain consistency" }],
  });
  addressedEdits.push({ page: secondary.page, line: "> Diagram updated: ORDER renamed to INVOICE." });

  const sm = pushMedia(secondary, "Sequence", `\`\`\`mermaid\n${SEQ}\n\`\`\``);
  const seqId = addBlockComment({
    pageObj: secondary,
    anchor: { kind: "mermaid", key: mermaidKey(SEQ), label: mermaidLabel(SEQ), section: sm.section, index: sm.index },
    thread: [{ author: "alex", body: "Show the error path (4xx) too.", ts: ts(ci++) }],
    status: "resolved",
    resolution: { note: "added the 4xx branch", journalEntryId: "j_block_seq" },
  });
  journal.push({
    id: "j_block_seq",
    date: "2026-01-06",
    title: "Add the error path to the sequence diagram",
    summary: "Documented the 4xx branch.",
    changes: [{ page: secondary.page, commentIds: [seqId], what: "added the error branch", why: "completeness" }],
  });

  // relative-file SVG image (no seeded comment): realistic authoring + manual target.
  const assetRel = `${secondary.page.split("/")[0]}/assets/sequence-overview.svg`;
  mediaAssets.push({ rel: assetRel, content: REL_SVG });
  pushMedia(secondary, "Overview image", "![Sequence overview](./assets/sequence-overview.svg)");
}

// ---- write everything ----
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// config
const cfg = `export default {
  siteName: "Demo",
  tagline: "fake docs",
  locale: ${JSON.stringify(LOCALE)},
  format: ${JSON.stringify(FORMAT)},
  roots: [
${spaces.map((s) => `    { key: "${s.key}", label: "${s.label}", path: "${s.path}", exclude: [".notabene/**"] },`).join("\n")}
  ],
  store: "docs/.notabene",
  review: ${JSON.stringify(REVIEW)},
};
`;
fs.writeFileSync(path.join(OUT, "notabene.config.mjs"), cfg);

// doc files
const pageFileAbs = (page) => path.join(OUT, `${page}.${EXT}`);
for (const pg of [...pagesBySpace.values()].flat()) {
  const f = pageFileAbs(pg.page);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, pg.body);
}

// media assets (referenced by relative image links; data-URI images are inline)
for (const a of mediaAssets) {
  const f = path.join(OUT, a.rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, a.content);
}

// store
const STORE = path.join(OUT, "docs", ".notabene");
fs.mkdirSync(STORE, { recursive: true });
fs.writeFileSync(path.join(STORE, "meta.json"), `${JSON.stringify({ schemaVersion: 3 }, null, 2)}\n`);
// v2 store: one file per comment at <store>/<page>/<id>.json (conflict-free git merges).
for (const [page, list] of commentsByPage) {
  const dir = path.join(STORE, page);
  fs.mkdirSync(dir, { recursive: true });
  for (const c of list) fs.writeFileSync(path.join(dir, `${c.id}.json`), `${JSON.stringify(c, null, 2)}\n`);
}
fs.writeFileSync(path.join(STORE, "journal.json"), `${JSON.stringify(journal, null, 2)}\n`);

// git: commit clean docs, then apply uncommitted "agent edits" so /review shows real diffs
let gitNote = "  (run with --git to get real /review diffs)";
if (GIT) {
  const g = (...a) => execFileSync("git", ["-C", OUT, ...a], { stdio: "ignore" });
  g("init");
  g("config", "user.email", "demo@notabene.dev");
  g("config", "user.name", "notabene demo");
  g("add", "-A");
  g("commit", "-m", "demo docs baseline");
  for (const e of addressedEdits) {
    const f = pageFileAbs(e.page);
    fs.appendFileSync(f, `\n${e.line}\n`);
  }
  gitNote = `  committed baseline + ${addressedEdits.length} uncommitted agent edits (→ /review diffs)`;
}

const nComments = [...commentsByPage.values()].reduce((n, l) => n + l.length, 0);
const nBlocks = [...commentsByPage.values()].flat().filter((c) => c.scope === "block").length;
console.log(`notabene demo written to ${OUT}`);
console.log(
  `  ${spaces.length} space(s), ${[...pagesBySpace.values()].flat().length} pages, ${nComments} comments (${nBlocks} on diagrams/images), ${journal.length} journal entries`,
);
console.log(`  format=${FORMAT} locale=${LOCALE} review=${REVIEW} seed=${SEED}`);
console.log(gitNote);
console.log(`\nRun it:\n  node packages/renderer/bin/notabene.mjs dev --root ${OUT}`);
