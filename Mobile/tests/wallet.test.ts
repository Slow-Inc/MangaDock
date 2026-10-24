import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/auth.ts';
import { createWallet } from '../src/wallet.ts';
import { createReader } from '../src/reader.ts';
import { createCatalog } from '../src/catalog.ts';
import { recoverPaymentReading } from '../src/recovery.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } };
}

test('a signed-in reader sees their existing Backend coin balance', async () => {
  const auth = fixture({ externalFetch: async (input, init) => {
    if (new URL(String(input)).pathname === '/wallet/balance' && new Headers(init?.headers).get('authorization')?.startsWith('Bearer ')) return Response.json({ balance: 20 });
    return Response.json({}, { status: 401 });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() });
  await wallet.refresh();
  assert.equal(wallet.snapshot().balance, 20);
});

test('creating a QR topup keeps coins unchanged until the Backend confirms payment', async () => {
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  const auth = fixture({ externalFetch: async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/wallet/balance') return Response.json({ balance: 20 });
    if (path === '/wallet/topup/create' && init?.method === 'POST' && JSON.parse(String(init.body)).amount === 100) return Response.json({ paymentId: 'payment-1', qrString: 'TEST-PAYMENT-QR', expiresAt });
    return Response.json({}, { status: 404 });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() });
  await wallet.refresh();
  await wallet.createTopup(100);
  assert.equal(wallet.snapshot().balance, 20);
  assert.deepEqual(wallet.snapshot().payment, { paymentId: 'payment-1', qrString: 'TEST-PAYMENT-QR', expiresAt, amount: 100, status: 'pending' });
});

test('relaunch restores the same pending QR payment and checks server status before local expiry', async () => {
  const expiredLocally = new Date(Date.now() - 1000).toISOString();
  const requests: string[] = [];
  const values = new Map<string, string>();
  const storage = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } };
  const auth = fixture({ externalFetch: async (input, init) => {
    const path = new URL(String(input)).pathname; requests.push(`${init?.method ?? 'GET'} ${path}`);
    if (path === '/wallet/topup/create') return Response.json({ paymentId: 'payment-1', qrString: 'TEST-PAYMENT-QR', expiresAt: expiredLocally });
    if (path === '/wallet/topup/status/payment-1') return Response.json({ status: 'paid', balance: 120 });
    return Response.json({}, { status: 404 });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const options = { apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage };
  const wallet = createWallet(options); await wallet.createTopup(100);
  const reopened = createWallet(options); await reopened.restore();
  assert.equal(reopened.snapshot().payment?.paymentId, 'payment-1');
  assert.equal(reopened.snapshot().payment?.status, 'paid');
  assert.equal(reopened.snapshot().balance, 120);
  assert.equal(requests.filter((request) => request === 'POST /wallet/topup/create').length, 1);
});

test('repeated topup taps reuse one pending payment instead of creating multiple charges', async () => {
  let creates = 0;
  const auth = fixture({ externalFetch: async () => {
    creates++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return Response.json({ paymentId: 'one-payment', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() });
  await Promise.all([wallet.createTopup(100), wallet.createTopup(100)]);
  await wallet.createTopup(100);
  assert.equal(creates, 1);
  assert.equal(wallet.snapshot().payment?.paymentId, 'one-payment');
});

test('cancel rechecks the server so a payment that already succeeded remains paid', async () => {
  const requests: string[] = [];
  const auth = fixture({ externalFetch: async (input) => {
    const path = new URL(String(input)).pathname; requests.push(path);
    if (path.endsWith('/create')) return Response.json({ paymentId: 'race', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
    if (path.endsWith('/cancel')) return Response.json({ cancelled: false });
    if (path.endsWith('/status/race')) return Response.json({ status: 'paid', balance: 123 });
    return Response.json({}, { status: 404 });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() });
  await wallet.createTopup(100);
  await wallet.cancel();
  assert.equal(wallet.snapshot().payment?.status, 'paid');
  assert.equal(wallet.snapshot().balance, 123);
  assert.deepEqual(requests.slice(-2), ['/wallet/topup/race/cancel', '/wallet/topup/status/race']);
});

test('logging out during topup response cannot expose the previous account payment', async () => {
  let release!: (value: Response) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const auth = fixture({ externalFetch: async () => { started(); return new Promise<Response>((resolve) => { release = resolve; }); } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const storage = memoryStorage();
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage });
  const creating = wallet.createTopup(100); await ready;
  await auth.app.signOut();
  release(Response.json({ paymentId: 'late', qrString: 'PRIVATE', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  await creating;
  assert.deepEqual(wallet.snapshot(), { balance: null, payment: null });
  assert.ok(await storage.getItem('mangadock_native_topup:reader-1'), 'An already-created payment must remain recoverable by its original owner');
});

test('payment stream reconciles paid status and does not reconnect after payment is terminal', async () => {
  let streams = 0;
  const auth = fixture({ externalFetch: async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/create')) return Response.json({ paymentId: 'streamed', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
    if (path.endsWith('/stream')) { streams++; return new Response('data: {"event":"payment.paid","balance":999}\n\n', { headers: { 'content-type': 'text/event-stream' } }); }
    if (path.endsWith('/status/streamed')) return Response.json({ status: 'paid', balance: 130 });
    return Response.json({}, { status: 404 });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() });
  await wallet.createTopup(100);
  await wallet.watch(); await wallet.watch();
  assert.equal(wallet.snapshot().balance, 130);
  assert.equal(wallet.snapshot().payment?.status, 'paid');
  assert.equal(streams, 1);
});

test('a new wallet recovers an existing QR before accepting another create tap', async () => {
  let creates = 0;
  const auth = fixture({ externalFetch: async (input) => {
    if (String(input).includes('/status/')) return Response.json({ status: 'pending' });
    creates++; return Response.json({ paymentId: 'existing', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const options = { apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() };
  await createWallet(options).createTopup(100);
  const reopened = createWallet(options);
  await reopened.createTopup(200);
  assert.equal(creates, 1);
  assert.equal(reopened.snapshot().payment?.amount, 100);
});

test('background stops a pending payment stream and preserves its QR identity for foreground recovery', async () => {
  let cancelled = false;
  let opened!: () => void;
  const ready = new Promise<void>((resolve) => { opened = resolve; });
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const auth = fixture({ externalFetch: async (input) => {
    if (String(input).endsWith('/stream')) { opened(); return new Response(stream, { headers: { 'content-type': 'text/event-stream' } }); }
    return Response.json({ paymentId: 'resume', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() });
  await wallet.createTopup(100);
  const watching = wallet.watch(); await ready;
  await new Promise((resolve) => setTimeout(resolve, 0));
  wallet.stopWatching(); await watching;
  assert.equal(cancelled, true);
  assert.equal(wallet.snapshot().payment?.paymentId, 'resume');
  assert.equal(wallet.snapshot().payment?.status, 'pending');
});

test('an invalid QR response cannot be persisted or shown as a usable payment', async () => {
  const auth = fixture({ externalFetch: async () => Response.json({ paymentId: 'invalid', qrString: '', expiresAt: 'unknown' }) });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const storage = memoryStorage();
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage });
  await assert.rejects(wallet.createTopup(100), /ข้อมูลการเติมเงิน/);
  assert.equal(wallet.snapshot().payment, null);
  assert.equal(await storage.getItem('mangadock_native_topup:reader-1'), null);
});

test('an older pending status response cannot undo a newer confirmed payment', async () => {
  let release!: (response: Response) => void;
  let started!: () => void;
  let statuses = 0;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const auth = fixture({ externalFetch: async (input) => {
    if (!String(input).includes('/status/')) return Response.json({ paymentId: 'race', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
    if (++statuses === 1) { started(); return new Promise<Response>((resolve) => { release = resolve; }); }
    return Response.json({ status: 'paid', balance: 120 });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() });
  await wallet.createTopup(100);
  const old = wallet.reconcile(); await ready;
  await wallet.reconcile();
  release(Response.json({ status: 'pending' })); await old;
  assert.equal(wallet.snapshot().payment?.status, 'paid');
  assert.equal(wallet.snapshot().balance, 120);
});

test('a pending topup retains its intended chapter and page on a cold wallet recovery', async () => {
  const context = { mangaId: 'manga-1', chapter: { id: 'ver:paid', chapterNumber: '2', title: 'Chapter', translatedLanguage: 'th' }, position: { pageIndex: 3, mode: 'single' as const, direction: 'rtl' as const, zoom: 2 }, derivative: 'hd' as const };
  const auth = fixture({ externalFetch: async (input) => String(input).includes('/status/') ? Response.json({ status: 'pending' }) : Response.json({ paymentId: 'return', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() }) });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const options = { apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() };
  await createWallet(options).createTopup(100, context);
  const reopened = createWallet(options); await reopened.restore();
  assert.deepEqual(reopened.snapshot().payment?.context, context);
});

test('payment relaunch restores its reading destination through server entitlement checking', async () => {
  let checks = 0;
  const context = { mangaId: 'manga-1', chapter: { id: 'ver:paid', chapterNumber: '2', title: 'Chapter', translatedLanguage: 'th' }, position: { pageIndex: 1, mode: 'single' as const, direction: 'rtl' as const, zoom: 2 }, derivative: 'hd' as const };
  const auth = fixture({ externalFetch: async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/create')) return Response.json({ paymentId: 'return', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
    if (path.includes('/status/')) return Response.json({ status: 'paid', balance: 100 });
    if (path.includes('/unlock/check/')) { checks++; return Response.json({ unlocked: true }); }
    if (path.startsWith('/versions/title/') || path.endsWith('/chapters')) return Response.json([]);
    if (path.startsWith('/versions/')) return Response.json({ priceCoins: 7, status: 'published', pages: ['/uploads/1.jpg', '/uploads/2.jpg'] });
    return Response.json({ id: 'manga-1', authors: [], genres: [], covers: [] });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const options = { apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() };
  await createWallet(options).createTopup(100, context);
  const reader = createReader(options); const catalog = createCatalog(options);
  await recoverPaymentReading({ wallet: createWallet(options), reader, catalog, isCurrent: () => true });
  assert.equal(reader.snapshot().chapter?.id, 'ver:paid');
  assert.equal(reader.snapshot().position?.pageIndex, 1);
  assert.equal(checks, 1);
});

test('a payment recovery waiting for captcha retains its intended page and saver choice', async () => {
  const context = { mangaId: 'manga-1', chapter: { id: 'chapter-1', chapterNumber: '2', title: 'Chapter', translatedLanguage: 'ja' }, position: { pageIndex: 1, mode: 'single' as const, direction: 'ltr' as const, zoom: 1 }, derivative: 'saver' as const };
  const auth = fixture({ externalFetch: async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/create')) return Response.json({ paymentId: 'return', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
    if (path.includes('/status/')) return Response.json({ status: 'pending' });
    if (path.includes('/chapters/chapter-1/pages')) return Response.json({}, { status: 401 });
    if (path.startsWith('/versions/title/') || path.endsWith('/chapters')) return Response.json([]);
    return Response.json({ id: 'manga-1', authors: [], genres: [], covers: [] });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const options = { apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() };
  await createWallet(options).createTopup(100, context);
  const reader = createReader(options);
  await recoverPaymentReading({ wallet: createWallet(options), reader, catalog: createCatalog(options), isCurrent: () => true });
  assert.equal(reader.snapshot().status, 'captchaRequired');
  assert.equal(reader.snapshot().position?.pageIndex, 1);
  assert.equal(reader.snapshot().derivative, 'saver');
});

test('a failed local save preserves the known payment in memory and prevents another create', async () => {
  let creates = 0;
  const auth = fixture({ externalFetch: async () => { creates++; return Response.json({ paymentId: 'known', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() }); } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: { ...memoryStorage(), setItem: async () => { throw new Error('Storage unavailable'); } } });
  await assert.rejects(wallet.createTopup(100));
  await wallet.createTopup(100);
  assert.equal(wallet.snapshot().payment?.paymentId, 'known');
  assert.equal(creates, 1);
});

test('a late terminal response for an old payment cannot delete a newer persisted QR', async () => {
  let release!: (response: Response) => void;
  let ready!: () => void;
  const started = new Promise<void>((resolve) => { ready = resolve; });
  let creates = 0; let statuses = 0;
  const auth = fixture({ externalFetch: async (input) => {
    if (String(input).includes('/create')) return Response.json({ paymentId: `payment-${++creates}`, qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
    if (++statuses === 1) { ready(); return new Promise<Response>((resolve) => { release = resolve; }); }
    return Response.json({ status: 'paid', balance: 120 });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const storage = memoryStorage();
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage });
  await wallet.createTopup(100);
  const old = wallet.reconcile(); await started;
  await wallet.reconcile(); await wallet.createTopup(200);
  release(Response.json({ status: 'paid', balance: 120 })); await old;
  assert.equal(wallet.snapshot().payment?.paymentId, 'payment-2');
  assert.equal(JSON.parse((await storage.getItem('mangadock_native_topup:reader-1'))!).paymentId, 'payment-2');
});

test('an invalid server payment status preserves the recoverable pending QR', async () => {
  const auth = fixture({ externalFetch: async (input) => String(input).includes('/status/') ? Response.json({ status: 'success' }) : Response.json({ paymentId: 'known', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() }) });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const storage = memoryStorage();
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage });
  await wallet.createTopup(100);
  await assert.rejects(wallet.reconcile());
  assert.equal(wallet.snapshot().payment?.status, 'pending');
  assert.ok(await storage.getItem('mangadock_native_topup:reader-1'));
});

test('a slow balance refresh cannot replace a newer paid balance with the pre-payment amount', async () => {
  let release!: (response: Response) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const auth = fixture({ externalFetch: async (input) => {
    if (String(input).endsWith('/balance')) { started(); return new Promise<Response>((resolve) => { release = resolve; }); }
    if (String(input).includes('/status/')) return Response.json({ status: 'paid', balance: 120 });
    return Response.json({ paymentId: 'known', qrString: 'QR', expiresAt: new Date(Date.now() + 60000).toISOString() });
  } });
  await auth.app.signIn('reader@example.test', 'correct-test-password');
  const wallet = createWallet({ apiOrigin: 'https://api.example.test', deviceId: 'mdock_native_test', fetch: auth.fetch, session: auth.app, storage: memoryStorage() });
  await wallet.createTopup(100);
  const old = wallet.refresh(); await ready;
  await wallet.reconcile(); release(Response.json({ balance: 20 })); await old;
  assert.equal(wallet.snapshot().balance, 120);
});
