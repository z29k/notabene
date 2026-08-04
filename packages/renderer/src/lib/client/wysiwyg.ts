// Milkdown mount for ONE block (plan §5, phase 3; interaction layer redone per
// plans/wysiwyg-reprise.md).
//
// Milkdown is document-centric; here it is handed a single top-level block's Markdown and
// asked for it back. The page around the block is the real document, and it stays rendered.
//
// Why Milkdown rather than any other rich editor: it parses and serializes with **remark**,
// the same mdast world as the Astro pipeline and src/remark/rewrite-links.mjs. That is what
// lets the file's own conventions (lib/md-style.ts) drive serialization, so an edited block
// comes back looking like the rest of the file instead of like a formatter's opinion.
//
// The interaction surfaces are Milkdown's own building blocks, not hand-rolled chrome —
// that distinction is the whole lesson of the first attempt (see the plan's diagnosis):
//   · links     → component/link-tooltip (URL input + preview; the bare toggleLinkCommand
//                 of the commonmark preset THROWS without an href payload)
//   · tables    → component/table-block (row/column handles, edge + buttons, drag)
//   · the `/`   → plugin/slash's SlashProvider: the query is DERIVED from the document on
//                 every update — recording the slash position in a setTimeout was a race
//                 that left "/ta" in the page for anyone typing faster than one tick
//   · keyboard  → a ProseMirror `handleKeyDown` prop, never a `document` keydown: the
//                 editor sees the key first, so a menu can consume Escape before the
//                 session-level handler reads it as "discard the block".
//
// Loaded with a dynamic import, exactly like mermaid (lib/client/mermaid.ts): a hard
// dependency that costs nothing until someone actually opens a block in rich mode.
// Vue is in that closure too — @milkdown/components renders its widgets with it. That is
// Milkdown's implementation detail, same status as mermaid's internals: dev-only, lazy,
// never in a build.

import { applyTableStyle, type TableStyle } from "../md-style";
import { ICONS } from "./editor-icons";
// Milkdown-specific selectors live in an editor-only sheet — and it is imported ?inline,
// NOT as a side-effect: a plain CSS import enters Astro's build CSS graph and gets
// INLINED into every page's HTML (the exact trap the editor CSS already dodged once),
// even though this module itself never ships. As a string it lives inside this dev-only
// chunk, and mountWysiwyg injects it once.
import themeCss from "./wysiwyg-theme.css?inline";

export interface WysiwygHandle {
  /** Current content, serialized with the file's conventions. */
  getMarkdown(): string;
  focus(): void;
  destroy(): Promise<void>;
  /** Run a Milkdown command by key — drives the toolbars. `false` = the command declined. */
  run(command: EditorCommand): boolean;
  /** What the caret is inside, for context-sensitive chrome. */
  context(): EditorContext;
  /** Which inline marks the selection (or caret) carries — the toolbar's active states. */
  marks(): MarkState;
  /** What the top-level block at the caret IS — the checkmark in the turn-into menu. */
  blockType(): BlockKind | null;
  /** `true` when the caret sits in an empty paragraph — the slash palette then transforms
   *  in place instead of inserting below (Notion's exact rule). */
  blockEmpty(): boolean;
  /** Delete the `/query` the palette consumed. The span is recomputed from the CURRENT
   *  selection, never from a position recorded at open time. */
  consumeSlash(query: string): void;
  /** Insert a fresh block of `kind` under the top-level block at the caret. */
  insertBelow(kind: BlockKind): boolean;
  /** Turn the block at the caret into `kind` — the turn-into menu's verb. */
  turnInto(kind: BlockKind): boolean;
  /** Insert an image (the file is already written to the repo). A non-empty block gets it
   *  as its own block below, so prose never wraps around a pasted screenshot by accident. */
  insertImage(src: string, alt?: string): void;
}

export type EditorCommand =
  | "strong"
  | "emphasis"
  | "inlineCode"
  | "link"
  | "strike"
  | "clearFormat"
  | "undo"
  | "redo"
  // Structural. A table row or a list item is INSIDE one top-level block, so every one of
  // these stays within the range the editor owns and the containment invariant still holds.
  // Row/column plumbing is mostly the table WIDGET's job now; addRowAfter stays reachable
  // for the Tab-in-last-cell affordance, headerRow/headerCol for the selection toolbar.
  | "addRowAfter"
  | "headerRow"
  | "headerCol"
  | "bulletList"
  | "orderedList"
  | "indent"
  | "outdent";

/** Block kinds the palette and the turn-into menu speak in. */
export type BlockKind =
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "bulletList"
  | "orderedList"
  | "todoList"
  | "quote"
  | "code"
  | "table"
  | "divider"
  | "other";

/** Where the caret is, so the chrome can offer the operations that apply to it. */
export interface EditorContext {
  inTable: boolean;
  inList: boolean;
}

export interface MarkState {
  strong: boolean;
  emphasis: boolean;
  inlineCode: boolean;
  strike: boolean;
  link: boolean;
}

/** Block kinds worth a rich editor. Code fences stay in source mode — see mountWysiwyg. */
export const RICH_KINDS = new Set(["paragraph", "heading", "list", "blockquote", "table"]);

/** Hooks the session chrome hands over so the slash palette is driven by the editor. */
export interface SlashHooks {
  /** The palette element. SlashProvider positions it and flips `data-show` on it. */
  content: HTMLElement;
  /** Called on every relevant document/selection change with the derived query
   *  (`null` = no slash context). Renders the menu; returns whether anything matched. */
  onQuery: (query: string | null) => boolean;
  /** First look at every keydown while the editor has focus. `true` = the menu ate it. */
  onKey: (event: KeyboardEvent) => boolean;
}

export interface WysiwygOptions {
  host: HTMLElement;
  markdown: string;
  /** remark-stringify options inferred from the file (lib/md-style.ts). */
  style: Record<string, unknown>;
  onChange?: () => void;
  slash?: SlashHooks;
  /** The two strings Milkdown's link tooltip needs, localized by the caller. */
  linkUI?: { placeholder: string; onCopy?: () => void };
}

/** The last `/query` before the caret, or null. The slash must open a word — start of the
 *  block or right after whitespace — so `and/or` in prose never summons a menu. */
export function slashQueryOf(textBeforeCaret: string): string | null {
  const m = /(?:^|\s)\/([^/\s]{0,24})$/.exec(textBeforeCaret);
  return m ? m[1] : null;
}

export async function mountWysiwyg({
  host,
  markdown,
  style,
  onChange,
  slash,
  linkUI,
}: WysiwygOptions): Promise<WysiwygHandle> {
  if (!document.getElementById("nb-wysiwyg-theme")) {
    const style = document.createElement("style");
    style.id = "nb-wysiwyg-theme";
    style.textContent = themeCss;
    document.head.append(style);
  }
  const [
    core,
    utils,
    commonmarkPreset,
    gfmPreset,
    history,
    listener,
    proseState,
    linkTooltip,
    tableBlockMod,
    slashMod,
  ] = await Promise.all([
    import("@milkdown/kit/core"),
    import("@milkdown/kit/utils"),
    import("@milkdown/kit/preset/commonmark"),
    import("@milkdown/kit/preset/gfm"),
    import("@milkdown/kit/plugin/history"),
    import("@milkdown/kit/plugin/listener"),
    import("@milkdown/kit/prose/state"),
    import("@milkdown/kit/component/link-tooltip"),
    import("@milkdown/kit/component/table-block"),
    import("@milkdown/kit/plugin/slash"),
  ]);

  const { TextSelection } = proseState;
  const { Editor, rootCtx, defaultValueCtx, remarkStringifyOptionsCtx, editorViewOptionsCtx, commandsCtx } = core;

  // `nbTable` is ours, not remark-stringify's: it drives remark-gfm below and the delimiter
  // touch-up in getMarkdown. Kept out of the options remark actually sees.
  const { nbTable = null, ...stringifyOptions } = style as { nbTable?: TableStyle | null };
  let ready = false;

  const slashPlugin = slash ? slashMod.slashFactory("NB") : null;

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, host);
      ctx.set(defaultValueCtx, markdown);
      // The point of the whole exercise: serialize like the rest of THIS file.
      ctx.set(remarkStringifyOptionsCtx, stringifyOptions);
      // Table pipes are remark-GFM's business, not remark-stringify's. Without this, every
      // table came back padded out to its widest cell — a whole-block diff for a one-word
      // edit, on 15 of the 16 tables in docs/.
      if (nbTable) ctx.set(gfmPreset.remarkGFMPlugin.options.key, { tablePipeAlign: nbTable.pipeAlign });
      ctx.set(editorViewOptionsCtx, { attributes: { class: "nb-wysiwyg-area", spellcheck: "false" } });
      // Gated on `ready`: the spread normalisation below dispatches a transaction, and the
      // caller has not assigned this handle yet — an onChange there would read an empty
      // document and store that as the draft.
      if (onChange) ctx.get(listener.listenerCtx).markdownUpdated(() => ready && onChange());

      // Link tooltip: preview on hover/caret, URL input on add/edit. Its icons are ours so
      // the popover reads as notabene chrome, not as a foreign widget.
      linkTooltip.configureLinkTooltip(ctx);
      ctx.set(linkTooltip.linkTooltipConfig.key, {
        linkIcon: ICONS.link,
        editButton: ICONS.pencil,
        confirmButton: ICONS.check,
        removeButton: ICONS.trash,
        inputPlaceholder: linkUI?.placeholder ?? "https://…",
        onCopyLink: () => linkUI?.onCopy?.(),
      });

      // Table widget: the component positions its own handles and buttons; only the icon
      // set comes from here (and the styling from wysiwyg-theme.css).
      ctx.set(tableBlockMod.tableBlockConfig.key, {
        renderButton: (kind: string) =>
          (
            ({
              add_row: ICONS.plus,
              add_col: ICONS.plus,
              delete_row: ICONS.trash,
              delete_col: ICONS.trash,
              align_col_left: ICONS.alignLeft,
              align_col_center: ICONS.alignCenter,
              align_col_right: ICONS.alignRight,
              col_drag_handle: ICONS.gripRow,
              row_drag_handle: ICONS.menu,
            }) as Record<string, string>
          )[kind] ?? "",
      });

      if (slash && slashPlugin) {
        ctx.set(slashPlugin.key, {
          view: () => {
            const provider: InstanceType<typeof slashMod.SlashProvider> = new slashMod.SlashProvider({
              content: slash.content,
              debounce: 24,
              root: document.body,
              offset: 6,
              // The whole state machine, derived: text before the caret either matches
              // `/query` (render, maybe show) or it does not (hide). Nothing is recorded,
              // so nothing can go stale — the fix for the "/ta left in the page" race.
              shouldShow: (view) => {
                const text = provider.getContent(view, (node) => node.isTextblock && !node.type.spec.code);
                if (text == null) return false;
                return slash.onQuery(slashQueryOf(text));
              },
            });
            provider.onHide = () => slash.onQuery(null);
            return {
              update: (view, prevState) => provider.update(view, prevState),
              destroy: () => provider.destroy(),
            };
          },
          props: {
            // The palette reads every key FIRST — this is what lets Escape close a menu
            // without also being the Escape that discards the block.
            handleKeyDown: (_view, event) => slash.onKey(event),
          },
        });
      }
    })
    .use(commonmarkPreset.commonmark)
    .use(gfmPreset.gfm)
    .use(history.history)
    .use(listener.listener)
    .use(linkTooltip.linkTooltipPlugin)
    .use(tableBlockMod.tableBlock)
    .use(slashPlugin ?? [])
    .create();

  const commands = {
    strong: commonmarkPreset.toggleStrongCommand,
    emphasis: commonmarkPreset.toggleEmphasisCommand,
    inlineCode: commonmarkPreset.toggleInlineCodeCommand,
    // The component's toggle, NOT the preset's: no link → opens the URL input at the
    // selection; existing link → removes it. The preset's command throws without a payload.
    link: linkTooltip.toggleLinkCommand,
    strike: gfmPreset.toggleStrikethroughCommand,
    undo: history.undoCommand,
    redo: history.redoCommand,
    addRowAfter: gfmPreset.addRowAfterCommand,
    bulletList: commonmarkPreset.wrapInBulletListCommand,
    orderedList: commonmarkPreset.wrapInOrderedListCommand,
    indent: commonmarkPreset.sinkListItemCommand,
    outdent: commonmarkPreset.liftListItemCommand,
  };
  /** Headings are one command with a level, not four commands. */
  const HEADING_LEVEL: Partial<Record<BlockKind, number>> = { heading1: 1, heading2: 2, heading3: 3, heading4: 4 };

  /**
   * Repair Milkdown's `spread` flag, which decides tight vs loose lists.
   *
   * Its list schemas declare `spread` as a boolean but PARSE it as a string —
   * `` `${node.spread}` `` — and hand that straight back to mdast on the way out. `"false"`
   * is a truthy string, so mdast saw every list as loose: opening a tight list and simply
   * leaving rewrote it with a blank line between every item. Observed on three different
   * pages before it was tracked down.
   *
   * Coerced once, over the whole document, OUTSIDE the undo history — this is not an edit
   * the reader made and ⌘Z must not walk back into a broken state.
   */
  const normalizeSpread = () => {
    try {
      editor.action((ctx) => {
        const view = ctx.get(core.editorViewCtx);
        const { tr } = view.state;
        let touched = false;
        view.state.doc.descendants((node, pos) => {
          const spread = (node.attrs as { spread?: unknown } | null)?.spread;
          if (typeof spread !== "string") return;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, spread: spread === "true" });
          touched = true;
        });
        if (touched) view.dispatch(tr.setMeta("addToHistory", false));
      });
    } catch {
      /* no view yet, or a schema without the attribute — the round trip is unaffected */
    }
  };
  normalizeSpread();
  ready = true;

  const focus = () => host.querySelector<HTMLElement>(".nb-wysiwyg-area")?.focus();

  /** Node type names on the path from the doc root down to the caret. */
  const ancestry = (): string[] => {
    try {
      return editor.action((ctx) => {
        const { state } = ctx.get(core.editorViewCtx);
        const $from = state.selection.$from;
        const names: string[] = [];
        for (let d = $from.depth; d > 0; d--) names.push($from.node(d).type.name);
        return names;
      });
    } catch {
      return [];
    }
  };

  /**
   * Which row and column the caret sits in, `-1` outside a table. Milkdown's select
   * commands need the index nobody hands us — used by the header-row/column toggles.
   */
  const cellIndex = (): { row: number; col: number } => {
    try {
      return editor.action((ctx) => {
        const { state } = ctx.get(core.editorViewCtx);
        const $from = state.selection.$from;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name.endsWith("_row")) return { row: $from.index(d - 1), col: $from.index(d) };
        }
        return { row: -1, col: -1 };
      });
    } catch {
      return { row: -1, col: -1 };
    }
  };

  /**
   * Toggle bold across the cells of the current CELL selection, deciding per cell.
   *
   * `toggleStrongCommand` cannot do this: ProseMirror asks `rangeHasMark` over the whole
   * selection, and a cell selection's span includes the cell boundaries between them — the
   * answer is always "not marked", so a second press bolded again instead of clearing.
   * A cell selection exposes one range PER CELL, which is the granularity the question
   * actually has an answer at.
   */
  const toggleStrongPerCell = (): boolean => {
    return editor.action((ctx) => {
      const view = ctx.get(core.editorViewCtx);
      const { state } = view;
      const strong = state.schema.marks.strong;
      if (!strong) return false;
      // An empty cell can carry no mark, so it must not veto "this row is already bold";
      // and the `th` row is already a header, so bolding it would only add noise to the
      // source — selectCol spans the whole column, header cell included.
      const inHeaderCell = (r: { $from: { depth: number; node: (d: number) => { type: { name: string } } } }) => {
        for (let d = r.$from.depth; d > 0; d--) if (r.$from.node(d).type.name.includes("header")) return true;
        return false;
      };
      const ranges = state.selection.ranges.filter((r) => r.$to.pos > r.$from.pos && !inHeaderCell(r));
      if (!ranges.length) return false;
      const marked = ranges.every((r) => state.doc.rangeHasMark(r.$from.pos, r.$to.pos, strong));
      const tr = state.tr;
      for (const r of ranges) {
        if (marked) tr.removeMark(r.$from.pos, r.$to.pos, strong);
        else tr.addMark(r.$from.pos, r.$to.pos, strong.create());
      }
      // Collapse back to a caret in the first cell. Leaving the CELL selection in place
      // left the column visibly selected AND broke the second press: cellIndex() reads the
      // row/column off `$from`, which sits on a cell BOUNDARY in a cell selection, so the
      // toggle could never find the column it had just bolded.
      const at = Math.min(ranges[0].$from.pos + 1, tr.doc.content.size);
      tr.setSelection(TextSelection.near(tr.doc.resolve(at)));
      view.dispatch(tr);
      return true;
    });
  };

  const call = (cmd: { key: unknown } | undefined, payload?: unknown): boolean => {
    if (!cmd?.key) return false;
    return editor.action((ctx) => ctx.get(commandsCtx).call(cmd.key as never, payload) !== false);
  };

  /** First schema mark type matching one of the candidate names. */
  const markType = (candidates: string[]) =>
    editor.action((ctx) => {
      const { state } = ctx.get(core.editorViewCtx);
      for (const name of candidates) {
        const t = state.schema.marks[name];
        if (t) return t;
      }
      return null;
    });

  const NODE_CANDIDATES: Record<string, string[]> = {
    paragraph: ["paragraph"],
    heading: ["heading"],
    blockquote: ["blockquote"],
    code: ["code_block", "codeBlock"],
    bullet: ["bullet_list", "bulletList"],
    ordered: ["ordered_list", "orderedList"],
    item: ["list_item", "listItem"],
    hr: ["hr", "horizontal_rule"],
    image: ["image"],
  };

  /** Kind of a top-level node, in the palette's vocabulary. */
  const kindOf = (node: {
    type: { name: string };
    attrs: Record<string, unknown>;
    firstChild?: unknown;
  }): BlockKind => {
    const name = node.type.name;
    if (name === "paragraph") return "text";
    if (name === "heading") {
      const level = Math.min(4, Math.max(1, Number(node.attrs.level) || 1));
      return `heading${level}` as BlockKind;
    }
    if (name === "blockquote") return "quote";
    if (NODE_CANDIDATES.code.includes(name)) return "code";
    if (NODE_CANDIDATES.hr.includes(name)) return "divider";
    if (name === "table") return "table";
    if (NODE_CANDIDATES.ordered.includes(name)) return "orderedList";
    if (NODE_CANDIDATES.bullet.includes(name)) {
      const first = (node as { firstChild?: { attrs?: { checked?: unknown } } }).firstChild;
      return first?.attrs?.checked != null ? "todoList" : "bulletList";
    }
    return "other";
  };

  /**
   * Switch the list surrounding the caret between bullet / ordered / to-do in place.
   * ProseMirror's wrap commands decline when the caret is already in a list, so the
   * turn-into menu needs a real type switch: same items, different container (and the
   * `checked` attr set or cleared — that attr IS what makes a GFM task list).
   */
  const setListType = (kind: "bulletList" | "orderedList" | "todoList"): boolean => {
    return editor.action((ctx) => {
      const view = ctx.get(core.editorViewCtx);
      const { state } = view;
      const $from = state.selection.$from;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        const name = node.type.name;
        if (!NODE_CANDIDATES.bullet.includes(name) && !NODE_CANDIDATES.ordered.includes(name)) continue;
        const targetName = kind === "orderedList" ? NODE_CANDIDATES.ordered : NODE_CANDIDATES.bullet;
        const target = targetName.map((n) => state.schema.nodes[n]).find(Boolean);
        if (!target) return false;
        const pos = $from.before(d);
        let tr = state.tr.setNodeMarkup(pos, target, node.attrs);
        const checked = kind === "todoList" ? false : null;
        let offset = pos + 1;
        node.forEach((child) => {
          if (
            NODE_CANDIDATES.item.includes(child.type.name) &&
            (child.attrs as { checked?: unknown }).checked !== checked
          ) {
            tr = tr.setNodeMarkup(offset, undefined, { ...child.attrs, checked });
          }
          offset += child.nodeSize;
        });
        view.dispatch(tr);
        return true;
      }
      return false;
    });
  };

  const turnInto = (kind: BlockKind): boolean => {
    let applied = false;
    if (kind === "text") applied = call(commonmarkPreset.turnIntoTextCommand);
    else if (HEADING_LEVEL[kind]) applied = call(commonmarkPreset.wrapInHeadingCommand, HEADING_LEVEL[kind]);
    else if (kind === "quote") applied = call(commonmarkPreset.wrapInBlockquoteCommand);
    else if (kind === "code") applied = call(commonmarkPreset.createCodeBlockCommand);
    else if (kind === "divider") applied = call(commonmarkPreset.insertHrCommand);
    else if (kind === "table") applied = call(gfmPreset.insertTableCommand);
    else if (kind === "bulletList" || kind === "orderedList" || kind === "todoList") {
      applied = setListType(kind);
      if (!applied) {
        applied = call(
          kind === "orderedList" ? commonmarkPreset.wrapInOrderedListCommand : commonmarkPreset.wrapInBulletListCommand,
        );
        if (applied && kind === "todoList") setListType("todoList");
      }
    }
    focus();
    return applied;
  };

  const insertBelow = (kind: BlockKind): boolean => {
    const ok = editor.action((ctx) => {
      const view = ctx.get(core.editorViewCtx);
      const { state } = view;
      const $from = state.selection.$from;
      if ($from.depth < 1) return false;
      const after = $from.after(1);
      const nodes = state.schema.nodes;
      const type = (candidates: string[]) => candidates.map((n) => nodes[n]).find(Boolean);
      const paragraph = type(NODE_CANDIDATES.paragraph);
      if (!paragraph) return false;

      const listOf = (listKind: "bulletList" | "orderedList" | "todoList") => {
        const listType = type(listKind === "orderedList" ? NODE_CANDIDATES.ordered : NODE_CANDIDATES.bullet);
        const itemType = type(NODE_CANDIDATES.item);
        if (!listType || !itemType) return null;
        const item = itemType.createAndFill(listKind === "todoList" ? { checked: false } : null);
        return item ? listType.create(null, [item]) : null;
      };

      let inserted: (ReturnType<NonNullable<ReturnType<typeof type>>["create"]> | null)[];
      switch (kind) {
        case "heading1":
        case "heading2":
        case "heading3":
        case "heading4":
          inserted = [type(NODE_CANDIDATES.heading)?.createAndFill({ level: HEADING_LEVEL[kind] }) ?? null];
          break;
        case "quote":
          inserted = [type(NODE_CANDIDATES.blockquote)?.createAndFill() ?? null];
          break;
        case "code":
          inserted = [type(NODE_CANDIDATES.code)?.createAndFill() ?? null];
          break;
        case "bulletList":
        case "orderedList":
        case "todoList":
          inserted = [listOf(kind)];
          break;
        case "table":
          inserted = [gfmPreset.createTable(ctx, 3, 3)];
          break;
        case "divider":
          // A rule has no caret position, so it brings a paragraph to land in.
          inserted = [type(NODE_CANDIDATES.hr)?.create() ?? null, paragraph.createAndFill()];
          break;
        default:
          inserted = [paragraph.createAndFill()];
      }
      const frag = inserted.filter((n): n is NonNullable<(typeof inserted)[number]> => !!n);
      if (!frag.length) return false;
      let tr = state.tr.insert(after, frag);
      // Caret into the LAST inserted node (the paragraph after a divider, the block itself
      // otherwise); `near` walks down to its first valid text position.
      const caretBase = after + frag.slice(0, -1).reduce((n, node) => n + node.nodeSize, 0);
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(caretBase + 1), 1)).scrollIntoView();
      view.dispatch(tr);
      return true;
    });
    focus();
    return ok;
  };

  /** Shared by blockEmpty() and insertImage: is the caret in an empty paragraph? */
  const isBlockEmpty = (): boolean => {
    try {
      return editor.action((ctx) => {
        const { state } = ctx.get(core.editorViewCtx);
        const $from = state.selection.$from;
        if ($from.depth < 1) return false;
        const top = $from.node(1);
        return top.type.name === "paragraph" && top.textContent.trim() === "";
      });
    } catch {
      return false;
    }
  };

  return {
    getMarkdown() {
      return applyTableStyle(String(editor.action(utils.getMarkdown())).replace(/\n+$/, ""), nbTable);
    },
    focus,
    context() {
      const names = ancestry();
      return {
        inTable: names.some((n) => n.includes("table")),
        inList: names.some((n) => n.includes("list")),
      };
    },
    marks() {
      try {
        return editor.action((ctx) => {
          const { state } = ctx.get(core.editorViewCtx);
          const { empty, from, to, $from } = state.selection;
          const has = (candidates: string[]) => {
            const t = markType(candidates);
            if (!t) return false;
            if (empty) return (state.storedMarks ?? $from.marks()).some((m) => m.type === t);
            return state.doc.rangeHasMark(from, to, t);
          };
          return {
            strong: has(["strong"]),
            emphasis: has(["emphasis"]),
            inlineCode: has(["inlineCode", "code_inline"]),
            strike: has(["strike_through", "strikethrough"]),
            link: has(["link"]),
          };
        });
      } catch {
        return { strong: false, emphasis: false, inlineCode: false, strike: false, link: false };
      }
    },
    blockType() {
      try {
        return editor.action((ctx) => {
          const { state } = ctx.get(core.editorViewCtx);
          const $from = state.selection.$from;
          if ($from.depth < 1) return null;
          return kindOf($from.node(1));
        });
      } catch {
        return null;
      }
    },
    blockEmpty: isBlockEmpty,
    consumeSlash(query) {
      editor.action((ctx) => {
        const view = ctx.get(core.editorViewCtx);
        const { state } = view;
        const to = state.selection.from;
        const from = to - query.length - 1;
        if (from < 0) return;
        // Recomputed from the live document AND verified: if the text between the caret
        // and the expected slash is not the query, nothing is deleted — never guess.
        if (state.doc.textBetween(from, to, undefined, "￼") !== `/${query}`) return;
        view.dispatch(state.tr.delete(from, to));
      });
    },
    insertBelow,
    turnInto,
    run(command) {
      let applied = false;
      if (command === "clearFormat") {
        applied = editor.action((ctx) => {
          const view = ctx.get(core.editorViewCtx);
          const { from, to, empty } = view.state.selection;
          if (empty) return false;
          // No mark argument = every mark. The Markdown syntax goes with them; the text stays.
          view.dispatch(view.state.tr.removeMark(from, to));
          return true;
        });
      } else if (command === "headerRow" || command === "headerCol") {
        // Markdown has no styling, so "make this a header" can only mean "bold every cell
        // of it" — which is what the renderer recognises (src/rehype/table-row-header.mjs).
        // Selecting first gives the toggle for free: prosemirror's toggleMark removes the
        // mark when the whole selection already carries it.
        const { row, col } = cellIndex();
        const isRow = command === "headerRow";
        const index = isRow ? row : col;
        if (index >= 0) {
          // Two steps, NOT chained on the first one's verdict: Milkdown's selectRow/selectCol
          // return `Boolean(dispatch(tr))`, and ProseMirror's dispatch returns undefined — so
          // they report false even when they worked. Only the toggle's verdict is meaningful.
          call(isRow ? gfmPreset.selectRowCommand : gfmPreset.selectColCommand, { index });
          applied = toggleStrongPerCell();
        }
      } else {
        // Milkdown returns the ProseMirror command's own verdict: false means it did not
        // apply here (no table row to add, nothing to outdent). Callers need that to decide
        // whether to fall back — see the Tab handling in lib/client/editor.ts.
        applied = call((commands as Record<string, { key: unknown } | undefined>)[command]);
      }
      focus();
      return applied;
    },
    insertImage(src, alt = "") {
      if (isBlockEmpty()) {
        call(commonmarkPreset.insertImageCommand, { src, alt });
      } else {
        editor.action((ctx) => {
          const view = ctx.get(core.editorViewCtx);
          const { state } = view;
          const $from = state.selection.$from;
          if ($from.depth < 1) return;
          const after = $from.after(1);
          const paragraph = state.schema.nodes.paragraph;
          const image = state.schema.nodes.image;
          if (!paragraph || !image) return;
          const node = paragraph.create(null, [image.create({ src, alt })]);
          view.dispatch(state.tr.insert(after, node).scrollIntoView());
        });
      }
      focus();
    },
    async destroy() {
      await editor.destroy();
    },
  };
}
