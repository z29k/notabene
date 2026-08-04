import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { describe, expect, it } from "vitest";
import { rehypeTableRowHeader } from "../src/rehype/table-row-header.mjs";

// GFM has one header ROW and no header COLUMN, and Markdown carries no styling — so the
// table toolbar's header actions can only bold a whole row or a whole column, and this
// plugin is what turns that convention back into a header surface.
//
// The threshold is the point: a LONE bold cell is emphasis and must stay untouched. CSS
// could express neither half — `:only-child` counts elements (so `| **✎** in the margin |`
// matched), and no selector can ask whether every cell of a column is bold.
const render = async (body: string) => {
  const proc = await createMarkdownProcessor({ rehypePlugins: [rehypeTableRowHeader] as never });
  return (await proc.render(body, {})).code;
};

/** Text of the cells that came back marked as a header cell. */
const marked = (html: string) =>
  [...html.matchAll(/<td[^>]*class="[^"]*nb-cellhead[^"]*"[^>]*>(.*?)<\/td>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ""),
  );

const table = (...rows: string[]) => `| a | b | c |\n| --- | --- | --- |\n${rows.map((r) => `${r}\n`).join("")}`;

describe("rehypeTableRowHeader", () => {
  it("marks a body row whose every cell is bold — the header-row action", async () => {
    expect(marked(await render(table("| **x** | **y** | **z** |", "| 1 | 2 | 3 |")))).toEqual(["x", "y", "z"]);
  });

  it("marks a column whose every body cell is bold — the header-column action", async () => {
    expect(marked(await render(table("| **One** | 1 | i |", "| **Two** | 2 | ii |")))).toEqual(["One", "Two"]);
  });

  it("leaves a LONE bold cell alone — that is emphasis, not a header", async () => {
    expect(marked(await render(table("| **One** | 1 | i |", "| two | 2 | ii |")))).toEqual([]);
  });

  it("leaves bold FOLLOWED by text alone, in a column that is otherwise all bold", async () => {
    // The exact shape that defeated the CSS attempt: `**✎** in the margin`.
    expect(marked(await render(table("| **One** | 1 | i |", "| **Two** and more | 2 | ii |")))).toEqual([]);
  });

  it("marks a middle column too — a header column need not be the first", async () => {
    expect(marked(await render(table("| 1 | **One** | i |", "| 2 | **Two** | ii |")))).toEqual(["One", "Two"]);
  });

  it("never touches the header row, which is already a header", async () => {
    const html = await render("| **a** | **b** |\n| --- | --- |\n| x | y |\n");
    expect(html).toContain("<th");
    expect(marked(html)).toEqual([]);
  });

  it("marks a cell once when its row AND its column both qualify", async () => {
    const html = await render(table("| **x** | **y** | **z** |"));
    expect((html.match(/nb-cellhead/g) ?? []).length).toBe(3);
  });

  it("leaves a table with no bold run byte-identical to an unprocessed one", async () => {
    const body = table("| x | y | z |");
    expect(await render(body)).toBe((await (await createMarkdownProcessor({})).render(body, {})).code);
  });
});
