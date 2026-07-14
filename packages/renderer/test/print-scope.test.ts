import { describe, expect, it } from "vitest";
import type { NavNode } from "../src/lib/nav";
import {
  findSubtree,
  flattenNav,
  folderPrefixes,
  parseScope,
  scopeParam,
  scopeToPath,
  sectionId,
} from "../src/lib/print-scope";

describe("parseScope", () => {
  it("undefined → the whole doc", () => {
    expect(parseScope(undefined)).toEqual({ kind: "doc" });
    expect(parseScope("")).toEqual({ kind: "doc" });
  });
  it("parses space / folder / page", () => {
    expect(parseScope("space/docs")).toEqual({ kind: "space", space: "docs" });
    expect(parseScope("folder/docs/guide/advanced")).toEqual({
      kind: "folder",
      space: "docs",
      path: "guide/advanced",
    });
    expect(parseScope("page/docs/guide/setup")).toEqual({ kind: "page", space: "docs", id: "guide/setup" });
  });
  it("rejects malformed scopes", () => {
    expect(parseScope("space")).toBeNull(); // missing key
    expect(parseScope("space/docs/extra")).toBeNull(); // space takes no rest
    expect(parseScope("folder/docs")).toBeNull(); // folder needs a path
    expect(parseScope("page/docs")).toBeNull(); // page needs an id
    expect(parseScope("bogus/docs/x")).toBeNull();
  });
});

describe("scopeParam / scopeToPath round-trip", () => {
  const cases = ["space/docs", "folder/docs/guide/advanced", "page/docs/guide/setup"];
  it("undefined ↔ /print", () => {
    expect(scopeParam({ kind: "doc" })).toBeUndefined();
    expect(scopeToPath({ kind: "doc" })).toBe("/print");
  });
  it("param round-trips through parseScope", () => {
    for (const c of cases) {
      const parsed = parseScope(c);
      if (!parsed) throw new Error(`expected "${c}" to parse`);
      expect(scopeParam(parsed)).toBe(c);
      expect(scopeToPath(parsed)).toBe(`/print/${c}`);
    }
  });
});

describe("sectionId", () => {
  it("is stable, slugified and namespaced by space", () => {
    expect(sectionId("docs", "guide/setup")).toBe("pg-docs-guide-setup");
    expect(sectionId("API Ref", "a/b_c")).toBe("pg-api-ref-a-b-c");
  });
  it("keeps distinct spaces from colliding", () => {
    expect(sectionId("a", "intro")).not.toBe(sectionId("b", "intro"));
  });
});

describe("folderPrefixes", () => {
  it("collects every ancestor folder, sorted + deduped", () => {
    expect(folderPrefixes(["index", "guide/setup", "guide/advanced/deep", "api/ref"])).toEqual([
      "api",
      "guide",
      "guide/advanced",
    ]);
  });
  it("ignores top-level pages (no folder)", () => {
    expect(folderPrefixes(["index", "about"])).toEqual([]);
  });
});

// buildNav-shaped tree for the flatten/subtree helpers.
const tree: NavNode[] = [
  {
    type: "group",
    label: "Guide",
    segment: "guide",
    prefix: "/docs/guide",
    children: [
      { type: "leaf", title: "Setup", href: "/docs/guide/setup", segment: "setup", id: "guide/setup" },
      {
        type: "group",
        label: "Advanced",
        segment: "advanced",
        prefix: "/docs/guide/advanced",
        children: [
          {
            type: "leaf",
            title: "Deep",
            href: "/docs/guide/advanced/deep",
            segment: "deep",
            id: "guide/advanced/deep",
          },
        ],
      },
    ],
  },
  { type: "leaf", title: "About", href: "/docs/about", segment: "about", id: "about" },
];

describe("flattenNav", () => {
  it("emits groups + leaves depth-first with depth + anchor ids", () => {
    expect(flattenNav("docs", tree)).toEqual([
      { type: "group", label: "Guide", depth: 1 },
      { type: "leaf", space: "docs", id: "guide/setup", title: "Setup", depth: 2, anchorId: "pg-docs-guide-setup" },
      { type: "group", label: "Advanced", depth: 2 },
      {
        type: "leaf",
        space: "docs",
        id: "guide/advanced/deep",
        title: "Deep",
        depth: 3,
        anchorId: "pg-docs-guide-advanced-deep",
      },
      { type: "leaf", space: "docs", id: "about", title: "About", depth: 1, anchorId: "pg-docs-about" },
    ]);
  });
});

describe("findSubtree", () => {
  it("returns the children of the matching folder group", () => {
    const sub = findSubtree(tree, "guide");
    expect(sub?.map((n) => (n.type === "leaf" ? n.href : n.label))).toEqual(["/docs/guide/setup", "Advanced"]);
  });
  it("descends nested folders", () => {
    const sub = findSubtree(tree, "guide/advanced");
    expect(sub?.map((n) => (n.type === "leaf" ? n.href : n.label))).toEqual(["/docs/guide/advanced/deep"]);
  });
  it("returns null for an unknown folder", () => {
    expect(findSubtree(tree, "nope")).toBeNull();
    expect(findSubtree(tree, "guide/missing")).toBeNull();
  });
});
