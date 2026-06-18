// SSE frame parsing for the live MIT stream (PRD #279, ADR 016). Pure — the
// `useLiveSnapshot` hook feeds it decoded text chunks from the `/api/live`
// proxy and folds the parsed messages through `snapshot.ts`. A chunk can split
// a frame mid-way, so incomplete trailing data is returned in `rest` to prepend
// to the next chunk. Unit-tested in live.test.ts.

import type { Message } from "./snapshot";

export interface ParseResult {
  messages: Message[];
  rest: string;
}

/** Split a buffer into complete `data: …\n\n` frames; return the parsed message
 * objects plus any incomplete trailing fragment. Malformed JSON and non-`data:`
 * lines (SSE comments / keep-alives) are skipped, never thrown. */
export function parseSseFrames(buffer: string): ParseResult {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? ""; // last block has no terminating blank line yet
  const messages: Message[] = [];
  for (const block of blocks) {
    const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) continue;
    const json = dataLine.slice(5).trim();
    if (!json) continue;
    try {
      messages.push(JSON.parse(json) as Message);
    } catch {
      // skip a malformed frame — a partial flush or a stray heartbeat
    }
  }
  return { messages, rest };
}
