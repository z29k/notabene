---
title: Editing in the page
description: Fix a block of prose where you are reading it — and let that same save close the comments it answers and journal the change.
sidebar:
  label: Editing in the page
  order: 6
---

# Editing in the page

The review loop gives an agent a way to write. This gives *you* one, without leaving the
page you are reading.

Click a paragraph and you are editing it. No mode to turn on, no box replacing the text:
the block stays exactly where it was, in the page's own typography, and a caret appears
where you clicked. Only that block's source is rewritten — the rest of the file is not
touched, so the diff your teammates review is the one line you actually changed.

It is a **dev-only** tool, exactly like commenting: the write API exists under
`notabene dev` and nowhere else. A built or published site has no editor, no endpoint,
and no trace of one.

## The gestures

Two intentions, two gestures — which is why there is no mode switch:

| You do | You get |
|---|---|
| **Click** a block | you are editing it, caret where you clicked |
| **Select** text | the comment popover, exactly as before |
| Select text *while editing* | a small formatting toolbar, at the selection |
| **Escape**, or click elsewhere | done — the change is written if there is one |
| `⌘Z` | undo your typing, as anywhere else |
| `⌘⇧M` | swap to raw Markdown for that block, and back |

There is no Save button: leaving a block commits it, the way a document editor does.
Nothing changed means nothing is written, so moving around the page never touches the repo.
Hovering a block shows a small ✎ in the margin — that is the whole chrome.

Everything around the block stays rendered while you type: the comment rail, the
highlights, the table of contents, the diagrams. That is the point — you are meant to be
reading a comment while you fix the sentence it is about.

## Closing the loop

Once you have actually changed something, a muted line appears under the block: the open
comments on that page, and a place to describe the change. Tick the comments your edit
answers and they are **resolved** by the same save, linked to a journal entry — the same
registry an agent pass writes to. Nothing appears until there is something to attach it to.

In `review: "approve"` mode, a comment you close this way goes straight to `resolved`, not
`addressed`: you edited the page, so you are the validator that mode is waiting for. On the
`/review` page, every card carries a **Fix in page** link that drops you directly onto the
block the comment is about, in edit mode — approve by correcting, in one click.

`notabene comments verify` audits what you wrote exactly as it audits an agent's pass.

## What it refuses to do

The editor writes into your content, so it is deliberately hard to make it do something
you did not mean:

- **It will not disturb a neighbouring block.** After splicing your text in, it re-parses
  the file and checks that every other top-level block comes back byte-identical. Turning a
  paragraph into a list next to an existing list would merge the two; an unterminated code
  fence would swallow the rest of the page. Both are refused, and nothing is written. When
  the merge is what you actually wanted, the refusal offers to **include the next block**
  and retry.
- **It will not edit what it cannot represent.** Only blocks the renderer could tag are
  editable; raw HTML and JSX blocks stay read-only and simply never light up.
- **It will not write a file git is not tracking**, because then the edit could not be
  undone. The message tells you to `git add` it. Set `edit: { requireGit: false }` if you
  really want to edit outside version control.
- **It warns before it breaks an anchor.** If your edit removes the text a comment is
  quoting, the line under the block says so while you type — that comment would be orphaned.

## Images

Paste an image into the editor and it is written into the repo next to the page, with a
content-hashed name, and the Markdown link is inserted for you. It lands in the same commit
as the prose that references it.

## Configuration

```js
export default {
  edit: {
    enabled: true,      // default — set false to hide the editor entirely
    requireGit: true,   // default — refuse to write a file git isn't tracking
  },
  roots: [
    { key: "reference", path: "docs/reference", edit: false },  // read-only space
  ],
};
```

`notabene doctor` reports the state, including the one combination that would refuse every
save: editing on, `requireGit` on, and no git repository.

## What it is not

Not a CMS. There is no editor in a deployed site, no media library, no frontmatter editing,
and no real-time collaboration — **git is the merge layer**. Editing a page in one language
does not touch its translations; those stay an explicit act.
