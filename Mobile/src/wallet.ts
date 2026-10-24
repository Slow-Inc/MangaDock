import type { createMobileSession } from './session.ts';
import { createApi } from './api.ts';
import { readSse } from './sse.ts';
import type { Chapter } from './catalog.ts';
import type { ViewerState } from './viewer.ts';

export type PaymentContext = { mangaId: string; chapter: Chapter; position?: ViewerState; derivative: 'hd' | 'saver' };
export type Payment = { paymentId: string; qrString: string; expiresAt: string; amount: number; status: 'pending' | 'paid' | 'expired' | 'cancelled'; context?: PaymentContext };
export type WalletState = { balance: number | null; payment: Payment | null };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
function validatePayment(value: Payment): Payment {
  if (!value || typeof value.paymentId !== 'string' || !value.paymentId || typeof value.qrString !== 'string' || !value.qrString || !Number.isFinite(Date.parse(value.expiresAt)) || !Number.isInteger(value.amount) || value.amount < 20 || value.amount > 100000) throw new Error('ข้อมูลการเติมเงินไม่ถูกต้อง กรุณาตรวจสอบรายการกับบริการ');
  return value;
}

export function createWallet(options: { apiOrigin: string; deviceId: string; fetch: typeof globalThis.fetch; session: ReturnType<typeof createMobileSession>; storage: Storage }) {
  let state: WalletState = { balance: null, payment: null };
  const listeners = new Set<() => void>();
  const owned = () => !!uid && options.session.snapshot().account?.uid === uid;
  const publish = (next: WalletState) => { if (!owned()) return; state = next; listeners.forEach((listener) => listener()); };
  const api = createApi(options);
  const uid = options.session.snapshot().account?.uid;
  const key = `mangadock_native_topup:${uid}`;
  let stream: AbortController | null = null;
  function stopWatching() { stream?.abort(); stream = null; }
  let unsubscribeSession: (() => void) | null = null;
  const onSessionChange = () => { if (!owned()) { stopWatching(); state = { balance: null, payment: null }; listeners.forEach((listener) => listener()); } };
  async function ownerToken() {
    if (!owned()) throw new Error('กรุณาเข้าสู่ระบบบัญชีเดิมเพื่อจัดการการเติมเงิน');
    const token = await options.session.accessToken();
    if (!owned()) throw new Error('บัญชีผู้ใช้เปลี่ยนแล้ว');
    return token;
  }
  let creating: Promise<void> | null = null;
  let statusGeneration = 0;
  let balanceGeneration = 0;
  async function reconcile(payment: Payment) {
    const current = ++statusGeneration;
    validatePayment(payment);
    const token = await ownerToken();
    const response = await api.json<{ status: Payment['status']; balance?: number }>(`wallet/topup/status/${encodeURIComponent(payment.paymentId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (current !== statusGeneration || !owned()) return;
    if (!['pending', 'paid', 'expired', 'cancelled'].includes(response.status) || (response.balance !== undefined && (!Number.isInteger(response.balance) || response.balance < 0)) || (response.status === 'paid' && response.balance === undefined)) throw new Error('ข้อมูลสถานะการเติมเงินไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    if (response.balance !== undefined) balanceGeneration++;
    publish({ balance: response.balance ?? state.balance, payment: { ...payment, status: response.status } });
    if (response.status !== 'pending') await options.storage.removeItem(key);
  }
  return { snapshot: () => state,
    subscribe(listener: () => void) {
      if (!unsubscribeSession) unsubscribeSession = options.session.subscribe(onSessionChange);
      listeners.add(listener);
      return () => { listeners.delete(listener); if (!listeners.size) { unsubscribeSession?.(); unsubscribeSession = null; } };
    },
    stopWatching,
    async watch() {
      if (stream || state.payment?.status !== 'pending') return;
      const payment = state.payment;
      const controller = new AbortController(); stream = controller;
      try {
        const token = await ownerToken();
        if (controller.signal.aborted) return;
        const response = await api.request(`wallet/topup/${encodeURIComponent(payment.paymentId)}/stream`, { signal: controller.signal, headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } });
        for await (const event of readSse<{ event: string }>(response, controller.signal)) {
          if (event.event === 'payment.paid' && !controller.signal.aborted) { await reconcile(payment); break; }
        }
      } catch (error) { if (!controller.signal.aborted) throw error; }
      finally { if (stream === controller) stream = null; }
    },
    async reconcile() { if (state.payment) await reconcile(state.payment); },
    async restore() {
      await ownerToken();
      const saved = await options.storage.getItem(key);
      if (!saved) return;
      const payment: Payment = JSON.parse(saved);
      await reconcile(payment);
    },
    async cancel() {
      if (state.payment?.status !== 'pending') return;
      const payment = state.payment;
      const token = await ownerToken();
      await api.json(`wallet/topup/${encodeURIComponent(payment.paymentId)}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      await reconcile(payment);
    },
    createTopup(amount: number, context?: PaymentContext): Promise<void> {
      if (creating) return creating;
      if (state.payment?.status === 'pending') return Promise.resolve();
      creating = (async () => {
      const saved = await options.storage.getItem(key);
      if (saved) { await reconcile(JSON.parse(saved)); if (state.payment?.status === 'pending') return; }
      const token = await ownerToken();
      const response = await api.json<{ paymentId: string; qrString: string; expiresAt: string }>('wallet/topup/create', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ amount }) });
      const payment: Payment = validatePayment({ ...response, amount, status: 'pending', ...(context ? { context } : {}) });
      statusGeneration++;
      try { await options.storage.setItem(key, JSON.stringify(payment)); }
      catch {
        publish({ ...state, payment });
        throw new Error(`บันทึกรายการเติมเงิน ${payment.paymentId} ไม่สำเร็จ กรุณาตรวจสอบรายการนี้ก่อนปิดแอป`);
      }
      publish({ ...state, payment });
      })().finally(() => { creating = null; });
      return creating;
    },
    async refresh() {
    const current = ++balanceGeneration;
    const token = await ownerToken();
    const result = await api.json<{ balance: number }>('wallet/balance', { headers: { Authorization: `Bearer ${token}` } });
    if (current === balanceGeneration) publish({ ...state, balance: result.balance });
  } };
}
