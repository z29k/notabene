---
description: Start (or reuse) the notabene review server in the background and print its URL.
argument-hint: "[--port N] [--host]"
allowed-tools: Bash(node:*)
---

Start the notabene review server for this repo as a **detached daemon** and report the
URL. Idempotent — if one of the same renderer version is already running for this repo it
just prints the existing URL; one left by an older plugin version is restarted on this one.
The first run fetches the renderer (~30 s); after that it's fast. Then it returns (the
server keeps running in the background).

!`node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" dev --detach $ARGUMENTS`

Report the URL from the output. If it says the port isn't responding yet, tell the user to
check the log path shown, or re-run `/notabene:status`.
