import { describe, expect, test } from "bun:test";
import { ROLE } from "../../lib/types/user";
import { SIDEBAR, clampSidebarWidth, nextTabIndex, sparklinePoints, studioPageTitle, studioRoleLabel } from "./shellMath";

describe("clampSidebarWidth: the resizable Studio sidebar (180–400 px, default 220)", () => {
  test("keeps a width inside the range", () => {
    expect(clampSidebarWidth(260)).toBe(260);
  });
  test("clamps to the limits", () => {
    expect(clampSidebarWidth(90)).toBe(SIDEBAR.min);
    expect(clampSidebarWidth(900)).toBe(SIDEBAR.max);
  });
  test("a stored value that is not a number falls back to the default", () => {
    expect(clampSidebarWidth(Number.NaN)).toBe(SIDEBAR.initial);
    expect(clampSidebarWidth(Number("abc"))).toBe(SIDEBAR.initial);
  });
});

describe("sparklinePoints: an SVG polyline for a metric card", () => {
  test("spreads values across the width, highest value at the top", () => {
    // 3 points in a 100 x 20 box with 2 px padding: x = 2, 50, 98; y: max -> 2, min -> 18
    expect(sparklinePoints([0, 10, 5], 100, 20, 2)).toBe("2,18 50,2 98,10");
  });
  test("a flat series draws a flat line through the middle", () => {
    expect(sparklinePoints([4, 4], 100, 20, 2)).toBe("2,10 98,10");
  });
  test("one value is a short centred line, none is empty", () => {
    expect(sparklinePoints([7], 100, 20, 2)).toBe("2,10 98,10");
    expect(sparklinePoints([], 100, 20, 2)).toBe("");
  });
});

describe("studioPageTitle: the shell header names the page from the route", () => {
  test("each Studio section has its own title", () => {
    expect(studioPageTitle("/studio")).toBe("ภาพรวม");
    expect(studioPageTitle("/studio/works")).toBe("ผลงาน");
    expect(studioPageTitle("/studio/wallet")).toBe("กระเป๋าเงิน");
    expect(studioPageTitle("/studio/account")).toBe("บัญชี");
    expect(studioPageTitle("/studio/upload")).toBe("อัปโหลด");
    expect(studioPageTitle("/studio/search")).toBe("ค้นหามังงะ");
  });
  test("a title's own page is named by its kind, and unknown routes fall back to Studio", () => {
    expect(studioPageTitle("/studio/manga/abc123")).toBe("จัดการเรื่อง");
    expect(studioPageTitle("/studio/somewhere-new")).toBe("สตูดิโอ");
  });
});

describe("studioRoleLabel: the status pill in the shell header", () => {
  test("names the creator roles", () => {
    expect(studioRoleLabel(ROLE.TRANSLATOR)).toBe("นักแปล");
    expect(studioRoleLabel(ROLE.CREATOR)).toBe("ครีเอเตอร์");
    expect(studioRoleLabel(ROLE.ADMIN)).toBe("แอดมิน");
  });
  test("shows nothing for a role without Studio access or an unknown role", () => {
    expect(studioRoleLabel(ROLE.USER)).toBeNull();
    expect(studioRoleLabel(null)).toBeNull();
  });
});

describe("nextTabIndex: arrow keys move between tabs and wrap around", () => {
  test("right and left step, wrapping at the ends", () => {
    expect(nextTabIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextTabIndex(2, "ArrowRight", 3)).toBe(0);
    expect(nextTabIndex(0, "ArrowLeft", 3)).toBe(2);
  });
  test("Home and End jump; other keys are not handled", () => {
    expect(nextTabIndex(1, "Home", 3)).toBe(0);
    expect(nextTabIndex(1, "End", 3)).toBe(2);
    expect(nextTabIndex(1, "Enter", 3)).toBeNull();
  });
});
