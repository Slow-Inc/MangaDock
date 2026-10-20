import { describe, expect, test } from "bun:test";
import { THEME_STORAGE_KEY, attributeFor, nextTheme, readTheme, themeBootScript } from "./theme";

const storage = (value: string | null) => ({ getItem: (k: string) => (k === THEME_STORAGE_KEY ? value : null) });

describe("readTheme: what the visitor gets on load", () => {
  test("nothing stored means dark — MangaDock defaults to dark, not to the system", () => {
    expect(readTheme(storage(null))).toBe("dark");
  });

  test("a stored choice wins", () => {
    expect(readTheme(storage("light"))).toBe("light");
    expect(readTheme(storage("system"))).toBe("system");
  });

  test("a value that is not a theme is ignored", () => {
    expect(readTheme(storage("purple"))).toBe("dark");
  });

  test("storage that throws (private mode, blocked site data) still yields dark", () => {
    expect(readTheme({ getItem: () => { throw new Error("blocked"); } })).toBe("dark");
  });
});

describe("attributeFor: the data-theme written on <html>", () => {
  test("forced themes set the attribute; system leaves it off so the media query decides", () => {
    expect(attributeFor("dark")).toBe("dark");
    expect(attributeFor("light")).toBe("light");
    expect(attributeFor("system")).toBeNull();
  });
});

describe("nextTheme: the toggle cycles dark → light → system → dark", () => {
  test("cycle", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("system");
    expect(nextTheme("system")).toBe("dark");
  });
});

describe("themeBootScript: runs in <head> before first paint", () => {
  const run = (stored: string | null) => {
    const attrs: Record<string, string> = {};
    const classes = new Set<string>();
    const html = {
      setAttribute: (k: string, v: string) => { attrs[k] = v; },
      removeAttribute: (k: string) => { delete attrs[k]; },
      classList: { add: (c: string) => classes.add(c) },
    };
    new Function("document", "localStorage", themeBootScript)(
      { documentElement: html },
      { getItem: (k: string) => (k === THEME_STORAGE_KEY ? stored : null) },
    );
    return { attrs, classes };
  };

  test("first visit: dark, and the js class that gates hidden-start animations", () => {
    const { attrs, classes } = run(null);
    expect(attrs["data-theme"]).toBe("dark");
    expect(classes.has("js")).toBe(true);
  });

  test("a visitor who chose system gets no attribute", () => {
    expect(run("system").attrs["data-theme"]).toBeUndefined();
  });

  test("a visitor who chose light gets light", () => {
    expect(run("light").attrs["data-theme"]).toBe("light");
  });
});
