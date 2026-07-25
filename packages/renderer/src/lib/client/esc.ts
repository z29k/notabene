// HTML-escape helper, in its own module so surfaces shared by the PUBLIC build
// (the search dropdown) can use it without pulling comments-client — whose API
// wrappers must not ship in a public artifact — into their bundle graph.
export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c);
