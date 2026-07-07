---
description: Process the review comments on the docs (notabene review loop).
argument-hint: "[extra instructions]"
---

Use the **notabene** skill to process the open review comments in this repo: read the
`.notabene/` store, apply each comment's feedback to the docs faithfully, mark them
resolved (or **addressed** in approve mode), append the journal, then verify (renderer
build + the project's `verify[]` checks). Ignore comments on hold. Report as a table and
**never commit without an explicit request**.

$ARGUMENTS
