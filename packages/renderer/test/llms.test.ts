import { describe, expect, it } from "vitest";
import { ensureH1, renderLlmsFull, renderLlmsIndex, twinHeader, twinPath } from "../src/lib/llms";

const abs = (p: string) => `https://example.com/repo${p === "/" ? "" : p}`;

describe("twinPath", () => {
  it("appends /index.md to a route", () => {
    expect(twinPath("/docs/guide/intro")).toBe("/docs/guide/intro/index.md");
    expect(twinPath("/fr/docs/guide")).toBe("/fr/docs/guide/index.md");
  });
  it("handles the root route", () => {
    expect(twinPath("/")).toBe("/index.md");
  });
});

describe("ensureH1", () => {
  it("keeps a body that already opens with an H1", () => {
    expect(ensureH1("# Title\n\nBody.", "Other")).toBe("# Title\n\nBody.");
    expect(ensureH1("\n\n# Title\nBody.", "Other")).toBe("\n\n# Title\nBody.");
  });
  it("prepends the title when the body has none (frontmatter title)", () => {
    expect(ensureH1("Body only.", "My title")).toBe("# My title\n\nBody only.");
  });
  it("does not mistake an H2 for an H1", () => {
    expect(ensureH1("## Section\nBody.", "My title")).toBe("# My title\n\n## Section\nBody.");
  });
});

describe("twinHeader", () => {
  it("points at the rendered page and the index", () => {
    expect(twinHeader("https://x/docs/a", "https://x/llms.txt")).toBe(
      "> Rendered: https://x/docs/a · Docs index: https://x/llms.txt\n\n",
    );
  });
});

describe("renderLlmsIndex", () => {
  const opts = {
    siteName: "Docs",
    tagline: "the docs",
    absolute: abs,
    fullPath: "/llms-full.txt",
    spaces: [
      {
        label: "Guides",
        pages: [
          { title: "Accueil", route: "/docs/index" },
          { title: "Intro", route: "/docs/guide/intro" },
        ],
      },
    ],
  };

  it("lists every page as a twin link with its rendered URL", () => {
    const out = renderLlmsIndex(opts);
    expect(out).toContain("# Docs");
    expect(out).toContain("Full corpus (all pages, one document): https://example.com/repo/llms-full.txt");
    expect(out).toContain("## Guides");
    expect(out).toContain(
      "- [Intro](https://example.com/repo/docs/guide/intro/index.md): rendered at https://example.com/repo/docs/guide/intro",
    );
    expect(out.endsWith("\n")).toBe(true);
  });

  it("links other locales' indexes only when given", () => {
    expect(renderLlmsIndex(opts)).not.toContain("Index for locale");
    const out = renderLlmsIndex({ ...opts, otherLocales: [{ locale: "fr", path: "/fr/llms.txt" }] });
    expect(out).toContain('Index for locale "fr": https://example.com/repo/fr/llms.txt');
  });

  it("is deterministic (no timestamps)", () => {
    expect(renderLlmsIndex(opts)).toBe(renderLlmsIndex(opts));
  });
});

describe("renderLlmsFull", () => {
  const opts = {
    siteName: "Docs",
    tagline: "the docs",
    absolute: abs,
    indexPath: "/llms.txt",
    spaces: [
      {
        label: "Guides",
        pages: [
          { title: "Accueil", route: "/docs/index", body: "# Accueil\n\nHello." },
          { title: "Intro", route: "/docs/guide/intro", body: "No heading body." },
        ],
      },
    ],
  };

  it("opens each page block with a rule + Source line and titles untitled bodies", () => {
    const out = renderLlmsFull(opts);
    expect(out).toContain("Index: https://example.com/repo/llms.txt");
    expect(out).toContain(
      "\n---\n\nSource: https://example.com/repo/docs/index · Markdown: https://example.com/repo/docs/index/index.md\n\n# Accueil",
    );
    expect(out).toContain("# Intro\n\nNo heading body.");
    // Page order preserved (nav order comes from the caller).
    expect(out.indexOf("# Accueil")).toBeLessThan(out.indexOf("# Intro"));
  });

  it("is deterministic (no timestamps)", () => {
    expect(renderLlmsFull(opts)).toBe(renderLlmsFull(opts));
  });
});
