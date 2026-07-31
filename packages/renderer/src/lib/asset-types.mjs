// Pure helpers for the /_nb asset route: stable public name + content type from a
// configured file's extension. Covers both families — the named branding/theme files
// and the consumer asset folder (`theme.assets`), hence the font types.
// Unit-tested; no fs, no config.
//
// `.mjs`, and it MUST stay that way: integrations/dev-assets.mjs imports it, and that
// module hangs off astro.config.mjs. Pulling a .ts file into the CONFIG module graph
// makes Astro load the config through a Vite module runner it then closes — after which
// any dynamic import from an integration closure dies with "Vite module runner has been
// closed" (it took down the dev Pagefind index, silently, via a swallowed catch).

/** @type {Record<string, string>} */
const TYPES = {
  svg: "image/svg+xml",
  ico: "image/x-icon",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  css: "text/css",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
};

/** Lowercased extension of a path ("docs/a/logo.SVG" → "svg"; none → "").
 *  @param {string} p @returns {string} */
export function assetExt(p) {
  const m = /\.([A-Za-z0-9]+)$/.exec(p);
  return m ? m[1].toLowerCase() : "";
}

/** Content type for an extension — octet-stream for anything unknown.
 *  @param {string} ext @returns {string} */
export function contentTypeFor(ext) {
  return TYPES[ext] ?? "application/octet-stream";
}

/** Public path of a branding asset: /_nb/<name>.<original ext> (base applied by callers).
 *  @param {string} name @param {string} sourceFile @returns {string} */
export function assetPath(name, sourceFile) {
  const ext = assetExt(sourceFile);
  return ext ? `/_nb/${name}.${ext}` : `/_nb/${name}`;
}
