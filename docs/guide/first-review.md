---
title: Your first review
description: From a comment on the rendered page to a journaled edit in your git — the core loop, step by step.
sidebar:
  label: Your first review
  order: 2
---

# Your first review

You have [installed](./install.md) the renderer and run `npx notabene dev`. Here's the
whole loop once, end to end.

## 1 · Comment the rendered page

Open `http://localhost:3009`, browse to any page, and **select a passage** — an action
bar appears; leave your comment right there. You can also:

- comment a **whole page** (the comment box at the bottom of each page);

- comment a **whole diagram or image** — hover it and use the 💬 in the toolbar
  (the ⤢ next to it opens a pan/zoom lightbox);

- **reply** in threads, put a comment **on hold** (⏸ — the agent will skip it), and see
  everything across pages at **`/comments`**.

On a phone or tablet the same loop works touch-first: the nav folds into a drawer,
comments become bottom sheets, and you can select text and comment with your thumb.
Drag a sheet's handle up to expand it, down to dismiss it.

## 2 · Hand the comments to your agent

Tell your agent — with the Claude Code plugin it's just:

> address the doc comments

The agent reads the `.notabene/` store directly (no server needed), locates each
commented passage in the **source** file, applies the feedback faithfully, marks the
comment **resolved**, and appends a **journal** entry linking *what changed* to *why*.
It then verifies: the renderer build always runs, plus any checks you list in
[`verify[]`](../reference/config.md). It never commits without asking.

## 3 · Read the trail

- **`/journal`** — every pass, with what/why/which comments per page.
- Each resolved comment links its journal entry.

Want to **validate each edit yourself** before it counts as resolved — with the real git
diff? That's approve mode: see [the review loop](./review-loop.md).

## Working with several reviewers

Comments carry an **identity** (name + optional email), set per browser via the 👤 chip
in the header — so threads attribute per person, not per machine. The store is
**one JSON file per comment**, so parallel branches merge without conflicts.
