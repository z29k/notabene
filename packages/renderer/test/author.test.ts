import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthor, setAuthor } from "../src/lib/client/comments-client";

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

describe("author identity (getAuthor / setAuthor)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the fallback when no per-device name is set", () => {
    mockLocalStorage();
    expect(getAuthor("t")).toBe("t");
    expect(getAuthor()).toBe("you");
  });

  it("prefers the stored per-device name over the fallback", () => {
    mockLocalStorage();
    setAuthor("Alex");
    expect(getAuthor("t")).toBe("Alex");
  });

  it("trims the name, and clearing removes the override", () => {
    const store = mockLocalStorage();
    setAuthor("  Sam  ");
    expect(getAuthor("t")).toBe("Sam");
    setAuthor("   ");
    expect(store.has("notabene:author")).toBe(false);
    expect(getAuthor("t")).toBe("t");
  });

  it("falls back gracefully when localStorage is unavailable", () => {
    // no stub → `localStorage` is undefined in node → getAuthor swallows and uses fallback
    expect(getAuthor("t")).toBe("t");
  });
});
