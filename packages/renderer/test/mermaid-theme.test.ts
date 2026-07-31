import { describe, expect, it } from "vitest";
import { PROBE_VARS, mermaidConfig, mermaidThemeVariables } from "../src/lib/client/mermaid-theme";

const PALETTE = {
  "--accent": "rgb(47, 111, 235)",
  "--accent-soft": "rgb(232, 240, 255)",
  "--text": "rgb(28, 32, 36)",
  "--text-soft": "rgb(91, 100, 112)",
  "--text-faint": "rgb(138, 146, 158)",
  "--bg": "rgb(255, 255, 255)",
  "--bg-soft": "rgb(246, 247, 249)",
  "--bg-elev": "rgb(255, 255, 255)",
  "--border": "rgb(228, 231, 236)",
  fontFamily: "Inter, sans-serif",
} as const;

describe("mermaidThemeVariables", () => {
  const vars = mermaidThemeVariables(PALETTE);
  it("paints nodes with the accent pair and labels with the prose color", () => {
    expect(vars.primaryColor).toBe(PALETTE["--accent-soft"]);
    expect(vars.mainBkg).toBe(PALETTE["--accent-soft"]);
    expect(vars.primaryBorderColor).toBe(PALETTE["--accent"]);
    expect(vars.primaryTextColor).toBe(PALETTE["--text"]);
    expect(vars.lineColor).toBe(PALETTE["--text-soft"]);
    expect(vars.fontFamily).toBe("Inter, sans-serif");
  });
  it("drops what the probe could not read (Mermaid keeps its own value)", () => {
    const partial = mermaidThemeVariables({ "--accent": "rgb(1, 2, 3)" });
    expect(partial.primaryBorderColor).toBe("rgb(1, 2, 3)");
    expect(partial).not.toHaveProperty("lineColor");
    expect(partial).not.toHaveProperty("fontFamily");
  });
  it("emits no empty values", () => {
    for (const [k, v] of Object.entries(vars)) {
      expect(v, k).toBeTruthy();
    }
  });
});

describe("mermaidConfig", () => {
  it("uses the base theme driven by the palette", () => {
    const cfg = mermaidConfig(PALETTE, { dark: false });
    expect(cfg.theme).toBe("base");
    expect(cfg.themeVariables?.primaryColor).toBe(PALETTE["--accent-soft"]);
  });
  it("falls back to the built-in themes when opted out (null palette)", () => {
    expect(mermaidConfig(null, { dark: false })).toEqual({ theme: "default" });
    expect(mermaidConfig(null, { dark: true })).toEqual({ theme: "dark" });
    // /print forces a white page → never the dark built-in theme.
    expect(mermaidConfig(null, { dark: true, forceLight: true })).toEqual({ theme: "default" });
  });
  it("falls back too when the probe read nothing (degrade, never break)", () => {
    expect(mermaidConfig({}, { dark: true })).toEqual({ theme: "dark" });
  });
  it("changes signature with the scheme, so the toggle re-initializes Mermaid", () => {
    const light = JSON.stringify(mermaidConfig(PALETTE, { dark: false }));
    const dark = JSON.stringify(mermaidConfig({ ...PALETTE, "--bg": "rgb(14, 17, 22)" }, { dark: true }));
    expect(light).not.toBe(dark);
  });
});

describe("PROBE_VARS", () => {
  it("probes the INTERNAL aliases — the palette the page actually renders with", () => {
    // Not the --nb-* contract: print.css overrides the internals to force a light
    // palette, so probing them makes /print and the PDF correct with no special case.
    for (const v of PROBE_VARS) expect(v.startsWith("--nb-")).toBe(false);
    expect(PROBE_VARS).toContain("--accent");
  });
});
