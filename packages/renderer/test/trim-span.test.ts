import { describe, expect, it } from "vitest";
import { trimSpan } from "../src/lib/client/comments-client";

// The flat text of an article: a heading, the inter-block newline, a table.
const text = "Intro.\n2. Indicateurs\nAxeIndicateur";
const h = text.indexOf("2.");
const next = text.indexOf("Axe");

describe("trimSpan", () => {
  it("drops the inter-block newline a block selection drags along", () => {
    // Triple-click on the heading: the range ends at the START of the next block.
    const [s, e] = trimSpan(text, h, next);
    expect(text.slice(s, e)).toBe("2. Indicateurs");
  });

  it("trims leading whitespace too", () => {
    const [s, e] = trimSpan(text, h - 1, h + 2);
    expect(text.slice(s, e)).toBe("2.");
  });

  it("leaves a tight span untouched", () => {
    expect(trimSpan(text, h, h + 2)).toEqual([h, h + 2]);
  });

  it("never turns an unplaceable boundary into the rest of the page", () => {
    // -1 was what an element boundary used to resolve to: slice(h, -1) = everything after h.
    expect(trimSpan(text, h, -1)).toEqual([0, 0]);
    expect(trimSpan(text, -1, next)).toEqual([0, 0]);
    expect(trimSpan(text, next, h)).toEqual([0, 0]);
    expect(trimSpan(text, h, text.length + 1)).toEqual([0, 0]);
  });

  it("collapses an all-whitespace span", () => {
    const [s, e] = trimSpan("a \n b", 1, 4);
    expect(e - s).toBe(0);
  });
});
