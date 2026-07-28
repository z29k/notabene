import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../src/lib/comment-types";
import { stripCode } from "../src/lib/lint-links.mjs";
import {
  BODY_MARKER,
  PROTOCOL_STORE_SCHEMA,
  PROTOCOL_VERSION,
  insertAfterFrontmatter,
  insertAfterH1,
  isGeneratedProtocol,
  joinSpec,
  parseProtocolVersion,
  renderDocsPage,
  renderProtocol,
  renderSkill,
  splitSpec,
} from "../src/lib/protocol-gen.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const SPEC = `# Title\n\nFront door.\n\n${BODY_MARKER}\n\n## Step 1\n\nBody.\n`;
const OVERLAY = "---\nname: x\n---\n\n# Claude title\n\nClient rules.\n\n{{body}}\n";

describe("splitSpec", () => {
  it("splits the front door from the shared body", () => {
    const { header, body } = splitSpec(SPEC);
    expect(header).toBe("# Title\n\nFront door.");
    expect(body).toBe("## Step 1\n\nBody.\n");
  });
  it("throws when the marker is missing (a silent miss would leak the neutral front door)", () => {
    expect(() => splitSpec("# No marker\n")).toThrow(/nb:body/);
  });
  it("joins back into one document without the marker", () => {
    expect(joinSpec(SPEC)).toBe("# Title\n\nFront door.\n\n## Step 1\n\nBody.\n");
    expect(joinSpec(SPEC)).not.toContain(BODY_MARKER);
  });
});

describe("insertion helpers", () => {
  it("puts a banner AFTER frontmatter (never before, or it stops being frontmatter)", () => {
    const out = insertAfterFrontmatter("---\na: 1\n---\n\n# H\n", "<!-- b -->");
    expect(out.startsWith("---\na: 1\n---\n")).toBe(true);
    expect(out).toContain("---\n\n<!-- b -->\n");
  });
  it("prepends when there is no frontmatter", () => {
    expect(insertAfterFrontmatter("# H\n", "<!-- b -->")).toBe("<!-- b -->\n\n# H\n");
  });
  it("inserts a note right after the first H1", () => {
    expect(insertAfterH1("# H\n\ntext\n", "> note")).toBe("# H\n\n> note\n\ntext\n");
  });
});

describe("renderSkill", () => {
  const skill = renderSkill({ overlay: OVERLAY, spec: SPEC, sources: ["spec/protocol.md"] });

  it("keeps the frontmatter first, then the provenance banner", () => {
    expect(skill.startsWith("---\nname: x\n---\n")).toBe(true);
    expect(skill).toMatch(/---\n\n<!-- Generated from spec\/protocol\.md/);
  });
  it("uses the overlay's front door and the spec's body", () => {
    expect(skill).toContain("# Claude title");
    expect(skill).toContain("Client rules.");
    expect(skill).toContain("## Step 1");
    expect(skill).not.toContain("Front door."); // the neutral front door is replaced
    expect(skill).not.toContain(BODY_MARKER);
  });
  it("throws when the overlay has no {{body}} placeholder", () => {
    expect(() => renderSkill({ overlay: "---\na: 1\n---\n\nno slot\n", spec: SPEC, sources: [] })).toThrow(
      /\{\{body\}\}/,
    );
  });
  it("is idempotent (same inputs → byte-identical output)", () => {
    expect(renderSkill({ overlay: OVERLAY, spec: SPEC, sources: ["spec/protocol.md"] })).toBe(skill);
  });
  // The spec is prose: `$…$`, shell snippets, `$&`… A string replacement would read
  // those as substitution patterns and splice the overlay into the middle of the body.
  it("splices a body containing $ substitution patterns verbatim", () => {
    const tricky = `# T\n\nfront\n\n${BODY_MARKER}\n\nMath \`$…$\` renders literally; $& $\` $' $1 stay.\n`;
    const out = renderSkill({ overlay: OVERLAY, spec: tricky, sources: [] });
    expect(out).toContain("Math `$…$` renders literally; $& $` $' $1 stay.");
    expect(out.match(/^---$/gm)).toHaveLength(2); // frontmatter delimiters, not one more
  });
});

describe("renderProtocol", () => {
  const out = renderProtocol({ spec: SPEC });

  it("stamps the versioned sentinel banner and the whole document", () => {
    expect(out.split("\n")[0]).toBe(
      `<!-- notabene agent protocol v${PROTOCOL_VERSION} · store schemaVersion ${PROTOCOL_STORE_SCHEMA} · generated — do not edit -->`,
    );
    expect(out).toContain("Front door.");
    expect(out).toContain("## Step 1");
  });
  it("carries NO package version (it would break the CI diff gate on every release)", () => {
    const pkg = JSON.parse(read("packages/renderer/package.json")).version;
    expect(out).not.toContain(pkg);
  });
  it("round-trips through the sentinel helpers", () => {
    expect(isGeneratedProtocol(out)).toBe(true);
    expect(parseProtocolVersion(out)).toBe(PROTOCOL_VERSION);
  });
  it("does not claim a file the user wrote", () => {
    expect(isGeneratedProtocol("# My own notes\n")).toBe(false);
    expect(parseProtocolVersion("# My own notes\n")).toBeNull();
  });
});

describe("renderDocsPage", () => {
  const page = renderDocsPage({
    spec: SPEC,
    frontmatter: "---\ntitle: T\n---",
    sources: ["spec/protocol.md"],
    note: "> **Generated page.**",
  });

  it("keeps site frontmatter first and warns the reader after the H1", () => {
    expect(page.startsWith("---\ntitle: T\n---\n")).toBe(true);
    expect(page).toContain("# Title\n\n> **Generated page.**\n");
  });
});

describe("the committed outputs", () => {
  const outputs = {
    "packages/plugin/skills/notabene/SKILL.md": read("packages/plugin/skills/notabene/SKILL.md"),
    "packages/renderer/protocol.md": read("packages/renderer/protocol.md"),
    "docs/reference/agent-protocol.md": read("docs/reference/agent-protocol.md"),
  };
  const authoring = {
    "packages/plugin/skills/notabene-authoring/SKILL.md": read("packages/plugin/skills/notabene-authoring/SKILL.md"),
    "docs/guide/authoring.md": read("docs/guide/authoring.md"),
  };

  // Frontmatter belongs at the very top, once. (A `$`-mangled splice re-injected it in
  // the middle of the body — a skill with a second frontmatter block silently rots.)
  // Code is blanked first: the authoring palette legitimately shows a frontmatter
  // EXAMPLE inside a fence.
  it.each(Object.entries({ ...outputs, ...authoring }))("%s carries its frontmatter once, on top", (_name, text) => {
    const prose = stripCode(text);
    const firstH1 = prose.indexOf("\n# ");
    for (const key of ["name: notabene", "\ntitle: "]) {
      const first = prose.indexOf(key);
      if (first === -1) continue;
      expect(first).toBe(prose.lastIndexOf(key));
      expect(first).toBeLessThan(firstH1);
    }
  });

  it.each(Object.entries(authoring))("%s carries the whole authoring palette", (_name, text) => {
    for (const heading of ["## First: know the format", "## The palette", "## Mermaid diagrams", "## Not available"]) {
      expect(text).toContain(heading);
    }
    expect(text).toContain("Math** — no KaTeX/MathJax; `$…$` renders literally.");
    expect(text).not.toContain(BODY_MARKER);
  });

  // A broken overlay could silently amputate the spec: the diff gate catches a CHANGE,
  // this catches a LOSS in the very commit that introduces it.
  it.each(Object.entries(outputs))("%s carries the whole protocol", (_name, text) => {
    for (const heading of [
      "## Discovery",
      "## Strict rules",
      "## Step 1 — Read the comments to process",
      "## Step 2 — Locate the source page",
      "## Step 3 — Resolve the anchor",
      "## Step 4 — Edit the docs",
      "## Step 5 — Mark the comment",
      "## Step 6 — Verify",
      "## Step 7 — Report",
    ]) {
      expect(text).toContain(heading);
    }
    expect(text).not.toContain(BODY_MARKER);
  });

  // `npx notabene <cmd>` resolves nothing unless the renderer is a local dependency:
  // unscoped `notabene` is not our package (free on npm — a squatter would be executed
  // by `-y`). Naming it to FORBID it is fine; invoking it is not.
  it("never invokes the unscoped npx name (not our package)", () => {
    for (const text of Object.values(outputs)) {
      expect(text).not.toMatch(/npx\s+(-y\s+)?notabene\s+[a-z]/);
    }
  });

  it("uses absolute links only (relative .md links would break `notabene lint` on the site)", () => {
    const body = outputs["docs/reference/agent-protocol.md"]
      .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
      .replace(/`[^`\n]*`/g, "");
    for (const m of body.matchAll(/\]\(\s*([^)\s]+)/g)) {
      expect(m[1]).toMatch(/^(https?:|#)/);
    }
  });

  it("describes the store schema this renderer actually writes", () => {
    expect(PROTOCOL_STORE_SCHEMA).toBe(SCHEMA_VERSION);
  });
});
