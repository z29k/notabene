#!/usr/bin/env node
// Regenerate every distributed copy of the protocol from `spec/` (npm run gen:protocol).
//
// The canonical documents are `spec/protocol.md` and `spec/authoring.md` — neutral,
// agent-agnostic, hand-edited. Everything below is GENERATED and committed, so the
// copies can't drift: CI re-runs this script and fails on any diff.
//
//   spec/protocol.md  + spec/claude-overlay.md            → packages/plugin/skills/notabene/SKILL.md
//                     + banner                            → packages/renderer/protocol.md   (npm + <store>/)
//                     + docs frontmatter                  → docs/reference/agent-protocol.md
//   spec/authoring.md + spec/claude-overlay-authoring.md  → packages/plugin/skills/notabene-authoring/SKILL.md
//                     + docs frontmatter                  → docs/guide/authoring.md
//
// The transforms live in packages/renderer/src/lib/protocol-gen.mjs (pure + unit-tested).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderDocsPage, renderProtocol, renderSkill } from "../packages/renderer/src/lib/protocol-gen.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

// A generated docs page is a real page of THIS site (dogfood): it needs the site's
// frontmatter, and a visible "don't edit me" note (see renderDocsPage).
const PROTOCOL_FRONTMATTER = `---
title: The agent protocol
description: The file-I/O-first protocol any agent follows to turn review comments into edits — store layout, anchors, journaling, verification.
sidebar:
  label: Agent protocol
  order: 5
---`;

const AUTHORING_FRONTMATTER = `---
title: Authoring docs
description: The rendering palette — what you can put in a notabene page (CommonMark/GFM, Shiki code, Mermaid diagrams, inter-doc links) and the MDX-safety rules.
sidebar:
  label: Authoring docs
  order: 6
---`;

const note = (specRel) =>
  `> **Generated page.** It is the canonical protocol rendered for the web — edit\n` +
  `> \`${specRel}\` in the [notabene repo](https://github.com/z29k/notabene) and run\n` +
  "> `npm run gen:protocol`; edits made here are overwritten.";

const protocolSpec = read("spec/protocol.md");
const authoringSpec = read("spec/authoring.md");

const outputs = [
  [
    "packages/plugin/skills/notabene/SKILL.md",
    renderSkill({
      overlay: read("spec/claude-overlay.md"),
      spec: protocolSpec,
      sources: ["spec/protocol.md", "spec/claude-overlay.md"],
    }),
  ],
  ["packages/renderer/protocol.md", renderProtocol({ spec: protocolSpec })],
  [
    "docs/reference/agent-protocol.md",
    renderDocsPage({
      spec: protocolSpec,
      frontmatter: PROTOCOL_FRONTMATTER,
      sources: ["spec/protocol.md"],
      note: note("spec/protocol.md"),
    }),
  ],
  [
    "packages/plugin/skills/notabene-authoring/SKILL.md",
    renderSkill({
      overlay: read("spec/claude-overlay-authoring.md"),
      spec: authoringSpec,
      sources: ["spec/authoring.md", "spec/claude-overlay-authoring.md"],
    }),
  ],
  [
    "docs/guide/authoring.md",
    renderDocsPage({
      spec: authoringSpec,
      frontmatter: AUTHORING_FRONTMATTER,
      sources: ["spec/authoring.md"],
      note: note("spec/authoring.md"),
    }),
  ],
];

let changed = 0;
for (const [rel, content] of outputs) {
  const abs = path.join(REPO_ROOT, rel);
  const before = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  if (before === content) continue;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  console.log(`gen-protocol: wrote ${rel}`);
  changed++;
}
console.log(`gen-protocol: ${outputs.length} output(s), ${changed} updated.`);
