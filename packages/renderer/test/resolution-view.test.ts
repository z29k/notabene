import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { collectPackages, linkResolutionView, lookupChain, removeView } from "../src/lib/resolution-view.mjs";

const tmps: string[] = [];
function tmpdir(): string {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "nb-view-")));
  tmps.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

/** Write `<nm>/<name>/package.json` with a version marker. */
function pkg(nm: string, name: string, version: string) {
  fs.mkdirSync(path.join(nm, name), { recursive: true });
  fs.writeFileSync(path.join(nm, name, "package.json"), JSON.stringify({ name, version }));
}
const versionOf = (view: string, name: string) =>
  JSON.parse(fs.readFileSync(path.join(view, name, "package.json"), "utf8")).version;

describe("lookupChain", () => {
  it("lists <dir>/node_modules for every ancestor, nearest first, skipping node_modules dirs", () => {
    const chain = lookupChain("/repo/packages/renderer/node_modules/astro");
    expect(chain.slice(0, 4)).toEqual([
      "/repo/packages/renderer/node_modules/astro/node_modules",
      "/repo/packages/renderer/node_modules",
      "/repo/packages/node_modules",
      "/repo/node_modules",
    ]);
    expect(chain.at(-1)).toBe("/node_modules");
  });
});

describe("collectPackages / linkResolutionView", () => {
  // The layout that broke the Astro 7 build: astro nested in the workspace, its deps
  // split between its own node_modules, the workspace's and the hoisted root.
  function nestedLayout() {
    const root = tmpdir();
    const rootNm = path.join(root, "node_modules");
    const wsNm = path.join(root, "packages/renderer/node_modules");
    const astroNm = path.join(wsNm, "astro/node_modules");
    pkg(rootNm, "@oslojs/encoding", "1.0.0");
    pkg(rootNm, "sharp", "0.33.0"); // the root tools' version…
    pkg(rootNm, "zod", "4.0.0");
    pkg(wsNm, "astro", "7.3.8");
    pkg(wsNm, "sharp", "0.35.5"); // …shadowed by astro's
    pkg(astroNm, "vite", "8.3.4");
    fs.mkdirSync(path.join(rootNm, ".bin"), { recursive: true });
    fs.writeFileSync(path.join(rootNm, ".package-lock.json"), "{}");
    return { root, chains: lookupChain(path.join(wsNm, "astro")) };
  }

  it("sees every level, nearest first, and skips dot entries", () => {
    const { chains } = nestedLayout();
    const found = collectPackages(chains);
    expect([...found.keys()].sort()).toEqual(["@oslojs/encoding", "astro", "sharp", "vite", "zod"]);
    expect(found.get("sharp")).toContain("packages/renderer/node_modules/sharp");
  });

  it("builds a dir of links that resolves like astro does", () => {
    const { chains } = nestedLayout();
    const view = path.join(tmpdir(), "node_modules");
    linkResolutionView(view, chains);
    expect(versionOf(view, "sharp")).toBe("0.35.5");
    expect(versionOf(view, "@oslojs/encoding")).toBe("1.0.0");
    expect(versionOf(view, "vite")).toBe("8.3.4");
    expect(fs.lstatSync(path.join(view, "zod")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(view, "@oslojs")).isDirectory()).toBe(true);
  });

  it("rebuilds over a previous view and over the legacy single symlink — never through them", () => {
    const { root, chains } = nestedLayout();
    const view = path.join(tmpdir(), "node_modules");
    const rootNm = path.join(root, "node_modules");
    // Legacy: one symlink straight at a real node_modules.
    fs.symlinkSync(rootNm, view, "junction");
    linkResolutionView(view, chains);
    linkResolutionView(view, chains); // and again, over a view
    expect(fs.existsSync(path.join(rootNm, "zod/package.json"))).toBe(true);
    expect(fs.existsSync(path.join(rootNm, "@oslojs/encoding/package.json"))).toBe(true);
    expect(fs.lstatSync(view).isDirectory()).toBe(true);
  });

  it("refuses to clear a directory holding anything but links", () => {
    const dir = path.join(tmpdir(), "node_modules");
    pkg(dir, "real", "1.0.0");
    expect(() => removeView(dir)).toThrow();
    expect(fs.existsSync(path.join(dir, "real/package.json"))).toBe(true);
  });
});
