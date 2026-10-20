import test from 'node:test';
import assert from 'node:assert/strict';
import { createReader } from '../src/reader.ts';
import { createTranslation } from '../src/translation.ts';

const chapter = { id: 'chapter-1', chapterNumber: '1', title: 'Original', translatedLanguage: 'ja' };
const pages = ['https://images.example.test/1.jpg', 'https://images.example.test/2.jpg'];
const patches = [{ xPct: 10, yPct: 20, wPct: 30, hPct: 15, url: '/img-cache/patches/test.png' }];

test('single-page translation exposes Backend Patches for the selected native page', async () => {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/pages')) return Response.json({ pages });
    if (path.endsWith('/pages/1/translate-patches')) {
      const body = JSON.parse(String(init?.body));
      if (body.pageUrl === pages[1] && body.mangaId === 'manga-1' && body.targetLang === 'th') return Response.json({ patches });
    }
    return Response.json({}, { status: 400 });
  };
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translatePage(1, 'th');
  assert.equal(translation.snapshot().status, 'completed');
  assert.deepEqual(translation.snapshot().patches[1], patches);
});

test('backgrounding the app aborts translation and requires a manual restart', async () => {
  let started!: () => void;
  const running = new Promise<void>((resolve) => { started = resolve; });
  let aborted = false;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/pages?mangaId=manga-1')) return Response.json({ pages });
    return new Promise<Response>((resolve, reject) => {
      started();
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    });
  };
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  const translating = translation.translatePage(0, 'th');
  await running;
  translation.setForeground(false);
  await translating;
  assert.equal(aborted, true);
  assert.equal(translation.snapshot().status, 'interrupted');
  translation.setForeground(true);
  assert.equal(translation.snapshot().status, 'interrupted');
  assert.deepEqual(translation.snapshot().patches, {});
});

test('leaving the Reader stops a page translation and discards a late external response', async () => {
  let release!: (response: Response) => void;
  const late = new Promise<Response>((resolve) => { release = resolve; });
  const fetch: typeof globalThis.fetch = async (input) => String(input).includes('translate-patches') ? late : Response.json({ pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  const translating = translation.translatePage(0, 'th');
  reader.close();
  release(Response.json({ patches }));
  await translating;
  assert.equal(translation.snapshot().status, 'interrupted');
  assert.deepEqual(translation.snapshot().patches, {});
});

test('a malformed page translation cannot be marked successful', async () => {
  const fetch: typeof globalThis.fetch = async (input) => Response.json(String(input).includes('translate-patches') ? {} : { pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translatePage(0, 'th');
  assert.equal(translation.snapshot().status, 'failed');
  assert.deepEqual(translation.snapshot().patches, {});
});

test('chapter translation sends every canonical page in order and accepts successful empty Patches', async () => {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (!String(input).includes('batch-translate-patches')) return Response.json({ pages });
    assert.deepEqual(JSON.parse(String(init?.body)).pages, pages.map((pageUrl, pageIndex) => ({ pageIndex, pageUrl })));
    const bytes = new TextEncoder().encode(`: connected\n\ndata: ${JSON.stringify({ pageIndex: 0, patches, error: null })}\n\ndata: ${JSON.stringify({ pageIndex: 1, patches: [], error: null })}\n\n`);
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.slice(0, 23)); controller.enqueue(bytes.slice(23)); controller.close(); } });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  };
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translateChapter('th');
  assert.equal(translation.snapshot().status, 'completed');
  assert.deepEqual(translation.snapshot().patches, { 0: patches, 1: [] });
});

test('a disconnected batch stream keeps completed pages but cannot claim chapter success', async () => {
  const fetch: typeof globalThis.fetch = async (input) => String(input).includes('batch-translate-patches') ? new Response(`data: ${JSON.stringify({ pageIndex: 0, patches, error: null })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }) : Response.json({ pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translateChapter('th');
  assert.equal(translation.snapshot().status, 'failed');
  assert.deepEqual(translation.snapshot().patches, { 0: patches });
});

test('a page failure in a batch is not counted as successful empty Patches', async () => {
  const fetch: typeof globalThis.fetch = async (input) => String(input).includes('batch-translate-patches') ? new Response(`data: ${JSON.stringify({ pageIndex: 0, patches, error: null })}\n\ndata: ${JSON.stringify({ pageIndex: 1, patches: [], error: 'Translation failed' })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }) : Response.json({ pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translateChapter('th');
  assert.equal(translation.snapshot().status, 'failed');
  assert.deepEqual(translation.snapshot().patches, { 0: patches });
});

test('batch progress reaches native observers before completion across split UTF-8 frames', async () => {
  let push!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { push = controller; } });
  const fetch: typeof globalThis.fetch = async (input) => String(input).includes('batch-translate-patches') ? new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }) : Response.json({ pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  const stages: string[] = [];
  const unsubscribe = translation.subscribe(() => { const stage = translation.snapshot().stage; if (stage) stages.push(stage.stage); });
  const translating = translation.translateChapter('th');
  const progress = new TextEncoder().encode(`: ping\r\n\r\ndata: ${JSON.stringify({ type: 'progress', pageIndex: 1, stage: 'แปลข้อความ' })}\r\n\r\n`);
  const split = progress.findIndex((byte) => byte >= 128) + 1;
  push.enqueue(progress.slice(0, split)); push.enqueue(progress.slice(split));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(translation.snapshot().status, 'running');
  assert.deepEqual(translation.snapshot().patches, {});
  assert.ok(stages.includes('แปลข้อความ'));
  push.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ pageIndex: 0, patches, error: null })}\n\ndata: ${JSON.stringify({ pageIndex: 1, patches: [], error: null })}\n\n`));
  push.close(); await translating; unsubscribe();
  assert.equal(translation.snapshot().status, 'completed');
});

test('Studio translation sends the original Backend-relative image path without rewriting its byte source', async () => {
  let requested: string | undefined;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (String(input).includes('translate-patches')) { requested = JSON.parse(String(init?.body)).pageUrl; return Response.json({ patches: [] }); }
    return Response.json({ pages: ['/uploads/chapters/version-1/page.jpg'], priceCoins: 0 });
  };
  const reader = createReader({ apiOrigin: 'http://10.0.2.2:4001', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', { ...chapter, id: 'ver:version-1' });
  const translation = createTranslation({ reader, apiOrigin: 'http://10.0.2.2:4001', deviceId: 'mdock_native_test', fetch });
  await translation.translatePage(0, 'th');
  assert.equal(requested, '/uploads/chapters/version-1/page.jpg');
  assert.equal(translation.snapshot().status, 'completed');
});

test('changing the image derivative clears old overlays and translates the matching saver source', async () => {
  const bodies: { pageUrl: string; derivative: string }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (String(input).includes('translate-patches')) { bodies.push(JSON.parse(String(init?.body))); return Response.json({ patches }); }
    return Response.json({ pages: ['/img-cache/hd.jpg'], dataSaverPages: ['/img-cache/saver.jpg'] });
  };
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translatePage(0, 'th');
  reader.setDerivative('saver');
  assert.deepEqual(translation.snapshot().patches, {});
  await translation.translatePage(0, 'th');
  assert.equal(bodies[1].pageUrl, '/img-cache/saver.jpg');
  assert.equal(bodies[1].derivative, 'saver');
});

test('an expired translation clearance returns to browser verification without retrying automatically', async () => {
  const fetch: typeof globalThis.fetch = async (input) => String(input).includes('translate-patches') ? Response.json({}, { status: 401 }) : Response.json({ pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translatePage(0, 'th');
  assert.equal(reader.snapshot().status, 'captchaRequired');
  assert.notEqual(translation.snapshot().status, 'running');
});

test('changing target language starts a new overlay context and passes the selected image model', async () => {
  let body: Record<string, unknown> = {};
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (String(input).includes('translate-patches')) { body = JSON.parse(String(init?.body)); return Response.json({ patches }); }
    return Response.json({ pages });
  };
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translatePage(0, 'th');
  await translation.translatePage(1, 'en', 'deployment-model');
  assert.equal(body.imageModel, 'deployment-model');
  assert.deepEqual(Object.keys(translation.snapshot().patches), ['1']);
});

test('a stalled batch reaches its deadline and releases the stream instead of remaining running forever', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const fetch: typeof globalThis.fetch = async (input) => String(input).includes('batch-translate-patches') ? new Response(stream, { headers: { 'content-type': 'text/event-stream' } }) : Response.json({ pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch, deadlineMs: 15 });
  await Promise.race([translation.translateChapter('th'), new Promise((_, reject) => setTimeout(() => reject(new Error('Batch did not terminate')), 200))]);
  assert.equal(translation.snapshot().status, 'failed');
  assert.equal(cancelled, true);
});

test('invalid normalized Patch geometry is rejected instead of rendering corrupt native overlays', async () => {
  const fetch: typeof globalThis.fetch = async (input) => Response.json(String(input).includes('translate-patches') ? { patches: [{ ...patches[0], wPct: 'wrong' }] } : { pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translatePage(0, 'th');
  assert.equal(translation.snapshot().status, 'failed');
  assert.deepEqual(translation.snapshot().patches, {});
});

test('Reader screen teardown releases its listener and can reconnect during native remount', async () => {
  let requests = 0;
  const fetch: typeof globalThis.fetch = async (input) => {
    requests++; return Response.json(String(input).includes('translate-patches') ? { patches } : { pages });
  };
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  translation.deactivate();
  await assert.rejects(translation.translatePage(0, 'th'), /แอป/);
  assert.equal(requests, 1);
  translation.activate();
  await translation.translatePage(0, 'th');
  assert.equal(translation.snapshot().status, 'completed');
});

test('batch retry reports failed pages and clears prior successful overlays for that attempt', async () => {
  let attempt = 0;
  const fetch: typeof globalThis.fetch = async (input) => {
    if (!String(input).includes('batch-translate-patches')) return Response.json({ pages });
    attempt++;
    return new Response(`data: ${JSON.stringify({ pageIndex: 0, patches: attempt === 1 ? patches : [], error: attempt === 1 ? null : 'failed' })}\n\ndata: {"pageIndex":1,"patches":[],"error":null}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
  };
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  await translation.translateChapter('th'); await translation.translateChapter('th');
  assert.equal(translation.snapshot().status, 'failed');
  assert.deepEqual(Object.keys(translation.snapshot().patches), ['1']);
  assert.deepEqual(Object.keys(translation.snapshot().failedPages ?? {}), ['0']);
});

test('duplicate batch completion frames count each canonical page once', async () => {
  const fetch: typeof globalThis.fetch = async (input) => String(input).includes('batch-translate-patches') ? new Response('data: {"pageIndex":1,"patches":[],"error":null}\n\ndata: {"pageIndex":1,"patches":[],"error":null}\n\ndata: {"pageIndex":0,"patches":[],"error":null}\n\n', { headers: { 'content-type': 'text/event-stream' } }) : Response.json({ pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch }); await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch }); await translation.translateChapter('th');
  assert.equal(translation.snapshot().status, 'completed');
  assert.deepEqual(translation.snapshot().patches, { 0: [], 1: [] });
});

test('global batch failure sentinel cannot be mistaken for an empty successful chapter', async () => {
  const fetch: typeof globalThis.fetch = async (input) => String(input).includes('batch-translate-patches') ? new Response('data: {"pageIndex":-1,"patches":[],"error":"Translation failed"}\n\n', { headers: { 'content-type': 'text/event-stream' } }) : Response.json({ pages });
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch }); await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch }); await translation.translateChapter('th');
  assert.equal(translation.snapshot().status, 'failed');
  assert.deepEqual(translation.snapshot().patches, {});
});

test('background cancels a live batch and returning active does not open another stream', async () => {
  let streams = 0; let cancelled = false; let opened!: () => void;
  const ready = new Promise<void>((resolve) => { opened = resolve; });
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const fetch: typeof globalThis.fetch = async (input) => {
    if (!String(input).includes('batch-translate-patches')) return Response.json({ pages });
    streams++; opened(); return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
  };
  const reader = createReader({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch }); await reader.open('manga-1', chapter);
  const translation = createTranslation({ reader, apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch });
  const job = translation.translateChapter('th'); await ready; await new Promise((resolve) => setTimeout(resolve, 0));
  translation.setForeground(false); await job; translation.setForeground(true);
  assert.equal(translation.snapshot().status, 'interrupted'); assert.equal(streams, 1); assert.equal(cancelled, true);
});
