// Vite's `?inline` CSS import (a string, kept OUT of the build CSS graph — see
// lib/client/wysiwyg.ts for why that distinction is load-bearing). vite/client types
// the bare `*.css` module but not the query form.
declare module "*.css?inline" {
  const css: string;
  export default css;
}

// The `mdxComponents` bridge (src/integrations/mdx-components.mjs): a Vite virtual module
// generated from the consumer's config, so it has no file on disk to infer types from.
declare module "virtual:notabene-mdx-components" {
  /** Component map for a space — `roots[].mdxComponents`, else the global `mdxComponents`,
   *  else undefined (callers then omit the `components` prop entirely). The values are
   *  whatever MDX can render, so they stay `unknown` here. */
  export function componentsFor(space?: string | null): Record<string, unknown> | undefined;
}
