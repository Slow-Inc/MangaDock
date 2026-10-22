import { describe, expect, test } from "bun:test";
import { canvasToPng } from "./canvasToPng";

/** #1011: canvas.toBlob returns undefined and calls back later — the PNG must come from the callback. */
describe("canvasToPng (#1011)", () => {
  test("resolves with the blob delivered asynchronously by toBlob", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const canvas = {
      toBlob(cb: (b: Blob | null) => void, type?: string) {
        expect(type).toBe("image/png");
        setTimeout(() => cb(blob), 5); // the browser delivers it later; toBlob itself returns undefined
      },
    };
    await expect(canvasToPng(canvas as unknown as HTMLCanvasElement)).resolves.toBe(blob);
  });

  test("resolves null when the browser could not encode the canvas", async () => {
    const canvas = { toBlob: (cb: (b: Blob | null) => void) => setTimeout(() => cb(null), 0) };
    await expect(canvasToPng(canvas as unknown as HTMLCanvasElement)).resolves.toBeNull();
  });

  test("resolves null without a canvas", async () => {
    await expect(canvasToPng(null)).resolves.toBeNull();
  });
});
