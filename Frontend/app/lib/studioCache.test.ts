import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getCached, setCache } from "./studioCache";

// Minimal sessionStorage mock (Bun test env has no DOM)
const store: Record<string, string> = {};
const sessionStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

const saved = (globalThis as Record<string, unknown>).sessionStorage;

beforeEach(() => {
  // Reset backing store and install mock
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as Record<string, unknown>).sessionStorage = sessionStorageMock;
  // Clear the studio:versions key before each test
  setCache("studio:versions", null as never);
});

afterEach(() => {
  (globalThis as Record<string, unknown>).sessionStorage = saved;
});

describe("studioCache version key", () => {
  it("getCached returns null before any write", () => {
    expect(getCached("studio:versions")).toBeNull();
  });

  it("round-trips data correctly", () => {
    const data = [{ versionId: "v1", chapterNumber: 1 }];
    setCache("studio:versions", data);
    expect(getCached("studio:versions")).toEqual(data);
  });
});
