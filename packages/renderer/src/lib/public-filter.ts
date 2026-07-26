// Public/private scoping for `build --public`. Three knobs, from coarse to fine:
//   roots[].publish: false            — a whole space stays private
//   publish.exclude: ["docs/int/**"]  — config globs on `<space key>/<canonical id>`
//                                       (locale-independent → hides every translation)
//   frontmatter `publish: false`      — a single page (per file)
// Everything is a NO-OP outside public mode — dev and normal builds always show
// the full doc. Applied at every enumeration site (routes, nav, search-index,
// print scopes, llms/twins) rather than at the content loader, so the same
// collections back both modes. Note: body links pointing at an excluded page
// will 404 in the public artifact — keeping public pages free of such links is
// an authoring concern.
import { publicMode, publish, roots } from "../config.mjs";

/** Minimal glob → RegExp: `*` matches within a path segment, `**` across segments.
 *  Split-on-`**` keeps the single-`*` pass away from it — no sentinel needed. */
export function globToRegExp(glob: string): RegExp {
  const seg = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${glob.split("**").map(seg).join(".*")}$`);
}

/** Pure core (unit-tested): does `spacePath` (`<space key>/<canonical id>`) match a pattern? */
export function isExcluded(patterns: RegExp[], spacePath: string): boolean {
  return patterns.some((re) => re.test(spacePath));
}

const compiled = publish.exclude.map(globToRegExp);

/** Roots to enumerate for the current build (private spaces drop out in public mode). */
export function visibleRoots<T extends { publish: boolean }>(all: T[]): T[] {
  return publicMode ? all.filter((r) => r.publish) : all;
}

/** Should this page exist in the current build? Always true outside public mode. */
export function isPublicPage(spaceKey: string, canonicalId: string, data?: Record<string, unknown>): boolean {
  if (!publicMode) return true;
  const root = roots.find((r) => r.key === spaceKey);
  if (root && root.publish === false) return false;
  if (data && data.publish === false) return false;
  return !isExcluded(compiled, canonicalId ? `${spaceKey}/${canonicalId}` : spaceKey);
}
