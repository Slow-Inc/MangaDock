import { parseNdjsonChunk, BatchStreamEvent } from './mit-batch-ndjson';

const pageLine = (i: number, patches: any = []) =>
  JSON.stringify({
    pageIndex: i,
    imgWidth: 100,
    imgHeight: 200,
    patches,
    error: null,
  });
const errorLine = (i: number, error: string) =>
  JSON.stringify({
    pageIndex: i,
    imgWidth: 0,
    imgHeight: 0,
    patches: [],
    error,
  });
const DONE = JSON.stringify({ done: true });

const types = (events: BatchStreamEvent[]) => events.map((e) => e.type);

describe('parseNdjsonChunk (#294) — chunk-boundary decoding', () => {
  it('parses a single complete line into one page event, no carry', () => {
    const { events, carry } = parseNdjsonChunk(pageLine(0) + '\n', '');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'page',
      pageIndex: 0,
      imgWidth: 100,
      imgHeight: 200,
    });
    expect(carry).toBe('');
  });

  it('reassembles a line split across two calls via carry', () => {
    const full = pageLine(7);
    const at = 20;
    const first = parseNdjsonChunk(full.slice(0, at), '');
    expect(first.events).toHaveLength(0);
    expect(first.carry).toBe(full.slice(0, at));

    const second = parseNdjsonChunk(full.slice(at) + '\n', first.carry);
    expect(second.events).toHaveLength(1);
    expect(second.events[0]).toMatchObject({ type: 'page', pageIndex: 7 });
    expect(second.carry).toBe('');
  });

  it('retains a trailing partial line (no newline) as the new carry', () => {
    const { events, carry } = parseNdjsonChunk(
      pageLine(0) + '\n' + pageLine(1),
      '',
    );
    expect(types(events)).toEqual(['page']);
    expect((events[0] as any).pageIndex).toBe(0);
    expect(carry).toBe(pageLine(1));
  });

  it('skips empty and whitespace-only lines', () => {
    const { events } = parseNdjsonChunk('\n   \n' + pageLine(0) + '\n\n', '');
    expect(types(events)).toEqual(['page']);
  });

  it('emits a malformed event for an unparseable line, carrying the raw line', () => {
    const { events } = parseNdjsonChunk('this is not json\n', '');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'malformed', line: 'this is not json' });
  });

  it('continues past a malformed line to later valid pages', () => {
    const { events } = parseNdjsonChunk(
      'garbage\n' + pageLine(0) + '\n' + pageLine(1) + '\n',
      '',
    );
    expect(types(events)).toEqual(['malformed', 'page', 'page']);
  });

  it('emits done and STOPS processing the rest of the chunk (mirrors break outer)', () => {
    const { events } = parseNdjsonChunk(
      pageLine(0) + '\n' + DONE + '\n' + pageLine(1) + '\n',
      '',
    );
    expect(types(events)).toEqual(['page', 'done']); // page(1) after done is discarded
  });

  it('skips a non-numeric pageIndex line without emitting an event', () => {
    const { events } = parseNdjsonChunk(
      JSON.stringify({ pageIndex: null, patches: [] }) +
        '\n' +
        pageLine(0) +
        '\n',
      '',
    );
    expect(types(events)).toEqual(['page']);
    expect((events[0] as any).pageIndex).toBe(0);
  });

  it('skips a NaN pageIndex line', () => {
    // NaN serializes to null in JSON, but guard against a stray non-number too.
    const { events } = parseNdjsonChunk(
      '{"pageIndex": "x", "patches": []}\n' + pageLine(2) + '\n',
      '',
    );
    expect(types(events)).toEqual(['page']);
    expect((events[0] as any).pageIndex).toBe(2);
  });

  it('emits an error event for a line carrying an error', () => {
    const { events } = parseNdjsonChunk(errorLine(3, 'boom') + '\n', '');
    expect(events[0]).toMatchObject({
      type: 'error',
      pageIndex: 3,
      error: 'boom',
    });
  });

  it('passes patches through as-is, including undefined (no defaulting)', () => {
    const { events } = parseNdjsonChunk(
      JSON.stringify({ pageIndex: 0, imgWidth: 1, imgHeight: 1, error: null }) +
        '\n',
      '',
    );
    expect(events[0].type).toBe('page');
    expect((events[0] as any).patches).toBeUndefined();
  });

  it('decodes multiple mixed events in one chunk, preserving order', () => {
    const { events } = parseNdjsonChunk(
      pageLine(0) + '\n' + errorLine(1, 'e') + '\n' + pageLine(2) + '\n',
      '',
    );
    expect(types(events)).toEqual(['page', 'error', 'page']);
  });
});
