import { describe, expect, it } from "vitest";
import { SHIKI_THEMES, codeThemeCss, normalizeCodeTheme } from "../src/lib/shiki-themes.mjs";

describe("SHIKI_THEMES", () => {
  it("mirrors the bundled themes of the installed shiki", async () => {
    const { bundledThemes } = await import("shiki");
    const bundled = Object.keys(bundledThemes).sort();
    // Both directions: an upgrade that adds or drops a theme must fail here, not
    // silently reject a valid name (or accept a gone one).
    expect(SHIKI_THEMES).toEqual(bundled);
  });
});

describe("normalizeCodeTheme", () => {
  it("is null when unset — the single built-in theme, unchanged output", () => {
    expect(normalizeCodeTheme(null)).toBeNull();
    expect(normalizeCodeTheme(undefined)).toBeNull();
    expect(codeThemeCss(null)).toBe("");
  });
  it("expands one name to both schemes", () => {
    expect(normalizeCodeTheme("github-light")).toEqual({ light: "github-light", dark: "github-light" });
  });
  it("keeps a light/dark pair", () => {
    expect(normalizeCodeTheme({ light: "github-light", dark: "vesper" })).toEqual({
      light: "github-light",
      dark: "vesper",
    });
  });
  it("throws on an unknown theme name (a typo must not silently no-op)", () => {
    expect(() => normalizeCodeTheme("githubb-light")).toThrow(/unknown theme.code "githubb-light"/);
    expect(() => normalizeCodeTheme({ light: "nope", dark: "vesper" })).toThrow(/unknown theme.code.light/);
    expect(() => normalizeCodeTheme({ light: "vitesse-light", dark: "nope" })).toThrow(/unknown theme.code.dark/);
  });
  it("throws on a half pair or an unknown key", () => {
    expect(() => normalizeCodeTheme({ light: "github-light" })).toThrow(/needs BOTH light and dark/);
    expect(() => normalizeCodeTheme({ light: "github-light", dark: "vesper", auto: "x" })).toThrow(
      /unknown key "auto"/,
    );
    expect(() => normalizeCodeTheme(["github-light"])).toThrow(/theme name or \{ light, dark \}/);
  });
});

describe("codeThemeCss", () => {
  const css = codeThemeCss({ light: "github-light", dark: "github-dark" });
  it("routes both palettes through light-dark() so the scheme toggle recolors code", () => {
    expect(css).toContain("light-dark(var(--shiki-light),var(--shiki-dark))");
    expect(css).toContain("light-dark(var(--shiki-light-bg),var(--shiki-dark-bg))");
  });
  it("sets the background through the internal token, never a competing !important", () => {
    // An un-layered !important would LOSE to global.css's layered one (importance
    // reverses layer order) — the custom property is what actually wins.
    expect(css).toContain("--code-bg:");
    expect(css).not.toContain("!important");
  });
});
