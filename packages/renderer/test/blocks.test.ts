import { describe, expect, it } from "vitest";
import { blockKey, hashSource, imageLabel, matchBlockIndex, mermaidLabel } from "../src/lib/client/blocks";

describe("hashSource / blockKey", () => {
  it("is stable and content-sensitive", () => {
    expect(hashSource("graph TD\n A-->B")).toBe(hashSource("graph TD\n A-->B"));
    expect(hashSource("a")).not.toBe(hashSource("b"));
  });
  it("mermaid key ignores surrounding whitespace; image key = src", () => {
    expect(blockKey("mermaid", "  graph TD  ")).toBe(blockKey("mermaid", "graph TD"));
    expect(blockKey("image", "/img/a.png")).toBe("image:/img/a.png");
  });
});

describe("labels", () => {
  it("mermaidLabel = type + first content line", () => {
    expect(mermaidLabel("erDiagram\n  CUSTOMER ||--o{ ORDER : places")).toBe(
      "erDiagram: CUSTOMER ||--o{ ORDER : places",
    );
    expect(mermaidLabel("flowchart TD")).toBe("flowchart");
  });
  it("imageLabel prefers alt, else filename", () => {
    expect(imageLabel("/x/diagram.png", "Architecture")).toBe("Architecture");
    expect(imageLabel("/x/y/diagram.png?v=2", "")).toBe("diagram.png");
  });
});

describe("matchBlockIndex", () => {
  const blocks = [{ key: "image:a" }, { key: "mermaid:h1" }, { key: "image:a" }];
  it("prefers same key at same index", () => {
    expect(matchBlockIndex({ key: "image:a", index: 2 }, blocks)).toBe(2);
  });
  it("falls back to first same-key on reorder", () => {
    expect(matchBlockIndex({ key: "mermaid:h1", index: 0 }, blocks)).toBe(1);
  });
  it("falls back to index when key is gone but position valid", () => {
    expect(matchBlockIndex({ key: "image:gone", index: 1 }, blocks)).toBe(1);
  });
  it("returns -1 when orphaned (no key, out of range)", () => {
    expect(matchBlockIndex({ key: "image:gone", index: 9 }, blocks)).toBe(-1);
  });
});
