import { describe, expect, it } from "vitest";
import { NB_TOKENS, tokensToCss, validateTokens } from "../src/lib/theme-tokens.mjs";

describe("NB_TOKENS", () => {
  it("mirrors the --nb-* contract declared in styles/global.css", async () => {
    const fs = await import("node:fs");
    const css = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
    for (const token of NB_TOKENS) {
      expect(css, `--nb-${token} missing from global.css`).toContain(`--nb-${token}:`);
    }
    // And the reverse: every declared --nb-* is in the list (no undocumented token).
    const declared = [...new Set([...css.matchAll(/--nb-([a-z-]+):/g)].map((m) => m[1]))];
    for (const name of declared) {
      expect(NB_TOKENS, `--nb-${name} declared but absent from NB_TOKENS`).toContain(name);
    }
  });
});

describe("tokensToCss", () => {
  it("emits a :root override block", () => {
    expect(tokensToCss({ accent: "#7c3aed", radius: "4px" })).toBe(":root{--nb-accent:#7c3aed;--nb-radius:4px}");
  });
  it("returns empty for no tokens", () => {
    expect(tokensToCss({})).toBe("");
  });
});

describe("validateTokens", () => {
  it("accepts contract tokens", () => {
    expect(() => validateTokens({ accent: "x", "bg-soft": "y" })).not.toThrow();
  });
  it("throws on a typo, naming the valid tokens", () => {
    expect(() => validateTokens({ acent: "x" })).toThrow(/unknown theme token "acent".*accent/s);
  });
});
