// In-page editor wiring — the source-map plugins and the write route, injected TOGETHER
// and ONLY when writing is actually possible (`astro dev`, or NOTABENE_ALLOW_WRITE=1).
//
// WHY an integration rather than entries in astro.config.mjs: the `data-nb-src` stamps
// exist to let the browser tell the server which source range a block came from. That is
// a dev-review affordance; baking it into every rendered block of every artifact would
// change the output of normal AND public builds for a feature they cannot use. Injecting
// here keeps the repo's rule intact — a build without the editor is byte-identical to a
// build from before the editor existed.
//
// Order matters and comes for free: the plugins are APPENDED to the processor's own
// lists, so they land after the ones declared in astro.config.mjs. rehypeMermaid replaces
// a `<pre>`'s properties wholesale, and the stamp is applied afterwards — nothing to fix
// there (test/source-stamp.test.ts pins that order).
import { fileURLToPath } from "node:url";
import { edit } from "../config.mjs";
import { rehypeSourceStamp } from "../rehype/source-stamp.mjs";
import { remarkSourceMap } from "../remark/source-map.mjs";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

/** The single condition: writes are possible AND the consumer wants the editor. */
export function editorEnabled(command) {
  return edit.enabled && (command === "dev" || process.env.NOTABENE_ALLOW_WRITE === "1");
}

export function notabeneEditor() {
  return {
    name: "notabene:editor",
    hooks: {
      "astro:config:setup": ({ command, config, injectRoute, logger }) => {
        if (!editorEnabled(command)) return;
        // Push onto the markdown processor's own lists. `updateConfig({ markdown: {…} })`
        // is NOT the way any more: the legacy `markdown.remarkPlugins`/`rehypePlugins`
        // keys are deprecated in Astro 6 (they get coerced into the processor, with a
        // warning), and `mergeConfig` REPLACES `markdown.processor` rather than merging
        // into it — so a plugin passed that way would either warn or be dropped.
        const options = config.markdown?.processor?.options;
        if (!options?.remarkPlugins || !options?.rehypePlugins) {
          // A consumer swapped in a processor of their own: no lists to extend, so the
          // editor simply stays off rather than half-wire itself (no stamps ⇒ read-only).
          logger.warn("in-page editor disabled: markdown.processor exposes no plugin lists to extend.");
          return;
        }
        options.remarkPlugins.push(remarkSourceMap);
        options.rehypePlugins.push(rehypeSourceStamp);
        injectRoute({ pattern: "/api/page", entrypoint: here("../app-routes/api/page.ts") });
        injectRoute({ pattern: "/api/asset", entrypoint: here("../app-routes/api/asset.ts") });
      },
    },
  };
}
