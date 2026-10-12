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

/**
 * Parsed pidfile, or null if absent/corrupt — or not OURS. Its pid gets signalled
 * (`stop`, and `dev --detach` replacing a daemon of another version), and on Linux the
 * workDir sits under the SHARED /tmp: a pidfile planted by another local user could
 * aim that signal at any of our processes. One we did not write is ignored.
 * `uid` defaults to the current user's; no uid (Windows, per-user temp) → no check.
 *
 * ONE open, then check and read through that descriptor: a stat-then-read on the path
 * could be raced (the file swapped in between), and a stat follows symlinks — a link to
 * a file of ours would pass for ours. O_NOFOLLOW refuses a symlink outright; O_NONBLOCK
 * keeps a FIFO planted there from hanging the open (it waits for a writer otherwise),
 * and anything but a regular file is ignored.
 */
export function readPidfile(workDir, uid = process.getuid?.()) {
  const { O_RDONLY, O_NOFOLLOW = 0, O_NONBLOCK = 0 } = fs.constants;
  let fd;
  try {
    fd = fs.openSync(pidfilePath(workDir), O_RDONLY | O_NOFOLLOW | O_NONBLOCK);
    const st = fs.fstatSync(fd);
    if (!st.isFile() || (uid !== undefined && st.uid !== uid)) return null;
    return JSON.parse(fs.readFileSync(fd, "utf8"));
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
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

/**
 * What `dev --detach` does with the daemon on record. A live daemon is reused only when
 * it runs the SAME renderer version as the CLI asking: the plugin pins the renderer, so
 * after a plugin update `dev --detach` is the new version asking — reusing the old
 * daemon kept serving the old renderer (and every fix since) under "already running".
 * A pidfile with no `version` predates this check, so it is replaced too.
 *
 * @param {{ version?: string } | null} info  the parsed pidfile
 * @param {{ alive: boolean, answering: boolean, version: string }} state
 * @returns {"start" | "reuse" | "replace"}  start = nothing live (a stale pidfile is
 *   just dropped); replace = stop the live daemon, then start.
 */
export function daemonVerdict(info, { alive, answering, version }) {
  if (!info || !alive || !answering) return "start";
  return info.version === version ? "reuse" : "replace";
}

/** Poll until the process is gone — so a replacement daemon can take its port back. */
export async function waitForExit(pid, { timeoutMs = 5000, intervalMs = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return !isAlive(pid);
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
