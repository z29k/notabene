// Shared overlay machinery for the mobile/compact shell: one scrim, one active
// overlay at a time (nav drawer OR a comment bottom-sheet), background `inert`,
// body scroll-lock, Escape, and on-screen-keyboard avoidance. Framework-free.
//
// Consumed by DocLayout (drawer) and Comments.astro (compose/read/list sheets).
// It's a single ES module, so the `current`/lock state is shared across every
// inline <script> that imports it. Desktop (≥1024px) never opens an overlay.

/** The compact breakpoint — mirrors the `max-width:1024px` CSS block. */
export const compactMQ = typeof matchMedia === "function" ? matchMedia("(max-width: 1024px)") : null;

export function isCompact(): boolean {
  return compactMQ?.matches ?? false;
}

// Background regions that get `inert` while an overlay is open — the active panel
// (or its ancestor region) is exempted so it stays interactive.
const BG_SELECTORS = [".topbar", ".sidebar", ".content", ".rail"];

interface Overlay {
  name: string;
  /** Visual teardown only (hide the panel). Must NOT call closeOverlay(). */
  close: () => void;
}

let current: Overlay | null = null;
let locked = false;
let savedScrollY = 0;
let lastFocus: Element | null = null;
let inerted: Element[] = [];
let initialized = false;
/** Localized label for the sheet grip; set by initShell(). */
let gripLabel = "Resize or close";

function scrimEl(): HTMLElement | null {
  return document.getElementById("nb-scrim");
}

function lockScroll(): void {
  if (locked) return;
  locked = true;
  savedScrollY = window.scrollY;
  const b = document.body.style;
  b.position = "fixed";
  b.top = `-${savedScrollY}px`;
  b.left = "0";
  b.right = "0";
}
function unlockScroll(): void {
  if (!locked) return;
  locked = false;
  const b = document.body.style;
  b.position = "";
  b.top = "";
  b.left = "";
  b.right = "";
  window.scrollTo(0, savedScrollY);
}

function setInert(panel: Element | null): void {
  clearInert();
  for (const sel of BG_SELECTORS) {
    for (const el of document.querySelectorAll(sel)) {
      if (panel && (el === panel || el.contains(panel))) continue;
      el.setAttribute("inert", "");
      inerted.push(el);
    }
  }
}
function clearInert(): void {
  for (const el of inerted) el.removeAttribute("inert");
  inerted = [];
}

// While an overlay is open, mirror the software-keyboard height into --nb-kb so a
// bottom sheet can lift above it (iOS overlays the keyboard without resizing the
// layout viewport). No-op where VisualViewport is unavailable.
function onViewport(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  const style = document.documentElement.style;
  style.setProperty("--nb-kb", `${kb}px`);
  // How tall a bottom-anchored sheet may actually be. `svh` cannot answer this: it is the
  // SMALL viewport height and does not shrink when the keyboard opens, so a sheet sized in
  // `svh` and lifted by --nb-kb has its top pushed off the TOP of the screen once the two
  // exceed the display — which is exactly what happened to the expanded compose sheet.
  // The visual viewport knows the real figure.
  style.setProperty("--nb-sheet-max", `${Math.max(160, vv.height - 12)}px`);
}
function bindViewport(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  vv.addEventListener("resize", onViewport);
  vv.addEventListener("scroll", onViewport);
}
function unbindViewport(): void {
  const vv = window.visualViewport;
  if (vv) {
    vv.removeEventListener("resize", onViewport);
    vv.removeEventListener("scroll", onViewport);
  }
  document.documentElement.style.setProperty("--nb-kb", "0px");
  document.documentElement.style.removeProperty("--nb-sheet-max");
}

// ── the sheet grip ──────────────────────────────────────────────────────────
// The pill at the top of every bottom sheet used to be a `::before` — a decoration
// that promises a gesture and delivers nothing. On a phone, grabbing it to expand or
// dismiss is the reflex, so it is now a REAL element with the drag wired here: one
// implementation for every sheet, since they all pass through openOverlay().
//
// It must be a real element, not a pseudo-element: the sheet scrolls (`touch-action:
// pan-y`), so the browser would claim a vertical drag started anywhere inside it before
// any JS ran. Only an element of its own can opt out with `touch-action: none`.

/** Past this fraction of its own height, a downward drag dismisses instead of snapping back. */
const DISMISS_RATIO = 0.3;

function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setExpanded(panel: HTMLElement, on: boolean): void {
  panel.classList.toggle("nb-sheet-full", on);
  panel.querySelector(".nb-sheet-grip")?.setAttribute("aria-expanded", String(on));
}

function attachGrip(panel: HTMLElement, label: string): void {
  const existing = panel.querySelector<HTMLButtonElement>(".nb-sheet-grip");
  if (!existing) {
    const grip = document.createElement("button");
    grip.type = "button";
    grip.className = "nb-sheet-grip";
    grip.setAttribute("aria-label", label);
    grip.setAttribute("aria-expanded", "false");
    panel.prepend(grip);

    let startY = 0;
    let dy = 0;
    let height = 0;
    let dragging = false;

    const end = () => {
      if (!dragging) return;
      dragging = false;
      panel.style.transition = reducedMotion() ? "" : "transform .18s ease, height .18s ease";
      panel.style.transform = "";
      // Down far enough (or from expanded) → collapse a step; otherwise snap back.
      if (dy > height * DISMISS_RATIO) {
        if (panel.classList.contains("nb-sheet-full")) setExpanded(panel, false);
        else closeOverlay();
      } else if (dy < -40) {
        setExpanded(panel, true);
      }
      dy = 0;
    };

    grip.addEventListener("pointerdown", (e) => {
      dragging = true;
      startY = e.clientY;
      dy = 0;
      height = panel.getBoundingClientRect().height;
      panel.style.transition = "none";
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dy = e.clientY - startY;
      // Downward follows the finger; upward resists, since there is nowhere to go past
      // the expanded detent.
      panel.style.transform = `translateY(${dy > 0 ? dy : dy / 4}px)`;
    });
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    // Keyboard: the grip is a button, so it must do something without a pointer.
    grip.addEventListener("click", (e) => {
      if (e.detail !== 0) return; // real clicks are handled by the drag above
      setExpanded(panel, !panel.classList.contains("nb-sheet-full"));
    });
  }
  setExpanded(panel, false);
  panel.style.transform = "";
  panel.style.transition = "";
}

/**
 * Open `panel` as the sole active overlay. `close` hides the panel (visual only).
 * Focuses `focusEl` after layout (pass the textarea for compose; omit for read/list
 * so a keyboard doesn't pop). Opening a second overlay closes the first.
 */
export function openOverlay(name: string, panel: HTMLElement, close: () => void, focusEl?: HTMLElement | null): void {
  const wasOpen = !!current;
  if (current && current.name !== name) current.close();
  if (!wasOpen) lastFocus = document.activeElement;
  current = { name, close };

  const s = scrimEl();
  if (s) s.hidden = false;
  if (isCompact()) attachGrip(panel, gripLabel);
  setInert(panel);
  lockScroll();
  bindViewport();
  onViewport();
  if (focusEl) requestAnimationFrame(() => focusEl.focus());
}

/** Close whatever overlay is open (runs its visual teardown + shared cleanup). */
export function closeOverlay(): void {
  if (!current) return;
  const c = current;
  current = null;
  const s = scrimEl();
  if (s) s.hidden = true;
  clearInert();
  unbindViewport();
  unlockScroll();
  const lf = lastFocus as HTMLElement | null;
  lastFocus = null;
  c.close();
  if (lf?.focus) requestAnimationFrame(() => lf.focus());
}

export function currentOverlay(): string | null {
  return current?.name ?? null;
}

/** Wire the shared scrim, Escape, and resize-to-desktop closers. Idempotent. */
export function initShell(label?: string): void {
  if (label) gripLabel = label;
  if (initialized) return;
  initialized = true;

  // Dismiss only when the WHOLE gesture happened on the scrim. A sheet opened from a tap
  // in the article (openView runs on `pointerup`) shows the scrim before the browser
  // dispatches that tap's `click` — and the click then hit-tests onto the freshly shown
  // scrim, closing what the same gesture just opened. That is the open-then-instantly-
  // close flicker on touch. Requiring the press to have started here fixes it without
  // weakening a genuine scrim tap.
  let pressTarget: EventTarget | null = null;
  document.addEventListener("pointerdown", (e) => {
    pressTarget = e.target;
  });
  scrimEl()?.addEventListener("click", (e) => {
    if (pressTarget === e.target) closeOverlay();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current) {
      e.preventDefault();
      closeOverlay();
    }
  });

  // Leaving compact strands any open overlay (a sheet left up across a rotation) —
  // force it closed so desktop is always clean.
  const desktopMQ = matchMedia("(min-width: 1025px)");
  const onDesktop = (e: MediaQueryList | MediaQueryListEvent) => {
    if (e.matches) closeOverlay();
  };
  desktopMQ.addEventListener("change", onDesktop);
}
