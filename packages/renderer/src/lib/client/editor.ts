// Browser side of the in-page editor.
//
// DESIGN: the document IS the interface. There is no "edit mode" to turn on and no box
// that replaces the block — the block is edited where it sits, in the article's own
// typography, and only takes on a tint so you can see which one is live. The chrome is a
// vertical rail in the gutter; formatting appears at the selection, the way Notion does it.
//
// Reading and editing never compete for a gesture, which is what makes a mode switch
// unnecessary — two steps on both platforms, never one:
//   · desktop → hover shows a ✎ in the gutter; clicking it opens the block
//   · touch   → a tap ARMS the block (outline + a chip at the top); the chip opens it
//   · selecting text, anywhere → the comment flow, untouched
//
// Clicking the text to start editing was tried and removed on BOTH: on desktop you click
// into a paragraph on the way to selecting part of it, and on a phone the tap is the
// reading gesture. Either way a stray tap must never drop you into an editor.
//
// Everything around the block stays rendered while you type: the comment rail, the
// highlights, the TOC, the diagrams. Editing one block never re-renders the page.
//
// After a write the dev server's HMR reloads with the authoritative rendering (Shiki,
// Mermaid, link rewriting, fresh stamps) — which is why the session-scoped draft below is
// load-bearing rather than a convenience: it is what survives that reload.
import { RICH_KINDS, type WysiwygHandle, mountWysiwyg } from "./wysiwyg";

/** A block's `data-nb-range` stamp. */
export interface Stamp {
  start: number;
  end: number;
  kind: string;
}

/** Parse `data-nb-range="start:end"`. Returns null for anything malformed. */
export function parseStamp(src: string | null | undefined, kind?: string | null): Stamp | null {
  const m = /^(\d+):(\d+)$/.exec(String(src ?? ""));
  if (!m) return null;
  const start = Number.parseInt(m[1], 10);
  const end = Number.parseInt(m[2], 10);
  if (end < start) return null;
  return { start, end, kind: kind ?? "" };
}

/** Session-scoped draft key. Includes the range so two blocks never share a draft. */
export function draftKey(page: string, s: Stamp): string {
  return `nb-draft:${page}:${s.start}:${s.end}`;
}

export interface ApiError {
  error?: string;
  detail?: string;
}

/**
 * Turn an API failure into something a human can act on. The server always says WHY it
 * refused; the catalog gives the sentence, and `detail` (the containment explanation, the
 * `git add` remedy) is appended when it adds information.
 */
export function editorMessage(status: number, payload: ApiError, m: Record<string, string>): string {
  const key =
    payload.error === "containment"
      ? "editErrorContainment"
      : payload.error === "moved"
        ? "editErrorMoved"
        : payload.error === "stale"
          ? "editErrorStale"
          : payload.error === "untracked"
            ? "editErrorUntracked"
            : "editErrorGeneric";
  const base = m[key] ?? m.editErrorGeneric ?? "Could not save.";
  if (payload.detail && key !== "editErrorUntracked") return `${base} ${payload.detail}`;
  if (payload.detail) return payload.detail;
  return status >= 500 ? `${base} (HTTP ${status})` : base;
}

/**
 * Approximate the rendered text of some Markdown — enough to tell whether a comment's
 * quote is still there. Comment anchors are captured from the RENDERED DOM (`inline code`,
 * not the backticked source), so a raw substring test against source would miss most.
 */
export function approxRendered(md: string): string {
  return md
    .replace(/^\s*```.*$/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)([\s\S]*?)\1/g, "$2")
    .replace(/(\*|_)([\s\S]*?)\1/g, "$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface QuotedComment {
  id: string;
  quote: string;
}

/**
 * Which comment anchors this edit would break: quotes that WERE in the block and are not
 * in the replacement. The "was there before" precondition is what keeps this quiet — if
 * the approximation above failed to locate a quote in the original, nothing is claimed
 * about it. A warning that cries wolf is worse than no warning.
 */
export function anchorsBrokenBy(comments: QuotedComment[], original: string, next: string): string[] {
  const before = approxRendered(original);
  const after = approxRendered(next);
  return comments
    .filter((c) => {
      const q = String(c.quote ?? "")
        .replace(/\s+/g, " ")
        .trim();
      return q.length > 0 && before.includes(q) && !after.includes(q);
    })
    .map((c) => c.id);
}

/** Name part of a git-style `Name <email>` author (mirrors displayName in comments-client). */
export function displayName(author: string): string {
  return String(author ?? "")
    .replace(/\s*<[^>]*>\s*$/, "")
    .trim();
}

/** Same token convention as the comments API (never embedded in the HTML). */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  try {
    const tok = localStorage.getItem("notabene:token");
    if (tok) headers["x-notabene-token"] = tok;
  } catch {
    /* localStorage unavailable — proceed without a token */
  }
  return headers;
}

const RAIL_W = 30;
/** Handle offset from the block's left edge — its hit area bridges the gap back (CSS). */
const HANDLE_GAP = 30;
const PANEL_W = 210;
const session = {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* private mode — drafts are best-effort */
    }
  },
  drop(key: string) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

interface Comment {
  id: string;
  status: string;
  hold?: boolean;
  scope?: string;
  anchor?: { quote?: string } | null;
  thread?: { author: string; body: string }[];
}

export interface EditorOptions {
  page: string;
  article: HTMLElement;
  messages: Record<string, string>;
}

interface Session {
  el: HTMLElement;
  host: HTMLElement;
  /** Vertical toolbar in the gutter — the editing chrome, entirely out of the text. */
  rail: HTMLElement;
  /** Card under the rail: the loop controls and any message. Only when relevant. */
  panel: HTMLElement;
  stamp: Stamp;
  original: string;
  comments: Comment[];
  quoted: QuotedComment[];
  rich: WysiwygHandle | null;
  area: HTMLTextAreaElement | null;
  style: Record<string, unknown>;
  nextEnd: number | null;
  saving: boolean;
  /** Comment ids ticked for closure, and the journal note — kept on the session because
   *  the panel is re-rendered on every keystroke. */
  closing: Set<string>;
  note: string;
}

export function mountEditor({ page, article, messages: m }: EditorOptions): void {
  let open: Session | null = null;

  // TOUCH IS A DIFFERENT PRODUCT, not a narrower one. There is no hover to reveal a
  // handle with and no gutter to put a rail in, so the entry is a tap that ARMS the block
  // and the chrome docks to the TOP of the viewport — the bottom belongs to the platform
  // (Android's "tap to search" chip and gesture pill, iOS's keyboard), and anything put
  // there ends up unreachable.
  let lastPointerType = "mouse";
  document.addEventListener("pointerdown", (e) => {
    lastPointerType = (e as PointerEvent).pointerType || "mouse";
  });
  const coarse = () => lastPointerType === "touch" || matchMedia("(pointer: coarse)").matches;

  const stamped = () => Array.from(article.querySelectorAll<HTMLElement>("[data-nb-range]"));
  const short = (s: string, n = 52) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const content = () => (open ? (open.rich ? open.rich.getMarkdown() : (open.area?.value ?? "")) : "");

  // ── the hover handle: the whole entry point, in one glyph ───────────────────
  // It sits in the left gutter, outside the text column, and never participates in layout
  // — so nothing on the page moves because of it.
  //
  // HIDING IS DELAYED, and that is not a nicety. The handle lives OUTSIDE the block it
  // belongs to, so reaching for it means leaving the block — which fired `mouseleave` and
  // took the handle away before the pointer arrived, making it literally unclickable. A
  // short grace period, cancelled the moment the pointer lands on the handle, is the
  // standard fix for that gap.
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "nb-edit-handle";
  handle.hidden = true;
  handle.setAttribute("aria-label", m.editBlockHint);
  handle.dataset.tip = m.editBlockHint;
  handle.textContent = "✎";
  document.body.append(handle);
  let handleFor: HTMLElement | null = null;
  let hideTimer = 0;

  function showHandle(el: HTMLElement | null) {
    window.clearTimeout(hideTimer);
    handleFor = el;
    if (!el || open || coarse()) {
      handle.hidden = true;
      return;
    }
    const r = el.getBoundingClientRect();
    handle.style.top = `${window.scrollY + r.top + 2}px`;
    handle.style.left = `${window.scrollX + r.left - HANDLE_GAP}px`;
    handle.hidden = false;
  }

  /** Give the pointer time to cross the gutter gap; landing on the handle cancels it. */
  function scheduleHide() {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => showHandle(null), 260);
  }

  article.addEventListener("mouseover", (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-nb-range]") ?? null;
    if (el) showHandle(el);
    else scheduleHide();
  });
  article.addEventListener("mouseleave", scheduleHide);
  handle.addEventListener("mouseenter", () => window.clearTimeout(hideTimer));
  handle.addEventListener("mouseleave", scheduleHide);
  window.addEventListener("scroll", () => showHandle(null), { passive: true });
  handle.addEventListener("click", () => {
    if (handleFor) void openBlock(handleFor);
  });

  // ── tooltips ────────────────────────────────────────────────────────────────
  // Not the native `title`: it takes ~1s to appear, cannot be styled, and would sit
  // wherever the OS decides — on a 30px button in a narrow gutter that is unusable.
  // One shared element, positioned to the LEFT of the chrome (the gutter it lives in),
  // flipping right only when the window is too narrow to fit it there.
  const tip = document.createElement("div");
  tip.className = "nb-edit-tip";
  tip.hidden = true;
  tip.setAttribute("role", "tooltip");
  document.body.append(tip);

  function showTip(el: HTMLElement) {
    const text = el.dataset.tip;
    if (!text) return;
    tip.textContent = text;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const left = r.left - w - 8 >= 4 ? r.left - w - 8 : r.right + 8;
    tip.style.left = `${window.scrollX + left}px`;
    tip.style.top = `${window.scrollY + r.top + r.height / 2 - tip.offsetHeight / 2}px`;
  }
  const hideTip = () => {
    tip.hidden = true;
  };

  for (const [ev, fn] of [
    ["mouseover", (t: HTMLElement) => showTip(t)],
    ["focusin", (t: HTMLElement) => showTip(t)],
  ] as const) {
    document.addEventListener(ev, (e) => {
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-tip]");
      if (t) fn(t);
      else hideTip();
    });
  }
  document.addEventListener("focusout", hideTip);
  window.addEventListener("scroll", hideTip, { passive: true });

  // ── the floating toolbar: only while text is selected, at the selection ──────
  const bar = document.createElement("div");
  bar.className = "nb-edit-float";
  bar.hidden = true;
  for (const [cmd, label, title] of [
    ["strong", "B", m.editBold],
    ["emphasis", "I", m.editItalic],
    ["inlineCode", "<>", m.editCode],
    ["link", "↗", m.editLink],
  ] as const) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `nb-edit-fmt nb-edit-fmt--${cmd}`;
    b.dataset.cmd = cmd;
    b.textContent = label;
    b.dataset.tip = title;
    b.setAttribute("aria-label", title);
    bar.append(b);
  }
  document.body.append(bar);
  // `mousedown` (not click) so the button never steals focus from the editor.
  bar.addEventListener("mousedown", (e) => {
    const cmd = (e.target as HTMLElement | null)?.closest<HTMLElement>(".nb-edit-fmt")?.dataset.cmd;
    if (!cmd || !open?.rich) return;
    e.preventDefault();
    open.rich.run(cmd as "strong" | "emphasis" | "inlineCode" | "link");
  });

  function positionBar() {
    const sel = window.getSelection();
    if (!open?.rich || !sel || sel.isCollapsed || sel.rangeCount === 0) {
      bar.hidden = true;
      return;
    }
    if (!open.host.contains(sel.anchorNode)) {
      bar.hidden = true;
      return;
    }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    // Clamp into the viewport: centred on the selection would hang off the edge of a
    // phone screen for anything selected near a margin.
    const top = r.top - bar.offsetHeight - 8;
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - bar.offsetWidth / 2),
      Math.max(8, document.documentElement.clientWidth - bar.offsetWidth - 8),
    );
    bar.style.top = `${window.scrollY + (top >= 4 ? top : r.bottom + 8)}px`;
    bar.style.left = `${window.scrollX + left}px`;
  }
  document.addEventListener("selectionchange", positionBar);
  for (const ev of ["scroll", "resize"]) {
    window.addEventListener(
      ev,
      () => {
        if (open) placeRail(open);
        positionBar();
      },
      { passive: true },
    );
  }

  /** Keep the rail and its panel glued to the block as it grows or the page moves. */
  function placeRail(s: Session) {
    if (coarse()) {
      // Docked by CSS at the bottom of the viewport — nothing to compute, and nothing
      // that can end up off-screen on a narrow one.
      s.rail.classList.add("nb-edit-rail--dock");
      s.panel.classList.add("nb-edit-panel--dock");
      for (const el of [s.rail, s.panel]) {
        el.style.top = "";
        el.style.left = "";
        el.style.width = "";
      }
      return;
    }
    const r = s.host.getBoundingClientRect();
    const gutter = r.left;
    // The rail lives in the left gutter. On a narrow window there is no gutter to live in,
    // so it tucks against the block's own left edge rather than hanging off-screen.
    const railLeft = gutter >= RAIL_W + 12 ? r.left - RAIL_W - 8 : r.left + 2;
    s.rail.style.top = `${window.scrollY + r.top}px`;
    s.rail.style.left = `${window.scrollX + railLeft}px`;
    const rr = s.rail.getBoundingClientRect();
    // Right-align the panel with the rail so the two read as one piece of chrome,
    // and never let it slide off the left edge on a narrow window.
    s.panel.style.top = `${window.scrollY + rr.bottom + 6}px`;
    s.panel.style.left = `${window.scrollX + Math.max(8, rr.right - PANEL_W)}px`;
    s.panel.style.width = `${PANEL_W}px`;
  }

  // ── the side rail: the whole editing chrome, in the gutter ──────────────────
  // Everything that used to sit under the block lives here instead. Under the block it
  // was both easy to miss and in the way of the prose; in the gutter it is out of the
  // reading column entirely, and being a column of real buttons it is finally visible.
  function railButton(act: string, label: string, title: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `nb-edit-act nb-edit-act--${act}`;
    b.dataset.act = act;
    b.textContent = label;
    b.dataset.tip = title;
    b.setAttribute("aria-label", title);
    return b;
  }

  function renderRail(s: Session) {
    s.rail.replaceChildren();
    s.rail.append(railButton("done", "✓", m.editDone));
    if (s.rich) s.rail.append(railButton("undo", "↶", m.editUndo));
    s.rail.append(railButton("mode", s.rich ? "M" : "¶", s.rich ? m.editModeSource : m.editModeRich));
    // No comment button: the panel below already surfaces this page's open comments the
    // moment there is a change to attach them to, and the rail on the right shows them
    // while reading. A button that only ever opened what opens by itself is chrome.
    renderPanel(s);
  }

  function renderPanel(s: Session) {
    const dirty = content() !== s.original;
    const msg = s.panel.querySelector(".nb-edit-msg");
    s.panel.replaceChildren();
    if (msg) s.panel.append(msg);

    const broken = anchorsBrokenBy(s.quoted, s.original, content());
    if (broken.length) {
      const warn = document.createElement("p");
      warn.className = "nb-edit-warn";
      warn.textContent = m.editAnchorWarn.replace("{n}", String(broken.length));
      s.panel.append(warn);
    }

    // The loop appears only once there is a change to attach it to.
    if (dirty && s.comments.length) {
      const title = document.createElement("p");
      title.className = "nb-edit-panel-title";
      title.textContent = m.editCloses;
      s.panel.append(title);
      for (const c of s.comments) {
        const row = document.createElement("label");
        row.className = "nb-edit-close";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = c.id;
        cb.checked = s.closing.has(c.id);
        cb.addEventListener("change", () => {
          if (cb.checked) s.closing.add(c.id);
          else s.closing.delete(c.id);
        });
        const txt = document.createElement("span");
        const head = c.thread?.[0];
        txt.textContent = head ? short(head.body) : c.id;
        row.append(cb, txt);
        s.panel.append(row);
      }
    }
    if (dirty) {
      const note = document.createElement("input");
      note.type = "text";
      note.className = "nb-edit-note";
      note.placeholder = m.editNotePlaceholder;
      note.value = s.note;
      note.addEventListener("input", () => {
        s.note = note.value;
      });
      s.panel.append(note);
    }
    s.panel.hidden = !s.panel.childElementCount;
    placeRail(s);
  }

  function message(s: Session, text: string, kind: "error" | "warn") {
    let el = s.panel.querySelector<HTMLElement>(".nb-edit-msg");
    if (!el) {
      el = document.createElement("p");
      el.className = "nb-edit-msg";
      s.panel.prepend(el);
    }
    el.textContent = text;
    el.dataset.kind = kind;
    s.panel.hidden = false;
    placeRail(s);
  }

  /** Open, un-held comments on this page. `addressed` included: that is what /review awaits. */
  async function loadComments(): Promise<Comment[]> {
    const res = await fetch(`/api/comments?page=${encodeURIComponent(page)}`).catch(() => null);
    if (!res?.ok) return [];
    const all = (await res.json().catch(() => [])) as Comment[];
    if (!Array.isArray(all)) return [];
    return all.filter((c) => (c.status === "open" || c.status === "addressed") && !c.hold);
  }

  async function openBlock(el: HTMLElement) {
    const stamp = parseStamp(el.getAttribute("data-nb-range"), el.getAttribute("data-nb-block"));
    if (!stamp) return;
    if (open?.el === el) return;
    await commit();
    showHandle(null);

    const host = document.createElement("div");
    host.className = "nb-edit-live";
    const rail = document.createElement("div");
    rail.className = "nb-edit-rail";
    const panel = document.createElement("div");
    panel.className = "nb-edit-panel";
    panel.hidden = true;
    el.before(host);
    // Both out of flow, in the gutter: entering an edit must not move a single pixel
    // of the page, and the chrome must never sit inside the reading column.
    document.body.append(rail, panel);
    el.hidden = true;

    open = {
      el,
      host,
      rail,
      panel,
      stamp,
      original: "",
      comments: [],
      quoted: [],
      rich: null,
      area: null,
      style: {},
      nextEnd: null,
      saving: false,
      closing: new Set(),
      note: "",
    };
    const s = open;

    const url = `/api/page?page=${encodeURIComponent(page)}&start=${stamp.start}&end=${stamp.end}`;
    const [res, comments] = await Promise.all([fetch(url).catch(() => null), loadComments()]);
    const payload = res ? await res.json().catch(() => ({})) : {};
    if (open !== s) return; // superseded while loading
    if (!res?.ok || !payload.block) {
      message(s, editorMessage(res?.status ?? 0, payload, m), "error");
      window.setTimeout(() => close(true), 2500);
      return;
    }

    s.original = payload.block.text as string;
    s.comments = comments;
    s.quoted = comments
      .filter((c) => c.scope === "selection" && c.anchor?.quote)
      .map((c) => ({ id: c.id, quote: String(c.anchor?.quote) }));
    s.style = (payload.style ?? {}) as Record<string, unknown>;
    s.nextEnd = typeof payload.block.nextEnd === "number" ? payload.block.nextEnd : null;

    const draft = session.get(draftKey(page, stamp));
    const initial = draft != null && draft !== s.original ? draft : s.original;

    await mount(s, RICH_KINDS.has(stamp.kind), initial);
    renderRail(s);
  }

  /** Swap the editing surface (rich ⇄ source) while keeping the current content. */
  async function mount(s: Session, rich: boolean, markdown?: string) {
    const current = markdown ?? content();
    if (s.rich) {
      await s.rich.destroy();
      s.rich = null;
    }
    s.area?.remove();
    s.area = null;
    s.host.replaceChildren();

    const onChange = () => {
      session.set(draftKey(page, s.stamp), content());
      renderPanel(s);
    };

    if (rich) {
      try {
        s.rich = await mountWysiwyg({ host: s.host, markdown: current, style: s.style, onChange });
        s.rich.focus();
        return;
      } catch {
        // Rich editing unavailable for this block — fall through to source rather than
        // block the edit. Source mode is the same contract minus the chrome.
        message(s, m.editRichFailed, "warn");
      }
    }
    const area = document.createElement("textarea");
    area.className = "nb-edit-source";
    area.spellcheck = false;
    area.value = current;
    area.setAttribute("aria-label", m.editBlockHint);
    s.host.append(area);
    s.area = area;
    const autosize = () => {
      area.style.height = "auto";
      area.style.height = `${area.scrollHeight}px`;
    };
    area.addEventListener("input", () => {
      autosize();
      onChange();
    });
    autosize();
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }

  function close(restore: boolean) {
    disarm();
    if (!open) return;
    const { el, host, rail, panel } = open;
    open = null;
    bar.hidden = true;
    if (restore) el.hidden = false;
    host.remove();
    rail.remove();
    panel.remove();
  }

  /**
   * Leaving a block commits it — there is no Save button, the way there is none in a
   * document editor. Nothing changed ⇒ nothing is written, so moving the caret around the
   * page never touches the repo (and never triggers an HMR reload).
   */
  async function commit(): Promise<void> {
    const s = open;
    if (!s || s.saving) return;
    const markdown = content();
    const closing = [...s.closing];
    const note = s.note.trim();

    if (markdown === s.original) {
      session.drop(draftKey(page, s.stamp));
      close(true);
      return;
    }
    s.saving = true;

    const res = await fetch("/api/page", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ page, start: s.stamp.start, end: s.stamp.end, original: s.original, markdown }),
    }).catch(() => null);
    const payload = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      s.saving = false;
      message(s, editorMessage(res?.status ?? 0, payload, m), "error");
      if (payload.error === "containment" && s.nextEnd != null) offerExtend(s);
      return;
    }

    // Journal + comment closure, in the same registry an agent pass writes to. Sequenced
    // client-side: there is no transaction to be had across three files, and
    // `comments verify` already reports a half-linked resolution in both directions.
    let journalEntryId: string | null = null;
    if (note || closing.length) {
      const first = s.comments.find((c) => closing.includes(c.id))?.thread?.[0];
      const title = note || m.editJournalDefault;
      const jr = await fetch("/api/journal", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title,
          summary: note,
          changes: [{ page, commentIds: closing, what: title, why: first?.body ?? "" }],
        }),
      }).catch(() => null);
      if (jr?.ok) journalEntryId = (await jr.json().catch(() => ({}))).id ?? null;
    }
    for (const id of closing) {
      await fetch("/api/comments", {
        method: "PATCH",
        headers: authHeaders(),
        // `resolved`, not `addressed`, even under `review: "approve"` — whoever just
        // edited the page IS the validator that mode waits for.
        body: JSON.stringify({
          page,
          id,
          status: "resolved",
          resolution: { note: note || m.editJournalDefault, ...(journalEntryId ? { journalEntryId } : {}) },
        }),
      }).catch(() => null);
    }

    session.drop(draftKey(page, s.stamp));
    // Non-blocking warnings, kept on screen (HMR takes the page from here). An agent pass
    // ends with a build + `notabene lint` + the consumer's `verify[]`; a human edit ends
    // with none of that, so say what was skipped rather than let CI find it.
    const warn: string[] = [];
    if (payload.warnings?.links?.length) {
      warn.push(`${m.editLinkWarn} ${payload.warnings.links.map((l: { link: string }) => l.link).join(", ")}`);
    }
    if (payload.warnings?.verifyPending?.length) {
      warn.push(m.editVerifyPending.replace("{n}", String(payload.warnings.verifyPending.length)));
    }
    if (warn.length) {
      s.saving = false;
      message(s, warn.join(" · "), "warn");
      return;
    }
    close(true);
  }

  /**
   * A containment refusal is not a dead end: the edit is legitimate, it just needs to own
   * the block it would merge with. The server already accepts a range covering 1..n
   * contiguous blocks, so growing the range is all "multi-block editing" needed to be.
   */
  function offerExtend(s: Session) {
    if (s.panel.querySelector(".nb-edit-extend") || s.nextEnd == null) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nb-edit-extend";
    btn.textContent = m.editExtend;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const draft = content();
      const el = s.el;
      el.setAttribute("data-nb-range", `${s.stamp.start}:${s.nextEnd}`);
      close(true);
      void openBlock(el).then(() => {
        if (!open) return;
        session.set(draftKey(page, open.stamp), draft + open.original.slice(draft.length));
        void mount(open, !!open.rich, draft + open.original.slice(draft.length));
      });
    });
    s.panel.append(btn);
    s.panel.hidden = false;
    placeRail(s);
  }

  // ── gestures ────────────────────────────────────────────────────────────────
  // TOUCH: a tap ARMS a block, it does not edit it. Opening the editor on a bare tap was
  // tried and is wrong — on a phone the tap is the READING gesture (you tap while
  // scrolling, aiming at a link, or on your way to a long-press), so it dropped people
  // into an editor they had not asked for and made choosing between commenting and
  // editing a fight. Arming is the same two-step the desktop already has (hover reveals
  // the pencil, clicking the pencil opens), with the one gesture a phone can spare.
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "nb-edit-chip";
  chip.hidden = true;
  chip.textContent = `✎ ${m.editBlockHint}`;
  document.body.append(chip);
  let armed: HTMLElement | null = null;

  function disarm() {
    armed?.removeAttribute("data-nb-armed");
    armed = null;
    chip.hidden = true;
  }
  function arm(el: HTMLElement) {
    disarm();
    armed = el;
    el.setAttribute("data-nb-armed", "");
    chip.hidden = false;
  }
  chip.addEventListener("click", (e) => {
    e.preventDefault();
    const el = armed;
    disarm();
    if (el) void openBlock(el);
  });

  article.addEventListener("click", (e) => {
    if (!coarse() || open) return;
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-nb-range]");
    if ((e.target as HTMLElement | null)?.closest("a, button, summary, input, label")) return;
    // A live selection belongs to the comment flow — never arm on top of it.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      disarm();
      return;
    }
    // Nor does a tap that just opened a comment thread: on touch, tapping a highlighted
    // passage opens its thread on `pointerup`, and the `click` that follows would stack
    // an edit affordance on top of it. The comment wins that tap.
    if (document.getElementById("cmt-view")?.hidden === false) {
      disarm();
      return;
    }
    if (!el || el === armed) {
      disarm();
      return;
    }
    arm(el);
  });
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (armed && sel && !sel.isCollapsed) disarm();
  });

  // Entering an edit is the PENCIL, and only the pencil. Clicking the text itself was
  // tried and fought the reader's other gesture: you click into a paragraph on the way to
  // selecting part of it, and a stray click would drop you into editing instead of
  // letting you comment. One explicit affordance, zero ambiguity — the whole article
  // stays plain readable text that you select to comment on, exactly as before.

  // Rail actions. `mousedown` + preventDefault so a button never steals focus from the
  // editor — clicking "undo" must undo, not blur and commit.
  document.addEventListener("mousedown", (e) => {
    const act = (e.target as HTMLElement | null)?.closest<HTMLElement>(".nb-edit-act")?.dataset.act;
    if (!act || !open) return;
    e.preventDefault();
    const s = open;
    hideTip();
    if (act === "done") void commit();
    else if (act === "undo") s.rich?.run("undo");
    else if (act === "mode") void mount(s, !s.rich).then(() => renderRail(s));
  });

  document.addEventListener("pointerdown", (e) => {
    if (!open) return;
    const t = e.target as HTMLElement | null;
    if (open.host.contains(t) || open.rail.contains(t) || open.panel.contains(t) || bar.contains(t)) return;
    void commit();
  });

  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      void commit();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void commit();
    } else if (e.key.toLowerCase() === "m" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      // The escape hatch, on a shortcut rather than a button in the page.
      e.preventDefault();
      const s = open;
      void mount(s, !s.rich).then(() => renderRail(s));
    }
  });

  // Coming back from the reload a save (or the agent) triggered, and the *Fix in page*
  // link on a /review card, which arrives as ?edit=1&c=<id>.
  const params = new URLSearchParams(location.search);
  const cid = params.get("edit") === "1" ? params.get("c") : null;
  if (cid) {
    void loadComments().then((cs) => {
      const quote = cs.find((c) => c.id === cid)?.anchor?.quote;
      if (!quote) return;
      const needle = approxRendered(String(quote));
      const target = stamped().find((el) => approxRendered(el.textContent ?? "").includes(needle));
      if (!target) return;
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      void openBlock(target);
    });
  }
}
