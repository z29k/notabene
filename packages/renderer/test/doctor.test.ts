import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  countOpenComments,
  detectDocs,
  findFreePort,
  groupByTopDir,
  hasOnPath,
  isPortFree,
  isVersionAtLeast,
  projectRoots,
  readStoreState,
} from "../src/lib/doctor.mjs";

const tmps: string[] = [];
function tmpdir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "nb-doctor-"));
  tmps.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

describe("isVersionAtLeast", () => {
  it("passes the engines floor", () => {
    expect(isVersionAtLeast("22.12.0", [22, 12, 0])).toBe(true);
    expect(isVersionAtLeast("24.3.1", [22, 12, 0])).toBe(true);
  });
  it("fails below the floor", () => {
    expect(isVersionAtLeast("22.11.0", [22, 12, 0])).toBe(false);
    expect(isVersionAtLeast("20.19.0", [22, 12, 0])).toBe(false);
  });
  it("tolerates a non-numeric tail", () => {
    expect(isVersionAtLeast("22.12.0-nightly", [22, 12, 0])).toBe(true);
  });
});

describe("groupByTopDir", () => {
  it("keeps unique top-level dirs, sorted", () => {
    expect(groupByTopDir(["docs/a.md", "docs/b/c.md", "guides/x.md"])).toEqual(["docs", "guides"]);
  });
  it("drops top-level files (no folder)", () => {
    expect(groupByTopDir(["README.md", "docs/i.md"])).toEqual(["docs"]);
  });
  it("normalizes backslashes", () => {
    expect(groupByTopDir(["docs\\win\\a.md"])).toEqual(["docs"]);
  });
});

describe("detectDocs", () => {
  it("finds doc folders, skips excluded/dot dirs and non-markdown", () => {
    const root = tmpdir();
    fs.mkdirSync(path.join(root, "docs/nested"), { recursive: true });
    fs.mkdirSync(path.join(root, "guides"), { recursive: true });
    fs.mkdirSync(path.join(root, "node_modules/pkg"), { recursive: true });
    fs.mkdirSync(path.join(root, ".notabene"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/index.md"), "# hi");
    fs.writeFileSync(path.join(root, "docs/nested/deep.mdx"), "# deep");
    fs.writeFileSync(path.join(root, "guides/g.markdown"), "# g");
    fs.writeFileSync(path.join(root, "guides/logo.png"), "x");
    fs.writeFileSync(path.join(root, "node_modules/pkg/readme.md"), "# dep");
    fs.writeFileSync(path.join(root, ".notabene/x.md"), "# store");
    fs.writeFileSync(path.join(root, "README.md"), "# root");
    expect(detectDocs(root)).toEqual(["docs", "guides"]);
  });
  it("returns [] for a repo with no markdown", () => {
    const root = tmpdir();
    fs.writeFileSync(path.join(root, "main.rs"), "fn main() {}");
    expect(detectDocs(root)).toEqual([]);
  });
});

describe("projectRoots", () => {
  it("keeps only the safe subset (no abs/baseUrl/pattern)", () => {
    const resolved = [
      {
        key: "docs",
        label: "Docs",
        path: "docs",
        exclude: [".notabene/**"],
        abs: "/x/docs",
        baseUrl: new URL("file:///x/docs"),
        pattern: ["**/*.md"],
      },
    ];
    expect(projectRoots(resolved)).toEqual([{ key: "docs", label: "Docs", path: "docs", exclude: [".notabene/**"] }]);
  });
  it("defaults a missing exclude to []", () => {
    expect(projectRoots([{ key: "d", label: "D", path: "d" }])[0].exclude).toEqual([]);
  });
});

describe("readStoreState + countOpenComments", () => {
  it("reports schemaVersion and counts open, non-held comments (v1 + v2)", () => {
    const store = tmpdir();
    fs.writeFileSync(path.join(store, "meta.json"), JSON.stringify({ schemaVersion: 2 }));
    fs.mkdirSync(path.join(store, "docs/index"), { recursive: true });
    fs.writeFileSync(path.join(store, "docs/index/a.json"), JSON.stringify({ id: "a", status: "open" }));
    fs.writeFileSync(path.join(store, "docs/index/b.json"), JSON.stringify({ id: "b", status: "open", hold: true }));
    fs.writeFileSync(path.join(store, "docs/index/c.json"), JSON.stringify({ id: "c", status: "resolved" }));
    // a legacy v1 page array alongside the v2 files
    fs.writeFileSync(path.join(store, "guides.json"), JSON.stringify([{ id: "d", status: "open" }]));
    expect(readStoreState(store)).toEqual({ exists: true, schemaVersion: 2 });
    expect(countOpenComments(store)).toBe(2); // a + d (b is on hold, c resolved)
  });
  it("handles a missing store", () => {
    const gone = path.join(tmpdir(), "nope");
    expect(readStoreState(gone)).toEqual({ exists: false, schemaVersion: undefined });
    expect(countOpenComments(gone)).toBe(0);
  });
});

describe("port probing", () => {
  it("isPortFree is false while a server holds the port, true after release", async () => {
    const srv = net.createServer();
    const port: number = await new Promise((resolve) => {
      srv.listen(0, "127.0.0.1", () => resolve((srv.address() as net.AddressInfo).port));
    });
    expect(await isPortFree(port)).toBe(false);
    await new Promise((r) => srv.close(r));
    expect(await isPortFree(port)).toBe(true);
  });
  it("findFreePort skips a taken port", async () => {
    const srv = net.createServer();
    const port: number = await new Promise((resolve) => {
      srv.listen(0, "127.0.0.1", () => resolve((srv.address() as net.AddressInfo).port));
    });
    const free = await findFreePort(port);
    expect(free).toBeGreaterThan(port);
    await new Promise((r) => srv.close(r));
  });
});

describe("hasOnPath", () => {
  it("finds node (the interpreter running this test)", () => {
    expect(hasOnPath("node")).toBe(true);
  });
  it("does not find an obviously absent binary", () => {
    expect(hasOnPath("definitely-not-a-real-binary-xyz")).toBe(false);
  });
});

// Guard: bin/notabene.mjs must stay runnable under raw `node` (it imports doctor.mjs).
describe("doctor CLI smoke", () => {
  it("emits valid JSON for a config-less repo", () => {
    const repo = tmpdir();
    fs.mkdirSync(path.join(repo, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repo, "docs/index.md"), "# Hi");
    const bin = fileFromHere("../bin/notabene.mjs");
    const out = execFileSync("node", [bin, "doctor", "--root", repo, "--json"], { encoding: "utf8" });
    const report = JSON.parse(out);
    expect(report.config.exists).toBe(false);
    expect(report.docs.detected).toEqual(["docs"]);
    expect(typeof report.node.ok).toBe("boolean");
  });
});

function fileFromHere(rel: string): string {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), rel);
}
