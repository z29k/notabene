// Base-path helper for hand-built root-absolute hrefs. Astro's BASE_URL is "/" in
// every dev/normal build and the `publish.base` value in a public build (set in
// astro.config.mjs), so this is a no-op everywhere except a public build served
// under a sub-path (GitHub Pages project site). Apply it at the point of EMISSION
// (the final href/fetch string): route builders (routeFor, scopeToPath) and
// getStaticPaths params stay base-less — Astro prefixes emitted routes itself, and
// active-state comparisons (Sidebar/NavTree `current`) run on the base-less values.
// Vite statically inlines BASE_URL, so this works in components AND client bundles
// (never in `is:inline` scripts — feed those pre-based values via JSON instead).

/** Pure form (unit-tested): prefix a root-absolute path with a base. Relative,
 *  external, hash and protocol-relative URLs pass through untouched. */
export function applyBase(base: string, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const b = base.replace(/\/+$/, "");
  return `${b}${href}` || "/";
}

export function withBase(href: string): string {
  return applyBase(import.meta.env.BASE_URL ?? "/", href);
}
