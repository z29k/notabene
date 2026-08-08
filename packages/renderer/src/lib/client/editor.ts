// Browser side of the in-page editor.
//
// DESIGN: the document IS the interface. There is no "edit mode" to turn on and no box
// that replaces the block — the block is edited where it sits, in the article's own
// typography, and only takes on a tint so you can see which one is live.
//
// The chrome follows Notion's split of responsibilities, translated to Markdown:
//   · hovering a block reveals three gutter handles — ✎ opens the block, + adds one
//     below, ⋮⋮ opens the block menu (duplicate / copy link / comment / delete), whose
//     actions need NO editing session: they are plain range writes
//   · a floating toolbar appears ONLY at a text selection — never at a bare caret, and
//     never covering the text (that was tried: a caret-following structure bar sat on
//     the very line being edited) — and leads with Turn into, like Notion's
//   · `/` in the editor is an INSERTION palette: on a non-empty block the chosen entry
//     becomes a new block below; only an empty block is transformed in place
//   · tables get Milkdown's table widget (handles at the grid, not a bar at the caret)
//   · everything session-scoped — done / cancel / undo / Markdown toggle, the journal
//     note, the comments this edit closes, every message — lives on ONE card directly
//     under the block, in the reading column, where the eye already is
//
// Reading and editing never compete for a gesture:
//   · desktop → hover shows the handles; clicking ✎ opens the block
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
import { ICONS } from "./editor-icons";
import {
  type BlockKind,
  type EditorCommand,
  RICH_KINDS,
  type WysiwygHandle,
  mountWysiwyg,
  slashQueryOf,
} from "./wysiwyg";

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
  /** The offending path, sent alongside `untracked` so the sentence can be localized. */
  file?: string;
  /** `stale` only: the server found its own render out of date and resynchronised it, so
   *  a reload now really does fix it — say so rather than repeating generic advice. */
  resynced?: boolean;
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
          ? // The server tells us whether it was the one that was behind. When it was, it
            // has just resynchronised itself, so "reload" is now a promise it can keep.
            payload.resynced
            ? "editErrorStaleResynced"
            : "editErrorStale"
          : payload.error === "untracked"
            ? "editErrorUntracked"
            : "editErrorGeneric";
  const base = m[key] ?? m.editErrorGeneric ?? "Could not save.";
  // `untracked` names the file and the remedy in the catalog, so it stays in the reader's
  // language; the server's English `detail` is only the fallback when no path came with it.
  if (key === "editErrorUntracked") {
    if (payload.file) return base.replace("{file}", payload.file);
    return payload.detail ?? base.replace("{file}", "this file");
  }
  if (payload.detail) return `${base} ${payload.detail}`;
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

/**
 * The block a "+" session will write: the untouched original, then the new one under it.
 *
 * The editor owns ONE range, so adding a block below means rewriting that range with two
 * blocks — which the containment check has always allowed, since the neighbours are what it
 * guards. An empty new block writes nothing at all, so clicking + and changing your mind
 * leaves the file exactly as it was.
 */
export function appendedBlock(original: string, body: string): string {
  return body.trim() ? `${original}\n\n${body}` : original;
}

/**
 * What a cancel request should do. Every OTHER way out of a block commits — done, a click
 * elsewhere, ⌘↵ — so this is the single path that throws work away, and once the editor is
 * closed there is nothing left to undo. Hence the confirmation, but ONLY when there is
 * something to lose: on an untouched block cancel is just "close", and making that ask
 * twice would be noise on the common case.
 */
export function cancelAction(dirty: boolean, armed: boolean): "discard" | "arm" {
  return !dirty || armed ? "discard" : "arm";
}

export interface SlashItem {
  cmd: BlockKind | "image";
  /** i18n key for the label shown in the menu. */
  key: string;
  /** i18n key for the one-line description under the label. */
  descKey: string;
  /** Icon name in editor-icons. */
  icon: string;
  /** Menu section, à la Notion: basic blocks first, then media. */
  section: "blocks" | "media";
  /** The Markdown that types the same thing — shown as a hint, because for a docs tool
   *  whose users read the source, the syntax IS the honest shortcut. */
  shortcut?: string;
  /** Extra words that should match the typed query, beyond the label itself. */
  hint: string;
}

/**
 * The `/` palette. Its verb is INSERT — each entry creates a block below the current one
 * (Notion's gesture exactly); only when the current block is empty does it type that block
 * instead. Transforming an existing block is the toolbar's Turn into menu, not this.
 *
 * Nothing here manages the block — duplicating and deleting live on the ⋮⋮ block menu,
 * because they are things you do TO a block, not things you say while composing one.
 *
 * Every entry yields top-level blocks within the range the editor owns, so nothing here
 * can reach a neighbour and the containment invariant is untouched by the whole feature.
 */
export const SLASH_ITEMS: SlashItem[] = [
  {
    cmd: "text",
    key: "blockText",
    descKey: "blockTextDesc",
    icon: "text",
    section: "blocks",
    hint: "text paragraph p texte paragraphe",
  },
  {
    cmd: "heading1",
    key: "blockH1",
    descKey: "blockH1Desc",
    icon: "heading1",
    section: "blocks",
    shortcut: "#",
    hint: "h1 heading title titre",
  },
  {
    cmd: "heading2",
    key: "blockH2",
    descKey: "blockH2Desc",
    icon: "heading2",
    section: "blocks",
    shortcut: "##",
    hint: "h2 heading subtitle titre",
  },
  {
    cmd: "heading3",
    key: "blockH3",
    descKey: "blockH3Desc",
    icon: "heading3",
    section: "blocks",
    shortcut: "###",
    hint: "h3 heading titre",
  },
  {
    cmd: "heading4",
    key: "blockH4",
    descKey: "blockH4Desc",
    icon: "heading4",
    section: "blocks",
    shortcut: "####",
    hint: "h4 heading titre",
  },
  {
    cmd: "bulletList",
    key: "editBulletList",
    descKey: "blockBulletDesc",
    icon: "bulletList",
    section: "blocks",
    shortcut: "-",
    hint: "ul bullet list puce liste",
  },
  {
    cmd: "orderedList",
    key: "editOrderedList",
    descKey: "blockOrderedDesc",
    icon: "orderedList",
    section: "blocks",
    shortcut: "1.",
    hint: "ol number list numero liste",
  },
  {
    cmd: "todoList",
    key: "blockTodo",
    descKey: "blockTodoDesc",
    icon: "todoList",
    section: "blocks",
    shortcut: "- [ ]",
    hint: "todo task check tache case",
  },
  {
    cmd: "quote",
    key: "blockQuote",
    descKey: "blockQuoteDesc",
    icon: "quote",
    section: "blocks",
    shortcut: ">",
    hint: "quote blockquote citation",
  },
  {
    cmd: "code",
    key: "blockCode",
    descKey: "blockCodeDesc",
    icon: "codeBlock",
    section: "blocks",
    shortcut: "```",
    hint: "code fence pre snippet",
  },
  {
    cmd: "table",
    key: "blockTable",
    descKey: "blockTableDesc",
    icon: "table",
    section: "blocks",
    hint: "table grid tableau",
  },
  {
    cmd: "divider",
    key: "blockDivider",
    descKey: "blockDividerDesc",
    icon: "divider",
    section: "blocks",
    shortcut: "---",
    hint: "divider rule hr separateur ligne",
  },
  {
    cmd: "image",
    key: "blockImage",
    descKey: "blockImageDesc",
    icon: "image",
    section: "media",
    hint: "image picture photo figure",
  },
];

/** Case- and accent-insensitive match, so `/tit` finds *Titre* and `/h1` finds it too. */
export function filterSlash(items: SlashItem[], query: string, label: (key: string) => string): SlashItem[] {
  const norm = (s: string) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  const q = norm(query).trim();
  if (!q) return items;
  return items.filter((i) => norm(`${label(i.key)} ${i.hint}`).includes(q));
}

/** What the toolbar's Turn into menu offers — every block change GFM can express. */
export interface TurnIntoItem {
  kind: BlockKind;
  key: string;
  icon: string;
}

export const TURN_INTO: TurnIntoItem[] = [
  { kind: "text", key: "blockText", icon: "text" },
  { kind: "heading1", key: "blockH1", icon: "heading1" },
  { kind: "heading2", key: "blockH2", icon: "heading2" },
  { kind: "heading3", key: "blockH3", icon: "heading3" },
  { kind: "heading4", key: "blockH4", icon: "heading4" },
  { kind: "bulletList", key: "editBulletList", icon: "bulletList" },
  { kind: "orderedList", key: "editOrderedList", icon: "orderedList" },
  { kind: "todoList", key: "blockTodo", icon: "todoList" },
  { kind: "quote", key: "blockQuote", icon: "quote" },
  { kind: "code", key: "blockCode", icon: "codeBlock" },
];

/**
 * What the floating toolbar offers, or null for no toolbar at all.
 *
 * It exists ONLY at a text selection. A bare caret gets nothing: the caret-following
 * structure bar was tried and sat exactly on the text being edited — tables now carry
 * their operations on the grid itself (the table widget), and lists answer Tab/⇧Tab plus
 * the list buttons here when text is selected inside one.
 */
export function toolbarButtons(
  hasSelection: boolean,
  ctx: { inTable: boolean; inList: boolean } | null,
): string[] | null {
  if (!hasSelection) return null;
  return [
    // Turn into changes the TOP-LEVEL block; inside a table that block is the table.
    ...(ctx?.inTable ? [] : ["turnInto"]),
    "strong",
    "emphasis",
    "strike",
    "inlineCode",
    "link",
    ...(ctx?.inList ? ["outdent", "indent"] : []),
    ...(ctx?.inTable ? ["headerRow", "headerCol"] : []),
    "clearFormat",
  ];
}

/**
 * Scroll offset that brings one item fully into a scrolling list — the keyboard's half of
 * a menu that scrolls. Returns `top` unchanged when the item is already visible, so moving
 * around the middle of the list never jerks it.
 *
 * Computed rather than delegated to `scrollIntoView`: the palette is absolutely positioned
 * on the page, and `scrollIntoView` walks every scrollable ancestor — it would scroll the
 * DOCUMENT too, dragging the block and the caret the menu is anchored to out from under it.
 */
export function scrollToItem(top: number, height: number, itemTop: number, itemHeight: number): number {
  if (itemTop < top) return itemTop;
  if (itemTop + itemHeight > top + height) return itemTop + itemHeight - height;
  return top;
}

/** The parts of a DOMRect this file needs — so the choice below can be unit-tested. */
export interface RectLike {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/**
 * Where to anchor chrome for the current caret.
 *
 * A collapsed caret normally has a line box to measure, but in an EMPTY table cell there is
 * no text node at all and the range measures 0×0 — which read as "no selection" and hid the
 * toolbar in exactly the cell where you most want it: the one you just created and have
 * not typed into yet. Fall back to the element that contains the caret, which always has
 * extent, and give up only when neither does.
 */
export function anchorRect(caret: RectLike | null, container: RectLike | null): RectLike | null {
  if (caret && (caret.width || caret.height)) return caret;
  if (container && (container.width || container.height)) return container;
  return null;
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

/** Gutter geometry: ✎ nearest the block, then ⋮⋮, then + — reach order matches use order. */
const HANDLE_GAP = 30;
const HANDLE_STEP = 30;
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
  /** The one piece of session chrome: the card directly under the block. */
  card: HTMLElement;
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
   *  the card body is re-rendered on every keystroke. */
  closing: Set<string>;
  note: string;
  /** Cancel has been asked for once on a dirty block and is awaiting confirmation. */
  cancelArmed: boolean;
  /** Touch only: Done has been pressed once on a dirty block — the loop section
   *  (journal note + comment closures) is showing and the next Done writes. Auto-
   *  appearing paperwork covered the very lines being typed; a hidden-then-revealed
   *  step surfaces it exactly when it is relevant instead. */
  confirming: boolean;
  /** "+" session: the block stays RENDERED and what is edited is a new block under it. */
  appending: boolean;
}

export function mountEditor({ page, article, messages: m }: EditorOptions): void {
  let open: Session | null = null;

  // TOUCH IS A DIFFERENT PRODUCT, not a narrower one. There is no hover to reveal
  // handles with and no gutter to put them in, so the entry is a tap that ARMS the block
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
  /** Is this keystroke aimed at the open block? Falls back to the focused element, which
   *  is where a keydown really lands when the event carries no useful target. */
  const inHost = (target: EventTarget | null) =>
    !!open && (open.host.contains(target as Node) || open.host.contains(document.activeElement));

  /** A "+" draft must not collide with a draft of the block it is being added under. */
  const keyFor = (s: Session) => draftKey(page, s.stamp) + (s.appending ? ":add" : "");

  /** What the block's range will actually be rewritten with. */
  const effective = () => (open ? (open.appending ? appendedBlock(open.original, content()) : content()) : "");

  const content = () => (open ? (open.rich ? open.rich.getMarkdown() : (open.area?.value ?? "")) : "");

  const label = (key: string) => m[key] ?? key;

  const iconButton = (cls: string, icon: string, title: string, text?: string): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.innerHTML = ICONS[icon] ?? "";
    if (text) {
      const span = document.createElement("span");
      span.textContent = text;
      b.append(span);
    }
    b.dataset.tip = title;
    b.setAttribute("aria-label", title);
    return b;
  };

  // ── the gutter handles: the whole entry point ───────────────────────────────
  // They sit in the left gutter, outside the text column, and never participate in
  // layout — so nothing on the page moves because of them. Hover reveals them and
  // NOTHING else: the block itself keeps its reading surface (no tint until it is
  // actually open — a tinted hover read as a selection).
  //
  // HIDING IS DELAYED, and that is not a nicety. The handles live OUTSIDE the block they
  // belong to, so reaching for one means leaving the block — which fired `mouseleave` and
  // took them away before the pointer arrived, making them literally unclickable. A
  // short grace period, cancelled the moment the pointer lands on a handle, is the
  // standard fix for that gap.
  const handleEdit = iconButton("nb-edit-handle", "pencil", m.editBlockHint);
  const handleMenu = iconButton("nb-edit-handle nb-edit-handle--menu", "menu", m.blockMenu);
  const handleAdd = iconButton("nb-edit-handle nb-edit-handle--add", "plus", m.editAddBlock);
  for (const h of [handleEdit, handleMenu, handleAdd]) {
    h.hidden = true;
    document.body.append(h);
  }
  let handleFor: HTMLElement | null = null;
  let hideTimer = 0;

  function showHandle(el: HTMLElement | null) {
    window.clearTimeout(hideTimer);
    handleFor = el;
    if (!el || open || coarse()) {
      handleEdit.hidden = true;
      handleMenu.hidden = true;
      handleAdd.hidden = true;
      hideBlockMenu();
      return;
    }
    const r = el.getBoundingClientRect();
    const place = (h: HTMLElement, step: number) => {
      h.style.top = `${window.scrollY + r.top + 2}px`;
      h.style.left = `${window.scrollX + r.left - HANDLE_GAP - step * HANDLE_STEP}px`;
      h.hidden = false;
    };
    place(handleEdit, 0);
    place(handleMenu, 1);
    place(handleAdd, 2);
  }

  /** Give the pointer time to cross the gutter gap; landing on a handle cancels it. */
  function scheduleHide() {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!blockMenuFor) showHandle(null);
    }, 260);
  }

  article.addEventListener("mouseover", (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-nb-range]") ?? null;
    if (el) {
      if (el !== handleFor) hideBlockMenu();
      showHandle(el);
    } else scheduleHide();
  });
  article.addEventListener("mouseleave", scheduleHide);
  for (const el of [handleEdit, handleMenu, handleAdd]) {
    el.addEventListener("mouseenter", () => window.clearTimeout(hideTimer));
    el.addEventListener("mouseleave", scheduleHide);
  }
  window.addEventListener(
    "scroll",
    () => {
      showHandle(null);
      hideBlockMenu();
    },
    { passive: true },
  );
  handleEdit.addEventListener("click", () => {
    if (handleFor) void openBlock(handleFor);
  });
  handleAdd.addEventListener("click", () => {
    const el = handleFor;
    if (!el) return;
    void openBlock(el, true);
  });
  handleMenu.addEventListener("click", () => {
    if (!handleFor) return;
    if (blockMenuFor) hideBlockMenu();
    else openBlockMenu(handleFor);
  });

  // ── the ⋮⋮ block menu: block management WITHOUT a session ───────────────────
  // Duplicate and delete are one-shot range writes (read the block, write the range);
  // copy-link resolves the nearest heading anchor; comment hands the block's text to the
  // selection-comment flow that already exists. None of them needs the editor open —
  // which is exactly why they do not live in the editing chrome.
  const blockMenu = document.createElement("div");
  blockMenu.className = "nb-block-menu";
  blockMenu.hidden = true;
  blockMenu.setAttribute("role", "menu");
  document.body.append(blockMenu);
  let blockMenuFor: HTMLElement | null = null;
  let deleteArmed = false;

  function hideBlockMenu() {
    blockMenu.hidden = true;
    blockMenu.classList.remove("nb-block-menu--sheet");
    blockMenuFor = null;
    deleteArmed = false;
  }

  function menuItem(act: string, icon: string, text: string, danger = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `nb-block-menu-item${danger ? " nb-block-menu-item--danger" : ""}`;
    b.dataset.act = act;
    b.setAttribute("role", "menuitem");
    const ic = document.createElement("span");
    ic.className = "nb-block-menu-ic";
    ic.innerHTML = ICONS[icon] ?? "";
    const txt = document.createElement("span");
    txt.textContent = text;
    b.append(ic, txt);
    return b;
  }

  function renderBlockMenu() {
    blockMenu.replaceChildren();
    blockMenu.append(
      // Add-below leads: on touch there is no + handle in the gutter, so this menu is
      // where the gesture lives (on desktop it doubles the + handle, harmlessly).
      menuItem("addbelow", "plus", m.editAddBlock),
      menuItem("duplicate", "duplicate", m.blockDuplicate),
      menuItem("copylink", "link", m.blockCopyLink),
      menuItem("comment", "comment", m.blockComment),
      menuItem("delete", "trash", deleteArmed ? m.blockDeleteConfirm : m.editDeleteBlock, true),
    );
    if (deleteArmed) blockMenu.querySelector(".nb-block-menu-item--danger")?.classList.add("nb-block-menu-item--armed");
  }

  function openBlockMenu(el: HTMLElement) {
    blockMenuFor = el;
    deleteArmed = false;
    renderBlockMenu();
    blockMenu.hidden = false;
    if (coarse()) {
      // Touch has no ⋮⋮ handle to hang a popover off — the menu opens as a bottom
      // sheet, the mobile shape every platform trained (and the comment sheets set).
      blockMenu.classList.add("nb-block-menu--sheet");
      blockMenu.style.top = "";
      blockMenu.style.left = "";
      placeDocked();
      return;
    }
    const r = handleMenu.getBoundingClientRect();
    blockMenu.style.top = `${window.scrollY + r.bottom + 4}px`;
    blockMenu.style.left = `${window.scrollX + Math.max(8, r.left - 4)}px`;
  }

  /** Post-save notice (verify[] pending, doubtful links) — fixed under the topbar, long
   *  enough to read, click to dismiss. Separate from toast(): this one must be findable
   *  again on the page the save's own HMR reload just replaced. */
  const noticeKey = `nb-save-notice:${page}`;
  function showSaveNotice(text: string) {
    document.querySelector(".nb-toast--save")?.remove();
    const t = document.createElement("div");
    t.className = "nb-toast nb-toast--save";
    t.textContent = text;
    t.addEventListener("click", () => t.remove());
    document.body.append(t);
    window.setTimeout(() => t.remove(), 4000);
  }
  try {
    const stashed = session.get(noticeKey);
    if (stashed) {
      session.drop(noticeKey);
      const { at, text } = JSON.parse(stashed) as { at: number; text: string };
      // Fresh stashes only: the notice belongs to the reload its save caused, not to a
      // page someone returns to an hour later.
      if (text && Date.now() - at < 15000) showSaveNotice(text);
    }
  } catch {
    /* malformed stash — ignore */
  }

  /** Transient confirmation/refusal near where the action happened. */
  function toast(text: string, near: RectLike) {
    const t = document.createElement("div");
    t.className = "nb-toast";
    t.textContent = text;
    t.style.top = `${window.scrollY + near.top}px`;
    t.style.left = `${window.scrollX + near.left}px`;
    document.body.append(t);
    window.setTimeout(() => t.remove(), 2200);
  }

  async function fetchBlockSource(stamp: Stamp): Promise<{ text: string } | { error: string }> {
    const url = `/api/page?page=${encodeURIComponent(page)}&start=${stamp.start}&end=${stamp.end}`;
    const res = await fetch(url).catch(() => null);
    const payload = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !payload.block) return { error: editorMessage(res?.status ?? 0, payload, m) };
    return { text: payload.block.text as string };
  }

  async function writeRange(stamp: Stamp, original: string, markdown: string): Promise<string | null> {
    const res = await fetch("/api/page", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ page, start: stamp.start, end: stamp.end, original, markdown }),
    }).catch(() => null);
    if (res?.ok) return null;
    const payload = res ? await res.json().catch(() => ({})) : {};
    return editorMessage(res?.status ?? 0, payload, m);
  }

  /** Nearest anchor for "copy link to block": the block's own heading id, else the
   *  closest heading above it. Falls back to the bare page URL — still a valid link. */
  function blockLink(el: HTMLElement): string {
    let id = "";
    if (/^H[1-6]$/.test(el.tagName) && el.id) id = el.id;
    else {
      for (let prev = el.previousElementSibling; prev; prev = prev.previousElementSibling) {
        if (/^H[1-6]$/.test(prev.tagName) && prev.id) {
          id = prev.id;
          break;
        }
      }
    }
    return `${location.origin}${location.pathname}${id ? `#${id}` : ""}`;
  }

  // onPress, not a raw mousedown: on touch the menu hides mid-tap and the trailing
  // ghost click would land on the page beneath it (same hazard the dockbar had).
  onPress(blockMenu, (target) => {
    const act = target?.closest<HTMLElement>(".nb-block-menu-item")?.dataset.act;
    const el = blockMenuFor;
    if (!act || !el) return;
    const near = el.getBoundingClientRect();
    const stamp = parseStamp(el.getAttribute("data-nb-range"), el.getAttribute("data-nb-block"));
    if (act === "delete") {
      // Two-step, in place: the item itself becomes the confirmation. Deleting a block
      // from a menu cannot be taken back from here — git is the undo.
      if (!deleteArmed) {
        deleteArmed = true;
        renderBlockMenu();
        return;
      }
      hideBlockMenu();
      disarm();
      if (!stamp) return;
      void fetchBlockSource(stamp).then(async (r) => {
        const err = "error" in r ? r.error : await writeRange(stamp, r.text, "");
        if (err) toast(err, near);
      });
      return;
    }
    hideBlockMenu();
    disarm();
    if (act === "addbelow") {
      // The same append session the gutter + opens: the block stays rendered, an empty
      // surface (placeholder, palette, keyboard bar) opens beneath it.
      void openBlock(el, true);
    } else if (act === "duplicate") {
      if (!stamp) return;
      void fetchBlockSource(stamp).then(async (r) => {
        const err = "error" in r ? r.error : await writeRange(stamp, r.text, `${r.text}\n\n${r.text}`);
        if (err) toast(err, near);
      });
    } else if (act === "copylink") {
      void navigator.clipboard
        ?.writeText(blockLink(el))
        .then(() => toast(m.copiedLink, near))
        .catch(() => toast(m.editErrorGeneric, near));
    } else if (act === "comment") {
      // Hand the block to the comment flow: a programmatic selection is exactly the
      // gesture Comments.astro already answers. No new comment surface to maintain.
      //
      // TIMING IS THE WHOLE TRICK. Comments.astro deliberately ignores selectionchange
      // while a pointer is down (a drag in progress is handled on pointerup), so the
      // selection must be applied with the pointer UP — and once its debounced fallback
      // (120 ms) has shown the affordance, that affordance is pressed for the reader:
      // the menu item promised a comment, not a second button to find.
      const select = () => {
        const sel = window.getSelection();
        if (!sel) return;
        // Boundaries on TEXT nodes, exactly like a hand-made selection.
        // `selectNodeContents(el)` was tried and produced an EMPTY anchor: the comment
        // code maps Range containers through a flat map of the article's text nodes,
        // and a container that is the element itself resolves to -1 — the composer
        // opened over a quote of "".
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let first: Text | null = null;
        let last: Text | null = null;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!(n as Text).data.trim()) continue;
          first ??= n as Text;
          last = n as Text;
        }
        if (!first || !last) return;
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(last, last.data.length);
        sel.removeAllRanges();
        sel.addRange(range);
        window.setTimeout(() => {
          const btn = document.getElementById("cmt-float") as HTMLButtonElement | null;
          if (btn && !btn.hidden) btn.click();
        }, 180);
      };
      if (coarse()) {
        // On touch this handler runs on the COMPAT mousedown, which fires AFTER the
        // tap's pointerup — a {once} pointerup listener here waited for the NEXT tap,
        // and "Comment on this block" opened nothing (user report). The tap is already
        // over: select now.
        window.setTimeout(select, 50);
      } else {
        // With a mouse this runs pointer-DOWN; defer past the click's own pointerup.
        document.addEventListener("pointerup", () => window.setTimeout(select, 0), { once: true });
      }
    }
  });

  // ── tooltips ────────────────────────────────────────────────────────────────
  // Not the native `title`: it takes ~1s to appear, cannot be styled, and would sit
  // wherever the OS decides — on a 30px button in a narrow gutter that is unusable.
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
    const h = tip.offsetHeight;
    // Above, centred, viewport-clamped; below when there is no room above.
    const top = r.top - h - 8;
    tip.style.top = `${window.scrollY + (top >= 4 ? top : r.bottom + 8)}px`;
    tip.style.left = `${
      window.scrollX +
      Math.min(Math.max(4, r.left + r.width / 2 - w / 2), Math.max(4, document.documentElement.clientWidth - w - 4))
    }px`;
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

  // ── the floating toolbar: at the selection, and ONLY at a selection ─────────
  const bar = document.createElement("div");
  bar.className = "nb-edit-float";
  bar.hidden = true;
  document.body.append(bar);

  const BAR_DEF: Record<string, { icon: string; tip: string; cmd?: EditorCommand }> = {
    strong: { icon: "bold", tip: m.editBold, cmd: "strong" },
    emphasis: { icon: "italic", tip: m.editItalic, cmd: "emphasis" },
    strike: { icon: "strike", tip: m.editStrike, cmd: "strike" },
    inlineCode: { icon: "code", tip: m.editCode, cmd: "inlineCode" },
    link: { icon: "link", tip: m.editLink, cmd: "link" },
    outdent: { icon: "outdent", tip: m.editOutdent, cmd: "outdent" },
    indent: { icon: "indent", tip: m.editIndent, cmd: "indent" },
    headerRow: { icon: "headerRow", tip: m.editHeaderRow, cmd: "headerRow" },
    headerCol: { icon: "headerCol", tip: m.editHeaderCol, cmd: "headerCol" },
    clearFormat: { icon: "clear", tip: m.editClearFormat, cmd: "clearFormat" },
  };
  let barSignature = "";

  function renderBar(buttons: string[]) {
    bar.replaceChildren();
    for (const id of buttons) {
      if (id === "turnInto") {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "nb-edit-fmt nb-edit-fmt--turninto";
        b.dataset.cmd = "turnInto";
        b.dataset.tip = m.editTurnInto;
        b.setAttribute("aria-label", m.editTurnInto);
        const lbl = document.createElement("span");
        lbl.className = "nb-edit-fmt-label";
        const chev = document.createElement("span");
        chev.className = "nb-edit-fmt-chevron";
        chev.innerHTML = ICONS.chevronDown;
        b.append(lbl, chev);
        bar.append(b);
        continue;
      }
      const def = BAR_DEF[id];
      if (!def) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `nb-edit-fmt nb-edit-fmt--${id}`;
      b.dataset.cmd = id;
      b.innerHTML = ICONS[def.icon] ?? "";
      b.dataset.tip = def.tip;
      b.setAttribute("aria-label", def.tip);
      bar.append(b);
    }
  }

  /** Active states + the Turn into label follow the caret — cheap, every reposition. */
  function refreshBarState() {
    if (!open?.rich || bar.hidden) return;
    const marks = open.rich.marks();
    for (const [id, active] of Object.entries(marks)) {
      bar.querySelector(`.nb-edit-fmt--${id}`)?.classList.toggle("is-active", !!active);
    }
    const lbl = bar.querySelector<HTMLElement>(".nb-edit-fmt--turninto .nb-edit-fmt-label");
    if (lbl) {
      const kind = open.rich.blockType();
      const item = TURN_INTO.find((t) => t.kind === kind);
      lbl.textContent = item ? label(item.key) : label("blockText");
    }
  }

  // `mousedown` (not click) so the button never steals focus from the editor.
  bar.addEventListener("mousedown", (e) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>(".nb-edit-fmt");
    const cmd = btn?.dataset.cmd;
    if (!cmd || !open?.rich) return;
    e.preventDefault();
    if (cmd === "turnInto") {
      if (btn) toggleTurnMenu(btn);
      return;
    }
    hideTurnMenu();
    open.rich.run(cmd as EditorCommand);
    // A structural edit changes the block's markdown, so the loop card (and the anchor
    // warning) must be recomputed exactly as typing does.
    renderCardBody(open);
    positionBar();
  });

  // ── the Turn into menu ──────────────────────────────────────────────────────
  const turnMenu = document.createElement("div");
  turnMenu.className = "nb-block-menu nb-turn-menu";
  turnMenu.hidden = true;
  turnMenu.setAttribute("role", "menu");
  document.body.append(turnMenu);

  function hideTurnMenu() {
    turnMenu.hidden = true;
  }

  function toggleTurnMenu(anchor: HTMLElement) {
    if (!turnMenu.hidden) {
      hideTurnMenu();
      return;
    }
    if (!open?.rich) return;
    const current = open.rich.blockType();
    turnMenu.replaceChildren();
    for (const item of TURN_INTO) {
      const b = menuItem(`turn:${item.kind}`, item.icon, label(item.key));
      if (item.kind === current) {
        const check = document.createElement("span");
        check.className = "nb-block-menu-check";
        check.innerHTML = ICONS.check;
        b.append(check);
      }
      turnMenu.append(b);
    }
    turnMenu.hidden = false;
    const r = anchor.getBoundingClientRect();
    const below = r.bottom + 6;
    const fits = below + turnMenu.offsetHeight < window.innerHeight - 8;
    turnMenu.style.top = `${window.scrollY + (fits ? below : Math.max(8, r.top - turnMenu.offsetHeight - 6))}px`;
    turnMenu.style.left = `${
      window.scrollX +
      Math.min(Math.max(8, r.left), Math.max(8, document.documentElement.clientWidth - turnMenu.offsetWidth - 8))
    }px`;
  }

  turnMenu.addEventListener("mousedown", (e) => {
    const act = (e.target as HTMLElement | null)?.closest<HTMLElement>(".nb-block-menu-item")?.dataset.act;
    if (!act?.startsWith("turn:") || !open?.rich) return;
    e.preventDefault();
    hideTurnMenu();
    open.rich.turnInto(act.slice(5) as BlockKind);
    renderCardBody(open);
    positionBar();
  });

  // ── the `/` palette ─────────────────────────────────────────────────────────
  // Driven entirely by the editor: SlashProvider derives the query from the document on
  // every update and positions the menu at the caret; the keydown hook below gets first
  // look at the keyboard THROUGH ProseMirror, not through a document listener. There is
  // no recorded state to go stale — the fix for the race that used to leave "/ta" in
  // the page (plans/wysiwyg-reprise.md, diagnostic #2).
  const slashMenu = document.createElement("div");
  slashMenu.className = "nb-edit-menu";
  slashMenu.dataset.show = "false";
  slashMenu.setAttribute("role", "listbox");
  document.body.append(slashMenu);
  let slashState: { query: string; index: number } | null = null;
  /** The keydown a menu consumed this dispatch — the session handler must not also see
   *  it (Escape would otherwise close a menu AND arm the discard, in one press). */
  let menuAte: KeyboardEvent | null = null;

  const slashItems = () => filterSlash(SLASH_ITEMS, slashState?.query ?? "", label);

  function hideSlash() {
    slashState = null;
    slashMenu.dataset.show = "false";
  }

  function renderSlash() {
    if (!slashState) return;
    const items = slashItems();
    slashState.index = Math.min(slashState.index, items.length - 1);
    slashMenu.replaceChildren();
    let section: string | null = null;
    items.forEach((item, i) => {
      if (item.section !== section) {
        section = item.section;
        // Section headers only when the media section actually shows — a lone header
        // over the whole list would be noise.
        if (items.some((x) => x.section === "media") && items.some((x) => x.section === "blocks")) {
          const h = document.createElement("div");
          h.className = "nb-edit-menu-sect";
          h.textContent = section === "media" ? m.slashMedia : m.slashBlocks;
          slashMenu.append(h);
        }
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nb-edit-menu-item";
      b.dataset.index = String(i);
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", String(i === slashState?.index));
      if (i === slashState?.index) b.classList.add("is-active");
      const ic = document.createElement("span");
      ic.className = "nb-edit-menu-ic";
      ic.innerHTML = ICONS[item.icon] ?? "";
      const txt = document.createElement("span");
      txt.className = "nb-edit-menu-txt";
      const name = document.createElement("span");
      name.textContent = label(item.key);
      const desc = document.createElement("span");
      desc.className = "nb-edit-menu-desc";
      desc.textContent = label(item.descKey);
      txt.append(name, desc);
      b.append(ic, txt);
      if (item.shortcut) {
        const kbd = document.createElement("kbd");
        kbd.textContent = item.shortcut;
        b.append(kbd);
      }
      slashMenu.append(b);
    });
    const active = slashMenu.querySelector<HTMLElement>(".is-active");
    if (active)
      slashMenu.scrollTop = scrollToItem(
        slashMenu.scrollTop,
        slashMenu.clientHeight,
        active.offsetTop,
        active.offsetHeight,
      );
  }

  /** SlashProvider's shouldShow: render for this query, say whether anything matched. */
  function onSlashQuery(query: string | null): boolean {
    if (query == null) {
      hideSlash();
      return false;
    }
    const keep = slashState?.query === query;
    slashState = { query, index: keep ? (slashState?.index ?? 0) : 0 };
    if (!slashItems().length) {
      hideSlash();
      return false;
    }
    renderSlash();
    return true;
  }

  /** First look at the keyboard while the palette is up (via ProseMirror, pre-bubble). */
  function onSlashKey(e: KeyboardEvent): boolean {
    if (!slashState || slashMenu.dataset.show !== "true") return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const n = slashItems().length;
      if (n) {
        slashState.index = (slashState.index + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
        renderSlash();
      }
      return true;
    }
    if (e.key === "Enter") {
      const item = slashItems()[slashState.index];
      if (item) applySlash(item);
      return true;
    }
    if (e.key === "Escape") {
      hideSlash();
      menuAte = e;
      return true;
    }
    // Everything else — characters, Backspace — flows into the document; the provider
    // re-derives the query from what the document then contains.
    return false;
  }

  /** Palette semantics, shared by the `/` menu and the dockbar's + sheet: INSERT below —
   *  or type an empty block in place, the only case Notion transforms too. */
  function applyBlockItem(s: Session, item: SlashItem) {
    if (!s.rich) return;
    if (item.cmd === "image") {
      void pickImage(s);
    } else if (s.rich.blockEmpty()) {
      s.rich.turnInto(item.cmd);
    } else {
      s.rich.insertBelow(item.cmd);
    }
    renderCardBody(s);
    positionBar();
    refreshDockbar();
  }

  /** Apply a `/` entry: swallow the typed `/query`, then insert. */
  function applySlash(item: SlashItem) {
    const s = open;
    if (!s?.rich || !slashState) return;
    const query = slashState.query;
    hideSlash();
    s.rich.consumeSlash(query);
    applyBlockItem(s, item);
  }

  slashMenu.addEventListener("mousedown", (e) => {
    const idx = (e.target as HTMLElement | null)?.closest<HTMLElement>(".nb-edit-menu-item")?.dataset.index;
    if (idx == null) return;
    e.preventDefault();
    const item = slashItems()[Number(idx)];
    if (item) applySlash(item);
  });

  // ── images ──────────────────────────────────────────────────────────────────
  /** Upload bytes to the repo beside the page, then insert the node Markdown will carry. */
  async function uploadImage(s: Session, file: File) {
    if (!s.rich) return;
    message(s, m.editImageUploading, "warn");
    const data = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result ?? "").split(",")[1] ?? "");
      fr.readAsDataURL(file);
    });
    const res = await fetch("/api/asset", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ page, filename: file.name || "pasted.png", data }),
    }).catch(() => null);
    const payload = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      message(s, editorMessage(res?.status ?? 0, payload, m), "error");
      return;
    }
    clearMessage(s);
    s.rich.insertImage(`./${payload.name}`);
    renderCardBody(s);
  }

  function pickImage(s: Session) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void uploadImage(s, file);
    });
    input.click();
  }

  function positionBar() {
    // Touch never sees the floating toolbar: it would sit under the native selection
    // callout, and every mark it offers lives on the keyboard bar full-time.
    if (open && coarse()) {
      bar.hidden = true;
      return;
    }
    const sel = window.getSelection();
    if (!open?.rich || !sel || sel.rangeCount === 0 || !open.host.contains(sel.anchorNode)) {
      bar.hidden = true;
      hideTurnMenu();
      return;
    }
    const buttons = toolbarButtons(!sel.isCollapsed, open.rich.context());
    if (!buttons) {
      bar.hidden = true;
      hideTurnMenu();
      return;
    }
    const signature = buttons.join(",");
    if (signature !== barSignature) {
      barSignature = signature;
      renderBar(buttons);
    }
    const node = sel.anchorNode;
    const holder = (node?.nodeType === 1 ? (node as Element) : node?.parentElement) ?? null;
    const r = anchorRect(sel.getRangeAt(0).getBoundingClientRect(), holder?.getBoundingClientRect() ?? null);
    if (!r) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    refreshBarState();
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
  document.addEventListener("selectionchange", () => {
    positionBar();
    refreshDockbar();
  });
  for (const ev of ["scroll", "resize"]) {
    window.addEventListener(ev, positionBar, { passive: true });
  }

  // ── the session card: everything session-scoped, directly under the block ───
  // The far-left gutter panel was the first attempt and it failed exactly where it
  // mattered: the cancel confirmation appeared 800px away from the hand asking for it.
  // The card is IN the reading column, in flow, right under the block being edited —
  // the one place the eye already is. It is compact when the block is untouched (just
  // the actions row) and grows the loop controls once there is a change to attach them to.
  function cardButton(act: string, icon: string | null, text: string, tipText?: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `nb-edit-act nb-edit-act--${act}`;
    b.dataset.act = act;
    if (icon) b.innerHTML = ICONS[icon] ?? "";
    if (text) {
      const span = document.createElement("span");
      span.textContent = text;
      b.append(span);
    }
    if (tipText) b.dataset.tip = tipText;
    b.setAttribute("aria-label", tipText ?? text);
    return b;
  }

  function renderCardActions(s: Session) {
    let row = s.card.querySelector<HTMLElement>(".nb-edit-card-actions");
    if (!row) {
      row = document.createElement("div");
      row.className = "nb-edit-card-actions";
      s.card.prepend(row);
    }
    row.replaceChildren();
    row.append(cardButton("done", "check", m.editDoneShort, m.editDone));
    const cancel = cardButton("cancel", "close", m.editCancelShort, m.editCancel);
    if (s.cancelArmed) cancel.classList.add("nb-edit-act--armed");
    row.append(cancel);
    const spring = document.createElement("span");
    spring.className = "nb-edit-card-spring";
    row.append(spring);
    // Undo is offered in BOTH surfaces. It used to appear only in rich mode, so swapping
    // to Markdown silently took the button away — the textarea has its own history all
    // along, it just had no affordance.
    row.append(cardButton("undo", "undo", "", m.editUndo));
    row.append(
      cardButton(
        "mode",
        null,
        s.rich ? m.editSourceLabel : m.editRichLabel,
        s.rich ? m.editModeSource : m.editModeRich,
      ),
    );
  }

  /** The card body below the actions: warnings, the loop, messages. */
  function renderCardBody(s: Session) {
    const dirty = effective() !== s.original;
    renderCardActions(s);
    let body = s.card.querySelector<HTMLElement>(".nb-edit-card-body");
    const msg = body?.querySelector(".nb-edit-msg") ?? null;
    if (!body) {
      body = document.createElement("div");
      body.className = "nb-edit-card-body";
      s.card.append(body);
    }
    body.replaceChildren();
    if (msg) body.append(msg);

    const broken = anchorsBrokenBy(s.quoted, s.original, effective());
    if (broken.length) {
      const warn = document.createElement("p");
      warn.className = "nb-edit-warn";
      warn.textContent = m.editAnchorWarn.replace("{n}", String(broken.length));
      body.append(warn);
    }

    // On touch the loop section appears at the CONFIRM step (first press on Done):
    // auto-appearing above the keyboard bar it covered the very lines being typed
    // (user screenshot), and an opt-in 📓 button went undiscovered (user question).
    // Warnings and messages above still show themselves — feedback may interrupt,
    // paperwork may not.
    const showLoop = !coarse() || s.confirming;

    // The loop appears only once there is a change to attach it to.
    if (showLoop && dirty && s.comments.length) {
      const title = document.createElement("p");
      title.className = "nb-edit-card-title";
      title.textContent = m.editCloses;
      body.append(title);
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
        body.append(row);
      }
    }
    if (showLoop && dirty) {
      // The input alone read as "why would I comment here?" — its DESTINATION is the
      // context: the note becomes this save's entry in the journal, the same registry
      // an agent pass writes to, read on /journal and /review.
      const title = document.createElement("p");
      title.className = "nb-edit-card-title";
      title.textContent = m.editNoteTitle;
      const note = document.createElement("input");
      note.type = "text";
      note.className = "nb-edit-note";
      note.placeholder = m.editNotePlaceholder;
      note.value = s.note;
      note.addEventListener("input", () => {
        s.note = note.value;
      });
      // The note is the last input of a save — Enter in it means "and write it".
      note.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void commit();
        }
      });
      body.append(title, note);
    }
    body.hidden = !body.childElementCount;
    placeDocked();
  }

  function message(s: Session, text: string, kind: "error" | "warn") {
    const body = s.card.querySelector<HTMLElement>(".nb-edit-card-body");
    if (!body) return;
    let el = body.querySelector<HTMLElement>(".nb-edit-msg");
    if (!el) {
      el = document.createElement("p");
      el.className = "nb-edit-msg";
      body.prepend(el);
    }
    el.textContent = text;
    el.dataset.kind = kind;
    body.hidden = false;
    placeDocked();
  }

  function clearMessage(s: Session) {
    const body = s.card.querySelector<HTMLElement>(".nb-edit-card-body");
    body?.querySelector(".nb-edit-msg")?.remove();
    if (body) body.hidden = !body.childElementCount;
  }

  /** Open, un-held comments on this page. `addressed` included: that is what /review awaits. */
  async function loadComments(): Promise<Comment[]> {
    const res = await fetch(`/api/comments?page=${encodeURIComponent(page)}`).catch(() => null);
    if (!res?.ok) return [];
    const all = (await res.json().catch(() => [])) as Comment[];
    if (!Array.isArray(all)) return [];
    return all.filter((c) => (c.status === "open" || c.status === "addressed") && !c.hold);
  }

  /**
   * `append` is the "+" affordance: the block stays RENDERED and the editing surface is a
   * NEW, empty block placed under it. Editing the existing block in order to type below it
   * was the first attempt and read as a line break inside it, which is not what + means.
   */
  async function openBlock(el: HTMLElement, append = false) {
    const stamp = parseStamp(el.getAttribute("data-nb-range"), el.getAttribute("data-nb-block"));
    if (!stamp) return;
    // Same block, DIFFERENT mode is a real request: ✎ while a "+" is open must switch.
    if (open?.el === el && open.appending === append) return;
    await commit();
    showHandle(null);
    hideBlockMenu();

    const host = document.createElement("div");
    host.className = "nb-edit-live";
    if (coarse()) host.classList.add("nb-edit-live--touch");
    const card = document.createElement("div");
    card.className = "nb-edit-card";
    if (coarse()) card.classList.add("nb-edit-card--dock");
    if (append) el.after(host);
    else el.before(host);
    // The card sits under the block, IN FLOW — the block itself does not move, and the
    // chrome is where the eye is. (On touch it docks under the topbar instead: the same
    // strip the comment chrome already claims, the only one no platform owns.)
    host.after(card);
    // In append mode the original stays on screen — it is not what is being edited.
    el.hidden = !append;

    open = {
      el,
      host,
      card,
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
      cancelArmed: false,
      confirming: false,
      appending: append,
    };
    const s = open;
    renderCardActions(s);

    const url = `/api/page?page=${encodeURIComponent(page)}&start=${stamp.start}&end=${stamp.end}`;
    const [res, comments] = await Promise.all([fetch(url).catch(() => null), loadComments()]);
    const payload = res ? await res.json().catch(() => ({})) : {};
    if (open !== s) return; // superseded while loading
    if (!res?.ok || !payload.block) {
      const body = document.createElement("div");
      body.className = "nb-edit-card-body";
      s.card.append(body);
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

    const draft = session.get(keyFor(s));
    const base = append ? "" : s.original;
    const initial = draft != null && draft !== base ? draft : base;

    // In append mode the surface holds a NEW block, always a paragraph to begin with — the
    // kind of the block we are adding UNDER is irrelevant, and using it opened a raw
    // textarea whenever you clicked + beside a code fence.
    await mount(s, RICH_KINDS.has(append ? "paragraph" : stamp.kind), initial);
    renderCardBody(s);
    if (coarse()) {
      renderDockbar(s);
      dockbar.hidden = false;
      refreshDockbar();
      watchKeyboard();
    }
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
    // Carried as an inherited custom property so the CSS placeholder rule can be localised
    // — `content: attr(...)` can only read the pseudo-element's own element, and the empty
    // paragraph that needs the hint is created by ProseMirror, not by us.
    s.host.style.setProperty("--nb-placeholder", JSON.stringify(m.editPlaceholder ?? ""));

    const onChange = () => {
      session.set(keyFor(s), content());
      if (s.cancelArmed) disarmCancel(s);
      else if (s.confirming) disarmConfirm(s);
      else renderCardBody(s);
      keepCaretVisible();
    };

    if (rich) {
      try {
        s.rich = await mountWysiwyg({
          host: s.host,
          markdown: current,
          style: s.style,
          onChange,
          slash: { content: slashMenu, onQuery: onSlashQuery, onKey: onSlashKey },
          linkUI: {
            placeholder: m.editLinkPlaceholder,
            onCopy: () => toast(m.copiedLink, s.host.getBoundingClientRect()),
          },
        });
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
    hideSlash();
    hideTurnMenu();
    hideSheet();
    dockbar.hidden = true;
    kbCleanup?.();
    if (!open) return;
    const { el, host, card } = open;
    open = null;
    bar.hidden = true;
    barSignature = "";
    if (restore) el.hidden = false;
    host.remove();
    card.remove();
  }

  /**
   * Undo in whichever surface is mounted. The textarea's own history is what ⌘Z has always
   * driven there; `execCommand` is the only handle on it, and its `input` event carries the
   * change into the draft exactly like typing does.
   */
  function undo(s: Session) {
    if (s.rich) {
      s.rich.run("undo");
      return;
    }
    s.area?.focus();
    document.execCommand("undo");
  }

  /** Throw the draft away and put the rendered block back. Nothing is sent to the server. */
  function discard() {
    const s = open;
    if (!s || s.saving) return;
    // Dropping the stored draft is what makes this a cancel rather than a postponement:
    // openBlock() restores a draft over the file's own text, so leaving it behind would
    // hand the discarded edit straight back on the next click.
    session.drop(keyFor(s));
    close(true);
  }

  /** The ✕ and Escape both land here. Confirms first when there is unsaved work. */
  function requestCancel() {
    const s = open;
    if (!s || s.saving) return;
    // During the confirm step the question on screen is the SAVE — ✕ withdraws that
    // question and goes back to editing; only its next press asks about discarding.
    if (s.confirming) {
      disarmConfirm(s);
      return;
    }
    if (cancelAction(effective() !== s.original, s.cancelArmed) === "discard") {
      discard();
      return;
    }
    s.cancelArmed = true;
    // The card, not just the button: Escape is a keyboard gesture, and the card under
    // the block is where the eye already is — the far-left panel this replaced put the
    // question 800px from the hand asking it.
    message(s, m.editCancelConfirm, "warn");
    renderCardActions(s);
    if (!dockbar.hidden) renderDockbar(s);
  }

  /** Any further typing means the cancel was not meant — take the question back down. */
  function disarmCancel(s: Session) {
    if (!s.cancelArmed) return;
    s.cancelArmed = false;
    clearMessage(s);
    renderCardActions(s);
    renderCardBody(s);
    if (!dockbar.hidden) renderDockbar(s);
  }

  /** Typing again means the save was not final — fold the paperwork back down. */
  function disarmConfirm(s: Session) {
    if (!s.confirming) return;
    s.confirming = false;
    renderCardBody(s);
    if (!dockbar.hidden) renderDockbar(s);
  }

  /**
   * Done and ⌘↵ land here — the only gestures that WRITE. An unchanged block commits to
   * nothing (the early return below), which is why implicit exits may still call this
   * for the clean case; a modified block reaches this function only through an explicit
   * save gesture. Moving the caret around the page never touches the repo (and never
   * triggers an HMR reload).
   */
  async function commit(): Promise<void> {
    const s = open;
    if (!s || s.saving) return;
    const markdown = effective();
    const closing = [...s.closing];
    const note = s.note.trim();

    if (markdown === s.original) {
      session.drop(keyFor(s));
      close(true);
      return;
    }
    s.saving = true;

    // The journal entry and the comment closures ride IN the save request: dev's
    // content resync pushes a full reload the moment the write lands, and follow-up
    // requests from a page being torn down were silently lost (the text saved, while
    // the closure, the journal and the toast all vanished). Server-side they are
    // sequenced with the write itself.
    //
    // The toast is stashed BEFORE the request for the same reason: that reload can
    // tear this page down before the response even arrives — everything after the
    // fetch is best-effort. An error answer (no write, so no reload) takes it back.
    session.set(noticeKey, JSON.stringify({ at: Date.now(), text: m.editSaved }));
    const res = await fetch("/api/page", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        page,
        start: s.stamp.start,
        end: s.stamp.end,
        original: s.original,
        markdown,
        ...(note || closing.length
          ? { closes: closing, journal: { title: note || m.editJournalDefault, summary: note } }
          : {}),
      }),
    }).catch(() => null);
    if (!res?.ok) {
      // A real error RESPONSE means no write happened — take the stashed notice back.
      // A null res is ambiguous: network failure, OR the fetch was aborted by the
      // very teardown a successful write triggers. Defer the drop: timers die with
      // the page, so a teardown keeps the stash (correct — the write landed) while a
      // survived page drops it a beat later (correct — nothing was saved).
      if (res) session.drop(noticeKey);
      else window.setTimeout(() => session.drop(noticeKey), 50);
      const payload = res ? await res.json().catch(() => ({})) : {};
      s.saving = false;
      message(s, editorMessage(res?.status ?? 0, payload, m), "error");
      if (payload.error === "containment" && s.nextEnd != null) offerExtend(s);
      return;
    }

    session.drop(keyFor(s));
    // A save answers with ONE word: saved (refusals surfaced above, in the card).
    // Post-save warnings — verify[] pending, doubtful links — were tried here twice and
    // dropped on user feedback ("I made an edit, why is it talking about
    // verifications?"): the exhaustive checks belong to `notabene lint`, CI and the
    // agent pass, not to a toast. The server still RETURNS the warnings (API contract,
    // other clients); this UI just keeps quiet about them. The notice itself was
    // stashed before the request — the fresh page re-shows it (consume-on-mount).
    showSaveNotice(m.editSaved);
    close(true);
    // Dev's HMR normally replaces the page with the authoritative render — but a
    // phone's websocket dies when the tab sleeps, and the page then kept showing the
    // OLD block after a CONFIRMED write ("Saved, but no impact on the page" — user
    // report; the saves were all on disk). Reload ourselves after a beat: long enough
    // for the content layer to resync, and if HMR is alive it simply wins the race —
    // the stashed notice re-shows "Saved" on whichever fresh page arrives.
    window.setTimeout(() => window.location.reload(), 800);
  }

  /**
   * A containment refusal is not a dead end: the edit is legitimate, it just needs to own
   * the block it would merge with. The server already accepts a range covering 1..n
   * contiguous blocks, so growing the range is all "multi-block editing" needed to be.
   */
  function offerExtend(s: Session) {
    const body = s.card.querySelector<HTMLElement>(".nb-edit-card-body");
    if (!body || body.querySelector(".nb-edit-extend") || s.nextEnd == null) return;
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
    body.append(btn);
    body.hidden = false;
  }

  // ── touch: the keyboard toolbar (Notion's mobile shape) ─────────────────────
  // On a phone the writing tools live in ONE bar anchored to the top of the software
  // keyboard — where the thumbs already are, and the one strip the platform cannot
  // claim while the keyboard is up. The scrolling zone acts on the CONTENT (+, Turn
  // into, marks, indent, undo, Markdown toggle, journal); the session's two exits —
  // ✕ and ✓ — sit together at the right end behind a light divider.
  // On touch the session card keeps only its BODY (journal, closures, messages), docked
  // right above this bar; the floating selection toolbar never shows at all — it would
  // fight the native selection callout, and the marks are on the bar full-time anyway.
  const dockbar = document.createElement("div");
  dockbar.className = "nb-edit-dockbar";
  dockbar.hidden = true;
  document.body.append(dockbar);
  const sheet = document.createElement("div");
  sheet.className = "nb-edit-sheet";
  sheet.hidden = true;
  document.body.append(sheet);

  const DOCK_FMT: [EditorCommand, string, string][] = [
    ["strong", "bold", m.editBold],
    ["emphasis", "italic", m.editItalic],
    ["strike", "strike", m.editStrike],
    ["inlineCode", "code", m.editCode],
    ["link", "link", m.editLink],
    ["outdent", "outdent", m.editOutdent],
    ["indent", "indent", m.editIndent],
  ];

  function renderDockbar(s: Session) {
    dockbar.replaceChildren();
    const scroll = document.createElement("div");
    scroll.className = "nb-edit-dock-scroll";
    if (s.rich) {
      const plus = iconButton("nb-edit-dock-btn", "plus", m.editAddBlock);
      plus.dataset.act = "sheet-insert";
      const turn = iconButton("nb-edit-dock-btn", "text", m.editTurnInto);
      turn.dataset.act = "sheet-turn";
      scroll.append(plus, turn);
      for (const [cmd, icon, tip] of DOCK_FMT) {
        const b = iconButton("nb-edit-dock-btn", icon, tip);
        b.dataset.act = `cmd-${cmd}`;
        scroll.append(b);
      }
    }
    const undoBtn = iconButton("nb-edit-dock-btn", "undo", m.editUndo);
    undoBtn.dataset.act = "undo";
    const mode = iconButton(
      "nb-edit-dock-btn",
      s.rich ? "codeBlock" : "text",
      s.rich ? m.editModeSource : m.editModeRich,
    );
    mode.dataset.act = "mode";
    scroll.append(undoBtn, mode);
    dockbar.append(scroll);
    // The session's two exits sit TOGETHER at the right end, behind a light divider:
    // one zone acts on the content, the other ends the session — the divider is the
    // boundary between the two ideas (user request; the earlier far-left ✕ read as
    // just another formatting button).
    const actions = document.createElement("div");
    actions.className = "nb-edit-dock-actions";
    const cancel = iconButton("nb-edit-dock-btn nb-edit-dock-btn--cancel", "close", m.editCancel);
    cancel.dataset.act = "cancel";
    if (s.cancelArmed) cancel.classList.add("nb-edit-act--armed");
    const done = iconButton(
      "nb-edit-dock-btn nb-edit-dock-btn--done",
      "check",
      m.editDone,
      s.confirming ? m.editConfirm : m.editDoneShort,
    );
    done.dataset.act = "done";
    actions.append(cancel, done);
    dockbar.append(actions);
    placeDocked();
  }

  /** Active marks + the current block type, following the caret — cheap, per change. */
  function refreshDockbar() {
    if (!open || dockbar.hidden) return;
    if (!open.rich) return;
    const marks = open.rich.marks() as unknown as Record<string, boolean>;
    for (const [cmd] of DOCK_FMT) {
      const b = dockbar.querySelector(`[data-act="cmd-${cmd}"]`);
      if (b && cmd in marks) b.classList.toggle("is-active", !!marks[cmd]);
    }
    const turn = dockbar.querySelector<HTMLElement>('[data-act="sheet-turn"]');
    if (turn) {
      const kind = open.rich.blockType();
      turn.innerHTML = ICONS[TURN_INTO.find((t) => t.kind === kind)?.icon ?? "text"] ?? "";
    }
  }

  /**
   * Touch-safe press wiring. A finger on a button must act on the SESSION, not steal
   * it: preventDefault on the mouse-compat `mousedown` is not enough on touch — the
   * editor still blurred and Gboard dropped, which read as "tapping B closes the
   * editor" (user feedback). Cancelling the touch `pointerdown` keeps the focus (and
   * the keyboard) where they are and suppresses the compat mouse events entirely; the
   * action then fires on the release, like a native key. Cancelling pointerdown does
   * NOT prevent scrolling, so the bar still pans — and a pan that the browser claims
   * ends in `pointercancel`, which drops the pending press instead of firing it.
   * With a mouse, unchanged: act on mousedown, keep focus via its preventDefault.
   */
  function onPress(el: HTMLElement, fn: (target: HTMLElement | null) => void) {
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      e.preventDefault();
      const up = (ue: PointerEvent) => {
        el.removeEventListener("pointerup", up);
        // The spec STILL dispatches a click after a cancelled pointerdown — and by
        // then the pressed surface may be gone, so that click lands on the PAGE under
        // the finger. Observed: cancelling a session armed the block beneath the ✕;
        // over a link it would navigate. Swallow that one ghost click.
        const swallow = (ce: MouseEvent) => {
          ce.preventDefault();
          ce.stopPropagation();
        };
        document.addEventListener("click", swallow, { capture: true, once: true });
        window.setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 500);
        fn(ue.target as HTMLElement | null);
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", () => el.removeEventListener("pointerup", up), { once: true });
    });
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      fn(e.target as HTMLElement | null);
    });
  }

  onPress(dockbar, (target) => {
    const act = target?.closest<HTMLElement>(".nb-edit-dock-btn")?.dataset.act;
    const s = open;
    if (!act || !s) return;
    if (act === "done") {
      // First press on a modified block REVEALS the paperwork (journal note + comment
      // closures) above the bar and turns Done into Confirm; only the second press
      // writes — with the note if one was filled in. Same two-step as the ✕, for the
      // same reason: the paperwork is folded away on touch, so the save must surface
      // it before it is final (user request). A clean block still just closes.
      if (!s.confirming && effective() !== s.original) {
        s.confirming = true;
        renderCardBody(s);
        renderDockbar(s);
        s.card.querySelector<HTMLInputElement>(".nb-edit-note")?.focus();
      } else void commit();
    } else if (act === "cancel") requestCancel();
    else if (act === "undo") undo(s);
    else if (act === "mode")
      void mount(s, !s.rich).then(() => {
        renderCardBody(s);
        renderDockbar(s);
      });
    else if (act === "sheet-insert") openSheet("insert");
    else if (act === "sheet-turn") openSheet("turn");
    else if (act.startsWith("cmd-")) {
      s.rich?.run(act.slice(4) as EditorCommand);
      renderCardBody(s);
      refreshDockbar();
    }
  });

  function hideSheet() {
    sheet.hidden = true;
  }

  /** The + and Turn-into menus, as bottom sheets above the bar — Notion's mobile shape
   *  for both, and the same list content as the desktop `/` palette and Turn into menu. */
  function openSheet(kind: "insert" | "turn") {
    const s = open;
    if (!s?.rich) return;
    sheet.replaceChildren();
    const title = document.createElement("div");
    title.className = "nb-edit-sheet-title";
    title.textContent = kind === "insert" ? m.editAddBlock : m.editTurnInto;
    sheet.append(title);
    const list = document.createElement("div");
    list.className = "nb-edit-sheet-list";
    if (kind === "insert") {
      for (const item of SLASH_ITEMS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "nb-edit-menu-item";
        const ic = document.createElement("span");
        ic.className = "nb-edit-menu-ic";
        ic.innerHTML = ICONS[item.icon] ?? "";
        const txt = document.createElement("span");
        txt.className = "nb-edit-menu-txt";
        const name = document.createElement("span");
        name.textContent = label(item.key);
        const desc = document.createElement("span");
        desc.className = "nb-edit-menu-desc";
        desc.textContent = label(item.descKey);
        txt.append(name, desc);
        b.append(ic, txt);
        onPress(b, () => {
          hideSheet();
          applyBlockItem(s, item);
        });
        list.append(b);
      }
    } else {
      const current = s.rich.blockType();
      for (const item of TURN_INTO) {
        const b = menuItem(`turn:${item.kind}`, item.icon, label(item.key));
        if (item.kind === current) {
          const check = document.createElement("span");
          check.className = "nb-block-menu-check";
          check.innerHTML = ICONS.check;
          b.append(check);
        }
        onPress(b, () => {
          hideSheet();
          s.rich?.turnInto(item.kind);
          renderCardBody(s);
          refreshDockbar();
        });
        list.append(b);
      }
    }
    sheet.append(list);
    sheet.hidden = false;
    placeDocked();
  }

  /**
   * Pin the docked chrome to the bottom of the VISUAL viewport — i.e. to the top of the
   * software keyboard when it is up.
   *
   * Anchored by TOP, not by bottom: `top = vv.offsetTop + vv.height − height` puts an
   * element's bottom edge exactly at the visual-viewport bottom in fixed-position
   * coordinates, and that identity holds in EVERY Android/iOS mode. The first attempt
   * published a bottom inset computed against `window.innerHeight`, and what `bottom: 0`
   * refers to shifts with `interactive-widget` and the URL bar — on a real Android the
   * bar sat half-sunk into Gboard (user's screenshot). The visual viewport is the only
   * coordinate system that tells the truth here; use it directly.
   */
  /** Height of the docked overlay stack (bar + card), for scroll math. */
  let dockedOverlayH = 0;
  function placeDocked() {
    const vv = window.visualViewport;
    const vpBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    // Fractional heights + ceil: offsetHeight rounds down, and the sub-pixel remainder
    // showed as a 1px sliver of page between the bar and the keyboard (user screenshot).
    // Ceil errs DOWNWARD — under the keyboard, where nothing shows through.
    const place = (el: HTMLElement, above: number): number => {
      const h = el.getBoundingClientRect().height;
      el.style.top = `${Math.ceil(vpBottom - above - h)}px`;
      el.style.bottom = "auto";
      return h;
    };
    let barH = 0;
    if (!dockbar.hidden) barH = place(dockbar, 0);
    let cardH = 0;
    if (open?.card.classList.contains("nb-edit-card--dock")) {
      const visible = getComputedStyle(open.card).display !== "none";
      if (visible) cardH = place(open.card, barH + 6) + 6;
    }
    if (!sheet.hidden) place(sheet, barH);
    if (!blockMenu.hidden && blockMenu.classList.contains("nb-block-menu--sheet")) place(blockMenu, 0);
    dockedOverlayH = barH + cardH;
    // Let the BROWSER's own caret-reveal account for the overlay: scroll-padding is the
    // documented lever for fixed chrome, and it costs nothing when the bar is away.
    document.documentElement.style.scrollPaddingBottom = dockbar.hidden ? "" : `${Math.ceil(dockedOverlayH) + 12}px`;
  }

  /**
   * Nudge the page so the caret stays ABOVE the docked chrome while typing. The browser
   * reveals the caret within the visual viewport, but knows nothing of the bar and card
   * floating over its bottom — each new line sank behind them and "the scroll does not
   * follow" (user report). scroll-padding covers most engines; this is the belt.
   */
  function keepCaretVisible() {
    const vv = window.visualViewport;
    if (!vv || dockbar.hidden) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !open?.host.contains(sel.anchorNode)) return;
    const holder = sel.anchorNode instanceof Element ? sel.anchorNode : (sel.anchorNode?.parentElement ?? null);
    const r = anchorRect(sel.getRangeAt(0).getBoundingClientRect(), holder?.getBoundingClientRect() ?? null);
    if (!r) return;
    const limit = vv.offsetTop + vv.height - dockedOverlayH - 12;
    if (r.bottom > limit) window.scrollBy(0, r.bottom - limit);
  }

  let kbCleanup: (() => void) | null = null;
  function watchKeyboard() {
    const vv = window.visualViewport;
    if (!vv || kbCleanup) return;
    vv.addEventListener("resize", placeDocked);
    vv.addEventListener("scroll", placeDocked);
    placeDocked();
    kbCleanup = () => {
      vv.removeEventListener("resize", placeDocked);
      vv.removeEventListener("scroll", placeDocked);
      document.documentElement.style.scrollPaddingBottom = "";
      kbCleanup = null;
    };
  }

  // ── gestures ────────────────────────────────────────────────────────────────
  // TOUCH: a tap ARMS a block, it does not edit it. Opening the editor on a bare tap was
  // tried and is wrong — on a phone the tap is the READING gesture (you tap while
  // scrolling, aiming at a link, or on your way to a long-press), so it dropped people
  // into an editor they had not asked for and made choosing between commenting and
  // editing a fight. Arming is the same two-step the desktop already has (hover reveals
  // the pencil, clicking the pencil opens), with the one gesture a phone can spare.
  // The armed chip carries TWO buttons — Edit, and ⋮ for the block menu: touch has no
  // hover to reveal the ⋮⋮ handle with, and this is where that menu lives instead.
  const chipbar = document.createElement("div");
  chipbar.className = "nb-edit-chipbar";
  chipbar.hidden = true;
  const chipEdit = iconButton("nb-edit-chip", "pencil", m.editBlockHint, m.editBlockHint);
  const chipMenu = iconButton("nb-edit-chip nb-edit-chip--menu", "menu", m.blockMenu);
  chipbar.append(chipEdit, chipMenu);
  document.body.append(chipbar);
  let armed: HTMLElement | null = null;

  function disarm() {
    armed?.removeAttribute("data-nb-armed");
    armed = null;
    chipbar.hidden = true;
  }
  function arm(el: HTMLElement) {
    disarm();
    armed = el;
    el.setAttribute("data-nb-armed", "");
    chipbar.hidden = false;
  }
  chipEdit.addEventListener("click", (e) => {
    e.preventDefault();
    const el = armed;
    disarm();
    if (el) void openBlock(el);
  });
  chipMenu.addEventListener("click", (e) => {
    e.preventDefault();
    if (!armed) return;
    if (blockMenuFor) hideBlockMenu();
    else openBlockMenu(armed);
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

  // Card actions. `mousedown` + preventDefault so a button never steals focus from the
  // editor — clicking "undo" must undo, not blur and commit.
  document.addEventListener("mousedown", (e) => {
    const act = (e.target as HTMLElement | null)?.closest<HTMLElement>(".nb-edit-act")?.dataset.act;
    if (!act || !open) return;
    e.preventDefault();
    const s = open;
    hideTip();
    if (act === "done") void commit();
    else if (act === "cancel") requestCancel();
    else if (act === "undo") undo(s);
    else if (act === "mode") void mount(s, !s.rich).then(() => renderCardBody(s));
  });

  // Pasting a screenshot writes it into the repo beside the page and links it — the whole
  // point being that the image lands in the SAME commit as the prose referencing it.
  document.addEventListener("paste", (e) => {
    const s = open;
    if (!s?.rich || !s.host.contains(e.target as Node)) return;
    const file = [...(e.clipboardData?.items ?? [])]
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .find(Boolean);
    if (!file) return;
    e.preventDefault();
    void uploadImage(s, file);
  });

  document.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement | null;
    if (blockMenuFor && !blockMenu.contains(t) && t !== handleMenu && !handleMenu.contains(t) && !chipMenu.contains(t))
      hideBlockMenu();
    if (!open) return;
    if (slashMenu.contains(t) || turnMenu.contains(t) || sheet.contains(t)) return;
    hideSlash();
    hideTurnMenu();
    // A tap outside an open sheet CLOSES the sheet — that tap has said all it means.
    if (!sheet.hidden) {
      hideSheet();
      return;
    }
    if (open.host.contains(t) || open.card.contains(t) || bar.contains(t) || dockbar.contains(t)) return;
    // Milkdown chrome (the link tooltip's input, the table widget's handles) can render
    // outside the host element; anything of Milkdown's is part of the session.
    if (t?.closest?.('[class*="milkdown"]')) return;
    // An implicit exit never WRITES. A clean block just closes; a modified one stays
    // open and asks — Done (or ⌘↵) is the only gesture that touches the repo.
    // Click-away used to commit, document-editor style, and read as "my draft was
    // validated without me pressing anything" (user feedback) — a stray click must be
    // able neither to write an edit nor to lose one.
    const settle = () => {
      if (!open) return;
      if (effective() !== open.original) {
        if (open.cancelArmed) disarmCancel(open);
        message(open, m.editUnsavedAsk, "warn");
        return;
      }
      void commit();
    };
    if ((e as PointerEvent).pointerType === "touch") {
      // On touch the session is quasi-modal — the keyboard bar IS the way out, its
      // ✕ and ✓ always under the thumb. A tap elsewhere neither closes nor asks
      // (first pass ended the session on scroll-start; second pass on any stray tap —
      // both wrong on a phone, per user feedback). At most the tap blurs the editor
      // and drops the keyboard; the block stays open, tap it to resume.
      return;
    }
    settle();
  });

  document.addEventListener("keydown", (e) => {
    // A menu consumed this exact event inside the editor (ProseMirror sees keys first).
    // Escape especially: closing a menu and discarding an edit must never be one press.
    if (e === menuAte) {
      menuAte = null;
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      if (!turnMenu.hidden) {
        hideTurnMenu();
        return;
      }
      // Escape ABANDONS. It used to commit, which made it the only Escape on the site that
      // wrote to the repo — and once a ✕ exists, the two gestures that read as "get me out"
      // must not do opposite things.
      e.stopPropagation();
      requestCancel();
    } else if (e.key === "Tab" && open.rich && inHost(e.target)) {
      // ProseMirror binds Tab inside tables and lists and marks the event handled. When it
      // DECLINES — the last cell of a table — the browser's own Tab moved focus out of the
      // block and silently ended the edit, which is the worst possible answer to the gesture
      // that means "next cell". Add the row it was asking for; otherwise just stay put.
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (!e.shiftKey && open.rich.context().inTable) {
        open.rich.run("addRowAfter");
        renderCardBody(open);
      }
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void commit();
    } else if (e.key.toLowerCase() === "m" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      // The escape hatch, on a shortcut rather than a button in the page.
      e.preventDefault();
      const s = open;
      void mount(s, !s.rich).then(() => renderCardBody(s));
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

// Re-exported for the unit tests: the query derivation lives beside the provider wiring
// in wysiwyg.ts, but its behaviour is part of this file's palette contract.
export { slashQueryOf };
