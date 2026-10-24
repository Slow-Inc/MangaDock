import { describe, expect, test } from "bun:test";
import { loaderFor } from "./loaderFor";

describe("loaderFor: one loader per kind of wait, so the same wait always looks the same", () => {
  test("a page or route loading uses Atom at page size", () => {
    expect(loaderFor("page")).toEqual({ kind: "atom", size: 40 });
  });

  test("a section inside a page (a list, a panel) uses Atom, smaller", () => {
    expect(loaderFor("section")).toEqual({ kind: "atom", size: 28 });
  });

  test("inside a button or next to a label: a small Arc that fits the text line", () => {
    expect(loaderFor("inline")).toEqual({ kind: "arc", size: 16 });
  });

  test("waiting for MIT to translate a page uses Slide", () => {
    expect(loaderFor("translate")).toEqual({ kind: "slide", size: 24 });
  });
});
