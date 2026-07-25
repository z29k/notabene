// Read-only block affordances for the PUBLIC build: hovering a rendered Mermaid
// diagram or an image shows a small ⤢ toolbar, and double-click opens the pan/zoom
// lightbox. The full review app wires the same gestures inside Comments.astro
// (alongside the 💬 comment half); this is the comment-free subset, so a public
// site keeps the zoom without shipping any review code.
import { type LightboxLabels, openLightbox } from "./lightbox";

// Crisp inline "expand" icon — the ⤢ glyph rendered too thin/small to read as a button.
const EXPAND_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M21 3l-8 8M9 21H3v-6M3 21l8-8"/></svg>';

export function initBlockZoom(article: HTMLElement, enlargeLabel: string, labels: LightboxLabels): void {
  let barEl: HTMLElement | null = null;
  let barTarget: HTMLElement | null = null;

  const hideBar = () => {
    if (barEl) barEl.hidden = true;
    barTarget = null;
  };
  const bar = (): HTMLElement => {
    if (barEl) return barEl;
    const b = document.createElement("div");
    b.className = "cmt-blockbar";
    b.hidden = true;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.b = "zoom";
    btn.title = enlargeLabel;
    btn.setAttribute("aria-label", enlargeLabel);
    btn.innerHTML = EXPAND_ICON; // static SVG markup, no interpolation
    b.appendChild(btn);
    b.addEventListener("pointerdown", (e) => e.preventDefault());
    b.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button[data-b]") && barTarget) openLightbox(barTarget, labels);
    });
    b.addEventListener("pointerleave", () => hideBar());
    document.body.appendChild(b);
    barEl = b;
    return b;
  };
  // Same placement rule as the review app's toolbar: pinned to the block's top-right,
  // never under the sticky header, never past the block's bottom edge.
  const showBar = (el: HTMLElement) => {
    barTarget = el;
    const b = bar();
    b.hidden = false;
    const r = el.getBoundingClientRect();
    const headerBottom = (document.querySelector(".topbar") as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0;
    const minTop = headerBottom + 6;
    const barH = b.offsetHeight || 34;
    b.style.top = `${Math.min(Math.max(minTop, r.top + 6), Math.max(minTop, r.bottom - barH - 6))}px`;
    b.style.left = `${Math.max(6, Math.min(window.innerWidth - 46, r.right - 40))}px`;
  };

  article.addEventListener("pointerover", (e) => {
    if ((e as PointerEvent).pointerType === "touch") return;
    const el = (e.target as HTMLElement).closest("pre.mermaid, img") as HTMLElement | null;
    if (el && article.contains(el)) showBar(el);
  });
  article.addEventListener("dblclick", (e) => {
    const el = (e.target as HTMLElement).closest("pre.mermaid, img") as HTMLElement | null;
    if (el && article.contains(el)) {
      e.preventDefault();
      openLightbox(el, labels);
    }
  });
  article.addEventListener("pointerout", (e) => {
    const to = (e as PointerEvent).relatedTarget as HTMLElement | null;
    if (to?.closest?.("pre.mermaid, img") || to?.closest?.(".cmt-blockbar")) return;
    setTimeout(() => {
      if (barEl && !barEl.matches(":hover")) hideBar();
    }, 150);
  });
  window.addEventListener("scroll", () => hideBar(), { passive: true });
}
