---
title: Safety model
description: Why the write API can't hurt you — dev-only, loopback-bound, gated writes, identity per person.
sidebar:
  label: Safety model
  order: 5
---

# Safety model

The comments API writes into your git — so it's fenced in, by construction:

- **Dev-only.** The write path only exists under `notabene dev`. In `build`/`preview`
  mutations return `403`, and a [public build](../guide/publish/index.md) doesn't contain
  the routes at all.
- **Loopback by default.** The server binds `127.0.0.1`; the write API is not reachable
  from your network unless you opt in with `--host` / `NOTABENE_HOST=1` — trusted
  networks only.
- **Every write is gated** beyond the bind: cross-origin requests are refused
  (anti-CSRF), a non-loopback `Host` header is refused in loopback mode
  (anti-DNS-rebinding), and — when you set `NOTABENE_TOKEN` — each write must carry a
  matching `x-notabene-token`. Setting a token is **recommended with `--host`**.
- **Identity per person.** On a non-loopback host, each visitor is asked to set their
  name (+ optional email) before browsing, so comments attribute to real people rather
  than the repo owner's git default.
- **The agent never commits without asking** and never bulk-deletes the store — that's
  part of the [protocol](./store-contract.md).

The public artifact is the mirror image: no write API, no store data, no identity —
[nothing to gate, because nothing is built](../guide/publish/private-content.md#the-guarantee).
