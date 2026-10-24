/**
 * The canvas as a PNG blob. `toBlob` returns undefined and delivers the blob later through its callback, so the
 * result must come from that callback — `toBlob(resolve) ?? resolve(null)` always settled with null first (#1011).
 */
export function canvasToPng(canvas: HTMLCanvasElement | null): Promise<Blob | null> {
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
