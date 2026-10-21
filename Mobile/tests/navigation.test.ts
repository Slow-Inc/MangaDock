import test from "node:test";
import assert from "node:assert/strict";
import { createNativeNavigation } from "../src/navigation.ts";

test("native starts at Home and selecting a mobile destination publishes its selected screen", () => {
  const navigation = createNativeNavigation();
  assert.equal(navigation.snapshot().tab, "home");
  const screens: string[] = [];
  const unsubscribe = navigation.subscribe(() =>
    screens.push(navigation.snapshot().tab),
  );
  navigation.select("new");
  navigation.select("categories");
  unsubscribe();
  assert.deepEqual(screens, ["new", "categories"]);
});

test("Android back returns through visited tabs and falls through at Home without adding duplicate tab entries", () => {
  const navigation = createNativeNavigation();
  navigation.select("new");
  navigation.select("new");
  navigation.select("categories");
  assert.equal(navigation.back(), true);
  assert.equal(navigation.snapshot().tab, "new");
  assert.equal(navigation.back(), true);
  assert.equal(navigation.snapshot().tab, "home");
  assert.equal(navigation.back(), false);
});

test("returning from a genre preserves the selected release tab and page rather than displaying genre books under All Books", () => {
  const navigation = createNativeNavigation();
  const releases = { kind: "new", tab: "popular", page: 2 } as const;
  navigation.browse(releases);
  navigation.browse({ kind: "genre", slug: "action", page: 1 });
  navigation.back();
  assert.equal(navigation.snapshot().tab, "new");
  assert.deepEqual(navigation.snapshot().selection, releases);
  navigation.select("categories");
  assert.deepEqual(navigation.snapshot().selection, {
    kind: "genre",
    slug: "action",
    page: 1,
  });
});
