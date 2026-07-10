import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const tmps: string[] = [];
function tmpdir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "nb-zc-"));
  tmps.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

const CONFIG_URL = new URL("../src/config.mjs", import.meta.url).href;
const BIN = fileURLToPath(new URL("../bin/notabene.mjs", import.meta.url));

// Import config.mjs in a fresh node process with a chosen env (the module reads env at
// eval time, so it can't be re-imported with different env in-process).
function loadConfig(env: Record<string, string>): { code: number; stdout: string; stderr: string } {
  const script = `import(${JSON.stringify(CONFIG_URL)}).then(c => process.stdout.write(JSON.stringify({ format: c.format, roots: c.roots.map(r => r.path), port: c.port })))`;
  try {
    const stdout = execFileSync("node", ["--input-type=module", "-e", script], {
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: any) {
    return { code: err.status ?? 1, stdout: String(err.stdout ?? ""), stderr: String(err.stderr ?? "") };
  }
}

describe("config.mjs zero-config gate", () => {
  it("a MISSING config falls back to defaults WHEN the gate is set", () => {
    const repo = tmpdir();
    const r = loadConfig({
      NOTABENE_ROOT: repo,
      NOTABENE_CONFIG: path.join(repo, "notabene.config.mjs"),
      NOTABENE_ALLOW_DEFAULTS: "1",
    });
    expect(r.code).toBe(0);
    const cfg = JSON.parse(r.stdout);
    expect(cfg.format).toBe("commonmark"); // zero-config picks the safer default
    expect(cfg.roots).toEqual(["docs"]);
    expect(cfg.port).toBe(3009);
  });

  it("a MISSING config throws WITHOUT the gate (CLI ergonomics unchanged)", () => {
    const repo = tmpdir();
    const r = loadConfig({
      NOTABENE_ROOT: repo,
      NOTABENE_CONFIG: path.join(repo, "notabene.config.mjs"),
      NOTABENE_ALLOW_DEFAULTS: "",
    });
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain("could not load config");
  });

  it("an EXISTING config keeps the code default of mdx when format is omitted", () => {
    const repo = tmpdir();
    fs.writeFileSync(
      path.join(repo, "notabene.config.mjs"),
      "export default { roots: [{ label: 'D', path: 'docs' }] };\n",
    );
    const r = loadConfig({
      NOTABENE_ROOT: repo,
      NOTABENE_CONFIG: path.join(repo, "notabene.config.mjs"),
      NOTABENE_ALLOW_DEFAULTS: "1", // gate on, but a file exists → not zero-config
    });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).format).toBe("mdx");
  });
});

describe("notabene init --detect", () => {
  it("writes a config with the auto-detected doc folders + commonmark, and creates the store", () => {
    const repo = tmpdir();
    fs.mkdirSync(path.join(repo, "docs"), { recursive: true });
    fs.mkdirSync(path.join(repo, "guides"), { recursive: true });
    fs.writeFileSync(path.join(repo, "docs/index.md"), "# Hi");
    fs.writeFileSync(path.join(repo, "guides/g.md"), "# G");
    execFileSync("node", [BIN, "init", "--detect", "--root", repo], { encoding: "utf8" });
    const cfg = fs.readFileSync(path.join(repo, "notabene.config.mjs"), "utf8");
    expect(cfg).toContain('path: "docs"');
    expect(cfg).toContain('path: "guides"');
    expect(cfg).toContain('format: "commonmark"');
    expect(fs.existsSync(path.join(repo, "docs/.notabene/meta.json"))).toBe(true);
  });
});
