import type { createPersonal } from "./personal.ts";

export type CsvFile = { uri: string; remove(): void };
export async function shareHistoryCSV(options: {
  personal: ReturnType<typeof createPersonal>;
  isCurrent(): boolean;
  createFile(csv: string): Promise<CsvFile>;
  share(uri: string): Promise<void>;
}): Promise<boolean> {
  const csv = await options.personal.exportHistory();
  if (csv === null || !options.isCurrent()) return false;
  const file = await options.createFile(csv);
  if (!options.isCurrent()) {
    file.remove();
    return false;
  }
  try {
    await options.share(file.uri);
  } catch (error) {
    file.remove();
    throw error;
  }
  return true;
}
