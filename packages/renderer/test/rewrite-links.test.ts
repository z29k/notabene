import path from "node:path";
import { describe, expect, it } from "vitest";
import { remarkRewriteLinks } from "../src/remark/rewrite-links.mjs";

const roots = [
  { key: "docs", abs: path.resolve("/repo/docs") },
  { key: "plans", abs: path.resolve("/repo/docs/plans") }, // nested
];
const OFF = { locales: ["en"], defaultLocale: "en", strategy: "directory", enabled: false };
const DIR = { locales: ["en", "fr"], defaultLocale: "en", strategy: "directory", enabled: true };
const SUF = { locales: ["en", "fr"], defaultLocale: "en", strategy: "suffix", enabled: true };

function run(fromFile: string, url: string, i18n = OFF): string {
  const tree = { type: "root", children: [{ type: "link", url, children: [] }] };
  remarkRewriteLinks({ roots, i18n })(tree, { path: fromFile });
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

  it("i18n directory: a same-folder link keeps the locale, as a clean prefixed route", () => {
    expect(run("/repo/docs/fr/index.md", "./guide/a.md", DIR)).toBe("/fr/docs/guide/a");
    expect(run("/repo/docs/en/index.md", "./guide/a.md", DIR)).toBe("/docs/guide/a"); // default unprefixed
  });
  it("i18n suffix: a link with no same-locale sibling falls back to the default route", () => {
    // /repo/docs/b.fr.md does not exist here → falls back to the default-locale /docs/b.
    expect(run("/repo/docs/a.fr.md", "./b.md", SUF)).toBe("/docs/b");
  });
});
