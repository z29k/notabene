// Manual light/dark scheme — the client side of the `color-scheme`/`light-dark()`
// mechanism in styles/global.css. The STORED preference is tri-state: null (auto,
// follow the system) | "light" | "dark", persisted per browser as localStorage
// "nb-scheme" and applied as [data-scheme] on <html> (pre-paint by DocLayout's
// inline head script; live by applyPref). `nb-scheme-change` fires on <html> so
// scheme-sensitive JS (Mermaid) can re-render. Pure helpers are unit-tested.

export type Scheme = "light" | "dark";
/** null = auto (follow the system). */
export type SchemePref = Scheme | null;

export const SCHEME_KEY = "nb-scheme";

/** Pure: anything that isn't exactly "light"/"dark" is auto. */
export function normalizeScheme(value: unknown): SchemePref {
  return value === "light" || value === "dark" ? value : null;
}

/** Pure: the toggle cycle — auto → light → dark → auto. */
export function nextPref(current: SchemePref): SchemePref {
  return current === null ? "light" : current === "light" ? "dark" : null;
}

export function storedPref(): SchemePref {
  try {
    return normalizeScheme(localStorage.getItem(SCHEME_KEY));
  } catch {
    return null;
  }
}

/** The scheme actually in effect: the stored preference, else the system's. */
export function effectiveScheme(): Scheme {
  const pref = storedPref();
  if (pref) return pref;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Persist + apply a preference and notify scheme-sensitive code. */
export function applyPref(pref: SchemePref): void {
  try {
    if (pref) localStorage.setItem(SCHEME_KEY, pref);
    else localStorage.removeItem(SCHEME_KEY);
  } catch {
    /* storage unavailable → the attribute still applies for this page */
  }
  const el = document.documentElement;
  if (pref) el.setAttribute("data-scheme", pref);
  else el.removeAttribute("data-scheme");
  document.dispatchEvent(new CustomEvent("nb-scheme-change"));
}
