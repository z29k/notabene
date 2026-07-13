import { describe, expect, it } from "vitest";
import { centeredView, clamp, fitScale, initialView, panBy, zoomAround, zoomBounds } from "../src/lib/pan-zoom";

describe("clamp", () => {
  it("bounds within [lo,hi]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe("fitScale", () => {
  it("uses the tighter axis", () => {
    expect(fitScale({ w: 200, h: 100 }, { w: 400, h: 400 })).toBe(2); // min(2, 4)
    expect(fitScale({ w: 400, h: 100 }, { w: 400, h: 400 })).toBe(1); // min(1, 4)
  });
  it("returns 1 for a degenerate (zero) natural size", () => {
    expect(fitScale({ w: 0, h: 0 }, { w: 400, h: 400 })).toBe(1);
  });
});

describe("zoomBounds", () => {
  it("spans half-fit … 16×-fit, floored at 4 and capped at 64", () => {
    expect(zoomBounds(2)).toEqual({ min: 1, max: 32 });
    expect(zoomBounds(0.1)).toEqual({ min: 0.05, max: 4 }); // 16×0.1=1.6 → floored to 4
    expect(zoomBounds(10)).toEqual({ min: 5, max: 64 }); // 16×10=160 → capped to 64
  });
  it("guards a non-positive fit", () => {
    expect(zoomBounds(0)).toEqual({ min: 0.5, max: 16 });
  });
});

describe("centeredView / initialView", () => {
  it("centers content in the viewport", () => {
    expect(centeredView(1, { w: 100, h: 100 }, { w: 300, h: 300 })).toEqual({ scale: 1, tx: 100, ty: 100 });
  });
  it("fits + upscales a diagram, but never upscales a small image", () => {
    // small content, big viewport: fit would be >1
    const diagram = initialView({ w: 100, h: 100 }, { w: 400, h: 400 }, true);
    expect(diagram.scale).toBe(4);
    const image = initialView({ w: 100, h: 100 }, { w: 400, h: 400 }, false);
    expect(image.scale).toBe(1); // capped at 1×, then centered
    expect(image).toEqual({ scale: 1, tx: 150, ty: 150 });
  });
});

describe("zoomAround", () => {
  it("keeps the content point under the cursor fixed", () => {
    const before = { scale: 1, tx: 0, ty: 0 };
    const contentPt = (p: number, v: { scale: number; t: number }) => (p - v.t) / v.scale;
    const px = 50;
    const py = 80;
    const pre = {
      x: contentPt(px, { scale: before.scale, t: before.tx }),
      y: contentPt(py, { scale: before.scale, t: before.ty }),
    };
    const after = zoomAround(before, 2, px, py, 0.1, 10);
    expect(after.scale).toBe(2);
    const post = {
      x: contentPt(px, { scale: after.scale, t: after.tx }),
      y: contentPt(py, { scale: after.scale, t: after.ty }),
    };
    expect(post.x).toBeCloseTo(pre.x);
    expect(post.y).toBeCloseTo(pre.y);
  });
  it("clamps the scale to bounds but still anchors the point", () => {
    const after = zoomAround({ scale: 1, tx: 0, ty: 0 }, 100, 40, 40, 0.1, 8);
    expect(after.scale).toBe(8); // clamped
    // point under (40,40) was content (40,40); after: (40 - tx)/8 must still be 40
    expect((40 - after.tx) / 8).toBeCloseTo(40);
  });
});

describe("panBy", () => {
  it("translates without changing scale", () => {
    expect(panBy({ scale: 3, tx: 10, ty: 20 }, 5, -7)).toEqual({ scale: 3, tx: 15, ty: 13 });
  });
});
