import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../src/lib/comment-types";
import { assertVersionSupported } from "../src/lib/store-meta";

describe("assertVersionSupported", () => {
  it("accepts the current and older versions", () => {
    expect(() => assertVersionSupported(SCHEMA_VERSION)).not.toThrow();
    expect(() => assertVersionSupported(SCHEMA_VERSION - 1)).not.toThrow();
  });
  it("accepts an absent/unknown version (uncommitted obligation)", () => {
    expect(() => assertVersionSupported(undefined)).not.toThrow();
    expect(() => assertVersionSupported("weird")).not.toThrow();
  });
  it("throws on a store newer than this renderer", () => {
    expect(() => assertVersionSupported(SCHEMA_VERSION + 1)).toThrow(/newer than this renderer/);
  });
  it("respects an explicit supported ceiling", () => {
    expect(() => assertVersionSupported(3, 2)).toThrow();
    expect(() => assertVersionSupported(2, 2)).not.toThrow();
  });
});
