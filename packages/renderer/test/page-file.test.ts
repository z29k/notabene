import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePageFile } from "../src/lib/page-file";

const roots = [
  { path: "docs", abs: path.resolve("/repo/docs") },
  { path: "docs/plans", abs: path.resolve("/repo/docs/plans") }, // nested
];
const ext = ["md", "mdx"];
const P = (p: string) => path.resolve("/repo", p);
const has =
  (...paths: string[]) =>
  (p: string) =>
    paths.includes(p);

describe("resolvePageFile", () => {
  it("resolves a direct .md page", () => {
    expect(resolvePageFile("docs/guide/nested", roots, ext, has(P("docs/guide/nested.md")))).toBe(
      P("docs/guide/nested.md"),
    );
  });
  it("resolves a .mdx page", () => {
    expect(resolvePageFile("docs/x", roots, ext, has(P("docs/x.mdx")))).toBe(P("docs/x.mdx"));
  });
  it("falls back to <rel>/index", () => {
    expect(resolvePageFile("docs/guide", roots, ext, has(P("docs/guide/index.md")))).toBe(P("docs/guide/index.md"));
  });
  it("resolves a space root to its index", () => {
    expect(resolvePageFile("docs", roots, ext, has(P("docs/index.md")))).toBe(P("docs/index.md"));
  });
  it("prefers the direct file over the index form", () => {
    const f = resolvePageFile("docs/guide", roots, ext, has(P("docs/guide.md"), P("docs/guide/index.md")));
    expect(f).toBe(P("docs/guide.md"));
  });
  it("uses the most specific root (nested wins)", () => {
    expect(resolvePageFile("docs/plans/svc", roots, ext, has(P("docs/plans/svc.md")))).toBe(P("docs/plans/svc.md"));
  });
  it("returns null when nothing exists", () => {
    expect(resolvePageFile("docs/missing", roots, ext, has())).toBe(null);
  });
  it("never resolves outside a root, even if everything 'exists'", () => {
    const f = resolvePageFile("docs/../../etc/passwd", roots, ext, () => true);
    expect(f === null || f.startsWith(path.resolve("/repo/docs"))).toBe(true);
  });
});
