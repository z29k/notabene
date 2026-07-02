import path from "node:path";
import { describe, expect, it } from "vitest";
import { remarkRewriteLinks } from "../src/remark/rewrite-links.mjs";

const roots = [
  { key: "docs", abs: path.resolve("/repo/docs") },
  { key: "plans", abs: path.resolve("/repo/docs/plans") }, // nested
];

function run(fromFile: string, url: string): string {
  const tree = { type: "root", children: [{ type: "link", url, children: [] }] };
  remarkRewriteLinks(roots)(tree, { path: fromFile });
  return tree.children[0].url;
}

describe("remarkRewriteLinks", () => {
  it("rewrites a relative .md link to a site route", () => {
    expect(run("/repo/docs/index.md", "./guide/a.md")).toBe("/docs/guide/a");
  });
  it("uses the most specific root for nested spaces", () => {
    expect(run("/repo/docs/plans/index.md", "./services/x.md")).toBe("/plans/services/x");
  });
  it("preserves a hash fragment", () => {
    expect(run("/repo/docs/index.md", "./guide/a.md#section")).toBe("/docs/guide/a#section");
  });
  it("leaves external links untouched", () => {
    expect(run("/repo/docs/index.md", "https://example.com/x.md")).toBe("https://example.com/x.md");
  });
  it("leaves absolute + anchor links untouched", () => {
    expect(run("/repo/docs/index.md", "/abs/x.md")).toBe("/abs/x.md");
    expect(run("/repo/docs/index.md", "#frag")).toBe("#frag");
  });
  it("leaves non-md targets untouched", () => {
    expect(run("/repo/docs/index.md", "./img.png")).toBe("./img.png");
  });
  it("leaves .md targets outside declared spaces as-is", () => {
    expect(run("/repo/docs/index.md", "../../outside/x.md")).toBe("../../outside/x.md");
  });
});
