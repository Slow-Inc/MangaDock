/**
 * #1126: which MIT stage the chapter-progress label shows when several pages translate at once (#1122).
 *
 * Stage events from concurrent pages interleave; showing the last one made the label jump between pages. The tracker
 * keeps the latest stage per in-flight page and shows the page that started earliest (the visible page is submitted
 * first, so it is the one the reader is waiting on). One page at a time behaves exactly as before.
 */
export type ShownStage = { pageIndex: number; stage: string } | null;

export function createStageTracker() {
  const inFlight = new Map<number, string>(); // insertion order = order the pages started reporting

  const shown = (): ShownStage => {
    const first = inFlight.entries().next();
    return first.done ? null : { pageIndex: first.value[0], stage: first.value[1] };
  };

  return {
    /** A stage event for `pageIndex`; returns what the label should show. */
    stage(pageIndex: number, stage: string): ShownStage {
      inFlight.set(pageIndex, stage);
      return shown();
    },
    /** `pageIndex` finished (success or error); returns what the label should show next. */
    done(pageIndex: number): ShownStage {
      inFlight.delete(pageIndex);
      return shown();
    },
    reset(): void {
      inFlight.clear();
    },
  };
}
