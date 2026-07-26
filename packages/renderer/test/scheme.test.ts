import { describe, expect, it } from "vitest";
import { nextPref, normalizeScheme } from "../src/lib/client/scheme";

describe("normalizeScheme", () => {
  it("keeps the two valid values", () => {
    expect(normalizeScheme("light")).toBe("light");
    expect(normalizeScheme("dark")).toBe("dark");
  });
  it("maps anything else to auto (null)", () => {
    expect(normalizeScheme(null)).toBeNull();
    expect(normalizeScheme("")).toBeNull();
    expect(normalizeScheme("Dark")).toBeNull();
    expect(normalizeScheme("system")).toBeNull();
    expect(normalizeScheme(42)).toBeNull();
  });
});

describe("nextPref", () => {
  it("cycles auto → light → dark → auto", () => {
    expect(nextPref(null)).toBe("light");
    expect(nextPref("light")).toBe("dark");
    expect(nextPref("dark")).toBeNull();
  });
});
