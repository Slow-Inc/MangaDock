import { describe, expect, test } from "bun:test";
import { getActiveStudioTab } from "./studioTabs";

describe("getActiveStudioTab: which Studio nav item is highlighted (#810)", () => {
  test("the four tab roots highlight themselves", () => {
    expect(getActiveStudioTab("/studio")).toBe("overview");
    expect(getActiveStudioTab("/studio/works")).toBe("works");
    expect(getActiveStudioTab("/studio/wallet")).toBe("wallet");
    expect(getActiveStudioTab("/studio/account")).toBe("account");
  });
  test("upload, one work's page and manga search are work management, not the overview", () => {
    expect(getActiveStudioTab("/studio/upload")).toBe("works");
    expect(getActiveStudioTab("/studio/manga/abc-123")).toBe("works");
    expect(getActiveStudioTab("/studio/search")).toBe("works");
  });
});
