let cleanup: (() => Promise<void>) | null = null;

export function registerHybridPushCleanup(callback: () => Promise<void>) {
  cleanup = callback;
  return () => { if (cleanup === callback) cleanup = null; };
}

// Optional push cleanup may fail offline; it must never prevent account logout.
export async function cleanupHybridPush() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([cleanup?.(), new Promise<void>(resolve => { timer = setTimeout(resolve, 12000); })]);
  } catch { /* The persisted owner marker retries OS cleanup on the next session. */ }
  finally { clearTimeout(timer); }
}
