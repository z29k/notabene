import { describe, expect, it } from "vitest";
import { parseGitLog } from "../src/lib/git-dates.mjs";

describe("parseGitLog", () => {
  it("maps paths to their NEWEST author date (first sighting wins, newest first)", () => {
    const out = parseGitLog(["t:2000", "M\tdocs/a.md", "", "t:1000", "M\tdocs/a.md", "M\tdocs/b.md", ""].join("\n"));
    expect(out.get("docs/a.md")).toBe(2000);
    expect(out.get("docs/b.md")).toBe(1000);
  });

  it("keys rename rows on the NEW path (last tab field)", () => {
    const out = parseGitLog("t:3000\nR100\tdocs/old.md\tdocs/new.md\n");
    expect(out.get("docs/new.md")).toBe(3000);
    expect(out.has("docs/old.md")).toBe(false);
  });

  it("ignores malformed timestamps and stray lines", () => {
    const out = parseGitLog("t:oops\nM\tdocs/x.md\nnoise\nt:500\nA\tdocs/y.md\n");
    expect(out.has("docs/x.md")).toBe(false);
    expect(out.get("docs/y.md")).toBe(500);
  });
});
