import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import type { PickedImage } from "./media.ts";
export async function pickImages(limit = 1): Promise<PickedImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) return [];
  return Promise.all(
    result.assets.slice(0, limit).map(async (asset) => {
      const file = new File(asset.uri);
      const type = asset.mimeType ?? file.type;
      if (!file.size || file.size > 10 * 1024 * 1024)
        throw new Error("รูปต้องมีขนาดไม่เกิน 10 MB");
      return {
        blob: file,
        name:
          asset.fileName ??
          `mangadock-${Date.now()}.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/gif" ? "gif" : "jpg"}`,
      };
    }),
  );
}
