import path from "node:path";
import { describe, expect, it } from "vitest";
import { ASSET_EXTENSIONS, assetRoute, contains, isAllowedAsset, resolveAsset } from "../src/lib/asset-dir.mjs";

const DIR = path.resolve("/repo/docs/theme/assets");

describe("isAllowedAsset", () => {
  it("accepts fonts, images and stylesheets, at any depth", () => {
    for (const p of ["fonts/Inter.woff2", "bg.png", "a/b/c/mark.svg", "extra.css", "photo.JPG"]) {
      expect(isAllowedAsset(p), p).toBe(true);
    }
  });
  it("refuses anything executable or textual outside the list", () => {
    for (const p of ["notes.md", "config.mjs", "run.js", "data.json", "archive.zip", "README"]) {
      expect(isAllowedAsset(p), p).toBe(false);
    }
  });
  it("refuses traversal, absolute paths and dot-segments", () => {
    for (const p of ["../secret.png", "a/../../b.png", "/etc/passwd.png", ".env.css", "a/.git/x.png", ""]) {
      expect(isAllowedAsset(p), p).toBe(false);
    }
  });
  it("keeps the allow-list free of anything executable", () => {
    for (const bad of ["js", "mjs", "cjs", "ts", "html", "md", "json", "env"]) {
      expect(ASSET_EXTENSIONS).not.toContain(bad);
    }
  });
});

describe("contains", () => {
  it("accepts the folder itself and anything under it", () => {
    expect(contains(DIR, DIR)).toBe(true);
    expect(contains(DIR, path.join(DIR, "fonts/Inter.woff2"))).toBe(true);
  });
  it("refuses a sibling whose name merely shares the prefix", () => {
    expect(contains(DIR, `${DIR}-private/x.png`)).toBe(false);
    expect(contains(DIR, "/repo/docs/theme/secret.png")).toBe(false);
  });
});

describe("resolveAsset", () => {
  it("resolves inside the folder", () => {
    expect(resolveAsset(DIR, "fonts/Inter.woff2")).toBe(path.join(DIR, "fonts/Inter.woff2"));
  });
  it("throws — naming the allow-list — on a refused extension", () => {
    expect(() => resolveAsset(DIR, "secrets.env")).toThrow(/refusing asset "secrets.env".*woff2/s);
  });
  it("throws on traversal", () => {
    expect(() => resolveAsset(DIR, "../../.env.css")).toThrow(/refusing asset/);
  });
});

describe("assetRoute", () => {
  it("mounts every asset under the FIXED /_nb/assets/ prefix", () => {
    expect(assetRoute("fonts/Inter.woff2")).toBe("/_nb/assets/fonts/Inter.woff2");
    expect(assetRoute("bg.png")).toBe("/_nb/assets/bg.png");
  });
});
