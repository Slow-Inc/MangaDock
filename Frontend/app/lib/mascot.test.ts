import { describe, expect, test } from "bun:test";
import { CAST, mascotFromUid, sanitizeMascot } from "./mascot";

describe("CAST: one character per area (redesign spec, Epic D table)", () => {
  test("each area wears its own look", () => {
    expect(CAST.reader).toMatchObject({ type: "droid", headphones: true, glasses: "round" });
    expect(CAST.search).toMatchObject({ type: "ghost", glasses: "shades" });
    expect(CAST.community).toMatchObject({ type: "cat", hat: "party" });
    expect(CAST.studio).toMatchObject({ type: "mech", hat: "beret", glasses: "square" });
    expect(CAST.wallet).toMatchObject({ type: "star", hat: "crown" });
    expect(CAST.login).toMatchObject({ type: "clover", bowTie: true });
    expect(CAST.error).toMatchObject({ type: "pebble" });
  });

  test("no two areas share a body shape, so people learn which one lives where", () => {
    const types = Object.values(CAST).map((c) => c.type);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("mascotFromUid: a user who never dressed one still gets a stable mascot", () => {
  test("the same uid always gives the same mascot", () => {
    expect(mascotFromUid("2f1c-uid-a")).toEqual(mascotFromUid("2f1c-uid-a"));
  });

  test("different uids usually differ", () => {
    const uids = Array.from({ length: 40 }, (_, i) => `user-${i}`);
    const distinct = new Set(uids.map((u) => JSON.stringify(mascotFromUid(u))));
    expect(distinct.size).toBeGreaterThan(20);
  });

  test("what it returns is always a valid config", () => {
    for (let i = 0; i < 50; i++) {
      const m = mascotFromUid(`u${i}`);
      expect(sanitizeMascot(m)).toEqual(m);
    }
  });
});

describe("sanitizeMascot: only allow-listed values reach another user's screen", () => {
  const ok = { type: "cat", face: "mouth", hat: "party", glasses: "none", headphones: false, bowTie: true, color: "#ff8c42", accessoryColor: "#222222" };

  test("a valid config passes through unchanged", () => {
    expect(sanitizeMascot(ok)).toEqual(ok);
  });

  test("unknown enum values are rejected", () => {
    expect(sanitizeMascot({ ...ok, type: "dragon" })).toBeNull();
    expect(sanitizeMascot({ ...ok, hat: "tophat" })).toBeNull();
    expect(sanitizeMascot({ ...ok, glasses: "monocle" })).toBeNull();
    expect(sanitizeMascot({ ...ok, face: "nose" })).toBeNull();
  });

  test("colours must be plain #rrggbb — no CSS expressions", () => {
    expect(sanitizeMascot({ ...ok, color: "red" })).toBeNull();
    expect(sanitizeMascot({ ...ok, color: "url(javascript:alert(1))" })).toBeNull();
    expect(sanitizeMascot({ ...ok, accessoryColor: "#12345" })).toBeNull();
  });

  test("booleans must be booleans, and junk input is rejected", () => {
    expect(sanitizeMascot({ ...ok, headphones: "yes" })).toBeNull();
    expect(sanitizeMascot(null)).toBeNull();
    expect(sanitizeMascot("cat")).toBeNull();
  });

  test("optional colours may be left out; extra keys are dropped", () => {
    const { color, accessoryColor, ...rest } = ok;
    void color;
    void accessoryColor;
    expect(sanitizeMascot({ ...rest, evil: "<script>" })).toEqual(rest);
  });
});
