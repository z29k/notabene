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
  tokens: { accent: "#7c3aed", radius: "4px" },   // quick overrides, no file needed
  css: "docs/notabene-theme.css",                 // or/and a full stylesheet
},
```

Both target the same contract; a typo'd token name **throws at startup** (never a silent
no-op). The renderer's own styles live in CSS cascade layers, so your un-layered CSS
**always wins** — no specificity war, no ordering luck.

## The token contract (`--nb-*`)

These custom properties are the **public theming surface** — stable across versions:

| Token | Light default | Role |
| --- | --- | --- |
| `bg` / `bg-soft` / `bg-elev` | `#ffffff` / `#f6f7f9` / `#ffffff` | Page, panels, elevated surfaces |
| `border` | `#e4e7ec` | Hairlines |
| `text` / `text-soft` / `text-faint` | `#1c2024` / `#5b6470` / `#8a929e` | Foregrounds |
| `accent` / `accent-soft` | `#2f6feb` / `#e8f0ff` | Links, focus, highlights |
| `ref` / `work` | `#2f6feb` / `#b5651d` | Space chips in search results |
| `code-bg` | `#0d1117` | Code block background |
| `topbar-h` / `sidebar-w` / `toc-w` / `content-max` | `52px` / `290px` / `320px` / responsive | Layout |
| `radius` | `8px` | Corner rounding |
| `sans` / `mono` | system stacks | Font families |

Dark mode redefines the color tokens under `@media (prefers-color-scheme: dark)` — a
theme that changes colors should do the same:

```css
/* docs/notabene-theme.css */
:root { --nb-accent: #7c3aed; --nb-accent-soft: #f1e9ff; }
@media (prefers-color-scheme: dark) {
  :root { --nb-accent: #b79bff; --nb-accent-soft: #241a3d; }
}
```

## Beyond tokens

Your stylesheet can also target a small set of **stable hooks**: `.topbar`, `.brand`,
`.sidebar`, `.prose` (the rendered content), `.home-cards`, `.rail`. Everything else —
and every un-prefixed CSS variable — is **internal** and may change between versions.

Two rules keep you safe:

- **Only override `--nb-*` tokens and the hooks above.** In particular, never touch the
  un-prefixed variables: the print/PDF views force a light palette through them, so a
  token-only theme can restyle the whole site without ever breaking the
  [PDF export](./pdf-export.md).
- Check both color schemes — the switcher is your system's light/dark setting.

Themes apply everywhere: dev, normal builds, [public sites](./publish/index.md) and the
print views (colors excepted, by design).
