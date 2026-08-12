// MDX component maps (config `mdxComponents`) — the pure half.
//
// `format: "mdx"` promises strict MDX, but strict MDX without components is just
// Markdown with a harsher parser: the moment a page writes <Accroche/>, rendering dies
// with "Expected component `Accroche` to be defined". The extension point is a config key
// naming a module whose DEFAULT EXPORT is a `{ Name: Component }` map, handed to
// `<Content components={…} />` at every render site (page, print/PDF, custom home).
//
// The map cannot be inlined in notabene.config.mjs: that file is loaded by RAW NODE (the
// CLI's `doctor` imports it), so it can never import a .astro/.tsx component. Hence a
// PATH — resolved through Vite, which is the only thing that can compile the consumer's
// components. The bridge is a virtual module (see integrations/mdx-components.mjs) whose
// source this file generates.
//
// Plain .mjs: reached from astro.config.mjs (config-graph rule) and from config.mjs,
// which runs under raw Node.

/** The virtual module the render sites import. */
export const MDX_COMPONENTS_ID = "virtual:notabene-mdx-components";

/** Modules we can hand to Vite. A `.astro` file default-exports a COMPONENT, not a map —
 *  the commonest mistake, and worth a config error rather than a render-time one. */
export const MDX_COMPONENT_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx"];

/**
 * Refuse `mdxComponents` outside `format: "mdx"`. A silently ignored option is worse than
 * a missing one — in CommonMark there is no component syntax for the map to serve.
 * @param {string} format resolved `format` ("mdx" | "commonmark")
 * @param {string} what config key, for the message (e.g. `roots[1].mdxComponents`)
 */
export function assertMdxFormat(format, what) {
  if (format !== "mdx") {
    throw new Error(`notabene: ${what} requires format: "mdx" — CommonMark/GFM has no components.`);
  }
}

/**
 * Extension allow-list for a components module (pure; existence is checked separately).
 * @param {string} rel repo-relative path
 * @param {string} what config key, for the message
 */
export function assertMdxModule(rel, what) {
  const dot = rel.lastIndexOf(".");
  const ext = dot === -1 ? "" : rel.slice(dot).toLowerCase();
  if (!MDX_COMPONENT_EXTENSIONS.includes(ext)) {
    throw new Error(
      `notabene: ${what} must point at a JS/TS module that default-exports a component map ` +
        `(${MDX_COMPONENT_EXTENSIONS.join(", ")}), got "${rel}".`,
    );
  }
}

/**
 * Do two absolute paths share a real parent folder?
 *
 * Astro resolves an `.astro` file's style/script sub-requests
 * (`X.astro?astro&type=style`) against ITS OWN root: `vite-plugin-utils`'
 * `normalizeFilename` REWRITES any absolute path that shares no ancestor with that root
 * (`<astroRoot>/<the whole path>`), while the transform that filled the compile cache used
 * the real one — so the lookup misses and the build dies with *"No cached compile metadata
 * found"*. Run-from-package puts the renderer in the consumer's `node_modules`, which
 * always shares the repo as an ancestor, so a real install can never hit it; a scratch
 * consumer in `/tmp` reviewed by a checkout under `/Users` (or another Windows drive) can.
 * Components with no `<style>`/`<script>` are unaffected — hence a warning, not a refusal.
 *
 * @param {string} a absolute path
 * @param {string} b absolute path
 */
export function sharesAncestor(a, b) {
  const head = (p) => String(p).replace(/\\/g, "/").split("/").filter(Boolean)[0];
  const ha = head(a);
  const hb = head(b);
  return ha !== undefined && ha === hb;
}

/**
 * @typedef {{ rel: string, abs: string }} MdxComponentFile
 * @typedef {{ global: MdxComponentFile|null, bySpace: Record<string, MdxComponentFile> }} MdxComponentEntries
 */

/**
 * Plan the virtual module: which files to compile, and the source that exposes them.
 *
 * The generated module resolves a space to its map — `roots[].mdxComponents` when that
 * space declares one, else the global `mdxComponents`, else `undefined` so the caller can
 * omit the prop entirely (a build with no `mdxComponents` is byte-identical to one from
 * before this feature). Each module's default export is checked AT IMPORT — i.e. when the
 * route module loads, not when the first page that uses a component renders.
 *
 * Imports go through `<id>/<n>` specifiers rather than absolute paths: the plugin maps
 * those back to files, so nothing here depends on how Vite treats a leading "/".
 *
 * @param {MdxComponentEntries} entries
 * @returns {{ files: string[], code: string }} `files[n]` backs specifier `<id>/<n>`
 */
export function planMdxComponents({ global = null, bySpace = {} } = {}) {
  /** @type {string[]} */
  const files = [];
  /** @type {string[]} */
  const rels = [];
  const indexOf = (file) => {
    const i = files.indexOf(file.abs);
    if (i !== -1) return i;
    files.push(file.abs);
    rels.push(file.rel);
    return files.length - 1;
  };

  const globalIndex = global ? indexOf(global) : -1;
  /** @type {Record<string, number>} */
  const spaceIndex = {};
  for (const [key, file] of Object.entries(bySpace)) spaceIndex[key] = indexOf(file);

  if (files.length === 0) {
    return {
      files,
      code:
        "// notabene: no `mdxComponents` configured — every render site omits the prop.\n" +
        "export function componentsFor() {\n  return undefined;\n}\n",
    };
  }

  const imports = files.map((_, i) => `import __m${i} from ${JSON.stringify(`${MDX_COMPONENTS_ID}/${i}`)};`);
  return {
    files,
    code: `// notabene: generated from \`mdxComponents\` — see lib/mdx-components.mjs.
${imports.join("\n")}

const __maps = [${files.map((_, i) => `__m${i}`).join(", ")}];
const __paths = ${JSON.stringify(rels)};
for (let i = 0; i < __maps.length; i++) {
  const m = __maps[i];
  if (!m || typeof m !== "object" || Array.isArray(m)) {
    throw new Error(
      \`notabene: mdxComponents module "\${__paths[i]}" must default-export an object mapping \` +
        "component names to components.",
    );
  }
}

const __bySpace = ${JSON.stringify(spaceIndex)};
const __global = ${globalIndex};

export function componentsFor(space) {
  const i = space != null && Object.hasOwn(__bySpace, space) ? __bySpace[space] : __global;
  return i === -1 ? undefined : __maps[i];
}
`,
  };
}
