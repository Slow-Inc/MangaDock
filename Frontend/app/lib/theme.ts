/**
 * Theme state: System / Light / Dark, written as `data-theme` on <html>.
 * Ported from Strata (`Strata-xeno Web/components/Nav.tsx` ThemeToggle + `app/layout.tsx:46`), with one change:
 * MangaDock defaults to DARK, not to the system preference.
 */
export type Theme = "dark" | "light" | "system";

export const THEME_STORAGE_KEY = "md-theme";
const THEMES: readonly Theme[] = ["dark", "light", "system"];
const DEFAULT_THEME: Theme = "dark";

/** Fired by applyTheme so every toggle on the page re-reads the choice (useSyncExternalStore). */
export const THEME_EVENT = "md-theme-change";

export function readTheme(storage: { getItem(key: string): string | null }): Theme {
  try {
    const v = storage.getItem(THEME_STORAGE_KEY);
    return (THEMES as readonly string[]).includes(v ?? "") ? (v as Theme) : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** `system` leaves the attribute off so `prefers-color-scheme` decides in CSS. */
export function attributeFor(theme: Theme): "dark" | "light" | null {
  return theme === "system" ? null : theme;
}

export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

/** Inlined in <head>: the same rules as readTheme/attributeFor, plus the `js` class, before first paint
 *  (no flash; Strata P2). Built from the constants above so the list and the default live in one place. */
/** The browser bar colour for each painted theme: the `--bg` of each (globals.css). */
export const THEME_COLOR = { light: "#f5f5f7", dark: "#0b0b0d" } as const;

export const themeBootScript = `(function(){var h=document.documentElement;h.classList.add("js");var t=${JSON.stringify(DEFAULT_THEME)};try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(THEMES)}.indexOf(s)>=0)t=s}catch(e){}if(t==="system")h.removeAttribute("data-theme");else h.setAttribute("data-theme",t);try{var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?${JSON.stringify(THEME_COLOR.dark)}:${JSON.stringify(THEME_COLOR.light)})}catch(e){}})();`;

export function applyTheme(theme: Theme) {
  const attr = attributeFor(theme);
  const html = document.documentElement;
  if (attr) html.setAttribute("data-theme", attr);
  else html.removeAttribute("data-theme");
  const dark = attr === "dark" || (!attr && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
