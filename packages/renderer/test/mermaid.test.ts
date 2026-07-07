import { describe, expect, it } from "vitest";
import { rehypeMermaid } from "../src/remark/mermaid.mjs";

// Minimal hast builders.
const text = (value: string) => ({ type: "text", value });
const el = (tagName: string, properties: any, children: any[]) => ({ type: "element", tagName, properties, children });
const root = (children: any[]) => ({ type: "root", children });

describe("rehypeMermaid", () => {
  it("rewrites pre>code.language-mermaid to pre.mermaid holding the raw source", () => {
    const tree = root([el("pre", {}, [el("code", { className: ["language-mermaid"] }, [text("graph TD\n  A-->B")])])]);
    rehypeMermaid()(tree);
    const node: any = tree.children[0];
    expect(node.tagName).toBe("pre");
    expect(node.properties.className).toEqual(["mermaid"]);
    expect(node.children).toEqual([text("graph TD\n  A-->B")]);
  });

  it("leaves other code languages untouched", () => {
    const tree = root([el("pre", {}, [el("code", { className: ["language-js"] }, [text("const x = 1;")])])]);
    rehypeMermaid()(tree);
    const code: any = (tree.children[0] as any).children[0];
    expect(code.tagName).toBe("code");
    expect(code.properties.className).toEqual(["language-js"]);
  });

  it("also handles the language class on the <pre> element", () => {
    const tree = root([
      el("pre", { className: ["language-mermaid"] }, [el("code", {}, [text("erDiagram\n  A ||--o{ B : has")])]),
    ]);
    rehypeMermaid()(tree);
    const node: any = tree.children[0];
    expect(node.properties.className).toEqual(["mermaid"]);
    expect(node.children[0].value).toContain("erDiagram");
  });

  it("concatenates text across nested nodes (e.g. highlighter line spans)", () => {
    const tree = root([
      el("pre", {}, [
        el("code", { className: ["language-mermaid"] }, [el("span", {}, [text("graph TD\n")]), text("A-->B")]),
      ]),
    ]);
    rehypeMermaid()(tree);
    expect((tree.children[0] as any).children[0].value).toBe("graph TD\nA-->B");
  });
});
