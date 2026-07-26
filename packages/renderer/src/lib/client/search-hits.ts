// One result markup for BOTH search engines — the JSON-index scoring (dev/normal
// builds) and Pagefind (public builds, when installed). Pure (unit-tested).
import { esc } from "./esc";

export interface SearchHit {
  href: string;
  /** Space KEY — doubles as the chip's modifier class. */
  spaceKey: string;
  /** Space label in the search locale (resolved by the caller). */
  spaceLabel: string;
  title: string;
  /** Pagefind excerpt — HTML it already escaped, with <mark> highlights; rendered verbatim. */
  excerptHtml?: string;
}

export function hitHtml(h: SearchHit): string {
  const excerpt = h.excerptHtml ? `<span class="r-excerpt">${h.excerptHtml}</span>` : "";
  return `<a href="${esc(h.href)}"><span class="r-space ${esc(h.spaceKey)}">${esc(h.spaceLabel)}</span><span class="r-title">${esc(h.title)}</span>${excerpt}</a>`;
}
