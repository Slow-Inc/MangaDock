import { expect, test, describe } from "bun:test";
import PageRenderer from "../PageRenderer";

describe("PageRenderer", () => {
  test("is wrapped in React.memo so stable props skip re-render", () => {
    // React.memo components carry the react.memo type tag.
    expect((PageRenderer as unknown as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for("react.memo"));
  });
});
