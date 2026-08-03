// Milkdown mount for ONE block (plan §5, phase 3).
//
// Milkdown is document-centric; here it is handed a single top-level block's Markdown and
// asked for it back. That is the whole integration: no slash menu, no block handles, no
// Crepe preset — the page around the block is the real document, and it stays rendered.
//
// Why Milkdown rather than any other rich editor: it parses and serializes with **remark**,
// the same mdast world as the Astro pipeline and src/remark/rewrite-links.mjs. That is what
// lets the file's own conventions (lib/md-style.ts) drive serialization, so an edited block
// comes back looking like the rest of the file instead of like a formatter's opinion.
//
// Loaded with a dynamic import, exactly like mermaid (lib/client/mermaid.ts): a hard
// dependency that costs nothing until someone actually opens a block in rich mode.

export interface WysiwygHandle {
  /** Current content, serialized with the file's conventions. */
  getMarkdown(): string;
  focus(): void;
  destroy(): Promise<void>;
  /** Run a Milkdown command by key — drives the toolbars. */
  run(command: EditorCommand): void;
}

export type EditorCommand = "strong" | "emphasis" | "inlineCode" | "link" | "undo" | "redo";

/** Block kinds worth a rich editor. Code fences stay in source mode — see mountWysiwyg. */
export const RICH_KINDS = new Set(["paragraph", "heading", "list", "blockquote", "table"]);

export interface WysiwygOptions {
  host: HTMLElement;
  markdown: string;
  /** remark-stringify options inferred from the file (lib/md-style.ts). */
  style: Record<string, unknown>;
  onChange?: () => void;
}

export async function mountWysiwyg({ host, markdown, style, onChange }: WysiwygOptions): Promise<WysiwygHandle> {
  const [core, utils, commonmarkPreset, gfmPreset, history, listener] = await Promise.all([
    import("@milkdown/kit/core"),
    import("@milkdown/kit/utils"),
    import("@milkdown/kit/preset/commonmark"),
    import("@milkdown/kit/preset/gfm"),
    import("@milkdown/kit/plugin/history"),
    import("@milkdown/kit/plugin/listener"),
  ]);

  const { Editor, rootCtx, defaultValueCtx, remarkStringifyOptionsCtx, editorViewOptionsCtx, commandsCtx } = core;

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, host);
      ctx.set(defaultValueCtx, markdown);
      // The point of the whole exercise: serialize like the rest of THIS file.
      ctx.set(remarkStringifyOptionsCtx, style);
      ctx.set(editorViewOptionsCtx, { attributes: { class: "nb-wysiwyg-area", spellcheck: "false" } });
      if (onChange) ctx.get(listener.listenerCtx).markdownUpdated(() => onChange());
    })
    .use(commonmarkPreset.commonmark)
    .use(gfmPreset.gfm)
    .use(history.history)
    .use(listener.listener)
    .create();

  const commands = {
    strong: commonmarkPreset.toggleStrongCommand,
    emphasis: commonmarkPreset.toggleEmphasisCommand,
    inlineCode: commonmarkPreset.toggleInlineCodeCommand,
    link: commonmarkPreset.toggleLinkCommand,
    undo: history.undoCommand,
    redo: history.redoCommand,
  };

  const focus = () => host.querySelector<HTMLElement>(".nb-wysiwyg-area")?.focus();

  return {
    getMarkdown() {
      return String(editor.action(utils.getMarkdown())).replace(/\n+$/, "");
    },
    focus,
    run(command) {
      const key = commands[command];
      if (!key) return;
      editor.action((ctx) => {
        ctx.get(commandsCtx).call(key.key);
      });
      focus();
    },
    async destroy() {
      await editor.destroy();
    },
  };
}
