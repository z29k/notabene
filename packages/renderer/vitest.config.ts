import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Some modules under test transitively load the consumer config (src/config.mjs reads
// NOTABENE_ROOT/NOTABENE_CONFIG at import time) — point those at a fixture so the
// imports resolve. `astro:content` is a virtual module that only exists in an Astro
// build, so stub it for the couple of tests that touch nav.ts.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    env: {
      NOTABENE_ROOT: fileURLToPath(new URL("./test/fixtures", import.meta.url)),
      NOTABENE_CONFIG: fileURLToPath(new URL("./test/fixtures/notabene.config.mjs", import.meta.url)),
    },
  },
  resolve: {
    alias: {
      "astro:content": fileURLToPath(new URL("./test/stubs/astro-content.ts", import.meta.url)),
    },
  },
});
