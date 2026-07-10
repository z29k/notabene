import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  canConnect,
  isAlive,
  pidfilePath,
  readPidfile,
  removePidfile,
  stopGroup,
  waitForPort,
  writePidfile,
} from "../src/lib/server-process.mjs";

const tmps: string[] = [];
function tmpdir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "nb-proc-"));
  tmps.push(d);
  return d;
}
afterAll(() => {
  for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

describe("pidfile round-trip", () => {
  it("writes, reads back, and removes", () => {
    const wd = tmpdir();
    const info = { pid: 4242, port: 3009, root: "/x", startedAt: "2026-07-06T00:00:00.000Z" };
    writePidfile(wd, info);
    expect(fs.existsSync(pidfilePath(wd))).toBe(true);
    expect(readPidfile(wd)).toEqual(info);
    removePidfile(wd);
    expect(readPidfile(wd)).toBeNull();
  });
  it("returns null for a missing/corrupt pidfile", () => {
    const wd = tmpdir();
    expect(readPidfile(wd)).toBeNull();
    fs.writeFileSync(pidfilePath(wd), "not json");
    expect(readPidfile(wd)).toBeNull();
  });
});

describe("isAlive", () => {
  it("is true for the current process", () => {
    expect(isAlive(process.pid)).toBe(true);
  });
  it("is false for an unused high pid and for non-positive pids", () => {
    expect(isAlive(0)).toBe(false);
    expect(isAlive(-5)).toBe(false);
    expect(isAlive(1073741823)).toBe(false);
  });
});

describe("canConnect / waitForPort", () => {
  it("connects only while a server is listening", async () => {
    const srv = net.createServer();
    const port: number = await new Promise((resolve) => {
      srv.listen(0, "127.0.0.1", () => resolve((srv.address() as net.AddressInfo).port));
    });
    expect(await canConnect(port)).toBe(true);
    expect(await waitForPort(port, { timeoutMs: 1000 })).toBe(true);
    await new Promise((r) => srv.close(r));
    expect(await canConnect(port)).toBe(false);
  });
  it("waitForPort gives up on a dead port", async () => {
    // An ephemeral port nobody is listening on: bind then release to learn a free number.
    const srv = net.createServer();
    const port: number = await new Promise((resolve) => {
      srv.listen(0, "127.0.0.1", () => resolve((srv.address() as net.AddressInfo).port));
    });
    await new Promise((r) => srv.close(r));
    expect(await waitForPort(port, { timeoutMs: 400, intervalMs: 100 })).toBe(false);
  });
});

describe("stopGroup", () => {
  it("returns false when the target is already gone (no throw)", () => {
    expect(stopGroup(1073741823)).toBe(false);
  });
});
