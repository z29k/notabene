// Detached review-server lifecycle — the state behind `notabene status`/`stop` and the
// `--detach` daemon started by `notabene dev`. The pidfile lives in the per-consumer
// workDir (os.tmpdir()/notabene/<hash(root)>, the same dir the build/cache use), so a
// later session recomputes the same path from the repo root and finds the daemon.
//
// Plain .mjs (bin/notabene.mjs runs under raw `node`); the pure parts are unit-tested.
import { spawnSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

export function pidfilePath(workDir) {
  return path.join(workDir, "notabene.pid");
}

export function writePidfile(workDir, info) {
  fs.writeFileSync(pidfilePath(workDir), `${JSON.stringify(info, null, 2)}\n`);
}

/** Parsed pidfile, or null if absent/corrupt. */
export function readPidfile(workDir) {
  try {
    return JSON.parse(fs.readFileSync(pidfilePath(workDir), "utf8"));
  } catch {
    return null;
  }
}

export function removePidfile(workDir) {
  try {
    fs.rmSync(pidfilePath(workDir), { force: true });
  } catch {
    /* already gone */
  }
}

/** Does a process with this pid exist? `kill(pid, 0)` probes without signalling;
 *  EPERM means it exists but isn't ours (still "alive"). */
export function isAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

/** Resolves true if something is listening on the port (i.e. the server is up). */
export function canConnect(port, host = "127.0.0.1", timeoutMs = 1000) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

/** Poll until the port answers or we give up — how the detached launcher knows the
 *  server is ready (its stdio goes to a log file, so we can't watch for a "ready" line). */
export async function waitForPort(port, { host = "127.0.0.1", timeoutMs = 20000, intervalMs = 200 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await canConnect(port, host)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/** Stop a DETACHED daemon and its workers. The daemon is a process-group leader
 *  (spawned `detached: true`), so on POSIX the negative pid signals the whole group
 *  (Astro + its Vite/esbuild children); on Windows `taskkill /T` kills the tree.
 *  Returns whether a stop signal was delivered. */
export function stopGroup(pid) {
  if (!isAlive(pid)) return false;
  if (process.platform === "win32") {
    const r = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return !r.error && r.status === 0;
  }
  try {
    process.kill(-pid, "SIGTERM"); // negative = the process group
    return true;
  } catch {
    try {
      process.kill(pid, "SIGTERM"); // group already gone — try the leader alone
      return true;
    } catch {
      return false;
    }
  }
}
