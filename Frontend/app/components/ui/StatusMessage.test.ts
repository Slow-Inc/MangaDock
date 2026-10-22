import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StatusMessage from "./StatusMessage";

const render = (kind: "status" | "alert", message: string, className: string) =>
  renderToStaticMarkup(createElement(StatusMessage, { kind, message, className }));

describe("StatusMessage: the live region exists before the message does", () => {
  test("an empty success region is still mounted as role=status", () => {
    expect(render("status", "", "mb-4")).toBe('<p role="status" aria-live="polite"></p>');
  });

  test("an empty error region is still mounted as role=alert", () => {
    expect(render("alert", "", "mb-4")).toBe('<p role="alert" aria-live="assertive"></p>');
  });

  test("the message lands inside the existing region and gets its visual classes", () => {
    expect(render("alert", "save failed", "text-danger")).toBe(
      '<p role="alert" aria-live="assertive" class="text-danger">save failed</p>',
    );
  });
});
