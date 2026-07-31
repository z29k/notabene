// Pure normalization of the config `nav` surface — the OUTBOUND navigation links a
// doc site needs and the renderer had no room for: repo / product / releases in the
// topbar, a "Resources" block under the space tree, a site footer.
//
// The contract is DECLARATIVE data, never a slot or an overridable template (same
// invariant as the theming contract): one item shape, one normalization, three mount
// points. `nav` is a FIRST-LEVEL config key, never `theme.nav` — a link is repo data,
// not appearance, so a theme package can style `.nb-nav-link` but never declare an
// entry (an `npm i` must not inject outbound links into a published site, and a theme
// cannot know the consumer's locales).
//
// Everything is validated at LOAD (same discipline as editPattern's `{path}` and
// publish.site's origin-only rule): an unknown key, an unknown icon or a
// `javascript:` href throws instead of shipping something broken — or trapped — into
// a PUBLIC artifact. `.mjs` so config.mjs can import it under raw Node.
import { NAV_ICON_NAMES } from "./nav-icons.mjs";

/** Href schemes an item may use, besides a site path ("/…"). */
const SCHEMES = ["http:", "https:", "mailto:"];

const SECTIONS = ["header", "sidebar", "footer"];
const ITEM_KEYS = ["label", "href", "icon", "iconOnly", "publish"];
const SIDEBAR_KEYS = ["title", "links"];
const FOOTER_KEYS = ["links", "text", "poweredBy"];

/**
 * @typedef {Object} NavItem
 * @property {string|Record<string,string>} label plain string or per-locale map (raw)
 * @property {string} href
 * @property {boolean} internal site route → prefix with the build `base` at emission
 * @property {boolean} blank open in a new tab (http(s) only)
 * @property {string|null} icon name in NAV_ICONS
 * @property {boolean} iconOnly topbar: render the icon alone, label → accessible name
 * @property {boolean} publish false = kept out of `build --public` artifacts
 */

/**
 * @typedef {Object} Nav
 * @property {NavItem[]} header
 * @property {{ title: string|Record<string,string>|null, links: NavItem[] }} sidebar
 * @property {{ links: NavItem[], text: string|Record<string,string>|null, poweredBy: boolean }} footer
 */

/** The nav of a config with no `nav` block — every mount point renders nothing.
 *  @type {Nav} */
export const EMPTY_NAV = {
  header: [],
  sidebar: { title: null, links: [] },
  footer: { links: [], text: null, poweredBy: false },
};

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A typo'd key must never silently no-op (the `theme.tokens` lesson). */
function assertKeys(obj, allowed, where) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) {
      throw new Error(`notabene: unknown key "${k}" in ${where} — valid keys: ${allowed.join(", ")}.`);
    }
  }
}

/**
 * A human label: a plain string OR a `{ <locale>: string }` map (resolved per page by
 * localizeField, exactly like `roots[].label`). Returned VERBATIM — the raw value rides
 * along to the client payload so aggregate pages can re-localize it.
 */
export function normalizeLabel(raw, where) {
  if (typeof raw === "string") {
    if (!raw.trim()) throw new Error(`notabene: ${where} must not be empty.`);
    return raw;
  }
  if (isPlainObject(raw)) {
    const entries = Object.entries(raw);
    if (!entries.length) throw new Error(`notabene: ${where} must not be an empty map.`);
    for (const [loc, v] of entries) {
      if (typeof v !== "string" || !v.trim()) {
        throw new Error(`notabene: ${where}.${loc} must be a non-empty string.`);
      }
    }
    return raw;
  }
  throw new Error(`notabene: ${where} must be a string or a { <locale>: string } map.`);
}

/**
 * Classify + validate an href. `internal` → a site route, prefixed with the build's
 * `base` at emission (withBase); `blank` → opened in a new tab with rel="noopener"
 * (http(s) only — a mailto: hand-off owns no tab).
 */
export function normalizeHref(raw, where) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`notabene: ${where}.href is required (an http(s)/mailto URL, or a site path starting with "/").`);
  }
  const href = raw.trim();
  if (href.startsWith("//")) {
    throw new Error(`notabene: ${where}.href "${href}" is protocol-relative — write the full https:// URL.`);
  }
  if (href.startsWith("/")) return { href, internal: true, blank: false };
  let url;
  try {
    url = new URL(href);
  } catch {
    throw new Error(
      `notabene: ${where}.href "${href}" must be an absolute http(s)/mailto URL, or a site path starting with "/".`,
    );
  }
  if (!SCHEMES.includes(url.protocol)) {
    throw new Error(
      `notabene: ${where}.href "${href}" uses the "${url.protocol}" scheme — only ${SCHEMES.join(", ")} ` +
        `and site paths ("/…") are allowed.`,
    );
  }
  return { href, internal: false, blank: url.protocol !== "mailto:" };
}

/** One link item: `{ label, href, icon?, iconOnly?, publish? }`.
 *  @returns {NavItem} */
export function normalizeItem(raw, where) {
  if (!isPlainObject(raw)) throw new Error(`notabene: ${where} must be an object with a label and an href.`);
  assertKeys(raw, ITEM_KEYS, where);
  const label = normalizeLabel(raw.label, `${where}.label`);
  const { href, internal, blank } = normalizeHref(raw.href, where);
  let icon = null;
  if (raw.icon != null) {
    if (typeof raw.icon !== "string" || !NAV_ICON_NAMES.includes(raw.icon)) {
      throw new Error(`notabene: unknown ${where}.icon "${raw.icon}" — valid icons: ${NAV_ICON_NAMES.join(", ")}.`);
    }
    icon = raw.icon;
  }
  if (raw.iconOnly != null && typeof raw.iconOnly !== "boolean") {
    throw new Error(`notabene: ${where}.iconOnly must be a boolean.`);
  }
  // Without an icon there would be nothing left to click.
  if (raw.iconOnly === true && !icon) throw new Error(`notabene: ${where}.iconOnly needs an icon.`);
  if (raw.publish != null && typeof raw.publish !== "boolean") {
    throw new Error(`notabene: ${where}.publish must be a boolean.`);
  }
  return { label, href, internal, blank, icon, iconOnly: raw.iconOnly === true, publish: raw.publish !== false };
}

/** A section's link list. Duplicate hrefs WITHIN a section are a config mistake; the
 *  same href in two sections (topbar icon + Resources row) is legitimate.
 *  @returns {NavItem[]} */
export function normalizeLinks(raw, where) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new Error(`notabene: ${where} must be an array of link objects.`);
  const items = raw.map((item, i) => normalizeItem(item, `${where}[${i}]`));
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.href)) throw new Error(`notabene: duplicate href "${item.href}" in ${where}.`);
    seen.add(item.href);
  }
  return items;
}

/** Whole `nav` block → the normalized shape every mount point consumes.
 *  @returns {Nav} */
export function normalizeNav(raw) {
  if (raw == null) return EMPTY_NAV;
  if (!isPlainObject(raw)) throw new Error(`notabene: nav must be an object with ${SECTIONS.join(" / ")} keys.`);
  assertKeys(raw, SECTIONS, "nav");
  const sidebarCfg = raw.sidebar ?? {};
  if (!isPlainObject(sidebarCfg)) {
    throw new Error("notabene: nav.sidebar must be an object with a `links` array (and an optional `title`).");
  }
  assertKeys(sidebarCfg, SIDEBAR_KEYS, "nav.sidebar");
  const footerCfg = raw.footer ?? {};
  if (!isPlainObject(footerCfg)) {
    throw new Error("notabene: nav.footer must be an object (`links`, `text`, `poweredBy`).");
  }
  assertKeys(footerCfg, FOOTER_KEYS, "nav.footer");
  if (footerCfg.poweredBy != null && typeof footerCfg.poweredBy !== "boolean") {
    throw new Error("notabene: nav.footer.poweredBy must be a boolean.");
  }
  return {
    header: normalizeLinks(raw.header, "nav.header"),
    sidebar: {
      title: sidebarCfg.title == null ? null : normalizeLabel(sidebarCfg.title, "nav.sidebar.title"),
      links: normalizeLinks(sidebarCfg.links, "nav.sidebar.links"),
    },
    footer: {
      links: normalizeLinks(footerCfg.links, "nav.footer.links"),
      text: footerCfg.text == null ? null : normalizeLabel(footerCfg.text, "nav.footer.text"),
      poweredBy: footerCfg.poweredBy === true,
    },
  };
}

/** Public builds: `publish: false` keeps a link OUT of the artifact (mirror of
 *  `roots[].publish`) — a dev-only dashboard link never reaches the deployed site.
 *  @param {Nav} nav @returns {Nav} */
export function filterPublicNav(nav) {
  const keep = (links) => links.filter((l) => l.publish);
  return {
    header: keep(nav.header),
    sidebar: { ...nav.sidebar, links: keep(nav.sidebar.links) },
    footer: { ...nav.footer, links: keep(nav.footer.links) },
  };
}

/** True when the footer would render anything at all (nothing configured, or every
 *  link filtered out by `publish: false` → no `<footer>` element is emitted).
 *  @param {Nav} nav */
export function hasFooter(nav) {
  return nav.footer.links.length > 0 || nav.footer.text != null || nav.footer.poweredBy;
}

/** Stable id of a localizable nav string, shared by the renderer and the client
 *  re-localizer: `header:0`, `sidebar:2`, `sidebar:title`, `footer:text`. */
export function navLabelId(section, index) {
  return `${section}:${index}`;
}

/**
 * Payload for the cross-locale AGGREGATE pages (/comments, /journal, /review, 404),
 * which have no page locale: `{ <id>: <raw label map> }` for the labels that actually
 * vary by language (a plain string needs no client work). Same mechanism as
 * `clientRoots` + `data-nb-root-label`; emitted only when i18n is enabled, so a
 * mono-language site's output stays byte-identical.
 * @param {Nav} nav @returns {Record<string, Record<string,string>>}
 */
export function navClientLabels(nav) {
  const out = {};
  const add = (id, value) => {
    if (value != null && typeof value !== "string") out[id] = value;
  };
  for (const [section, links] of [
    ["header", nav.header],
    ["sidebar", nav.sidebar.links],
    ["footer", nav.footer.links],
  ]) {
    links.forEach((l, i) => {
      add(navLabelId(section, i), l.label);
    });
  }
  add(navLabelId("sidebar", "title"), nav.sidebar.title);
  add(navLabelId("footer", "text"), nav.footer.text);
  return out;
}
