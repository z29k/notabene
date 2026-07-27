import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBundlePath, searchContentType } from "../src/lib/dev-search.mjs";

describe("searchContentType", () => {
  it("maps the pagefind bundle surface", () => {
    expect(searchContentType("pagefind.js")).toContain("text/javascript");
    expect(searchContentType("pagefind-ui.css")).toContain("text/css");
    expect(searchContentType("pagefind-entry.json")).toContain("application/json");
    expect(searchContentType("wasm.en.pagefind")).toBe("application/octet-stream");
    expect(searchContentType("x.wasm")).toBe("application/wasm");
    expect(searchContentType("fragment/en_abc.pf_fragment")).toBe("application/octet-stream");
  });
});

describe("resolveBundlePath", () => {
  const root = path.resolve("/srv/bundle");

  it("resolves plain and nested files inside the bundle dir", () => {
    expect(resolveBundlePath(root, "pagefind.js")).toBe(path.join(root, "pagefind.js"));
    expect(resolveBundlePath(root, "fragment/en_abc.pf_fragment")).toBe(
      path.join(root, "fragment", "en_abc.pf_fragment"),
    );
  });

  it("rejects escapes, absolute paths, empty and malformed input", () => {
    expect(resolveBundlePath(root, "../secret")).toBeNull();
    expect(resolveBundlePath(root, "fragment/../../secret")).toBeNull();
    expect(resolveBundlePath(root, "%2e%2e/secret")).toBeNull();
    expect(resolveBundlePath(root, "/etc/passwd")).toBeNull();
    expect(resolveBundlePath(root, "")).toBeNull();
    expect(resolveBundlePath(root, "a%zz")).toBeNull();
    expect(resolveBundlePath(root, "a\0b")).toBeNull();
  });
});
