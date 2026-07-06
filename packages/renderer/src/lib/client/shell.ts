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
  document.documentElement.style.setProperty("--nb-kb", `${kb}px`);
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
export function initShell(): void {
  if (initialized) return;
  initialized = true;

  scrimEl()?.addEventListener("click", () => closeOverlay());

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
