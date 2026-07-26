---
title: Customize the look
description: Branding assets, the --nb-* token contract, and your own stylesheet — theme the site without forking it.
sidebar:
  label: Customize the look
  order: 4
---

# Customize the look

notabene runs from the package — you never fork its UI. Instead, three layers of
customization, all config-driven:

1. **[Branding](./configuration.md#branding)** — logo, favicon, social image.
2. **Design tokens** — override the `--nb-*` custom properties (below).
3. **Your own stylesheet** — a CSS file loaded after the renderer's styles.

```js
theme: {
  // Quick overrides, no file needed. A plain value applies to BOTH color schemes;
  // a light-dark() pair customizes each: light on the left, dark on the right.
  tokens: { accent: "light-dark(#7c3aed, #b79bff)", radius: "4px" },
  css: "docs/notabene-theme.css",                 // or/and a full stylesheet
},
```

Both target the same contract; a typo'd token name **throws at startup** (never a silent
no-op). The renderer's own styles live in CSS cascade layers, so your un-layered CSS
**always wins** — no specificity war, no ordering luck.

## The token contract (`--nb-*`)

These custom properties are the **public theming surface** — stable across versions.
Color defaults are given as their `light-dark(light, dark)` pair:

| Token | Default (light / dark) | Role |
| --- | --- | --- |
| `bg` | `#ffffff` / `#0e1116` | Page background |
| `bg-soft` | `#f6f7f9` / `#151a21` | Panels, inputs |
| `bg-elev` | `#ffffff` / `#161b22` | Elevated surfaces (topbar, popovers) |
| `border` | `#e4e7ec` / `#272e38` | Hairlines |
| `text` | `#1c2024` / `#e7ebf0` | Primary foreground |
| `text-soft` | `#5b6470` / `#aab2bd` | Secondary foreground |
| `text-faint` | `#8a929e` / `#768091` | Tertiary foreground |
| `accent` | `#2f6feb` / `#6ea0ff` | Links, focus, highlights |
| `accent-soft` | `#e8f0ff` / `#182539` | Accent backgrounds |
| `ref` / `work` | `#2f6feb` / `#6ea0ff` · `#b5651d` / `#e0a060` | Space chips in search results |
| `code-bg` | `#0d1117` / `#0b0e13` | Code block background (code stays dark in both schemes — Shiki colors are baked light-on-dark) |
| `topbar-h` / `sidebar-w` / `toc-w` / `content-max` | `52px` / `290px` / `320px` / responsive | Layout (scheme-invariant) |
| `radius` | `8px` | Corner rounding |
| `sans` / `mono` | system stacks | Font families |

Every color token is a **`light-dark()` pair** — one declaration covers both schemes,
and the header's **scheme toggle** (auto / light / dark, persisted per browser) flips
them all at once. A theme that changes colors does the same:

```css
/* docs/notabene-theme.css */
:root {
  --nb-accent: light-dark(#7c3aed, #b79bff);
  --nb-accent-soft: light-dark(#f1e9ff, #241a3d);
}
```

The toggle works through `color-scheme` + a `data-scheme` attribute the renderer sets
on `<html>` — a theme must **not** set that attribute (or `color-scheme` on `:root`);
override tokens, and the toggle keeps working for free. `light-dark()` covers colors
only; for the rare non-color per-scheme styling, *selecting* on
`:root[data-scheme="dark"]` in your stylesheet is fine — it's *setting* the attribute
that's reserved.

## Beyond tokens

Your stylesheet can also target a small set of **stable hooks**: `.topbar`, `.brand`,
`.sidebar`, `.prose` (the rendered content), `.home-cards`, `.rail`. Everything else —
and every un-prefixed CSS variable — is **internal** and may change between versions.

Two rules keep you safe:

- **Only override `--nb-*` tokens and the hooks above.** In particular, never touch the
  un-prefixed variables: the print/PDF views force a light palette through them, so a
  token-only theme can restyle the whole site without ever breaking the
  [PDF export](./pdf-export.md).
- Check both color schemes — the header toggle makes that a two-click test.

Themes apply everywhere: dev, normal builds, [public sites](./publish/index.md) and the
print views (colors excepted, by design).
