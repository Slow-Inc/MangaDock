// Trigger a client-side file download robustly. Extracted from the dashboard so the DOM mechanics
// (DOM-attach the anchor, click, remove, then revoke the object URL on a later tick) are unit-tested
// in isolation — bun:test injects a fake env; the app uses the real document/URL/setTimeout defaults.

export interface DownloadAnchor {
  href: string;
  download: string;
  click(): void;
}

export interface DownloadDeps {
  document: {
    createElement(tag: "a"): DownloadAnchor;
    body: { appendChild(a: DownloadAnchor): void; removeChild(a: DownloadAnchor): void };
  };
  url: { createObjectURL(b: Blob): string; revokeObjectURL(u: string): void };
  defer(fn: () => void): void;
}

export function triggerDownload(opts: { filename: string; content: string; type?: string }, deps?: DownloadDeps): void {
  const d = deps?.document ?? (document as unknown as DownloadDeps["document"]);
  const u = deps?.url ?? URL;
  const defer = deps?.defer ?? ((fn: () => void) => setTimeout(fn, 0));

  const blob = new Blob([opts.content], { type: opts.type ?? "application/json" });
  const objUrl = u.createObjectURL(blob);
  const a = d.createElement("a");
  a.href = objUrl;
  a.download = opts.filename;
  d.body.appendChild(a); // attached so a programmatic click() triggers the download in every browser
  a.click();
  d.body.removeChild(a);
  defer(() => u.revokeObjectURL(objUrl)); // deferred so the revoke can't cancel the in-flight download
}
