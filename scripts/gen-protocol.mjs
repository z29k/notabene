#!/usr/bin/env node
// Regenerate every shipped copy of the protocol from the DOC PAGES (npm run gen:protocol).
//
// The canonical documents are the published pages `docs/reference/agent-protocol.md`
// and `docs/guide/authoring.md` — hand-written, reviewed with the loop like any other
// page. The plugin skills and the packaged protocol are GENERATED from them and
// committed, so the copies can't drift: CI re-runs this script and fails on any diff.
//
//   docs/reference/agent-protocol.md + overlays/notabene.md            → skills/notabene/SKILL.md
//                                    + version banner                  → packages/renderer/protocol.md
//   docs/guide/authoring.md          + overlays/notabene-authoring.md  → skills/notabene-authoring/SKILL.md
//
// An overlay holds ONLY what is specific to the Claude Code plugin (skill frontmatter +
// the setup hand-off, the nb.mjs forwarder and the sibling skill) — hence its home in
// packages/plugin. The transforms are pure + unit-tested (src/lib/protocol-gen.mjs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderProtocol, renderSkill } from "../packages/renderer/src/lib/protocol-gen.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const PROTOCOL_PAGE = "docs/reference/agent-protocol.md";
const AUTHORING_PAGE = "docs/guide/authoring.md";

const protocolSpec = read(PROTOCOL_PAGE);
const authoringSpec = read(AUTHORING_PAGE);

const outputs = [
  [
    "packages/plugin/skills/notabene/SKILL.md",
    renderSkill({
      overlay: read("packages/plugin/overlays/notabene.md"),
      spec: protocolSpec,
      sources: [PROTOCOL_PAGE, "packages/plugin/overlays/notabene.md"],
    }),
  ],
  ["packages/renderer/protocol.md", renderProtocol({ spec: protocolSpec })],
  [
    "packages/plugin/skills/notabene-authoring/SKILL.md",
    renderSkill({
      overlay: read("packages/plugin/overlays/notabene-authoring.md"),
      spec: authoringSpec,
      sources: [AUTHORING_PAGE, "packages/plugin/overlays/notabene-authoring.md"],
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
