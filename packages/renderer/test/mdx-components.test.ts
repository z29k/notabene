import { describe, expect, it } from "vitest";
import {
  MDX_COMPONENTS_ID,
  MDX_COMPONENT_EXTENSIONS,
  assertMdxFormat,
  assertMdxModule,
  planMdxComponents,
  sharesAncestor,
} from "../src/lib/mdx-components.mjs";

const file = (rel: string) => ({ rel, abs: `/repo/${rel}` });

/** Evaluate the generated module for real: swap each `<id>/<n>` specifier for a data-URL
 *  stub, then import it. Asserting on the SEMANTICS of `componentsFor` beats asserting on
 *  the source text — the text is an implementation detail, the resolution order is not. */
async function evaluate(code: string, mods: unknown[]) {
  const src = code.replace(new RegExp(`"${MDX_COMPONENTS_ID}/(\\d+)"`, "g"), (_m, i) =>
    JSON.stringify(`data:text/javascript,${encodeURIComponent(`export default ${JSON.stringify(mods[Number(i)])};`)}`),
  );
  return (await import(`data:text/javascript,${encodeURIComponent(src)}`)) as {
    componentsFor: (space?: string | null) => Record<string, unknown> | undefined;
  };
}

describe("assertMdxFormat", () => {
  it("accepts the mdx format", () => {
    expect(() => assertMdxFormat("mdx", "mdxComponents")).not.toThrow();
  });

  it("refuses commonmark, naming the key", () => {
    expect(() => assertMdxFormat("commonmark", "roots[1].mdxComponents")).toThrow(
      /roots\[1\]\.mdxComponents requires format: "mdx"/,
    );
  });
});

describe("assertMdxModule", () => {
  it("accepts every JS/TS module extension", () => {
    for (const ext of MDX_COMPONENT_EXTENSIONS) {
      expect(() => assertMdxModule(`site/nb${ext}`, "mdxComponents")).not.toThrow();
    }
  });

  it("refuses a .astro file — it default-exports a component, not a map", () => {
    expect(() => assertMdxModule("site/Accroche.astro", "mdxComponents")).toThrow(/must point at a JS\/TS module/);
  });

  it("refuses an extension-less path", () => {
    expect(() => assertMdxModule("site/components", "mdxComponents")).toThrow(/must point at a JS\/TS module/);
  });
});

describe("sharesAncestor", () => {
  it("holds for the layout a real install produces (renderer under the repo)", () => {
    expect(sharesAncestor("/home/me/repo", "/home/me/repo/node_modules/@z29k/notabene")).toBe(true);
    // …and for an npx cache, as long as it sits under the same top-level folder.
    expect(sharesAncestor("/home/me/repo", "/home/me/.npm/_npx/ab12/node_modules/@z29k/notabene")).toBe(true);
  });

  it("fails for a scratch consumer reviewed by a checkout elsewhere", () => {
    expect(sharesAncestor("/tmp/scratch", "/Users/me/dev/notabene/packages/renderer")).toBe(false);
    expect(sharesAncestor("/tmp/scratch", "/home/runner/work/notabene/notabene/packages/renderer")).toBe(false);
  });

  it("compares Windows drives, not just POSIX roots", () => {
    expect(sharesAncestor("C:\\repo", "C:\\repo\\node_modules\\@z29k\\notabene")).toBe(true);
    expect(sharesAncestor("D:\\repo", "C:\\tools\\notabene")).toBe(false);
  });

  it("never calls two empty paths a match", () => {
    expect(sharesAncestor("/", "/")).toBe(false);
    expect(sharesAncestor("", "")).toBe(false);
  });
});

describe("planMdxComponents", () => {
  it("compiles nothing and resolves to undefined when unconfigured", async () => {
    const { files, code } = planMdxComponents({ global: null, bySpace: {} });
    expect(files).toEqual([]);
    const mod = await evaluate(code, []);
    expect(mod.componentsFor("docs")).toBeUndefined();
    expect(mod.componentsFor(null)).toBeUndefined();
  });

  it("defaults every space (and the space-less home) to the global map", async () => {
    const { files, code } = planMdxComponents({ global: file("nb/all.ts"), bySpace: {} });
    expect(files).toEqual(["/repo/nb/all.ts"]);
    const mod = await evaluate(code, [{ A: "global" }]);
    expect(mod.componentsFor("docs")).toEqual({ A: "global" });
    expect(mod.componentsFor(null)).toEqual({ A: "global" });
  });

  it("lets a space REPLACE the global map (never merge it)", async () => {
    const { files, code } = planMdxComponents({
      global: file("nb/all.ts"),
      bySpace: { site: file("nb/site.ts") },
    });
    expect(files).toEqual(["/repo/nb/all.ts", "/repo/nb/site.ts"]);
    const mod = await evaluate(code, [{ A: "global" }, { B: "site" }]);
    expect(mod.componentsFor("site")).toEqual({ B: "site" });
    expect(mod.componentsFor("docs")).toEqual({ A: "global" });
    expect(mod.componentsFor(null)).toEqual({ A: "global" });
  });

  it("leaves spaces without a map undefined when only some declare one", async () => {
    const { files, code } = planMdxComponents({ global: null, bySpace: { site: file("nb/site.ts") } });
    expect(files).toEqual(["/repo/nb/site.ts"]);
    const mod = await evaluate(code, [{ B: "site" }]);
    expect(mod.componentsFor("site")).toEqual({ B: "site" });
    expect(mod.componentsFor("docs")).toBeUndefined();
    expect(mod.componentsFor(null)).toBeUndefined();
  });

  it("compiles a file shared by several spaces exactly once", async () => {
    const { files, code } = planMdxComponents({
      global: file("nb/all.ts"),
      bySpace: { a: file("nb/all.ts"), b: file("nb/other.ts") },
    });
    expect(files).toEqual(["/repo/nb/all.ts", "/repo/nb/other.ts"]);
    const mod = await evaluate(code, [{ A: 1 }, { B: 2 }]);
    expect(mod.componentsFor("a")).toEqual({ A: 1 });
    expect(mod.componentsFor("b")).toEqual({ B: 2 });
  });

  it("is not fooled by a space named like an Object prototype key", async () => {
    const { code } = planMdxComponents({ global: file("nb/all.ts"), bySpace: {} });
    const mod = await evaluate(code, [{ A: 1 }]);
    expect(mod.componentsFor("constructor")).toEqual({ A: 1 });
    expect(mod.componentsFor("toString")).toEqual({ A: 1 });
  });

  it("rejects a module whose default export is not a component map, naming the file", async () => {
    const { code } = planMdxComponents({ global: file("nb/all.ts"), bySpace: {} });
    await expect(evaluate(code, ["not a map"])).rejects.toThrow(
      /mdxComponents module "nb\/all\.ts" must default-export an object/,
    );
    await expect(evaluate(code, [["A", "B"]])).rejects.toThrow(/must default-export an object/);
    await expect(evaluate(code, [null])).rejects.toThrow(/must default-export an object/);
  });
});
