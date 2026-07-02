#!/usr/bin/env node
// notabene CLI — run-from-package. Renders a consumer repo's docs from this
// package (no app is copied into the consumer). Only DATA lives in the consumer:
// notabene.config.mjs + the .notabene store.
//
//   notabene init          write notabene.config.mjs + create the store (no-op if present)
//   notabene dev           start the review server (astro dev) over the current repo
//   notabene build         build the static site (no write API in the artifact)
//   notabene preview       serve the built site
//
// Flags: --config <path> (default <cwd>/notabene.config.mjs), --root <path>
// (consumer repo root, default cwd), --host (expose on the LAN — trusted only).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
// bin/ is at <package>/bin → the Astro app root is the package root.
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 ? (argv[i + 1] ?? true) : undefined;
};

const repoRoot = path.resolve(flag("--root") || process.cwd());
const configPath = path.resolve(flag("--config") || path.join(repoRoot, "notabene.config.mjs"));
const exposeHost = argv.includes("--host");

function fail(msg) {
  console.error(`notabene: ${msg}`);
  process.exit(1);
}

const TEMPLATE_CONFIG = path.join(APP_DIR, "templates", "notabene.config.mjs");

function readStore(cfgPath) {
  // Best-effort: read the `store` value from an existing config to create it.
  try {
    const txt = fs.readFileSync(cfgPath, "utf8");
    const m = txt.match(/store\s*:\s*["'`]([^"'`]+)["'`]/);
    return m ? m[1] : "docs/.notabene";
  } catch {
    return "docs/.notabene";
  }
}

function doInit() {
  if (fs.existsSync(configPath)) {
    console.log(`notabene: ${path.relative(repoRoot, configPath)} already exists — leaving it.`);
  } else {
    fs.copyFileSync(TEMPLATE_CONFIG, configPath);
    console.log(`notabene: wrote ${path.relative(repoRoot, configPath)}`);
  }
  const store = path.resolve(repoRoot, readStore(configPath));
  fs.mkdirSync(store, { recursive: true });
  const meta = path.join(store, "meta.json");
  if (!fs.existsSync(meta)) fs.writeFileSync(meta, `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`);
  console.log(`notabene: store ready at ${path.relative(repoRoot, store)}/`);
  console.log("notabene: run `notabene dev` to start reviewing.");
}

function runAstro(astroCmd) {
  if (!fs.existsSync(configPath)) {
    fail(`no config at ${configPath}. Run \`notabene init\` first (or pass --config).`);
  }
  // Astro CLI entry, resolved from this package's deps. Astro's `exports` blocks
  // deep subpaths, so resolve via package.json + its `bin` field.
  const astroPkgPath = require.resolve("astro/package.json");
  const astroPkg = JSON.parse(fs.readFileSync(astroPkgPath, "utf8"));
  const binRel = typeof astroPkg.bin === "string" ? astroPkg.bin : astroPkg.bin.astro;
  const astroBin = path.join(path.dirname(astroPkgPath), binRel);
  // Note: build output goes to <APP_DIR>/dist (next to the renderer's deps, so
  // Astro's prerender step resolves them). It's a throwaway verification artifact,
  // gitignored, inside the installed package — not the consumer's source.
  const args = [astroBin, astroCmd, "--root", APP_DIR];
  const port = flag("--port");
  if (port && port !== true) args.push("--port", String(port));
  if (exposeHost) args.push("--host");
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    cwd: repoRoot,
    env: {
      ...process.env,
      NOTABENE_ROOT: repoRoot,
      NOTABENE_CONFIG: configPath,
      ...(exposeHost ? { NOTABENE_HOST: "1" } : {}),
    },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

switch (cmd) {
  case "init":
    doInit();
    break;
  case "dev":
  case "build":
  case "preview":
    runAstro(cmd);
    break;
  default:
    console.log(
      "notabene — docs review tool\n\n" +
        "  notabene init       write notabene.config.mjs + create the store\n" +
        "  notabene dev        start the review server over this repo's docs\n" +
        "  notabene build      build the static site\n" +
        "  notabene preview    serve the built site\n\n" +
        "Flags: --config <path>  --root <path>  --host",
    );
    process.exit(cmd ? 1 : 0);
}
