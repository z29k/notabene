// Client init for the /print routes. Native browser print — NO pagination library:
// the document is styled by print.css and the browser's "Save as PDF" turns it into a
// PDF. We only need to (1) render Mermaid diagrams to SVG (they're client-rendered) and
// (2) wire the toolbar's print button. The higher-fidelity artifact (real PDF bookmark
// outline, running headers/footers) is produced headlessly by `notabene pdf`.
import { renderMermaid } from "./mermaid";

async function init(): Promise<void> {
  // Force the light Mermaid theme: the print page is always white, so a dark-themed
  // diagram (dark nodes on the viewer's dark OS) would be unreadable here / in the PDF.
  await renderMermaid({ forceLight: true }).catch((err) => console.error("[notabene] mermaid render failed:", err));
  const status = document.getElementById("pg-status");
  if (status) status.textContent = "";

  document.getElementById("pg-print")?.addEventListener("click", () => window.print());

  // Signal to `notabene pdf` (headless Chromium) that diagrams are rendered and the page
  // is ready to be captured — it waits for `body[data-pg-ready]` before calling page.pdf().
  document.body.dataset.pgReady = "1";

  // ?autoprint=1 — a "print now" link: open the dialog once diagrams have settled.
  if (new URLSearchParams(location.search).get("autoprint") === "1") {
    setTimeout(() => window.print(), 250);
  }
}

init();
