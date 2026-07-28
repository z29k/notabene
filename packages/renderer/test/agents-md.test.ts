import { describe, expect, it } from "vitest";
import { BEGIN, END, detectEol, hasAgentsBlock, mergeAgentsBlock, renderAgentsBlock } from "../src/lib/agents-md.mjs";

const block = renderAgentsBlock({ storeRel: "docs/.notabene", protocolRel: "docs/.notabene/protocol.md" });

describe("renderAgentsBlock", () => {
  it("is bounded by the markers and points at RESOLVED repo paths", () => {
    expect(block.startsWith(BEGIN)).toBe(true);
    expect(block.trimEnd().endsWith(END)).toBe(true);
    expect(block).toContain("`docs/.notabene/`");
    expect(block).toContain("`docs/.notabene/protocol.md`");
  });
  it("falls back to the URL + scoped npx when there is no local copy (--no-protocol)", () => {
    const b = renderAgentsBlock({ storeRel: "docs/.notabene", protocolRel: null });
    expect(b).toContain("https://z29k.github.io/notabene/reference/agent-protocol/");
    expect(b).toContain("npx -y @z29k/notabene@latest protocol");
    expect(b).not.toMatch(/npx (-y )?notabene\b/);
  });
  it("normalizes a Windows store path", () => {
    expect(renderAgentsBlock({ storeRel: "docs\\.notabene" })).toContain("`docs/.notabene/`");
  });
});

describe("mergeAgentsBlock", () => {
  it("creates the file when there is none", () => {
    const { text, action } = mergeAgentsBlock(null, block);
    expect(action).toBe("created");
    expect(text.startsWith("# Agent instructions")).toBe(true);
    expect(hasAgentsBlock(text)).toBe(true);
  });

  it("appends to a file that has no markers, preserving every existing line", () => {
    const existing = "# My repo\n\nRun `make test` before pushing.\n";
    const { text, action } = mergeAgentsBlock(existing, block);
    expect(action).toBe("appended");
    expect(text.startsWith(existing.trimEnd())).toBe(true);
    expect(text).toContain("Run `make test` before pushing.");
    expect(hasAgentsBlock(text)).toBe(true);
  });

  it("replaces ONLY the span between markers (repair after a reconfigure)", () => {
    const stale = `# Repo\n\nkeep me\n\n${BEGIN}\nold store path\n${END}\n\ntrailing user text\n`;
    const { text, action } = mergeAgentsBlock(stale, block);
    expect(action).toBe("replaced");
    expect(text).toContain("keep me");
    expect(text).toContain("trailing user text");
    expect(text).not.toContain("old store path");
    expect(text.match(new RegExp(BEGIN, "g"))).toHaveLength(1);
  });

  it("is idempotent — merging twice changes nothing", () => {
    const once = mergeAgentsBlock("# Repo\n\ntext\n", block).text;
    const twice = mergeAgentsBlock(once, block);
    expect(twice.action).toBe("unchanged");
    expect(twice.text).toBe(once);
  });

  it("refuses to guess when the block is unterminated (hand-mangled file)", () => {
    const broken = `# Repo\n\n${BEGIN}\nhalf a block\n`;
    const { text, action } = mergeAgentsBlock(broken, block);
    expect(action).toBe("unterminated");
    expect(text).toBe(broken);
  });

  it("treats a whitespace-only file as empty", () => {
    expect(mergeAgentsBlock("\n  \n", block).action).toBe("created");
  });

  it("preserves CRLF line endings", () => {
    const crlf = "# Repo\r\n\r\nRun tests.\r\n";
    const { text } = mergeAgentsBlock(crlf, block);
    expect(detectEol(text)).toBe("\r\n");
    expect(text).not.toMatch(/[^\r]\n/);
    expect(hasAgentsBlock(text)).toBe(true);
  });

  it("stays LF for an LF file", () => {
    const { text } = mergeAgentsBlock("# Repo\n\ntext\n", block);
    expect(text).not.toContain("\r");
  });
});
