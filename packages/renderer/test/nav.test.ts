import { describe, expect, it } from "vitest";
import {
  assembleNav,
  humanize,
  navLabel,
  type NavNode,
  type NavSource,
  pageTitle,
  resolveGroupLabel,
  resolveNavLabel,
} from "../src/lib/nav";

const label = (n: NavNode) => (n.type === "group" ? n.label : n.title);
const src = (id: string, data?: Record<string, unknown>): NavSource => ({ id, href: `/docs/${id}`, data });

describe("humanize", () => {
  it("title-cases kebab/underscore segments", () => {
    expect(humanize("getting-started")).toBe("Getting Started");
    expect(humanize("billing_setup")).toBe("Billing Setup");
  });
  it("upcases known acronyms", () => {
    expect(humanize("api-reference")).toBe("API Reference");
    expect(humanize("dns-and-tls")).toBe("DNS and TLS");
    expect(humanize("evaluation-irn")).toBe("Evaluation IRN");
    expect(humanize("import-cmdb")).toBe("Import CMDB");
    expect(humanize("import-xls")).toBe("Import XLS");
  });
  it("keeps small words lowercase (except first)", () => {
    expect(humanize("state-of-the-art")).toBe("State of the Art");
  });
  it("splits camelCase", () => {
    expect(humanize("ipAddress")).toBe("IP Address");
  });
});

describe("navLabel", () => {
  it("maps readme/index to Overview", () => {
    expect(navLabel("readme")).toBe("Overview");
    expect(navLabel("docs/index")).toBe("Overview");
  });
  it("humanizes the last segment", () => {
    expect(navLabel("guide/getting-started")).toBe("Getting Started");
  });
});

describe("pageTitle", () => {
  it("prefers frontmatter title over the H1", () => {
    expect(pageTitle("# Real Title\n\nbody", "x/y", { title: "From Frontmatter" })).toBe("From Frontmatter");
  });
  it("prefers the first H1 when no frontmatter title", () => {
    expect(pageTitle("# Real Title\n\nbody", "x/y")).toBe("Real Title");
    expect(pageTitle("# Real Title", "x/y", { title: "   " })).toBe("Real Title"); // blank ignored
  });
  it("falls back to the nav label", () => {
    expect(pageTitle("no heading here", "guide/getting-started")).toBe("Getting Started");
  });
});

describe("resolveNavLabel (leaf)", () => {
  it("prefers sidebar.label, then title, then the humanized filename", () => {
    expect(resolveNavLabel("x/cartographie", { sidebar: { label: "Carto" } })).toBe("Carto");
    expect(resolveNavLabel("x/cartographie", { title: "Cartographie du réseau" })).toBe("Cartographie du réseau");
    expect(resolveNavLabel("x/getting-started")).toBe("Getting Started");
  });
  it("ignores non-string labels and falls through", () => {
    expect(resolveNavLabel("x/getting-started", { sidebar: { label: 123 } })).toBe("Getting Started");
    expect(resolveNavLabel("x/getting-started", { sidebar: { label: "  " }, title: "T" })).toBe("T");
  });
});

describe("resolveGroupLabel (folder index)", () => {
  it("uses sidebar.label, then title, else undefined (keep humanized segment)", () => {
    expect(resolveGroupLabel({ sidebar: { label: "Cartographie" } })).toBe("Cartographie");
    expect(resolveGroupLabel({ title: "Cartographie" })).toBe("Cartographie");
    expect(resolveGroupLabel({})).toBeUndefined();
    expect(resolveGroupLabel(undefined)).toBeUndefined();
  });
});

describe("assembleNav ordering + labels", () => {
  it("is backward-compatible: no frontmatter → groups and pages interleave alphabetically", () => {
    const nodes = assembleNav(
      [src("08-surveys"), src("09-cartographie/detail"), src("10-eval"), src("00-overview")],
      "docs",
      "en",
    );
    expect(nodes.map(label)).toEqual(["00 Overview", "08 Surveys", "09 Cartographie", "10 Eval"]);
  });

  it("sorts explicit order ascending, unordered last (alphabetical)", () => {
    const nodes = assembleNav(
      [src("beta", { sidebar: { order: 2 } }), src("alpha", { sidebar: { order: 1 } }), src("zeta"), src("gamma")],
      "docs",
      "en",
    );
    expect(nodes.map(label)).toEqual(["Alpha", "Beta", "Gamma", "Zeta"]);
  });

  it("coerces a numeric-string order and ignores a non-numeric one", () => {
    const nodes = assembleNav(
      [
        src("c", { sidebar: { order: "3" } }),
        src("a", { sidebar: { order: 1 } }),
        src("b", { sidebar: { order: "x" } }),
      ],
      "docs",
      "en",
    );
    // a(1), c(3), then b (unordered → +∞)
    expect(nodes.map(label)).toEqual(["A", "C", "B"]);
  });

  it("folds a folder index.md (Astro id = folder path) into one group with an Overview child — no duplicate leaf", () => {
    // `guide/index.md` → id "guide"; `guide/setup.md` → id "guide/setup".
    const nodes = assembleNav([src("guide/setup"), src("guide")], "docs", "en");
    expect(nodes).toHaveLength(1); // ← one group, NOT a sibling leaf + group
    const group = nodes[0];
    if (group.type !== "group") throw new Error("expected a group");
    expect(group.children.map(label)).toEqual(["Overview", "Setup"]);
  });

  it("treats a folder readme.md (id keeps /readme) as the group's Overview landing page", () => {
    const nodes = assembleNav([src("guide/page"), src("guide/readme", { sidebar: { label: "Guide" } })], "docs", "en");
    expect(nodes.map(label)).toEqual(["Guide"]); // group renamed by readme frontmatter
    const group = nodes[0];
    if (group.type !== "group") throw new Error("expected a group");
    expect(group.children.map(label)).toEqual(["Overview", "Page"]);
  });

  it("lifts a folder index's frontmatter (label + order) onto the group, positioning it among siblings", () => {
    const nodes = assembleNav(
      [
        src("carto", { sidebar: { label: "Cartographie", order: 9 } }), // carto/index.md
        src("carto/detail"),
        src("surveys", { sidebar: { order: 8 } }),
        src("sessions", { sidebar: { order: 11 } }),
      ],
      "docs",
      "en",
    );
    expect(nodes.map(label)).toEqual(["Surveys", "Cartographie", "Sessions"]);
    const group = nodes[1];
    expect(group.type).toBe("group");
    // The folder's own "Overview" leaf is unaffected by the lifted positioning order.
    if (group.type === "group") expect(group.children.map(label)).toEqual(["Overview", "Detail"]);
  });

  it("keeps the humanized segment for a folder with no landing page", () => {
    const nodes = assembleNav([src("carto/detail"), src("carto/more")], "docs", "en");
    expect(nodes.map(label)).toEqual(["Carto"]);
  });

  it("applies a leaf's sidebar.label", () => {
    const nodes = assembleNav([src("verbose-file-name", { sidebar: { label: "Short" } })], "docs", "en");
    expect(nodes.map(label)).toEqual(["Short"]);
  });

  // The three end-to-end scenarios, locked in at the pure-logic layer (mirrors the rendered
  // nav verified against a real build).
  it("scenario A — every page title-driven: sidebar shows titles, sorted by title not filename", () => {
    const nodes = assembleNav(
      [
        src("a-file", { title: "Zebra Guide" }),
        src("b-file", { title: "Alpha Manual" }),
        src("c-file", { title: "Mango Notes" }),
      ],
      "docs",
      "en",
    );
    expect(nodes.map(label)).toEqual(["Alpha Manual", "Mango Notes", "Zebra Guide"]);
  });

  it("scenario B — mixed: sidebar label+order, order-only (→ filename), and plain filename together", () => {
    const nodes = assembleNav(
      [
        src("intro", { sidebar: { label: "Getting Started", order: 1 } }),
        src("deep-dive", { sidebar: { order: 2 } }), // order, no label → humanized filename
        src("appendix"), // no frontmatter → filename
        src("glossary"), // no frontmatter → filename
      ],
      "docs",
      "en",
    );
    expect(nodes.map(label)).toEqual(["Getting Started", "Deep Dive", "Appendix", "Glossary"]);
  });

  // Scenario C (no frontmatter at all) is the "backward-compatible" case above.
});
