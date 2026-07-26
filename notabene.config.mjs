// notabene, reviewed and published by notabene (dogfood). This repo is its own
// consumer: `docs/` holds the user documentation, reviewed with the local loop
// (`node packages/renderer/bin/notabene.mjs dev`) and published to GitHub Pages
// by .github/workflows/docs.yml (`build --public` → z29k.github.io/notabene).
export default {
  siteName: "notabene",
  tagline: "note this well",
  locale: "en",
  format: "commonmark",

  roots: [
    {
      key: "guide",
      label: "Guide",
      path: "docs/guide",
      description: "Install notabene, run your first review loop, and grow into every feature.",
    },
    {
      key: "reference",
      label: "Reference",
      path: "docs/reference",
      description: "The exhaustive surfaces: CLI, config keys, frontmatter, the store contract, safety.",
    },
  ],

  store: "docs/.notabene",

  // Custom landing page: rendered above the space cards on "/" (README-like welcome,
  // written for the site — relative links become routes). Deliberately OUTSIDE the
  // two spaces so it isn't also a doc page.
  home: "docs/home.md",

  // Dogfood the flagship feature: agent proposes, humans validate at /review.
  review: "approve",

  publish: { site: "https://z29k.github.io", base: "/notabene" },
};
