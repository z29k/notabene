// Rehype plugin — render the improvised header row / header column of a Markdown table.
//
// GFM tables have exactly one header ROW and no header COLUMN at all, and Markdown carries
// no styling. So the toolbar's "header row" / "header column" actions can only write the
// one thing the format has: they bold every cell of that row or column. This plugin is the
// other half — it recognises that convention and gives those cells the header's surface.
//
// THE WHOLE row or the WHOLE column, never a lone cell. That threshold is the entire design:
//   · a single bold cell is emphasis, and tinting it would be guessing;
//   · nobody bolds every cell of a column by accident, so a full run is a decision;
//   · it is exactly what the toolbar action produces, so the button and the rendering agree.
//
// WHY THIS IS NOT CSS. `td:has(> strong:only-child)` was tried and is wrong twice over:
// `:only-child` counts ELEMENTS, so `| **✎** in the margin |` matched too (3 false positives
// out of 8 rows on this repo's own editor page), and CSS cannot ask "are all the cells of
// this column bold?" at all. Both questions only exist in the tree.
//
// Runs in every build — this is content rendering, not editing (unlike src/rehype/source-stamp).

const CLASS = "nb-cellhead";

/** Whitespace-only text is layout, not content. */
const isFiller = (node) => node.type === "text" && !String(node.value ?? "").trim();

/** True when the cell holds a single `<strong>` and nothing else at all. */
function isBoldOnly(cell) {
  const meaningful = (cell.children ?? []).filter((child) => !isFiller(child));
  return meaningful.length === 1 && meaningful[0].type === "element" && meaningful[0].tagName === "strong";
}

const elements = (node, tag) =>
  (node?.children ?? []).filter((c) => c.type === "element" && (!tag || c.tagName === tag));

function addClass(cell) {
  const existing = cell.properties?.className ?? [];
  const list = Array.isArray(existing) ? existing : [existing];
  if (list.includes(CLASS)) return;
  cell.properties = { ...(cell.properties ?? {}), className: [...list, CLASS] };
}

/** Every `tr` of the table, wherever the parser put it (`thead`/`tbody` or straight in). */
function allRows(table) {
  const rows = [];
  for (const child of elements(table)) {
    if (child.tagName === "tr") rows.push(child);
    else rows.push(...elements(child, "tr"));
  }
  return rows;
}

function markTable(table) {
  // The `th` row is already a header; only body rows can be improvised into one.
  const body = allRows(table)
    .map((row) => elements(row))
    .filter((cells) => cells.length > 0 && cells.every((c) => c.tagName === "td"));
  if (!body.length) return;

  for (const cells of body) {
    if (cells.every(isBoldOnly)) cells.forEach(addClass);
  }

  const width = Math.max(...body.map((cells) => cells.length));
  for (let i = 0; i < width; i++) {
    const column = body.map((cells) => cells[i]).filter(Boolean);
    // A ragged table has no such column: every body row must actually reach this index.
    if (column.length === body.length && column.every(isBoldOnly)) column.forEach(addClass);
  }
}

export function rehypeTableRowHeader() {
  return (tree) => {
    const walk = (node) => {
      if (node.type === "element" && node.tagName === "table") markTable(node);
      else for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}
