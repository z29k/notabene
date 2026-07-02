import path from "node:path";

// Rewrites RELATIVE links to .md/.mdx files (between docs) into site routes.
// Without this, inter-doc links (`[x](../foo.md)`) point at files and 404 in the site.
//
//   <root.path>/**  → /<root.key>/<slug>
//
// Generic: the mapping comes from notabene.config `roots[]` (cf. src/config.mjs),
// no hardcoded paths. External links (http…, mailto), absolute (/…), anchors (#…)
// and non-.md targets are left intact. .md targets OUTSIDE the declared spaces are
// left as-is.

function slug(rel) {
  return rel.replace(/\\/g, "/").replace(/\.mdx?$/i, "");
}

function visit(node, fn) {
  fn(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child, fn);
  }
}

/**
 * @param {{ key: string, abs: string }[]} roots — normalized spaces (config.mjs).
 */
export function remarkRewriteLinks(roots) {
  // Most specific root (longest absolute path) first: a nested space (docs/plans)
  // must win over its parent (docs).
  const ordered = [...roots].sort((a, b) => b.abs.length - a.abs.length);

  function toRoute(abs) {
    for (const r of ordered) {
      if (abs === r.abs || abs.startsWith(r.abs + path.sep)) {
        return `/${r.key}/${slug(path.relative(r.abs, abs))}`;
      }
    }
    return null;
  }

  return (tree, file) => {
    const from = file?.path ?? file?.history?.[0];
    if (!from) return;
    const fromDir = path.dirname(from);

    visit(tree, (node) => {
      if (node.type !== "link" && node.type !== "definition") return;
      const url = node.url;
      if (typeof url !== "string") return;
      if (/^[a-z]+:/i.test(url) || url.startsWith("/") || url.startsWith("#")) return;

      const hashIdx = url.indexOf("#");
      const target = hashIdx === -1 ? url : url.slice(0, hashIdx);
      const hash = hashIdx === -1 ? "" : url.slice(hashIdx);
      if (!/\.mdx?$/i.test(target)) return;

      const abs = path.resolve(fromDir, target);
      const route = toRoute(abs);
      if (route) node.url = route + hash;
    });
  };
}
