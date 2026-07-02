// Minimal config so modules that import src/config.mjs load during tests.
export default {
  siteName: "Test",
  locale: "en",
  format: "commonmark",
  roots: [{ key: "docs", label: "Docs", path: "docs" }],
  store: "docs/.notabene",
};
