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
//        [--i18n directory|suffix]   ← bilingual demo (adds the other of en/fr)
//        [--chrome]                  ← site-chrome seeds: branding assets, the theme
//                                      contract (tokens / css / assets folder / code
//                                      theme) and nav links (topbar, sidebar block,
//                                      footer) — incl. a publish:false link and a
//                                      non-asset file as `--publish` canaries
//        [--publish]                 ← public-scoping seeds: a private space
//                                      (roots[].publish:false), a publish.exclude'd
//                                      wip/ sub-tree, a frontmatter publish:false page,
//                                      `description` frontmatter, and a `publish` config
//                                      block — then `build --public` exercises them all
//                                      (the *-PRIVATE markers must not reach the artifact)
//        [--components]              ← `mdxComponents` seeds (implies --format mdx): a
//                                      component module in the FIXTURE's own repo, used
//                                      by every page, plus a second module overriding it
//                                      for one space (roots[].mdxComponents)
//   Defaults: outDir=<repo>/.demo (gitignored), commonmark, en, approve, 2 spaces,
//             4 pages/space, seed=42, git off.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
// Flags that consume the following token as their value — so it is NOT a positional arg.
// (Without this, `--i18n directory` treats "directory" as the outDir positional.)
const VALUE_FLAGS = new Set(["format", "locale", "review", "spaces", "pages", "seed", "i18n"]);
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    if (VALUE_FLAGS.has(a.slice(2)) && argv[i + 1] && !argv[i + 1].startsWith("--")) i++; // skip its value
    continue;
  }
  positional.push(a);
}
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);

// Default: a gitignored `.demo/` inside the repo (browsable, persistent), resolved from
// the repo root so it works regardless of cwd. An explicit path overrides it.
const OUT = positional[0] ? path.resolve(positional[0]) : path.join(REPO_ROOT, ".demo");
// --components seeds config `mdxComponents`, which only exists in MDX — so it flips the
// default format rather than silently doing nothing. An explicit contradictory --format
// is an error, never an override (a demo that quietly ignores your flag is a bug report).
const COMPONENTS = has("components");
const FORMAT = flag("format", COMPONENTS ? "mdx" : "commonmark");
if (COMPONENTS && FORMAT !== "mdx") {
  console.error('gen-fixture: --components requires --format mdx (components do not exist in CommonMark).');
  process.exit(1);
}
const LOCALE = flag("locale", "en");
const REVIEW = flag("review", "approve");
const N_SPACES = Math.max(1, Number(flag("spaces", 2)));
const N_PAGES = Math.max(2, Number(flag("pages", 4)));
const SEED = Number(flag("seed", 42));
const GIT = has("git");
const PUBLISH = has("publish");
const CHROME = has("chrome");
const EXT = FORMAT === "mdx" ? "mdx" : "md";

// Bilingual mode (demo of the multi-language feature): --i18n directory|suffix.
// The default locale = --locale; the other of en/fr is added as the second language. EVERY
// page is translated (full EN/FR parity — a real bilingual doc: equivalent content, so page
// equivalence, the switcher, and hreflang land on real pages everywhere).
const I18N = flag("i18n", null);
const I18N_ON = I18N === "directory" || I18N === "suffix";
const STRATEGY = I18N === "suffix" ? "suffix" : "directory";
const DEFAULT_LOCALE = LOCALE;
const OTHER_LOCALE = LOCALE === "fr" ? "en" : "fr";
const LOCALES = I18N_ON ? [DEFAULT_LOCALE, OTHER_LOCALE] : [DEFAULT_LOCALE];

// Plain "<spacePath>/<rel>" page → its raw (locale-encoded) id / store key, per strategy.
function rawId(plainPage, locale) {
  if (!I18N_ON) return plainPage;
  const i = plainPage.indexOf("/");
  const sp = plainPage.slice(0, i);
  const rel = plainPage.slice(i + 1);
  if (STRATEGY === "directory") return `${sp}/${locale}/${rel}`;
  return locale === DEFAULT_LOCALE ? plainPage : `${sp}/${rel}.${locale}`;
}
// `<spacePath>/assets/x` → per-locale asset path (directory mode inserts the locale folder).
function assetPath(rel, locale) {
  if (!I18N_ON || STRATEGY === "suffix") return rel;
  const i = rel.indexOf("/");
  return `${rel.slice(0, i)}/${locale}/${rel.slice(i + 1)}`;
}
// FR vocabulary for the bilingual demo — makes the `fr` locale genuinely French (the prose
// is filler in BOTH languages; this swaps English tokens for French ones so the page reads as
// a real translation). Deterministic (pure string transforms). Only `fr` is special-cased;
// any other target locale falls back to the base (English) content.
const FR_WORD = {
  system: "système", service: "service", request: "requête", token: "jeton", cache: "cache",
  queue: "file", billing: "facturation", invoice: "facture", tenant: "locataire", region: "région",
  cluster: "grappe", node: "nœud", retry: "réessai", timeout: "délai", policy: "politique",
  schema: "schéma", migration: "migration", pipeline: "pipeline", webhook: "webhook", payload: "charge",
  latency: "latence", quota: "quota", session: "session", cursor: "curseur", index: "index",
  shard: "fragment", replica: "réplique", backlog: "arriéré", throttle: "limitation",
  idempotent: "idempotent", boundary: "frontière", contract: "contrat", adapter: "adaptateur",
  renderer: "moteur", anchor: "ancre", journal: "journal", comment: "commentaire", resolve: "résoudre",
};
const FR_TITLE = {
  "Auth tokens": "Jetons d'auth", "Rate limits": "Limites de débit", Billing: "Facturation",
  Ingestion: "Ingestion", Webhooks: "Webhooks", Caching: "Mise en cache", Migrations: "Migrations",
  Queues: "Files",
};
const FR_HEADING = {
  Overview: "Vue d'ensemble", "How it works": "Fonctionnement", Configuration: "Configuration",
  Operations: "Exploitation", "Edge cases": "Cas limites", Limits: "Limites",
  Architecture: "Architecture", Dashboard: "Tableau de bord", "Data model": "Modèle de données",
  Sequence: "Séquence", "Overview image": "Image d'aperçu",
};
// Whole-word EN→FR, preserving a leading capital; markdown link/image targets are shielded.
function frInline(text) {
  const urls = [];
  text = text.replace(/\]\([^)]*\)/g, (m) => `\u0000${urls.push(m) - 1}\u0000`);
  text = text.replace(/[A-Za-zÀ-ÿ]+/g, (w) => {
    const fr = FR_WORD[w.toLowerCase()];
    if (!fr) return w;
    return /^[A-Z]/.test(w) ? fr.charAt(0).toUpperCase() + fr.slice(1) : fr;
  });
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => urls[Number(i)]);
}
function frLine(line) {
  const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  if (h) {
    const [, hashes, textRaw] = h;
    if (hashes.length === 1) {
      let text = textRaw;
      for (const [en, fr] of Object.entries(FR_TITLE)) {
        if (text === en || text.startsWith(`${en} `)) {
          text = fr + text.slice(en.length);
          break;
        }
      }
      return `${hashes} ${frInline(text)}`;
    }
    return `${hashes} ${FR_HEADING[textRaw] ?? frInline(textRaw)}`;
  }
  line = line
    .replace("| Field | Meaning |", "| Champ | Signification |")
    .replace("| ttl | time to live |", "| ttl | durée de vie |")
    .replace("| id | identifier |", "| id | identifiant |")
    .replace(/^See also /, "Voir aussi ");
  return frInline(line);
}
// Translate a page body to `locale`, skipping fenced code / mermaid (kept verbatim).
function translate(body, locale) {
  if (locale === DEFAULT_LOCALE || locale !== "fr") return body;
  let inFence = false;
  // Leading YAML frontmatter is data (publish/description/sidebar keys), not prose —
  // pass it through untouched or the FR variant gets mangled YAML.
  let inFrontmatter = body.startsWith("---\n");
  let fmSeen = 0;
  return body
    .split("\n")
    .map((line) => {
      if (inFrontmatter) {
        if (line === "---" && ++fmSeen === 2) inFrontmatter = false;
        return line;
      }
      if (/^```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      // A JSX block tag is markup, not prose (`--components`): translating it would rename
      // the component or its props. Its CHILDREN sit on their own lines and are translated.
      if (!inFence && /^<\/?[A-Z]/.test(line)) return line;
      return inFence ? line : frLine(line);
    })
    .join("\n");
}

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

// ---- --components: the `mdxComponents` extension point ----
// Two modules in the FIXTURE's own repo (the renderer compiles them through Vite —
// nothing is scaffolded): a global palette every space gets, and one that REPLACES it for
// a single space, so the demo shows both halves of the config. The children of each tag
// are ordinary prose, deliberately: words a component *produces* would have nothing for a
// comment to anchor to, words kept in the page stay reviewable (see the config guide).
const COMPONENT_SPACE = COMPONENTS && N_SPACES >= 2 ? SPACES[1].key : null;
const COMPONENT_MAP = "nb/components.ts";
const COMPONENT_MAP_SPACE = COMPONENT_SPACE ? `nb/components-${COMPONENT_SPACE}.ts` : null;

/** The component block a page of `spaceKey` may use — its space's map, and only that. */
function componentBlock(spaceKey) {
  if (!COMPONENTS) return null;
  if (spaceKey === COMPONENT_SPACE) {
    return {
      prose: "This paragraph lives in the page, not in the component — so it stays reviewable.",
      wrap: (prose) => `<Spec name="ttl" value="60s">\n\n${prose}\n\n</Spec>\n\n`,
      inline: null,
    };
  }
  return {
    prose: "Callouts are the classic reason to reach for MDX: plain Markdown has no admonitions.",
    wrap: (prose) => `<Callout kind="note">\n\n${prose}\n\n</Callout>\n\n`,
    inline: 'Status: <Chip label="beta" /> — an inline component inside a sentence.\n\n',
  };
}

const componentFiles = !COMPONENTS
  ? []
  : [
      {
        rel: "nb/Callout.astro",
        content:
          "---\n// A demo component of the FIXTURE repo, published to .mdx pages by\n" +
          "// `mdxComponents` in notabene.config.mjs. Styled with the renderer's public\n" +
          "// --nb-* tokens, so it follows the theme and the light/dark toggle.\n" +
          'const { kind = "note" } = Astro.props;\n---\n\n' +
          '<aside class="demo-callout">\n  <p class="demo-callout-kind">{kind}</p>\n  <slot />\n</aside>\n\n' +
          "<style>\n" +
          "  .demo-callout {\n" +
          "    border-left: 3px solid var(--nb-accent);\n" +
          "    background: var(--nb-accent-soft);\n" +
          "    border-radius: var(--nb-radius);\n" +
          "    padding: 0.2rem 1rem;\n" +
          "    margin: 1.2rem 0;\n" +
          "  }\n" +
          "  .demo-callout-kind {\n" +
          "    text-transform: uppercase;\n" +
          "    letter-spacing: 0.08em;\n" +
          "    font-size: 0.74rem;\n" +
          "    color: var(--nb-accent);\n" +
          "  }\n" +
          "</style>\n",
      },
      {
        rel: "nb/Chip.astro",
        content:
          "---\nconst { label } = Astro.props;\n---\n\n" +
          '<span class="demo-chip">{label}</span>\n\n' +
          "<style>\n" +
          "  .demo-chip {\n" +
          "    border: 1px solid var(--nb-border);\n" +
          "    border-radius: 999px;\n" +
          "    padding: 0.05rem 0.5rem;\n" +
          "    font-size: 0.8em;\n" +
          "  }\n" +
          "</style>\n",
      },
      ...(COMPONENT_SPACE
        ? [
            {
              rel: "nb/Spec.astro",
              content:
                "---\n// Only reachable from the space whose roots[] entry names the module\n" +
                "// below — a per-space map REPLACES the global one, it does not merge.\n" +
                "const { name, value } = Astro.props;\n---\n\n" +
                '<section class="demo-spec">\n' +
                '  <p><code>{name}</code> = <b>{value}</b></p>\n  <slot />\n</section>\n\n' +
                "<style>\n" +
                "  .demo-spec {\n" +
                "    border: 1px dashed var(--nb-border);\n" +
                "    border-radius: var(--nb-radius);\n" +
                "    padding: 0.2rem 1rem;\n" +
                "    margin: 1.2rem 0;\n" +
                "  }\n" +
                "</style>\n",
            },
            {
              rel: COMPONENT_MAP_SPACE,
              content:
                "// Config `roots[].mdxComponents` for one space. The DEFAULT EXPORT is the map;\n" +
                "// a name missing from it is a build error on the page that uses it.\n" +
                'import Spec from "./Spec.astro";\n\nexport default { Spec };\n',
            },
          ]
        : []),
      {
        rel: COMPONENT_MAP,
        content:
          "// Config `mdxComponents`: the global palette, available to every space that does\n" +
          "// not declare its own. A path is configured (not the map itself) because\n" +
          "// notabene.config.mjs is also read by plain Node, which cannot import .astro.\n" +
          'import Callout from "./Callout.astro";\nimport Chip from "./Chip.astro";\n\n' +
          "export default { Callout, Chip };\n",
      },
    ];

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
      // --components: one tag per page, from THIS space's map (see componentBlock).
      const comp = componentBlock(space.key);
      if (comp) {
        plain.push({ text: comp.prose, section: SECTIONS[s % SECTIONS.length] });
        body += comp.wrap(comp.prose);
        if (comp.inline) body += comp.inline;
      }
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
let heldOnce = false; // guarantee ONE on-hold comment whatever the seed (the agent must
// skip it — a fixture where `hold` never lands leaves that rule untested).
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
      hold: heldOnce ? rnd() < 0.2 : (heldOnce = true),
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
  const cid = id("r");
  addFile(pg.page, {
    id: cid,
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
        // Back-link required by the contract: /review inverts the journal to build a
        // comment's diff, so an empty commentIds[] renders an EMPTY diff (caught by
        // `notabene comments verify`).
        page: pg.page,
        commentIds: [cid],
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

// ---- public-publish scoping seeds (--publish) ----
// One seed per `build --public` scoping knob, on top of the normal corpus:
//   space level    → an extra `internal` space with roots[].publish: false
//   sub-tree level → a wip/ page in the primary space, matched by publish.exclude
//   page level     → a page with frontmatter `publish: false`
// plus `description` frontmatter on the primary home (public meta/OG). Verify with
//   node packages/renderer/bin/notabene.mjs build --root <out> --public
// — no *-PRIVATE marker may appear in the artifact; a normal build shows them all.
let publishExclude = null;
if (PUBLISH) {
  const internal = { key: "internal", label: "Internal", path: "internal", publish: false };
  spaces.push(internal);
  const ipages = [makePage(internal, ["index"], 0), makePage(internal, ["oncall", "rotations-1"], 1)];
  for (const p of ipages) p.body += "\nSPACE-PRIVATE marker: this space never ships publicly.\n";
  pagesBySpace.set(internal.key, ipages);

  const primary = spaces[0];
  const wip = makePage(primary, ["wip", "draft-1"], N_PAGES + 1);
  wip.body += "\nGLOB-PRIVATE marker: excluded via publish.exclude.\n";
  const fmPage = makePage(primary, ["guide", "unreleased-1"], N_PAGES + 2);
  fmPage.body = `---\npublish: false\n---\n\n${fmPage.body}\nPAGE-PRIVATE marker: excluded via frontmatter.\n`;
  pagesBySpace.get(primary.key).push(wip, fmPage);

  const home = pagesBySpace.get(primary.key)[0];
  home.body = `---\ndescription: Deterministic demo corpus for the notabene public build.\n---\n\n${home.body}`;

  publishExclude = [`${primary.key}/wip/**`];
}

// ---- site chrome seeds (--chrome) ----
// Everything a repo can customize WITHOUT touching content: branding assets, the theme
// contract (tokens / stylesheet / asset folder / code theme) and the outbound nav links
// (topbar, sidebar block, footer). Off by default so the baseline demo keeps rendering
// the stock chrome; with the flag the demo is visibly themed and every mount point has
// something in it. Deterministic (hand-written SVGs, no randomness).
// Two seeds double as `--publish` canaries: a `publish: false` nav link and a non-asset
// file inside the assets folder — neither may appear in a `build --public` artifact.
const chromeFiles = [];
let chromeCfg = "";
if (CHROME) {
  const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${inner}</svg>`;
  chromeFiles.push(
    { rel: "brand/logo.svg", content: svg('<rect width="32" height="32" rx="7" fill="#7c3aed"/>') },
    { rel: "brand/logo-dark.svg", content: svg('<rect width="32" height="32" rx="7" fill="#b79bff"/>') },
    { rel: "brand/favicon.svg", content: svg('<circle cx="16" cy="16" r="14" fill="#7c3aed"/>') },
    {
      rel: "brand/og.svg",
      content:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 126">' +
        '<rect width="240" height="126" fill="#241a3d"/><circle cx="120" cy="63" r="34" fill="#b79bff"/></svg>',
    },
    // The asset folder is served at the FIXED /_nb/assets/ mount, so the stylesheet
    // addresses it RELATIVE to the served sheet (/_nb/theme.css) — the only form that
    // also survives a `base` sub-path. Fonts work the same way (@font-face src).
    {
      rel: "brand/assets/dots.svg",
      content:
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
        '<circle cx="2" cy="2" r="1" fill="#b79bff" opacity="0.35"/></svg>',
    },
    // Canary: NOT an asset extension → the allow-list must refuse to serve it.
    { rel: "brand/assets/secrets.env", content: "TOKEN=ASSET-PRIVATE marker: never served, never published.\n" },
    {
      rel: "brand/theme.css",
      content:
        "/* Consumer stylesheet (config theme.css), served at /_nb/theme.css. Only --nb-*\n" +
        "   tokens + the documented hooks — see docs/guide/customize.md.\n" +
        "   The url() is RELATIVE: it resolves against the served sheet, so it finds the\n" +
        "   theme.assets folder at /_nb/assets/ and survives a `base` sub-path. */\n" +
        ".home-cards {\n" +
        "  background-image: url(\"./assets/dots.svg\");\n" +
        "  background-size: 16px 16px;\n" +
        "  padding: 1.1rem;\n" +
        "  border: 1px solid var(--nb-border);\n" +
        "  border-radius: var(--nb-radius);\n" +
        "}\n" +
        ".site-footer { font-variant-numeric: tabular-nums; }\n",
    },
  );
  const repo = "https://github.com/z29k/notabene";
  chromeCfg =
    `  branding: { logo: "brand/logo.svg", logoDark: "brand/logo-dark.svg", ` +
    `favicon: "brand/favicon.svg", socialImage: "brand/og.svg" },\n` +
    `  theme: {\n` +
    `    tokens: { accent: "light-dark(#7c3aed, #b79bff)", "accent-soft": "light-dark(#f1e9ff, #241a3d)" },\n` +
    `    css: "brand/theme.css",\n` +
    `    assets: "brand/assets",\n` +
    `    code: { light: "github-light", dark: "github-dark" },\n` +
    `  },\n` +
    `  nav: {\n` +
    `    header: [\n` +
    `      { label: "GitHub", href: ${JSON.stringify(repo)}, icon: "github", iconOnly: true },\n` +
    `      { label: { en: "Product", fr: "Produit" }, href: "https://example.com" },\n` +
    // The publish:false canary is a --publish concern: it must NOT reach a public
    // artifact. Left out of a plain --chrome demo, where it would just be a stray
    // "NAV-PRIVATE" label in the topbar (these seeds also feed the demo GIFs).
    (PUBLISH ? `      { label: "NAV-PRIVATE dashboard", href: "https://nav-private.example", publish: false },\n` : "") +
    `    ],\n` +
    `    sidebar: {\n` +
    `      title: { en: "Resources", fr: "Ressources" },\n` +
    `      links: [\n` +
    `        { label: "Releases", href: ${JSON.stringify(`${repo}/releases`)}, icon: "star" },\n` +
    `        { label: "npm", href: "https://www.npmjs.com/package/@z29k/notabene", icon: "npm" },\n` +
    `      ],\n` +
    `    },\n` +
    `    footer: {\n` +
    `      links: [\n` +
    `        { label: { en: "Home", fr: "Accueil" }, href: "/", icon: "home" },\n` +
    `        { label: { en: "Contact", fr: "Contact" }, href: "mailto:demo@notabene.dev", icon: "mail" },\n` +
    `      ],\n` +
    `      text: { en: "© 2026 demo — MIT", fr: "© 2026 demo — MIT" },\n` +
    `      poweredBy: true,\n` +
    `    },\n` +
    `  },\n`;
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
${spaces.map((s) => `    { key: "${s.key}", label: "${s.label}", path: "${s.path}", exclude: [".notabene/**"]${s.publish === false ? ", publish: false" : ""}${s.key === COMPONENT_SPACE ? `, mdxComponents: ${JSON.stringify(COMPONENT_MAP_SPACE)}` : ""} },`).join("\n")}
  ],
${COMPONENTS ? `  mdxComponents: ${JSON.stringify(COMPONENT_MAP)},\n` : ""}  store: "docs/.notabene",
  review: ${JSON.stringify(REVIEW)},
${chromeCfg}${I18N_ON ? `  i18n: { locales: ${JSON.stringify(LOCALES)}, defaultLocale: ${JSON.stringify(DEFAULT_LOCALE)}, strategy: ${JSON.stringify(STRATEGY)} },\n` : ""}${PUBLISH ? `  publish: { site: "https://demo.example.com", exclude: ${JSON.stringify(publishExclude)} },\n` : ""}};
`;
fs.writeFileSync(path.join(OUT, "notabene.config.mjs"), cfg);

// branding / theme files (--chrome) + component modules (--components). Repo-relative,
// pointed at by the config — nothing is scaffolded into the consumer's tree by notabene.
for (const f of [...chromeFiles, ...componentFiles]) {
  const abs = path.join(OUT, f.rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, f.content);
}

// doc files. In i18n mode nearly EVERY page is written in EVERY locale (near-full parity — a
// real bilingual doc), EXCEPT one content page left in the default locale only, on purpose,
// to exercise the fallback + the "not available in your language" banner. `pageFileAbs`
// points at the DEFAULT-locale file (used by the git edits).
const pageFileAbs = (page) => path.join(OUT, `${rawId(page, DEFAULT_LOCALE)}.${EXT}`);
const untranslatedPage = I18N_ON ? contentPages[contentPages.length - 1]?.page : null;
for (const pg of [...pagesBySpace.values()].flat()) {
  for (const loc of LOCALES) {
    if (loc !== DEFAULT_LOCALE && pg.page === untranslatedPage) continue; // demo: EN-only page
    const f = path.join(OUT, `${rawId(pg.page, loc)}.${EXT}`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, translate(pg.body, loc));
  }
}

// media assets (referenced by relative image links; data-URI images are inline). In
// directory mode they're written under each locale's folder so the relative link resolves.
for (const a of mediaAssets) {
  for (const loc of LOCALES) {
    const f = path.join(OUT, assetPath(a.rel, loc));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, a.content);
  }
}

// store
const STORE = path.join(OUT, "docs", ".notabene");
fs.mkdirSync(STORE, { recursive: true });
fs.writeFileSync(path.join(STORE, "meta.json"), `${JSON.stringify({ schemaVersion: 3 }, null, 2)}\n`);
// v2 store: one file per comment at <store>/<page>/<id>.json (conflict-free git merges).
// Comments/journal are seeded on the DEFAULT-locale pages → remap their `page` key to the
// raw (locale-encoded) id so it matches the file on disk (directory mode moves the files).
for (const [page, list] of commentsByPage) {
  const storePage = rawId(page, DEFAULT_LOCALE);
  const dir = path.join(STORE, storePage);
  fs.mkdirSync(dir, { recursive: true });
  for (const c of list) {
    c.page = storePage;
    fs.writeFileSync(path.join(dir, `${c.id}.json`), `${JSON.stringify(c, null, 2)}\n`);
  }
}
for (const j of journal) for (const ch of j.changes) ch.page = rawId(ch.page, DEFAULT_LOCALE);
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
console.log(
  `  format=${FORMAT} locale=${LOCALE} review=${REVIEW} seed=${SEED}${I18N_ON ? ` i18n=${STRATEGY} [${LOCALES.join(",")}]` : ""}`,
);
if (untranslatedPage) console.log(`  demo fallback: ${untranslatedPage} is ${DEFAULT_LOCALE}-only (exercises the banner)`);
console.log(gitNote);
if (CHROME) {
  console.log(
    "  chrome seeds: branding (logo/dark/favicon/og) · theme (tokens + css + assets folder + dual code theme) · " +
      "nav (topbar icon, Resources block, footer)",
  );
}
if (COMPONENTS) {
  console.log(
    `  component seeds: ${COMPONENT_MAP} (Callout + Chip, global)` +
      (COMPONENT_SPACE ? ` · ${COMPONENT_MAP_SPACE} (Spec — replaces it for "${COMPONENT_SPACE}")` : "") +
      "\n  every .mdx page uses its own space's map; a name outside it is a build error",
  );
}
if (PUBLISH) {
  console.log(
    "  publish seeds: internal/ (space private) · docs/wip/ (publish.exclude) · " +
      "guide/unreleased-1 (frontmatter publish: false) · description on the primary home\n" +
      `  verify: node packages/renderer/bin/notabene.mjs build --root ${OUT} --public` +
      "  → no *-PRIVATE marker in the artifact" +
      (CHROME ? " (NAV-PRIVATE + ASSET-PRIVATE included)" : ""),
  );
}
console.log(`\nRun it:\n  node packages/renderer/bin/notabene.mjs dev --root ${OUT}`);
