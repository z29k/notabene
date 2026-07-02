import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveStorePath } from "../src/lib/store-path";

const ROOT = "/tmp/store";
const base = path.resolve(ROOT);
const inside = (p: string) => p === base || p.startsWith(base + path.sep);

describe("resolveStorePath", () => {
  it("maps a page to <root>/<page>.json", () => {
    expect(resolveStorePath(ROOT, "docs/index")).toBe(path.resolve(ROOT, "docs/index.json"));
  });
  it("handles nested pages", () => {
    expect(resolveStorePath(ROOT, "docs/guide/a/b")).toBe(path.resolve(ROOT, "docs/guide/a/b.json"));
  });
  it("neutralizes .. traversal (stays inside the store)", () => {
    expect(inside(resolveStorePath(ROOT, "../../etc/passwd"))).toBe(true);
  });
  it("neutralizes leading slashes", () => {
    expect(inside(resolveStorePath(ROOT, "/etc/passwd"))).toBe(true);
  });
  it("neutralizes mixed traversal", () => {
    expect(inside(resolveStorePath(ROOT, "a/../../b"))).toBe(true);
  });
  it("neutralizes backslash separators", () => {
    expect(inside(resolveStorePath(ROOT, "a\\..\\..\\b"))).toBe(true);
  });
});
