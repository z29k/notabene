// Enlarge a diagram/image in a full-screen overlay. Reuses the shell overlay machinery
// (scrim, Escape, scroll-lock, inert). The stage scrolls for diagrams bigger than the
// viewport; click the backdrop or ✕ to close.
import { closeOverlay, currentOverlay, openOverlay } from "./shell";

let el: HTMLElement | null = null;

function ensureEl(): HTMLElement {
  if (el) return el;
  const box = document.createElement("div");
  box.id = "nb-lightbox";
  box.className = "nb-lightbox";
  box.hidden = true;
  box.innerHTML =
    '<button type="button" class="nb-lightbox-close" aria-label="Close">✕</button><div class="nb-lightbox-stage"></div>';
  box.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t === box || t.closest(".nb-lightbox-close")) {
      if (currentOverlay() === "lightbox") closeOverlay();
      else box.hidden = true;
    }
  });
  document.body.appendChild(box);
  el = box;
  return box;
}

/** Open the lightbox showing an enlarged copy of a commentable block (pre.mermaid / img). */
export function openLightbox(block: HTMLElement): void {
  const box = ensureEl();
  const stage = box.querySelector(".nb-lightbox-stage") as HTMLElement;
  stage.innerHTML = "";
  if (block.tagName === "IMG") {
    const img = new Image();
    img.src = (block as HTMLImageElement).currentSrc || (block as HTMLImageElement).src;
    img.alt = (block as HTMLImageElement).alt || "";
    stage.appendChild(img);
  } else {
    const svg = block.querySelector("svg");
    if (svg) stage.appendChild(svg.cloneNode(true));
    else stage.textContent = block.textContent || ""; // not rendered yet → show source
  }
  box.hidden = false;
  openOverlay("lightbox", box, () => {
    box.hidden = true;
    stage.innerHTML = "";
  });
}
