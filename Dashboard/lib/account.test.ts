import { test, expect } from "bun:test";
import { accountConnections, type Identity } from "./account";

const SUPPORTED = [
  { provider: "github", label: "GitHub" },
  { provider: "google", label: "Google" },
];

test("marks a linked provider with its identity id and unlinkable when not the only login", () => {
  const ids: Identity[] = [
    { identity_id: "i-gh", provider: "github" },
    { identity_id: "i-go", provider: "google" },
  ];
  const rows = accountConnections(ids, SUPPORTED);
  expect(rows).toEqual([
    { provider: "github", label: "GitHub", linked: true, identityId: "i-gh", canUnlink: true },
    { provider: "google", label: "Google", linked: true, identityId: "i-go", canUnlink: true },
  ]);
});

test("a not-yet-linked provider is linkable, not unlinkable", () => {
  const ids: Identity[] = [{ identity_id: "i-go", provider: "google" }];
  const rows = accountConnections(ids, SUPPORTED);
  expect(rows[0]).toEqual({ provider: "github", label: "GitHub", linked: false, identityId: undefined, canUnlink: false });
});

test("the only remaining identity cannot be unlinked (don't lock yourself out)", () => {
  const ids: Identity[] = [{ identity_id: "i-go", provider: "google" }];
  const rows = accountConnections(ids, SUPPORTED);
  const google = rows.find((r) => r.provider === "google")!;
  expect(google.linked).toBe(true);
  expect(google.canUnlink).toBe(false);
});

test("no identities → everything is unlinked and not unlinkable", () => {
  const rows = accountConnections([], SUPPORTED);
  expect(rows.every((r) => !r.linked && !r.canUnlink)).toBe(true);
});

test("output order follows the supported list, not the identities order", () => {
  const ids: Identity[] = [
    { identity_id: "i-go", provider: "google" },
    { identity_id: "i-gh", provider: "github" },
  ];
  const rows = accountConnections(ids, SUPPORTED);
  expect(rows.map((r) => r.provider)).toEqual(["github", "google"]);
});
