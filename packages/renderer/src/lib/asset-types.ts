// Pure helpers for the branding asset route (pages/_nb/): stable public name +
// content type from a configured file's extension. Unit-tested; no fs, no config.

const TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  ico: "image/x-icon",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

/** Lowercased extension of a path ("docs/a/logo.SVG" → "svg"; none → ""). */
export function assetExt(p: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(p);
  return m ? m[1].toLowerCase() : "";
}

/** Content type for an image extension — octet-stream for anything unknown. */
export function contentTypeFor(ext: string): string {
  return TYPES[ext] ?? "application/octet-stream";
}

/** Public path of a branding asset: /_nb/<name>.<original ext> (base applied by callers). */
export function assetPath(name: string, sourceFile: string): string {
  const ext = assetExt(sourceFile);
  return ext ? `/_nb/${name}.${ext}` : `/_nb/${name}`;
}
