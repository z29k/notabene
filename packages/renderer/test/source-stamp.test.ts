import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { describe, expect, it } from "vitest";
import { rehypeSourceStamp } from "../src/rehype/source-stamp.mjs";
import { rehypeMermaid } from "../src/remark/mermaid.mjs";
import { remarkSourceMap } from "../src/remark/source-map.mjs";

// The editor's source map is only trustworthy if it survives Astro's REAL markdown
// pipeline — Shiki rebuilds code blocks from scratch, and our own rehypeMermaid replaces
// a <pre>'s properties wholesale. This suite renders through `createMarkdownProcessor`
// with the repo's exact markdown config, so a change in either would fail here rather
// than silently hand the editor wrong offsets. (Probe §11 of plans/editeur-wysiwyg.md.)
const BODY = `# Heading one

A paragraph with \`inline code\`.

- item one
- item two

\`\`\`js
const x = 1;
\`\`\`

\`\`\`mermaid
graph TD; A-->B;
\`\`\`

> a quote

| a | b |
|---|---|
| 1 | 2 |

<div class="raw">raw html block</div>

Last paragraph.`;

const render = async (body: string, extraRehype: unknown[] = []) => {
  const proc = await createMarkdownProcessor({
    syntaxHighlight: { type: "shiki", excludeLangs: ["mermaid"] },
    shikiConfig: { theme: "github-dark", wrap: true },
    remarkPlugins: [remarkSourceMap],
    // Same order the editor integration produces: config plugins first, stamp appended.
    rehypePlugins: [rehypeMermaid, ...extraRehype, rehypeSourceStamp] as never,
  });
  return (await proc.render(body, {})).code;
};

/** Every `data-nb-range` in the html, as [start, end] pairs. */
const stamps = (html: string) => [...html.matchAll(/data-nb-range="(\d+):(\d+)"/g)].map((m) => [+m[1], +m[2]] as const);

describe("source map through Astro's markdown pipeline", () => {
  it("stamps ranges that slice back to the exact block source", async () => {
    const html = await render(BODY);
    const found = stamps(html);
    expect(found.length).toBeGreaterThan(0);
    for (const [start, end] of found) {
      expect(BODY.slice(start, end).length).toBe(end - start);
      expect(BODY.slice(start, end).trim()).toBe(BODY.slice(start, end));
    }
  });

  it("stamps every top-level block except html — the whitelist IS the absence of a stamp", async () => {
    const html = await render(BODY);
    const kinds = [...html.matchAll(/data-nb-block="([a-z]+)"/g)].map((m) => m[1]).sort();
    expect(kinds).toEqual(["blockquote", "code", "code", "heading", "list", "paragraph", "paragraph", "table"]);
    // The raw html block is the one top-level node with no stamp.
    expect(html).toContain('<div class="raw">raw html block</div>');
    expect(kinds).not.toContain("html");
  });

  it("recovers code blocks whose position Shiki destroyed (the index join)", async () => {
    const html = await render(BODY);
    const jsStart = BODY.indexOf("```js");
    const jsEnd = BODY.indexOf("```", jsStart + 5) + 3;
    expect(stamps(html)).toContainEqual([jsStart, jsEnd]);
  });

  it("keeps the stamp on a mermaid pre despite rehypeMermaid replacing its properties", async () => {
    const html = await render(BODY);
    const pre = /<pre class="mermaid"[^>]*>/.exec(html)?.[0] ?? "";
    expect(pre).toContain("data-nb-range=");
    expect(pre).toContain('data-nb-block="code"');
  });

  it("maps nothing for a .mdx file — its offsets are in another coordinate system", () => {
    // @astrojs/mdx does not hand remark a frontmatter-stripped body, so an .mdx heading at
    // body offset 0 arrives stamped at the frontmatter's length. The write path refuses
    // those ranges anyway (they align with no block), but refusing late means lighting up
    // a block that can never be saved — so nothing is mapped in the first place.
    const tree = { children: [{ type: "heading", position: { start: { offset: 0 }, end: { offset: 9 } } }] };
    const run = remarkSourceMap() as (t: unknown, f: unknown) => void;

    const md: { path: string; data: Record<string, unknown> } = { path: "/repo/docs/page.md", data: {} };
    run(tree, md);
    expect(md.data.nbSourceMap).toHaveLength(1);

    const mdx: { path: string; data: Record<string, unknown> } = { path: "/repo/docs/page.mdx", data: {} };
    run(tree, mdx);
    expect(mdx.data.nbSourceMap).toBeUndefined();

    // `history` is the fallback when `path` is not populated.
    const viaHistory: { history: string[]; data: Record<string, unknown> } = {
      history: ["/repo/docs/other.MDX"],
      data: {},
    };
    run(tree, viaHistory);
    expect(viaHistory.data.nbSourceMap).toBeUndefined();
  });

  it("stamps nothing at all when the top-level counts disagree (fail-closed)", async () => {
    // A plugin that inserts an extra top-level element breaks the 1:1 index join.
    const injectExtra = () => (tree: { children: unknown[] }) => {
      tree.children.unshift({ type: "element", tagName: "aside", properties: {}, children: [] });
    };
    const html = await render(BODY, [injectExtra]);
    expect(stamps(html)).toHaveLength(0);
    // …and the page still renders normally, it is merely not editable.
    expect(html).toContain("Last paragraph.");
  });
});
