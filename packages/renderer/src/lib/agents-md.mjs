// AGENTS.md entry point — pure block rendering + merge, used by `notabene init`.
//
// AGENTS.md is the de-facto file agents (Codex CLI, Cursor, Gemini CLI, Zed, Amp…)
// read at session start. It's the ONLY discovery hook a non-Claude agent gets: without
// it, nothing tells it that review comments exist or where the protocol lives.
//
// The file belongs to the CONSUMER, so we never own it: we own a bounded block between
// two markers. Absent file → created; file without markers → block appended; file with
// markers → only the span between them is replaced (so `init` is a repair too). Nothing
// outside the markers is ever touched, and the file's existing EOL is preserved.
//
// Raw-Node importable (bin/ uses it outside Vite): no imports.

export const BEGIN = "<!-- notabene:begin -->";
export const END = "<!-- notabene:end -->";

const DOCS_URL = "https://z29k.github.io/notabene/reference/agent-protocol/";

/** CRLF if the file already uses it, else LF. */
export function detectEol(text) {
  return /\r\n/.test(text ?? "") ? "\r\n" : "\n";
}

function toEol(text, eol) {
  return text.replace(/\r?\n/g, eol);
}

/**
 * The bounded block. Paths are repo-relative and resolved from the CONFIG (never
 * generic), so the agent reads a path that exists in THIS repo.
 * @param {{ storeRel: string, protocolRel?: string|null, docsUrl?: string }} opts
 */
export function renderAgentsBlock({ storeRel, protocolRel = null, docsUrl = DOCS_URL }) {
  const store = storeRel.replace(/\\/g, "/").replace(/\/+$/, "");
  const source = protocolRel
    ? `- **The protocol**: \`${protocolRel.replace(/\\/g, "/")}\` — read it first; it is the\n` +
      `  complete spec (store layout, anchor resolution, journaling, verification).\n` +
      `- Online copy: <${docsUrl}>`
    : `- **The protocol**: <${docsUrl}> — or print it locally with\n  \`npx -y @z29k/notabene@latest protocol\`.`;
  return [
    BEGIN,
    "## Documentation review (notabene)",
    "",
    `Review comments on this repo's docs live in \`${store}/\` — one JSON file per comment,`,
    'committed with the code. When asked to "address the doc comments" (or anything',
    "equivalent), follow the notabene review protocol:",
    "",
    source,
    "",
    'Non-negotiable: only process comments with `status: "open"` and `hold: false`; never',
    "delete the store; never commit without being asked.",
    END,
  ].join("\n");
}

/**
 * Merge the block into an existing AGENTS.md (or create one).
 * @returns {{ text: string, action: "created"|"replaced"|"appended"|"unchanged"|"unterminated" }}
 *   `unterminated` = an opening marker with no closing one (a hand-mangled file):
 *   we refuse to guess and leave the file untouched for the caller to report.
 */
export function mergeAgentsBlock(existing, block) {
  const eol = detectEol(existing ?? "");
  const b = toEol(block.trimEnd(), eol);

  if (existing == null || existing.trim() === "") {
    return { text: toEol("# Agent instructions\n\n", eol) + b + eol, action: "created" };
  }

  const i = existing.indexOf(BEGIN);
  const j = existing.indexOf(END);
  if (i !== -1 && (j === -1 || j < i)) return { text: existing, action: "unterminated" };
  if (i !== -1) {
    const text = existing.slice(0, i) + b + existing.slice(j + END.length);
    return { text, action: text === existing ? "unchanged" : "replaced" };
  }

  const text = `${existing.replace(/\s+$/, "")}${eol}${eol}${b}${eol}`;
  return { text, action: "appended" };
}

/** Does this text already carry a notabene block? (doctor / status reporting) */
export function hasAgentsBlock(text) {
  const s = String(text ?? "");
  return s.includes(BEGIN) && s.includes(END);
}
