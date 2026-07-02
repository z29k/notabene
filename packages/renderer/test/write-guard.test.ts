import { describe, expect, it } from "vitest";
import { hostnameOf, isLoopbackHostname, writeGuardVerdict } from "../src/lib/write-guard";

const base = {
  writable: true,
  hostMode: false,
  token: "",
  origin: null as string | null,
  host: "localhost:3009" as string | null,
  tokenHeader: null as string | null,
};

describe("isLoopbackHostname", () => {
  it("accepts loopback forms", () => {
    for (const h of ["localhost", "127.0.0.1", "::1", "[::1]", "LOCALHOST"]) {
      expect(isLoopbackHostname(h)).toBe(true);
    }
  });
  it("rejects non-loopback", () => {
    for (const h of ["evil.com", "192.168.1.5", "0.0.0.0", "example.localhost"]) {
      expect(isLoopbackHostname(h)).toBe(false);
    }
  });
});

describe("hostnameOf", () => {
  it("strips port + brackets, lowercases", () => {
    expect(hostnameOf("localhost:3009")).toBe("localhost");
    expect(hostnameOf("[::1]:3009")).toBe("::1");
    expect(hostnameOf("EVIL.COM")).toBe("evil.com");
    expect(hostnameOf(null)).toBe("");
  });
});

describe("writeGuardVerdict", () => {
  it("refuses when writing is disabled (outside dev)", () => {
    expect(writeGuardVerdict({ ...base, writable: false }).ok).toBe(false);
  });
  it("allows a legit loopback request", () => {
    expect(writeGuardVerdict({ ...base, origin: "http://localhost:3009" }).ok).toBe(true);
  });
  it("allows when Origin is absent but Host is loopback", () => {
    expect(writeGuardVerdict({ ...base, origin: null }).ok).toBe(true);
  });
  it("refuses a cross-origin write (CSRF)", () => {
    const v = writeGuardVerdict({ ...base, origin: "http://evil.com" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/cross-origin/);
  });
  it("refuses a non-loopback Host (DNS-rebinding) in loopback mode", () => {
    expect(writeGuardVerdict({ ...base, host: "evil.com", origin: null }).ok).toBe(false);
  });
  it("refuses a malformed Origin", () => {
    expect(writeGuardVerdict({ ...base, origin: "notaurl" }).ok).toBe(false);
  });
  it("in --host mode allows a same-Host Origin and skips the loopback-Host check", () => {
    const v = writeGuardVerdict({
      ...base,
      hostMode: true,
      host: "192.168.1.5:3009",
      origin: "http://192.168.1.5:3009",
    });
    expect(v.ok).toBe(true);
  });
  it("in --host mode still refuses a cross-site Origin", () => {
    const v = writeGuardVerdict({
      ...base,
      hostMode: true,
      host: "192.168.1.5:3009",
      origin: "http://evil.com",
    });
    expect(v.ok).toBe(false);
  });
  it("enforces the shared token when configured", () => {
    expect(writeGuardVerdict({ ...base, token: "s3cret", tokenHeader: null }).ok).toBe(false);
    expect(writeGuardVerdict({ ...base, token: "s3cret", tokenHeader: "wrong" }).ok).toBe(false);
    expect(writeGuardVerdict({ ...base, token: "s3cret", tokenHeader: "s3cret" }).ok).toBe(true);
  });
});
