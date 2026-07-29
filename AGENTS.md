# Agent instructions

This repo *is* notabene (renderer + review protocol) and its own consumer: `docs/` holds
the user documentation, reviewed with the loop itself. Architecture, conventions and the
quality gates live in [CLAUDE.md](./CLAUDE.md) — read that before changing code. The
protocol is documented in `docs/reference/agent-protocol.md` (canonical) and generated
from there into the plugin skills and the npm package; never edit a generated copy.

<!-- notabene:begin -->
## Documentation review (notabene)

Review comments on this repo's docs live in `docs/.notabene/` — one JSON file per comment,
committed with the code. When asked to "address the doc comments" (or anything
equivalent), follow the notabene review protocol:

- **The protocol**: `docs/.notabene/protocol.md` — read it first; it is the
  complete spec (store layout, anchor resolution, journaling, verification).
- Online copy: <https://z29k.github.io/notabene/reference/agent-protocol/>

Non-negotiable: only process comments with `status: "open"` and `hold: false`; never
delete the store; never commit without being asked.
<!-- notabene:end -->
