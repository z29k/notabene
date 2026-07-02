// Inline icons (Lucide, MIT) as SVG strings — comment cards are rendered in JS
// (innerHTML), so no Astro component here. Monochrome (stroke = currentColor) →
// they inherit the button's color.
const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  reopen: svg('<path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>'),
  pause: svg('<rect x="14" y="3" width="4" height="18" rx="1"/><rect x="6" y="3" width="4" height="18" rx="1"/>'),
  play: svg('<polygon points="6 3 20 12 6 21 6 3"/>'),
  reply: svg('<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  trash: svg(
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  ),
};
