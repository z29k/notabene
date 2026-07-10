---
description: Stop the detached notabene review server for this repo.
allowed-tools: Bash(node:*)
---

Stop the notabene review server daemon for this repo (SIGTERMs its process group and
clears the pidfile).

!`node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" stop`
