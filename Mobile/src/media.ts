import { createApi } from "./api.ts";
import type { createMobileSession } from "./session.ts";
export type PickedImage = { blob: Blob; name: string };
export function validateImage(image: PickedImage, maxBytes = 5 * 1024 * 1024) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
      image.blob.type,
    )
  )
    throw new Error("รองรับรูป JPEG, PNG, WebP และ GIF");
  if (!image.blob.size || image.blob.size > maxBytes)
    throw new Error(`รูปต้องมีขนาดไม่เกิน ${maxBytes / 1024 / 1024} MB`);
}
export function createMedia(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  const api = createApi(options);
  let epoch = 0,
    owner = options.session.snapshot().account?.uid ?? null;
  const requests = new Set<AbortController>();
  const identityChanged = () => {
    const next = options.session.snapshot().account?.uid ?? null;
    if (next !== owner) {
      owner = next;
      epoch++;
      requests.forEach((request) => request.abort());
    }
  };
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  return {
    async upload<T = { imageUrl: string }>(
      path: string,
      image: PickedImage,
      maxBytes = 5 * 1024 * 1024,
    ): Promise<T | null> {
      const current = epoch;
      validateImage(image, maxBytes);
      const token = await options.session.accessToken();
      if (current !== epoch || !unsubscribe) return null;
      const body = new FormData();
      body.append("file", image.blob, image.name);
      const controller = new AbortController();
      requests.add(controller);
      try {
        const response = await api.json<T>(path, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body,
          signal: controller.signal,
        });
        return current === epoch && !controller.signal.aborted
          ? response
          : null;
      } finally {
        requests.delete(controller);
      }
    },
    activate() {
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    dispose() {
      epoch++;
      unsubscribe?.();
      unsubscribe = undefined;
      requests.forEach((request) => request.abort());
    },
  };
}
