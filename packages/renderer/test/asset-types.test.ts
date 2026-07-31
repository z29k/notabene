import { describe, expect, it } from "vitest";
import { assetExt, assetPath, contentTypeFor } from "../src/lib/asset-types.mjs";

describe("assetExt", () => {
  it("extracts the lowercased extension", () => {
    expect(assetExt("docs/assets/logo.SVG")).toBe("svg");
    expect(assetExt("a/b/favicon.ico")).toBe("ico");
  });
  it("returns empty when there is none", () => {
    expect(assetExt("docs/logo")).toBe("");
  });
});

describe("contentTypeFor", () => {
  it("maps the image types the branding config accepts", () => {
    expect(contentTypeFor("svg")).toBe("image/svg+xml");
    expect(contentTypeFor("ico")).toBe("image/x-icon");
    expect(contentTypeFor("png")).toBe("image/png");
    expect(contentTypeFor("jpg")).toBe("image/jpeg");
    expect(contentTypeFor("webp")).toBe("image/webp");
  });
  it("maps the font types a theme.assets folder serves", () => {
    expect(contentTypeFor("woff2")).toBe("font/woff2");
    expect(contentTypeFor("woff")).toBe("font/woff");
    expect(contentTypeFor("ttf")).toBe("font/ttf");
    expect(contentTypeFor("otf")).toBe("font/otf");
  });
  it("types every extension the asset folder allows", async () => {
    const { ASSET_EXTENSIONS } = await import("../src/lib/asset-dir.mjs");
    for (const ext of ASSET_EXTENSIONS) {
      expect(contentTypeFor(ext), ext).not.toBe("application/octet-stream");
    }
  });
  it("falls back to octet-stream", () => {
    expect(contentTypeFor("weird")).toBe("application/octet-stream");
  });
});

describe("assetPath", () => {
  it("builds the stable /_nb/ path with the source extension", () => {
    expect(assetPath("logo", "assets/brand/logo.png")).toBe("/_nb/logo.png");
    expect(assetPath("favicon", "docs/favicon.svg")).toBe("/_nb/favicon.svg");
    expect(assetPath("logo-dark", "x/dark.webp")).toBe("/_nb/logo-dark.webp");
  });
  it("tolerates an extension-less source", () => {
    expect(assetPath("logo", "assets/logo")).toBe("/_nb/logo");
  });
});
