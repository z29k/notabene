import { describe, expect, it } from "vitest";
import { hitHtml } from "../src/lib/client/search-hits";

describe("hitHtml", () => {
  it("renders the chip + title markup (no excerpt span without one)", () => {
    const html = hitHtml({ href: "/guide/install", spaceKey: "guide", spaceLabel: "Guide", title: "Install" });
    expect(html).toBe(
      '<a href="/guide/install"><span class="r-space guide">Guide</span><span class="r-title">Install</span></a>',
    );
  });

  it("escapes href, key, label and title", () => {
    const html = hitHtml({ href: '/a"b', spaceKey: "<k>", spaceLabel: "A & B", title: "<script>" });
    expect(html).toContain('href="/a&quot;b"');
    expect(html).toContain('class="r-space &lt;k&gt;"');
    expect(html).toContain("A &amp; B");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders a Pagefind excerpt verbatim (pre-escaped upstream, <mark> preserved)", () => {
    const html = hitHtml({
      href: "/x",
      spaceKey: "guide",
      spaceLabel: "Guide",
      title: "X",
      excerptHtml: "run the <mark>installer</mark> to publish",
    });
    expect(html).toContain('<span class="r-excerpt">run the <mark>installer</mark> to publish</span>');
  });
});
