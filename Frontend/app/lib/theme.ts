/**
 * Theme state: System / Light / Dark, written as `data-theme` on <html>.
 * Ported from Strata (`Strata-xeno Web/components/Nav.tsx` ThemeToggle + `app/layout.tsx:46`), with one change:
 * MangaDock defaults to DARK, not to the system preference.
 */
export type Theme = "dark" | "light" | "system";

export const THEME_STORAGE_KEY = "md-theme";
const THEMES: readonly Theme[] = ["dark", "light", "system"];

export function readTheme(storage: { getItem(key: string): string | null }): Theme {
  try {
    const v = storage.getItem(THEME_STORAGE_KEY);
    return (THEMES as readonly string[]).includes(v ?? "") ? (v as Theme) : "dark";
  } catch {
    return "dark";
  }
}

/** `system` leaves the attribute off so `prefers-color-scheme` decides in CSS. */
export function attributeFor(theme: Theme): "dark" | "light" | null {
  return theme === "system" ? null : theme;
}

export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

/** Inlined in <head>: sets the theme and the `js` class before first paint (no flash, Strata P2). */
export const themeBootScript = `(function(){var h=document.documentElement;h.classList.add("js");var t="dark";try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="dark"||s==="light"||s==="system")t=s}catch(e){}if(t==="system")h.removeAttribute("data-theme");else h.setAttribute("data-theme",t)})();`;

export function applyTheme(theme: Theme) {
  const attr = attributeFor(theme);
  const html = document.documentElement;
  if (attr) html.setAttribute("data-theme", attr);
  else html.removeAttribute("data-theme");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Fired by applyTheme so every toggle on the page re-reads the choice (useSyncExternalStore). */
export const THEME_EVENT = "md-theme-change";

export function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
