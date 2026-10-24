import type { createWallet } from "./wallet.ts";
import type { createReader } from "./reader.ts";
import type { createCatalog } from "./catalog.ts";
import type { HistoryBook } from "./personal.ts";

export async function resumeHistoryReading(options: {
  item: HistoryBook;
  catalog: ReturnType<typeof createCatalog>;
  reader: ReturnType<typeof createReader>;
  isCurrent(): boolean;
}): Promise<boolean> {
  await options.catalog.openBook(options.item.id);
  if (!options.isCurrent()) return false;
  const chapter = options.catalog
    .snapshot()
    .chapters.find((chapter) => chapter.id === options.item.lastChapterId);
  if (!chapter) return false;
  await options.reader.open(options.item.id, chapter, {
    pageIndex: Math.max(0, (options.item.lastPage ?? 1) - 1),
    mode: "strip",
    direction: "ltr",
    zoom: 1,
  });
  return options.isCurrent();
}

export async function recoverPaymentReading(options: {
  wallet: ReturnType<typeof createWallet>;
  reader: ReturnType<typeof createReader>;
  catalog: ReturnType<typeof createCatalog>;
  isCurrent(): boolean;
}): Promise<boolean> {
  await options.wallet.restore();
  const payment = options.wallet.snapshot().payment;
  const context = payment?.context;
  if (!context || !options.isCurrent()) return false;
  await options.catalog.openBook(context.mangaId);
  if (!options.isCurrent()) return false;
  await options.reader.open(context.mangaId, context.chapter);
  if (!options.isCurrent()) return false;
  if (context.position) options.reader.setPosition(context.position);
  try {
    options.reader.setDerivative(context.derivative);
  } catch {
    /* Missing saver falls back to the opened HD source. */
  }
  return payment.status === "pending";
}
