// Rehype plugin — turn a ```mermaid fenced code block into `<pre class="mermaid">` holding
// the RAW diagram source, so the client renderer (src/lib/client/mermaid.ts) can pick it up.
//
// Pairs with `markdown.syntaxHighlight.excludeLangs: ["mermaid"]` in astro.config.mjs:
// that keeps Shiki from mangling the fence (it stays a plain
// `<pre><code class="language-mermaid">…</code></pre>`), and this normalizes it to the
// container Mermaid expects. Works for `.md` (native pipeline) and `.mdx` (@astrojs/mdx
// inherits the markdown config). A ```mermaid fence is a code block, so it's MDX-safe —
// the diagram's `-->`, `{`, `<` etc. are never parsed as JSX.
//
// Hand-rolled hast walk (no unist-util-visit dependency — cf. rewrite-links.mjs).

function hastText(node) {
  if (node.type === "text") return node.value;
  if (Array.isArray(node.children)) return node.children.map(hastText).join("");
  return "";
}

function classList(node) {
  const c = node?.properties?.className;
  if (Array.isArray(c)) return c.map(String);
  if (typeof c === "string") return c.split(/\s+/);
  return [];
}

const hasMermaidClass = (node) => classList(node).includes("language-mermaid");

export function rehypeMermaid() {
  return (tree) => {
    (function walk(node) {
      if (!node || !Array.isArray(node.children)) return;
      for (const child of node.children) {
        if (child.type === "element" && child.tagName === "pre") {
          const code = child.children?.find((c) => c.type === "element" && c.tagName === "code");
          if (hasMermaidClass(child) || (code && hasMermaidClass(code))) {
            child.properties = { className: ["mermaid"] };
            child.children = [{ type: "text", value: hastText(code ?? child) }];
            continue; // replaced — don't descend into it
          }
        }
        walk(child);
      }
    })(tree);
  };
}
