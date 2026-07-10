---
description: Report whether the notabene review server is running (pid, port, URL) + open comment count.
argument-hint: "[--json]"
allowed-tools: Bash(node:*)
---

Report whether the notabene review server is running for this repo, and how many comments
are open.

!`node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" status $ARGUMENTS`
!`node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" comments ls --open --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log("open comments:",JSON.parse(s).length)}catch{console.log("open comments: (store not readable)")}})'`

Summarize: running or not (with the URL if running), and the open-comment count.
