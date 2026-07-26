---
title: Frontmatter
description: Every key a page can carry — titles, sidebar placement, public-build metadata and scoping.
sidebar:
  label: Frontmatter
  order: 3
---

# Frontmatter

Optional YAML at the very top of a page. Everything has a sensible default — a repo with
zero frontmatter renders fine (humanized file names, alphabetical order).

```yaml
---
title: Internal network map        # page <title> + breadcrumb (overrides the first H1)
description: Segments and VLANs.   # public builds: meta description + OpenGraph + JSON-LD
publish: false                     # public builds: keep this page out entirely
lastUpdated: 2026-05-04            # page footer: overrides the git "Updated on" date
sidebar:
  label: Network map               # sidebar text (else title, else humanized file name)
  order: 9                         # position among siblings (ascending)
  indexLabel: Start here           # folder landing pages: rename the "Overview" entry
---
```

| Key | Effect |
| --- | --- |
| `title` | Page `<title>`, breadcrumb, search result title. Falls back to the first `# H1`, then the file name |
| `description` | [Public builds](../guide/publish/index.md): `<meta name="description">`, OpenGraph/Twitter description, JSON-LD |
| `publish: false` | [Public builds](../guide/publish/private-content.md): the page is **not built** — no route, nav, search, llms, twin, sitemap. Dev/normal builds always show it |
| `lastUpdated` | Overrides the [git-derived date](../guide/configuration.md#page-footer-edit-link--last-updated) in the page footer's *Updated on*. Any date YAML can parse. Useful when git history misleads (imported or generated content) |
| `sidebar.label` | Sidebar entry text. Resolution: `sidebar.label` → `title` → humanized file name |
| `sidebar.order` | Sort key among siblings, ascending. Unset entries keep alphabetical order, after the ordered ones. Groups and pages share one ordering |
| `sidebar.indexLabel` | On a folder's landing page: renames its localized *Overview* entry |

## Folders

A **folder** is named and positioned by its landing page — `<folder>/index.md` (or
`readme.md`): its `sidebar` frontmatter applies to the whole group, and the page itself
appears as the group's *Overview* entry. Labels and order flow through to breadcrumbs
and [PDF covers](../guide/pdf-export.md).

Unknown keys are ignored and preserved — agents editing a page must keep the existing
frontmatter intact (the review skill does).
