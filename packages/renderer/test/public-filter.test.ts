import { describe, expect, it } from "vitest";
import { globToRegExp, isExcluded, isPublicPage, visibleRoots } from "../src/lib/public-filter";

const compile = (globs: string[]) => globs.map(globToRegExp);

describe("globToRegExp / isExcluded", () => {
  it("matches exact page paths", () => {
    expect(isExcluded(compile(["docs/internal"]), "docs/internal")).toBe(true);
    expect(isExcluded(compile(["docs/internal"]), "docs/internal/x")).toBe(false);
  });

  it("`**` matches across segments", () => {
    const p = compile(["docs/internal/**"]);
    expect(isExcluded(p, "docs/internal/a")).toBe(true);
    expect(isExcluded(p, "docs/internal/a/b/c")).toBe(true);
    expect(isExcluded(p, "docs/internals")).toBe(false);
    expect(isExcluded(p, "docs/public/a")).toBe(false);
  });

  it("`*` stays within one segment", () => {
    const p = compile(["docs/*/draft"]);
    expect(isExcluded(p, "docs/guide/draft")).toBe(true);
    expect(isExcluded(p, "docs/a/b/draft")).toBe(false);
  });

  it("escapes regex specials in literals", () => {
    expect(isExcluded(compile(["docs/v1.0"]), "docs/v1.0")).toBe(true);
    expect(isExcluded(compile(["docs/v1.0"]), "docs/v1x0")).toBe(false);
  });

  it("several patterns OR together", () => {
    const p = compile(["docs/wip/**", "notes"]);
    expect(isExcluded(p, "docs/wip/x")).toBe(true);
    expect(isExcluded(p, "notes")).toBe(true);
    expect(isExcluded(p, "docs/done")).toBe(false);
  });
});

// The fixture config has no `publish` block and tests run without NOTABENE_PUBLIC,
// so the bound helpers must behave as identity (dev/normal-build semantics).
describe("outside public mode (test env)", () => {
  it("isPublicPage always allows", () => {
    expect(isPublicPage("docs", "anything", { publish: false })).toBe(true);
  });
  it("visibleRoots keeps every root", () => {
    const all = [{ publish: true }, { publish: false }];
    expect(visibleRoots(all)).toEqual(all);
  });
});
