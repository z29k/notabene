// Vite's `?inline` CSS import (a string, kept OUT of the build CSS graph — see
// lib/client/wysiwyg.ts for why that distinction is load-bearing). vite/client types
// the bare `*.css` module but not the query form.
declare module "*.css?inline" {
  const css: string;
  export default css;
}
