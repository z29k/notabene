import { describe, expect, it } from "vitest";
import { effectiveDiffMode, parseUnifiedDiff, toSideBySide } from "../src/lib/client/diff";

const sample = [
  "diff --git a/x.md b/x.md",
  "index 111..222 100644",
  "--- a/x.md",
  "+++ b/x.md",
  "@@ -1,3 +1,3 @@",
  " # Title",
  " ",
  "-old line",
  "+new line",
  "",
].join("\n");

describe("parseUnifiedDiff", () => {
  const lines = parseUnifiedDiff(sample);
  it("drops file headers, keeps the hunk header", () => {
    expect(lines.some((l) => l.text.startsWith("diff --git"))).toBe(false);
    expect(lines[0]).toEqual({ type: "hunk", text: "@@ -1,3 +1,3 @@" });
  });
  it("classifies add/del/ctx and strips the marker", () => {
    expect(lines).toContainEqual({ type: "del", text: "old line" });
    expect(lines).toContainEqual({ type: "add", text: "new line" });
    expect(lines).toContainEqual({ type: "ctx", text: "# Title" });
  });
  it("returns [] for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});

describe("toSideBySide", () => {
  const rows = toSideBySide(parseUnifiedDiff(sample));
  it("pairs a deletion with the following addition", () => {
    const paired = rows.find((r) => r.left?.type === "del" && r.right?.type === "add");
    expect(paired).toBeTruthy();
    expect(paired?.left?.text).toBe("old line");
    expect(paired?.right?.text).toBe("new line");
  });
  it("keeps context on both sides", () => {
    expect(rows.some((r) => r.left?.type === "ctx" && r.right?.type === "ctx")).toBe(true);
  });
  it("pads the shorter side when counts differ", () => {
    const lines = parseUnifiedDiff(["@@ -1,2 +1,3 @@", "-a", "+b", "+c", "+d"].join("\n"));
    const r = toSideBySide(lines);
    // 1 deletion vs 3 additions → 3 rows, left padded with nulls
    const changed = r.filter((x) => x.right?.type === "add");
    expect(changed.length).toBe(3);
    expect(changed.filter((x) => x.left === null).length).toBe(2);
  });
});

describe("effectiveDiffMode", () => {
  it("keeps the stored preference on wide screens", () => {
    expect(effectiveDiffMode("split", false)).toBe("split");
    expect(effectiveDiffMode("unified", false)).toBe("unified");
  });
  it("forces unified on narrow screens regardless of preference", () => {
    expect(effectiveDiffMode("split", true)).toBe("unified");
    expect(effectiveDiffMode("unified", true)).toBe("unified");
  });
});
