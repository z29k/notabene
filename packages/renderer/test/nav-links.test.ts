import { describe, expect, it } from "vitest";
import { NAV_ICONS, NAV_ICON_NAMES } from "../src/lib/nav-icons.mjs";
import {
  EMPTY_NAV,
  filterPublicNav,
  hasFooter,
  navClientLabels,
  navLabelId,
  normalizeHref,
  normalizeItem,
  normalizeLabel,
  normalizeLinks,
  normalizeNav,
} from "../src/lib/nav-links.mjs";

const link = (over = {}) => ({ label: "GitHub", href: "https://github.com/z29k/notabene", ...over });

describe("normalizeHref", () => {
  it("keeps an https URL external and blank-targeted", () => {
    expect(normalizeHref("https://example.com/x", "nav.header[0]")).toEqual({
      href: "https://example.com/x",
      internal: false,
      blank: true,
    });
  });
  it("treats a site path as internal (base applied at emission)", () => {
    expect(normalizeHref("/guide/install", "x")).toEqual({ href: "/guide/install", internal: true, blank: false });
  });
  it("allows mailto without opening a tab", () => {
    expect(normalizeHref("mailto:hi@example.com", "x")).toEqual({
      href: "mailto:hi@example.com",
      internal: false,
      blank: false,
    });
  });
  it("refuses javascript: and data: loudly", () => {
    expect(() => normalizeHref("javascript:alert(1)", "nav.header[0]")).toThrow(/scheme.*only http:/s);
    expect(() => normalizeHref("data:text/html,x", "nav.header[0]")).toThrow(/scheme/);
  });
  it("refuses a protocol-relative URL (it bypasses the scheme allow-list)", () => {
    expect(() => normalizeHref("//evil.example", "x")).toThrow(/protocol-relative/);
  });
  it("refuses a bare word / missing href", () => {
    expect(() => normalizeHref("github.com", "x")).toThrow(/must be an absolute/);
    expect(() => normalizeHref(undefined, "x")).toThrow(/href is required/);
  });
});

describe("normalizeLabel", () => {
  it("passes a string through verbatim", () => {
    expect(normalizeLabel("Releases", "x")).toBe("Releases");
  });
  it("keeps a per-locale map raw (localizeField resolves it per page)", () => {
    const map = { en: "Product", fr: "Produit" };
    expect(normalizeLabel(map, "x")).toBe(map);
  });
  it("refuses empty strings, empty maps and non-strings", () => {
    expect(() => normalizeLabel("  ", "nav.header[0].label")).toThrow(/must not be empty/);
    expect(() => normalizeLabel({}, "x")).toThrow(/empty map/);
    expect(() => normalizeLabel({ en: 3 }, "x")).toThrow(/non-empty string/);
    expect(() => normalizeLabel(undefined, "x")).toThrow(/string or a \{ <locale>: string \} map/);
  });
});

describe("normalizeItem", () => {
  it("defaults icon/iconOnly/publish", () => {
    expect(normalizeItem(link(), "x")).toEqual({
      label: "GitHub",
      href: "https://github.com/z29k/notabene",
      internal: false,
      blank: true,
      icon: null,
      iconOnly: false,
      publish: true,
    });
  });
  it("accepts a known icon and iconOnly", () => {
    const item = normalizeItem(link({ icon: "github", iconOnly: true }), "x");
    expect(item.icon).toBe("github");
    expect(item.iconOnly).toBe(true);
  });
  it("throws on an unknown icon, naming the set", () => {
    expect(() => normalizeItem(link({ icon: "githbu" }), "nav.header[0]")).toThrow(/unknown.*icon "githbu".*github/s);
  });
  it("refuses iconOnly without an icon (nothing left to click)", () => {
    expect(() => normalizeItem(link({ iconOnly: true }), "x")).toThrow(/iconOnly needs an icon/);
  });
  it("refuses an unknown key (a typo must never silently no-op)", () => {
    expect(() => normalizeItem(link({ iconOnyl: true }), "nav.header[0]")).toThrow(/unknown key "iconOnyl"/);
  });
  it("carries publish: false", () => {
    expect(normalizeItem(link({ publish: false }), "x").publish).toBe(false);
  });
});

describe("normalizeLinks", () => {
  it("refuses a duplicate href inside one section", () => {
    expect(() => normalizeLinks([link(), link({ label: "Repo" })], "nav.header")).toThrow(/duplicate href/);
  });
  it("allows the same href in two different sections", () => {
    const nav = normalizeNav({ header: [link()], sidebar: { links: [link()] } });
    expect(nav.header[0].href).toBe(nav.sidebar.links[0].href);
  });
  it("treats a missing list as empty and a non-array as an error", () => {
    expect(normalizeLinks(undefined, "x")).toEqual([]);
    expect(() => normalizeLinks("nope", "nav.header")).toThrow(/must be an array/);
  });
});

describe("normalizeNav", () => {
  it("returns the empty nav when unset", () => {
    expect(normalizeNav(null)).toEqual(EMPTY_NAV);
    expect(hasFooter(EMPTY_NAV)).toBe(false);
  });
  it("normalizes the three sections", () => {
    const nav = normalizeNav({
      header: [link({ icon: "github", iconOnly: true })],
      sidebar: {
        title: { en: "Resources", fr: "Ressources" },
        links: [link({ label: "npm", href: "https://npmjs.com" })],
      },
      footer: { links: [link({ label: "MIT", href: "/licence" })], text: "© 2026 z29k", poweredBy: true },
    });
    expect(nav.header).toHaveLength(1);
    expect(nav.sidebar.title).toEqual({ en: "Resources", fr: "Ressources" });
    expect(nav.footer.links[0].internal).toBe(true);
    expect(nav.footer.poweredBy).toBe(true);
    expect(hasFooter(nav)).toBe(true);
  });
  it("refuses unknown keys at every level", () => {
    expect(() => normalizeNav({ headers: [] })).toThrow(/unknown key "headers" in nav/);
    expect(() => normalizeNav({ sidebar: { titel: "x", links: [] } })).toThrow(/unknown key "titel" in nav.sidebar/);
    expect(() => normalizeNav({ footer: { copyright: "x" } })).toThrow(/unknown key "copyright" in nav.footer/);
  });
  it("refuses a non-object section", () => {
    expect(() => normalizeNav({ sidebar: [link()] })).toThrow(/nav.sidebar must be an object/);
    expect(() => normalizeNav({ footer: "© 2026" })).toThrow(/nav.footer must be an object/);
    expect(() => normalizeNav({ footer: { poweredBy: "yes" } })).toThrow(/poweredBy must be a boolean/);
  });
});

describe("filterPublicNav", () => {
  const nav = normalizeNav({
    header: [link(), link({ label: "Dashboard", href: "https://internal.example", publish: false })],
    sidebar: { links: [link({ label: "Wip", href: "https://wip.example", publish: false })] },
    footer: { links: [link({ label: "Wip", href: "https://wip.example", publish: false })], poweredBy: false },
  });
  it("drops publish:false links from every section", () => {
    const pub = filterPublicNav(nav);
    expect(pub.header.map((l) => l.label)).toEqual(["GitHub"]);
    expect(pub.sidebar.links).toEqual([]);
    expect(pub.footer.links).toEqual([]);
  });
  it("makes a footer whose only link was private disappear entirely", () => {
    expect(hasFooter(nav)).toBe(true);
    expect(hasFooter(filterPublicNav(nav))).toBe(false);
  });
});

describe("navClientLabels", () => {
  it("carries ONLY the per-locale maps, keyed by their stable id", () => {
    const nav = normalizeNav({
      header: [link(), link({ label: { en: "Product", fr: "Produit" }, href: "https://z29k.fr" })],
      sidebar: { title: { en: "Resources", fr: "Ressources" }, links: [link({ href: "https://npmjs.com" })] },
      footer: { text: { en: "© 2026 z29k — MIT", fr: "© 2026 z29k — MIT" } },
    });
    expect(navClientLabels(nav)).toEqual({
      "header:1": { en: "Product", fr: "Produit" },
      "sidebar:title": { en: "Resources", fr: "Ressources" },
      "footer:text": { en: "© 2026 z29k — MIT", fr: "© 2026 z29k — MIT" },
    });
  });
  it("uses the same ids the renderer emits", () => {
    expect(navLabelId("header", 1)).toBe("header:1");
    expect(navLabelId("sidebar", "title")).toBe("sidebar:title");
  });
});

describe("NAV_ICONS", () => {
  it("ships every documented name as inline monochrome SVG markup", () => {
    expect(NAV_ICON_NAMES).toContain("github");
    for (const name of NAV_ICON_NAMES) {
      const icon = NAV_ICONS[name];
      expect(["brand", "line"], name).toContain(icon.kind);
      expect(icon.body, name).toMatch(/^<(path|rect|circle|line|polyline|polygon)/);
      // No hardcoded color, no external reference — an icon must follow the theme.
      expect(icon.body, name).not.toMatch(/fill="#|stroke="#|url\(|<image/);
    }
  });
});
