import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkLinks, extractLinks, globToRegExp, levenshtein, stripCode, suggest } from "../src/lib/lint-links.mjs";

describe("stripCode", () => {
  it("blanks fenced blocks and inline code, preserving length and lines", () => {
    const src = "a `[x](y.md)` b\n```\n[z](w.md)\n```\nend";
    const out = stripCode(src);
    expect(out.length).toBe(src.length);
    expect(out.split("\n").length).toBe(src.split("\n").length);
    expect(out).not.toContain("y.md");
    expect(out).not.toContain("w.md");
    expect(out).toContain("end");
  });
});

describe("extractLinks", () => {
  it("finds inline links with 1-based positions", () => {
    const [l] = extractLinks("# T\n\nSee [x](./a.md).");
    expect(l).toMatchObject({ target: "./a.md", line: 3 });
    expect(l.column).toBeGreaterThan(0);
  });
  it("finds reference definitions and titles-carrying links", () => {
    const links = extractLinks('[a]: ./def.md\n\n[t](./b.md "Title")');
    expect(links.map((l) => l.target).sort()).toEqual(["./b.md", "./def.md"]);
  });
});

describe("levenshtein / suggest", () => {
  it("computes edit distance", () => {
    expect(levenshtein("intro", "intr")).toBe(1);
    expect(levenshtein("abc", "xyz")).toBe(3);
  });
  it("suggests the closest route within the cap, else null", () => {
    expect(suggest("/docs/guide/intr", ["/docs/guide/intro", "/docs"])).toBe("/docs/guide/intro");
    expect(suggest("/completely/else", ["/docs/guide/intro"])).toBeNull();
  });
});

describe("globToRegExp", () => {
  it("matches like public-filter's matcher", () => {
    expect(globToRegExp(".notabene/**").test(".notabene/docs/x.json")).toBe(true);
    expect(globToRegExp("docs/*/draft").test("docs/a/draft")).toBe(true);
    expect(globToRegExp("docs/*/draft").test("docs/a/b/draft")).toBe(false);
  });
});

describe("checkLinks", () => {
  const routes = new Set(["/docs", "/docs/guide/intro"]);
  // Fake mapper: files under /repo/docs map to /docs/<rel-without-ext>; others null.
  const toRoute = (abs: string) => {
    const rel = path.relative("/repo/docs", abs).replace(/\\/g, "/");
    if (rel.startsWith("..")) return null;
    return `/docs/${rel.replace(/\.md$/i, "")}`.replace(/\/index$/, "") || "/docs";
  };
  const run = (text: string) =>
    checkLinks({ text, fromDir: "/repo/docs", srcLocale: "en", toRoute, resolve: path.resolve, routes });

  it("passes valid links, external links, anchors and absolute paths", () => {
    expect(run("[ok](./guide/intro.md) [ext](https://x.dev/a.md) [h](#x) [abs](/docs/whatever)")).toEqual([]);
  });
  it("flags a missing route with a suggestion", () => {
    const [d] = run("[typo](./guide/intr.md)");
    expect(d).toMatchObject({ kind: "missing", route: "/docs/guide/intr", suggestion: "/docs/guide/intro" });
  });
  it("flags links escaping every declared space", () => {
    const [d] = run("[out](../../elsewhere/x.md)");
    expect(d).toMatchObject({ kind: "outside", link: "../../elsewhere/x.md" });
  });
  it("ignores links inside code", () => {
    expect(run("`[x](./guide/nope.md)`\n\n```\n[y](./guide/nope.md)\n```")).toEqual([]);
  });
});
