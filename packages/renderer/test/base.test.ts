import { describe, expect, it } from "vitest";
import { applyBase, withBase } from "../src/lib/base";

describe("applyBase", () => {
  it("is a no-op with the root base", () => {
    expect(applyBase("/", "/docs/guide")).toBe("/docs/guide");
    expect(applyBase("/", "/")).toBe("/");
  });

  it("prefixes root-absolute paths", () => {
    expect(applyBase("/repo", "/docs/guide")).toBe("/repo/docs/guide");
    expect(applyBase("/repo", "/")).toBe("/repo/");
    expect(applyBase("/repo", "/llms.txt")).toBe("/repo/llms.txt");
  });

  it("tolerates a trailing slash on the base (Astro's BASE_URL form)", () => {
    expect(applyBase("/repo/", "/docs")).toBe("/repo/docs");
    expect(applyBase("/repo/", "/")).toBe("/repo/");
  });

  it("leaves relative, external, hash and protocol-relative URLs untouched", () => {
    expect(applyBase("/repo", "docs/guide")).toBe("docs/guide");
    expect(applyBase("/repo", "./intro.md")).toBe("./intro.md");
    expect(applyBase("/repo", "https://example.com/x")).toBe("https://example.com/x");
    expect(applyBase("/repo", "#section")).toBe("#section");
    expect(applyBase("/repo", "//cdn.example.com/x")).toBe("//cdn.example.com/x");
  });
});

describe("withBase", () => {
  it('binds applyBase to the build\'s BASE_URL ("/" under vitest)', () => {
    expect(withBase("/docs/guide")).toBe("/docs/guide");
  });
});
