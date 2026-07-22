import { describe, expect, it } from "vitest";
import {
  alternatesFor,
  buildEquivalence,
  decode,
  isSpaceHomeId,
  localizeField,
  makeSuffixGenerateId,
  routeFor,
  switchLinks,
} from "../src/lib/i18n-content.mjs";

const DIR = { locales: ["en", "fr"], defaultLocale: "en", strategy: "directory", enabled: true };
const SUF = { locales: ["en", "fr"], defaultLocale: "en", strategy: "suffix", enabled: true };
const OFF = { locales: ["en"], defaultLocale: "en", strategy: "directory", enabled: false };

describe("decode — directory", () => {
  it("peels the leading locale folder", () => {
    expect(decode("en/guide/setup", DIR)).toEqual({ locale: "en", id: "guide/setup" });
    expect(decode("fr/guide/setup", DIR)).toEqual({ locale: "fr", id: "guide/setup" });
    expect(decode("fr/index", DIR)).toEqual({ locale: "fr", id: "index" });
  });
  it("treats a non-locale-prefixed file as the default locale", () => {
    expect(decode("guide/setup", DIR)).toEqual({ locale: "en", id: "guide/setup" });
  });
});

describe("decode — suffix", () => {
  it("peels a trailing .<loc> on the file stem", () => {
    expect(decode("guide/setup.fr", SUF)).toEqual({ locale: "fr", id: "guide/setup" });
    expect(decode("index.fr", SUF)).toEqual({ locale: "fr", id: "index" });
    expect(decode("guide/setup.en", SUF)).toEqual({ locale: "en", id: "guide/setup" });
  });
  it("keeps a bare file as the default locale", () => {
    expect(decode("guide/setup", SUF)).toEqual({ locale: "en", id: "guide/setup" });
  });
  it("does NOT treat a non-locale dot as a marker (api.v2)", () => {
    expect(decode("guide/notes.v2", SUF)).toEqual({ locale: "en", id: "guide/notes.v2" });
  });
});

describe("decode — disabled (mono-language parity)", () => {
  it("returns the id unchanged", () => {
    expect(decode("guide/setup.fr", OFF)).toEqual({ locale: "en", id: "guide/setup.fr" });
    expect(decode("en/guide", OFF)).toEqual({ locale: "en", id: "en/guide" });
  });
});

describe("makeSuffixGenerateId", () => {
  const gen = makeSuffixGenerateId(SUF);
  it("strips only the final extension, preserving the locale marker verbatim", () => {
    expect(gen({ entry: "guide/setup.fr.md" })).toBe("guide/setup.fr");
    expect(gen({ entry: "guide/setup.md" })).toBe("guide/setup");
    expect(gen({ entry: "index.mdx" })).toBe("index");
    expect(gen({ entry: "guide/notes.v2.md" })).toBe("guide/notes.v2");
  });
});

describe("isSpaceHomeId", () => {
  it("matches only the root readme/index (or empty)", () => {
    for (const id of ["", "index", "README", "readme"]) expect(isSpaceHomeId(id)).toBe(true);
    for (const id of ["guide/setup", "guide/index", "about"]) expect(isSpaceHomeId(id)).toBe(false);
  });
});

describe("routeFor — clean prefixed URLs", () => {
  it("leaves the default locale unprefixed, prefixes the others", () => {
    expect(routeFor({ space: "docs", id: "guide/setup", locale: "en" }, DIR)).toBe("/docs/guide/setup");
    expect(routeFor({ space: "docs", id: "guide/setup", locale: "fr" }, DIR)).toBe("/fr/docs/guide/setup");
  });
  it("routes the synthetic space home (id '') to /<space>; a readme keeps its own id", () => {
    expect(routeFor({ space: "docs", id: "", locale: "en" }, DIR)).toBe("/docs");
    expect(routeFor({ space: "docs", id: "", locale: "fr" }, DIR)).toBe("/fr/docs");
    expect(routeFor({ space: "docs", id: "index", locale: "en" }, DIR)).toBe("/docs/index");
  });
  it("disabled → unprefixed like today", () => {
    expect(routeFor({ space: "docs", id: "guide", locale: "en" }, OFF)).toBe("/docs/guide");
  });
});

describe("buildEquivalence + alternatesFor", () => {
  const entries = [
    { space: "docs", rawId: "en/guide/setup" },
    { space: "docs", rawId: "fr/guide/setup" },
    { space: "docs", rawId: "en/about" },
  ];
  it("groups translations by (space, canonical id)", () => {
    const eq = buildEquivalence(entries, DIR);
    expect(alternatesFor("docs", "guide/setup", eq, DIR)).toEqual([
      { locale: "en", href: "/docs/guide/setup" },
      { locale: "fr", href: "/fr/docs/guide/setup" },
    ]);
    expect(alternatesFor("docs", "about", eq, DIR)).toEqual([{ locale: "en", href: "/docs/about" }]);
  });
  it("switchLinks: every space-locale, page-equivalent or home fallback (translated flag)", () => {
    const eq = buildEquivalence(entries, DIR);
    expect(switchLinks("docs", "guide/setup", eq, ["en", "fr"], DIR)).toEqual([
      { locale: "en", href: "/docs/guide/setup", translated: true },
      { locale: "fr", href: "/fr/docs/guide/setup", translated: true },
    ]);
    // "about" exists only in EN → FR falls back to the FR space home, translated:false.
    expect(switchLinks("docs", "about", eq, ["en", "fr"], DIR)).toEqual([
      { locale: "en", href: "/docs/about", translated: true },
      { locale: "fr", href: "/fr/docs", translated: false },
    ]);
  });
  it("flags a directory collision (bare file + locale folder → same route)", () => {
    const dups: unknown[] = [];
    buildEquivalence(
      [
        { space: "docs", rawId: "guide" },
        { space: "docs", rawId: "en/guide" },
      ],
      DIR,
      (d: unknown) => dups.push(d),
    );
    expect(dups).toEqual([{ space: "docs", id: "guide", locale: "en", rawId: "en/guide" }]);
  });
});

describe("localizeField — per-locale roots[].label / .description", () => {
  it("returns a plain string verbatim (mono-language / backward compat)", () => {
    expect(localizeField("Docs", "fr", "en")).toBe("Docs");
    // A string is locale-agnostic — the requested locale is irrelevant.
    expect(localizeField("Docs", "de", "en")).toBe("Docs");
  });
  it("picks the exact locale from a map", () => {
    expect(localizeField({ en: "Documentation", fr: "Documentation FR" }, "fr", "en")).toBe("Documentation FR");
  });
  it("falls back to the default locale when the requested one is missing", () => {
    expect(localizeField({ en: "Guides", de: "Anleitungen" }, "fr", "en")).toBe("Guides");
  });
  it("falls back to the first non-empty value when neither locale nor default is present", () => {
    expect(localizeField({ es: "Guías", it: "Guide" }, "fr", "en")).toBe("Guías");
  });
  it("ignores empty / whitespace entries during resolution", () => {
    expect(localizeField({ fr: "  ", en: "Docs" }, "fr", "en")).toBe("Docs");
  });
  it("ignores non-string map values (defensive against arbitrary config)", () => {
    expect(localizeField({ fr: 42, en: "Docs" }, "fr", "en")).toBe("Docs");
  });
  it("returns undefined for null / non-object / empty map", () => {
    expect(localizeField(undefined, "fr", "en")).toBeUndefined();
    expect(localizeField(null, "fr", "en")).toBeUndefined();
    expect(localizeField(123, "fr", "en")).toBeUndefined();
    expect(localizeField({}, "fr", "en")).toBeUndefined();
  });
});
