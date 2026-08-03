import { parseFrontmatter } from "@astrojs/markdown-remark";
import { describe, expect, it } from "vitest";
import { bodySpan, hashOf, withBody } from "../src/lib/page-write";

// `data-nb-src` offsets are relative to the body Astro hands to remark, which its
// markdown entry type builds as `parseFrontmatter(raw).content.trim()`. Getting that base
// wrong shifts every offset — so derive it here the same way and assert the round trip.
const spanOf = (raw: string) => bodySpan(raw, parseFrontmatter(raw).content);
const bodyOf = (raw: string) => {
  const s = spanOf(raw);
  return raw.slice(s.start, s.start + s.length);
};

describe("bodySpan", () => {
  it("matches what Astro parses, for a file with frontmatter", () => {
    const raw = "---\ntitle: T\n---\n\n# Heading\n\nText.\n";
    expect(bodyOf(raw)).toBe(parseFrontmatter(raw).content.trim());
    expect(bodyOf(raw)).toBe("# Heading\n\nText.");
    expect(spanOf(raw).start).toBe(raw.indexOf("# Heading"));
  });

  it("handles a file with no frontmatter", () => {
    const raw = "# Heading\n\nText.\n";
    expect(bodyOf(raw)).toBe("# Heading\n\nText.");
    expect(spanOf(raw).start).toBe(0);
  });

  it("handles TOML frontmatter", () => {
    const raw = '+++\ntitle = "T"\n+++\n\n# Heading\n';
    expect(bodyOf(raw)).toBe(parseFrontmatter(raw).content.trim());
    expect(bodyOf(raw)).toBe("# Heading");
  });

  it("handles blank lines before the frontmatter", () => {
    const raw = "\n---\ntitle: T\n---\n\n# Heading\n";
    expect(bodyOf(raw)).toBe(parseFrontmatter(raw).content.trim());
    expect(spanOf(raw).start).toBe(raw.indexOf("# Heading"));
  });

  it("handles a body whose text also occurs inside the frontmatter", () => {
    // A naive raw.indexOf(body) would find the copy inside the frontmatter.
    const raw = "---\nsummary: hello\n---\n\nhello\n";
    expect(spanOf(raw).start).toBe(raw.lastIndexOf("hello"));
    expect(bodyOf(raw)).toBe("hello");
  });

  it("handles a file with no trailing newline", () => {
    const raw = "---\ntitle: T\n---\n\n# Heading";
    expect(bodyOf(raw)).toBe("# Heading");
    expect(spanOf(raw).start + spanOf(raw).length).toBe(raw.length);
  });

  it("handles CRLF", () => {
    const raw = "---\r\ntitle: T\r\n---\r\n\r\n# Heading\r\n\r\nText.\r\n";
    expect(bodyOf(raw)).toBe(parseFrontmatter(raw).content.trim());
    expect(bodyOf(raw)).toBe("# Heading\r\n\r\nText.");
  });
});

describe("withBody", () => {
  const cases: [string, string][] = [
    ["---\ntitle: T\n---\n\n# Heading\n\nText.\n", "# Heading\n\nEdited."],
    ["# Heading\n\nText.\n", "# Heading\n\nEdited."],
    ['+++\ntitle = "T"\n+++\n\n# Heading\n', "# Edited"],
    ["---\ntitle: T\n---\n\n# Heading", "# Edited"],
    ["\n---\ntitle: T\n---\n\n# Heading\n", "# Edited"],
  ];

  it("puts the frontmatter and the trailing newline back verbatim", () => {
    for (const [raw, nextBody] of cases) {
      const out = withBody(raw, nextBody, spanOf(raw));
      // Everything outside the body is byte-identical…
      expect(out.slice(0, spanOf(raw).start)).toBe(raw.slice(0, spanOf(raw).start));
      expect(out.endsWith(raw.slice(spanOf(raw).start + spanOf(raw).length))).toBe(true);
      // …and re-reading the result yields exactly the new body.
      expect(bodyOf(out)).toBe(nextBody);
    }
  });

  it("is an identity when the body is unchanged", () => {
    for (const [raw] of cases) {
      expect(withBody(raw, bodyOf(raw), spanOf(raw))).toBe(raw);
    }
  });
});

describe("hashOf", () => {
  it("is stable and content-dependent", () => {
    expect(hashOf("a")).toBe(hashOf("a"));
    expect(hashOf("a")).not.toBe(hashOf("b"));
    expect(hashOf("a")).toMatch(/^[0-9a-f]{16}$/);
  });
});
