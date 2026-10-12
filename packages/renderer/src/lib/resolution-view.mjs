// The build's working dir (os.tmpdir()/notabene/<hash>) is outside every node_modules
// tree, yet the chunks Astro writes there import packages by bare specifier — and not
// only `astro`: its own runtime deps (zod, devalue, sharp, @oslojs/encoding…) are left
// external. They resolve through a `node_modules` placed beside the chunks.
//
// That used to be ONE symlink to the directory holding `astro`. It only works while
// astro's deps are hoisted into that same directory: as soon as the package manager
// nests astro (a consumer with its own Astro, or this workspace — root tools pin other
// versions of sharp/cookie/diff), its deps are split across several levels and the
// prerender step dies on "Cannot find package". The view below rebuilds what Node
// itself would see from astro's directory, then from the renderer's: every package of
// every node_modules on those lookup chains, nearest first, as a flat dir of links.
//
// Plain .mjs (bin/notabene.mjs runs under raw `node`); unit-tested.
import fs from "node:fs";
import path from "node:path";

/** Node's lookup chain from a directory: `<d>/node_modules` for each ancestor `d`
 *  (inclusive) that is not itself a node_modules dir, nearest first. */
export function lookupChain(fromDir) {
  const out = [];
  let dir = path.resolve(fromDir);
  for (;;) {
    if (path.basename(dir) !== "node_modules") out.push(path.join(dir, "node_modules"));
    const parent = path.dirname(dir);
    if (parent === dir) return out;
    dir = parent;
  }
}

/** Package dirs visible from the chains, nearest first: `name` → absolute path.
 *  Dot entries (.bin, .package-lock.json, pnpm's .pnpm store) are not packages. */
export function collectPackages(chains) {
  const found = new Map();
  const seenDirs = new Set();
  const read = (dir) => {
    try {
      return fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  for (const nm of chains) {
    if (seenDirs.has(nm)) continue;
    seenDirs.add(nm);
    for (const e of read(nm)) {
      if (e.name.startsWith(".")) continue;
      if (e.name.startsWith("@")) {
        for (const s of read(path.join(nm, e.name))) {
          const name = `${e.name}/${s.name}`;
          if (!s.name.startsWith(".") && !found.has(name)) found.set(name, path.join(nm, e.name, s.name));
        }
      } else if (!found.has(e.name)) {
        found.set(e.name, path.join(nm, e.name));
      }
    }
  }
  return found;
}

/**
 * Remove a previous view (or the legacy single symlink) WITHOUT ever following a link:
 * links are unlinked, scope dirs emptied the same way, and anything else is left in
 * place — this must never be able to reach into a real node_modules.
 */
export function removeView(target) {
  let st;
  try {
    st = fs.lstatSync(target);
  } catch {
    return;
  }
  if (!st.isDirectory()) {
    fs.unlinkSync(target);
    return;
  }
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    const p = path.join(target, e.name);
    if (e.isSymbolicLink()) fs.unlinkSync(p);
    else if (e.isDirectory() && e.name.startsWith("@")) removeView(p);
  }
  fs.rmdirSync(target);
}

/** (Re)build `target` as a dir of links to every package visible from `chains`. */
export function linkResolutionView(target, chains) {
  removeView(target);
  fs.mkdirSync(target);
  for (const [name, real] of collectPackages(chains)) {
    const link = path.join(target, name);
    if (name.includes("/")) fs.mkdirSync(path.dirname(link), { recursive: true });
    // "junction": a directory link that needs no privilege on Windows.
    fs.symlinkSync(real, link, "junction");
  }
}
