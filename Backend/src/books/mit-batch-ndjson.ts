/**
 * Pure NDJSON decoder for the MIT batch stream (#294).
 *
 * Carved out of `MitBatchOrchestrator._runMitBatch` so the chunk-boundary state
 * machine — the part that's hardest to read and most likely to break — can be
 * unit-tested with hand-crafted strings, no Nest runtime or job machinery.
 *
 * It is deliberately SYNTACTIC ONLY: it turns a decoded text chunk (+ the partial
 * line carried over from the previous chunk) into an ordered list of typed events.
 * It does NOT persist, log, count, or know about jobs/listeners — the consumer maps
 * each event to its side effect, exactly as the inline loop did. Behaviour is
 * byte-identical to the code it replaces:
 *  - whitespace-only lines are dropped (no event);
 *  - a line that fails `JSON.parse` becomes a `malformed` event (the consumer logs
 *    the same "NDJSON parse failed" warning);
 *  - `{ done: true }` becomes a `done` event and STOPS processing the rest of the
 *    chunk (mirrors the original `break outer` on the sentinel);
 *  - a non-numeric / NaN `pageIndex` is skipped silently (no event), as before;
 *  - `patches` is passed THROUGH AS-IS (not defaulted) so a page missing its
 *    `patches` array still throws in the consumer's persist step and is logged +
 *    retried, identical to the original `data.patches.map(...)`.
 */

/** One translated-region patch as MIT streams it on the wire. */
export interface NdjsonPatch {
  x: number;
  y: number;
  w: number;
  h: number;
  img_b64: string;
}

export type BatchStreamEvent =
  | {
      type: 'page';
      pageIndex: number;
      imgWidth: number;
      imgHeight: number;
      /** As-streamed; may be undefined — the consumer's persist step throws then,
       *  matching the original inline `data.patches.map(...)`. */
      patches: NdjsonPatch[];
      /** Raw source line, kept so the consumer can log `line.slice(0,120)` on a
       *  persist failure byte-identically to the original catch. */
      line: string;
    }
  | { type: 'error'; pageIndex: number; error: string; line: string }
  | { type: 'done' }
  | { type: 'malformed'; line: string };

/**
 * Parse one decoded text chunk, prepended with the `carry` (partial line) from the
 * previous call. Returns the events found and the new carry (the trailing partial
 * line awaiting more bytes).
 */
export function parseNdjsonChunk(
  chunk: string,
  carry: string,
): { events: BatchStreamEvent[]; carry: string } {
  const buf = carry + chunk;
  const lines = buf.split('\n');
  const newCarry = lines.pop() ?? '';
  const events: BatchStreamEvent[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(line) as Record<string, unknown>;
    } catch {
      events.push({ type: 'malformed', line });
      continue;
    }

    // Sentinel: MIT signals it has finished all pages. Stop here — the original
    // `break outer` discarded anything after it in the same chunk.
    if (raw['done'] === true) {
      events.push({ type: 'done' });
      return { events, carry: newCarry };
    }

    const data = raw as {
      pageIndex: number;
      imgWidth: number;
      imgHeight: number;
      patches: NdjsonPatch[];
      error: string | null;
    };

    if (typeof data.pageIndex !== 'number' || Number.isNaN(data.pageIndex)) {
      continue;
    }

    if (data.error) {
      events.push({
        type: 'error',
        pageIndex: data.pageIndex,
        error: data.error,
        line,
      });
      continue;
    }

    events.push({
      type: 'page',
      pageIndex: data.pageIndex,
      imgWidth: data.imgWidth,
      imgHeight: data.imgHeight,
      patches: data.patches,
      line,
    });
  }

  return { events, carry: newCarry };
}
