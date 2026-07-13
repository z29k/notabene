// Pure pan/zoom math for the lightbox viewer (lib/client/lightbox.ts). DOM-free so it's
// unit-tested (test/pan-zoom.test.ts). A "view" is the affine state applied to the content
// layer as `translate(tx, ty) scale(scale)`, in viewport (stage) pixels. The content's
// own box is its *natural* size, so `scale` reads as content-pixels-per-natural-pixel
// (100% = natural size), the same mental model as an image viewer.

export interface Size {
  w: number;
  h: number;
}
export interface View {
  scale: number;
  tx: number;
  ty: number;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Largest scale at which `nat` (natural content size) fits inside `vp` (viewport). */
export function fitScale(nat: Size, vp: Size): number {
  if (nat.w <= 0 || nat.h <= 0) return 1;
  return Math.min(vp.w / nat.w, vp.h / nat.h);
}

/** Zoom bounds derived from the fit scale: down to half-fit, up to 16×-fit (never absurd). */
export function zoomBounds(fit: number): { min: number; max: number } {
  const f = fit > 0 ? fit : 1;
  return { min: f * 0.5, max: Math.min(64, Math.max(4, f * 16)) };
}

/** A view placing `nat` at `scale`, centered in `vp`. */
export function centeredView(scale: number, nat: Size, vp: Size): View {
  return { scale, tx: (vp.w - nat.w * scale) / 2, ty: (vp.h - nat.h * scale) / 2 };
}

/**
 * Initial view on open: fit the content and center it — but only upscale past 1× when
 * `allowUpscale` (vector diagrams stay crisp filling the stage; raster images shouldn't
 * balloon past their pixels).
 */
export function initialView(nat: Size, vp: Size, allowUpscale: boolean): View {
  const fit = fitScale(nat, vp);
  return centeredView(allowUpscale ? fit : Math.min(fit, 1), nat, vp);
}

/**
 * Multiply the scale by `factor` (clamped to [min,max]) while keeping the content point
 * currently under viewport pixel (px,py) pinned there. The invariant is that the content
 * coordinate under the cursor, (p - t) / scale, is held constant across the zoom:
 *   t' = p - k·(p - t),   with k = scale' / scale.
 */
export function zoomAround(v: View, factor: number, px: number, py: number, min: number, max: number): View {
  const scale = clamp(v.scale * factor, min, max);
  const k = scale / v.scale;
  return { scale, tx: px - k * (px - v.tx), ty: py - k * (py - v.ty) };
}

/** Translate the view by (dx,dy) viewport pixels. */
export function panBy(v: View, dx: number, dy: number): View {
  return { scale: v.scale, tx: v.tx + dx, ty: v.ty + dy };
}
