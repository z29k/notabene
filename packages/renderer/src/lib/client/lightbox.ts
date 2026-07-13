// Enlarge a diagram/image in a full-screen overlay with pan + zoom. Dense diagrams (a wide
// ER model, a condensed flowchart) are unreadable fit-to-screen, so the stage is a viewport
// the content pans/zooms inside: wheel/pinch to zoom-to-cursor, drag to pan, double-click to
// zoom in, +/−/0/arrows on the keyboard, and a − % + ⤢ control pill. Vector SVG stays crisp
// under the transform; raster images zoom to inspect. Reuses the shell overlay machinery
// (scrim, Escape, scroll-lock, inert). The lightbox shows a *clone*, so comment anchoring on
// the original block is untouched. All affine math lives in the pure lib/pan-zoom module.
import { type Size, fitScale, initialView, panBy, zoomAround, zoomBounds } from "../pan-zoom";
import { closeOverlay, currentOverlay, openOverlay } from "./shell";

export interface LightboxLabels {
  close: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
}
const DEFAULT_LABELS: LightboxLabels = {
  close: "Close",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Reset zoom",
};

interface Controller {
  destroy(): void;
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
}

let el: HTMLElement | null = null;
let stage: HTMLElement;
let content: HTMLElement;
let pct: HTMLElement;
let active: Controller | null = null;

function ensureEl(labels: LightboxLabels): HTMLElement {
  if (el) return el;
  const box = document.createElement("div");
  box.id = "nb-lightbox";
  box.className = "nb-lightbox";
  box.hidden = true;
  box.innerHTML =
    `<button type="button" class="nb-lightbox-close" data-z="close" title="${labels.close}" aria-label="${labels.close}">✕</button>` +
    '<div class="nb-lightbox-stage"><div class="nb-lightbox-content"></div></div>' +
    '<div class="nb-lightbox-tools" role="group">' +
    `<button type="button" data-z="out" title="${labels.zoomOut}" aria-label="${labels.zoomOut}">−</button>` +
    '<span class="nb-lightbox-pct" aria-live="polite">100%</span>' +
    `<button type="button" data-z="in" title="${labels.zoomIn}" aria-label="${labels.zoomIn}">+</button>` +
    `<button type="button" data-z="reset" title="${labels.zoomReset}" aria-label="${labels.zoomReset}">⤢</button>` +
    "</div>";
  stage = box.querySelector(".nb-lightbox-stage") as HTMLElement;
  content = box.querySelector(".nb-lightbox-content") as HTMLElement;
  pct = box.querySelector(".nb-lightbox-pct") as HTMLElement;

  const doClose = () => {
    if (currentOverlay() === "lightbox") closeOverlay();
    else box.hidden = true;
  };
  box.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-z]") as HTMLElement | null;
    if (!btn) {
      if (e.target === box) doClose(); // backdrop margin closes; the stage is for panning
      return;
    }
    const z = btn.dataset.z;
    if (z === "close") doClose();
    else if (z === "in") active?.zoomIn();
    else if (z === "out") active?.zoomOut();
    else if (z === "reset") active?.reset();
  });

  document.body.appendChild(box);
  el = box;
  return box;
}

/** Wire pointer/wheel/keyboard on `stage`, driving `content`'s transform via pan-zoom math. */
function makeController(nat: Size, allowUpscale: boolean): Controller {
  const vp = (): Size => ({ w: stage.clientWidth, h: stage.clientHeight });
  let bounds = zoomBounds(fitScale(nat, vp()));
  let view = initialView(nat, vp(), allowUpscale);

  const pointers = new Map<number, { x: number; y: number }>();
  let panId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let pinchDist = 0;

  const apply = () => {
    content.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
    pct.textContent = `${Math.round(view.scale * 100)}%`;
  };
  const at = (clientX: number, clientY: number): [number, number] => {
    const r = stage.getBoundingClientRect();
    return [clientX - r.left, clientY - r.top];
  };
  const zoomAt = (factor: number, px: number, py: number) => {
    view = zoomAround(view, factor, px, py, bounds.min, bounds.max);
    apply();
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault(); // zoom instead of scrolling the (locked) page
    const [px, py] = at(e.clientX, e.clientY);
    zoomAt(Math.exp(-e.deltaY * 0.0015), px, py);
  };
  const onDown = (e: PointerEvent) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      panId = null;
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    } else {
      panId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      stage.classList.add("nb-grabbing");
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) {
        const [mx, my] = at((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAt(d / pinchDist, mx, my);
      }
      pinchDist = d;
    } else if (e.pointerId === panId) {
      view = panBy(view, e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      apply();
    }
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 1) {
      // a finger lifted mid-pinch → resume single-finger pan with the one that remains
      const [[id, p]] = [...pointers];
      panId = id;
      lastX = p.x;
      lastY = p.y;
    } else if (pointers.size === 0) {
      panId = null;
      stage.classList.remove("nb-grabbing");
    }
  };
  const onDbl = (e: MouseEvent) => {
    const [px, py] = at(e.clientX, e.clientY);
    zoomAt(1.8, px, py);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "+" || e.key === "=") zoomCenter(1.25);
    else if (e.key === "-" || e.key === "_") zoomCenter(0.8);
    else if (e.key === "0") reset();
    else if (e.key === "ArrowLeft") view = panBy(view, 60, 0);
    else if (e.key === "ArrowRight") view = panBy(view, -60, 0);
    else if (e.key === "ArrowUp") view = panBy(view, 0, 60);
    else if (e.key === "ArrowDown") view = panBy(view, 0, -60);
    else return;
    e.preventDefault();
    apply();
  };

  const zoomCenter = (factor: number) => {
    const v = vp();
    zoomAt(factor, v.w / 2, v.h / 2);
  };
  const reset = () => {
    bounds = zoomBounds(fitScale(nat, vp()));
    view = initialView(nat, vp(), allowUpscale);
    apply();
  };
  const onResize = () => {
    bounds = zoomBounds(fitScale(nat, vp()));
    apply();
  };

  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
  stage.addEventListener("dblclick", onDbl);
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize, { passive: true });

  apply();

  return {
    zoomIn: () => zoomCenter(1.4),
    zoomOut: () => zoomCenter(1 / 1.4),
    reset,
    destroy() {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("dblclick", onDbl);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      stage.classList.remove("nb-grabbing");
    },
  };
}

/** Open the lightbox showing an enlarged, pan/zoomable copy of a commentable block (pre.mermaid / img). */
export function openLightbox(block: HTMLElement, labels: LightboxLabels = DEFAULT_LABELS): void {
  const box = ensureEl(labels);
  active?.destroy();
  active = null;
  content.innerHTML = "";
  content.style.transform = "";

  let nat: Size = { w: 0, h: 0 };
  let allowUpscale = false;

  if (block.tagName === "IMG") {
    const src = block as HTMLImageElement;
    const img = new Image();
    img.src = src.currentSrc || src.src;
    img.alt = src.alt || "";
    img.draggable = false;
    content.appendChild(img);
    nat = { w: src.naturalWidth, h: src.naturalHeight };
    // If the source's natural size isn't known yet, size + fit once the clone loads.
    if (!nat.w || !nat.h)
      img.addEventListener("load", () => start({ w: img.naturalWidth, h: img.naturalHeight }, false));
  } else {
    const svg = block.querySelector("svg") as SVGSVGElement | null;
    if (svg) {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      const vb = svg.viewBox?.baseVal;
      const r = svg.getBoundingClientRect();
      nat = { w: vb?.width || r.width || 300, h: vb?.height || r.height || 150 };
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      clone.style.maxWidth = "none";
      clone.style.maxHeight = "none";
      content.appendChild(clone);
      allowUpscale = true; // vectors stay crisp; fill the stage
    } else {
      content.textContent = block.textContent || ""; // not rendered yet → show source
    }
  }

  function start(size: Size, upscale: boolean): void {
    active?.destroy();
    content.style.width = `${size.w}px`;
    content.style.height = `${size.h}px`;
    active = makeController(size, upscale);
  }

  box.hidden = false;
  // box.hidden just flipped display:none→flex; read clientWidth to force the reflow so the
  // stage has real dimensions before we compute the fit (avoids a first-paint jump).
  void stage.clientWidth;
  start(nat, allowUpscale);

  openOverlay("lightbox", box, () => {
    box.hidden = true;
    active?.destroy();
    active = null;
    content.innerHTML = "";
    content.style.transform = "";
  });
}
