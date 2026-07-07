#!/usr/bin/env node
// notabene plugin forwarder — the one wrapper the setup skill and the /notabene:*
// commands call. A command/skill `.md` can't interpolate the pinned renderer version,
// so this does it: it resolves `@z29k/notabene@<ver>` and forwards to npx.
//
//   node <plugin>/bin/nb.mjs <subcommand> [--root <repo>] [flags…]
//     → npx -y --prefer-offline @z29k/notabene@<ver> <subcommand> [flags…]
//
// Notes:
//   • The version is read from the sibling plugin manifest, resolved relative to THIS
//     file (import.meta.url) — NOT via $CLAUDE_PLUGIN_ROOT (which is only set when Claude
//     Code invokes us), so `node bin/nb.mjs …` also works when tested directly.
//   • Preflight: npx must be on PATH. If not, we emit a structured JSON error the skill
//     routes to its "install Node" fallback (Claude Code's bundled Node is not always on
//     PATH). `npx --version` (exit code) is cross-platform; `command -v` is bash-only.
//   • NOTABENE_RENDERER_SPEC overrides the pinned spec (e.g. `@z29k/notabene@dev`, a
//     tarball, or `file:../renderer`) — needed to test the plugin BEFORE the matching
//     stable is published to npm (on `develop` only the `X.Y.Z-dev.N` prerelease exists).
//   • Node only (no .sh/.ps1); one wrapper centralizes version + npx + detection.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// npx is npx.cmd on Windows; spawning a .cmd requires a shell there (Node ≥ 18.20/20.12).
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const useShell = process.platform === "win32";

function emit(obj, code) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
  process.exit(code);
}

// Pinned renderer spec: env override wins; else @z29k/notabene@<plugin version> from the
// sibling manifest (lockstep — bumping the plugin bumps the renderer it pins).
function rendererSpec() {
  if (process.env.NOTABENE_RENDERER_SPEC) return process.env.NOTABENE_RENDERER_SPEC;
  const manifest = new URL("../.claude-plugin/plugin.json", import.meta.url);
  const { version } = JSON.parse(readFileSync(manifest, "utf8"));
  return `@z29k/notabene@${version}`;
}

function npxAvailable() {
  const r = spawnSync(NPX, ["--version"], { stdio: "ignore", shell: useShell });
  return !r.error && r.status === 0;
}

if (!npxAvailable()) {
  emit(
    {
      ok: false,
      error: "npx-unavailable",
      hint:
        "notabene needs `npx` on your PATH (it ships with Node). Install Node from " +
        "nodejs.org, your OS package manager, or nvm, then retry. Claude Code's bundled " +
        "Node runtime is not always exposed on PATH.",
    },
    1,
  );
}

const spec = rendererSpec();
const args = process.argv.slice(2);
// NOTABENE_ALLOW_DEFAULTS=1 = opt into zero-config: through the plugin, a repo with no
// notabene.config.mjs falls back to sane defaults instead of erroring. Bare CLI use never
// sets this, so `npx @z29k/notabene dev` still fails helpfully on a missing config.
const r = spawnSync(NPX, ["-y", "--prefer-offline", spec, ...args], {
  stdio: "inherit",
  shell: useShell,
  env: { ...process.env, NOTABENE_ALLOW_DEFAULTS: "1" },
});
if (r.error) emit({ ok: false, error: "spawn-failed", hint: String(r.error.message || r.error) }, 1);
process.exit(r.status ?? 0);
