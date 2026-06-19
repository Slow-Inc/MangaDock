# Wallet SSE Payment Confirmation — Design Spec

**Date**: 2026-06-19  
**Status**: Approved  
**Scope**: Backend `wallet` module + Frontend `TopupModal`

---

## Problem

1. **Simulate ไม่อัพเดทสถานะ**: `simulateTopup` ส่งคำสั่งไปยัง Xendit sandbox ซึ่งจะยิง webhook กลับมา แต่ใน local dev Xendit ไม่สามารถเข้าถึง `localhost` ได้ → webhook ไม่ถึง → `coin_topups.status` ยังเป็น `pending` ตลอด → polling ไม่เจอ `paid` เลย

2. **Polling ผ่าน proxy มี delay**: `setInterval(poll, 3000)` ผ่าน Next.js proxy เพิ่ม latency และ unnecessary load แม้แก้ webhook แล้วก็ยังรอถึง 3s

---

## Goals

- กด Simulate แล้ว SUCCESS screen ขึ้นทันที (dev + sandbox)
- Production: webhook จาก Xendit trigger SUCCESS ทันทีผ่าน SSE push
- Security สูงสุด: JWT ใน Authorization header ตลอด, ownership check, auto-close stream

---

## Architecture

### Data Flow

```
Dev / Sandbox:
  [กด Simulate]
    → POST /wallet/topup/:id/simulate  (AuthGuard + ownership check)
    → xenditService.simulatePayment()  (optional, ยังเก็บไว้)
    → addCoins() + UPDATE status='paid'  ← ทำเองเลย ไม่รอ webhook
    → WalletEventsService.emit(paymentId, { balance })
      → SSE stream ส่ง 'payment.paid' ถึง client ทันที → SUCCESS

Production:
  Xendit → POST /wallet/xendit/webhook
    → verify x-callback-token + HMAC-SHA256 signature
    → addCoins() + UPDATE status='paid'
    → WalletEventsService.emit(paymentId, { balance })
      → SSE stream ส่ง 'payment.paid' ถึง client ทันที → SUCCESS

Frontend (ทั้ง dev + prod):
  fetch('/api/proxy/wallet/topup/:id/stream', { headers: { Authorization: Bearer <jwt> } })
  → ReadableStream parser (text/event-stream)
  → event 'payment.paid' → setScreen('SUCCESS')
  → cleanup: abort controller on unmount / SUCCESS / QR expired
```

---

## Backend Changes

### 1. `WalletEventsService` (ไฟล์ใหม่: `wallet-events.service.ts`)

```typescript
@Injectable()
export class WalletEventsService {
  // Subject per paymentId — complete after first emit (no leak)
  private subjects = new Map<string, Subject<{ balance: number }>>();

  getOrCreate(paymentId: string): Subject<{ balance: number }> { ... }

  emit(paymentId: string, data: { balance: number }): void {
    const sub = this.subjects.get(paymentId);
    if (sub) { sub.next(data); sub.complete(); this.subjects.delete(paymentId); }
  }

  stream$(paymentId: string): Observable<{ balance: number }> {
    return this.getOrCreate(paymentId).asObservable();
  }
}
```

### 2. SSE Endpoint (เพิ่มใน `wallet.controller.ts`)

```
GET /wallet/topup/:paymentId/stream
Guards: AuthGuard
```

Security layers:
1. `@UseGuards(AuthGuard)` — ต้อง valid JWT ก่อนเปิด stream
2. **Ownership check** — query `coin_topups` ยืนยัน `uid` ตรงกับ JWT (ก่อน subscribe)
3. **Auto-close on expiry** — `setTimeout(cleanup, ms until expires_at)` เมื่อ stream เปิด
4. **Complete on emit** — stream ปิดทันทีหลังส่ง `payment.paid` (1 event แล้วจบ)
5. Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

### 3. `simulateTopup` (แก้ `wallet.service.ts`)

เพิ่มหลัง `xenditService.simulatePayment()`:

```typescript
// Dev-only: ทำ credit โดยตรงแทนรอ webhook
const { balance } = await this.addCoins(uid, data.amount_coins, 'topup', 'เติมเหรียญ MangaDock', paymentId);
await this.db.from('coin_topups').update({ status: 'paid' }).eq('payment_id', paymentId);
this.walletEvents.emit(paymentId, { balance });
```

Guard `process.env.NODE_ENV === 'production'` ยังคงอยู่ — ถ้า prod ยัง throw `ForbiddenException`

### 4. `processXenditWebhook` (แก้ `wallet.service.ts`)

Security เพิ่ม:
- **HMAC-SHA256 signature check** ก่อน token check:
  ```typescript
  const sig = crypto.createHmac('sha256', process.env.XENDIT_WEBHOOK_SECRET!)
    .update(rawBody).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(incomingSig, 'hex'))) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
  ```
- `rawBody` ต้องการ `RawBodyMiddleware` (เก็บ `req.rawBody` ก่อน JSON parse)
- Emit **หลัง UPDATE สำเร็จเท่านั้น**:
  ```typescript
  // ลำดับ: addCoins → UPDATE status='paid' → emit (ไม่ emit ถ้า DB fail)
  await this.addCoins(...);
  const { error: updateError } = await this.db...update({ status: 'paid' })...;
  if (updateError) throw new InternalServerErrorException(...);
  const balance = await this.getBalance(data.uid);
  this.walletEvents.emit(paymentId, { balance });
  ```

### 5. SSE Event Wire Format

Backend controller ส่ง SSE ในรูปแบบ:
```
data: {"event":"payment.paid","balance":1234}\n\n
```
Frontend helper parse `payload.event === 'payment.paid'` และ `payload.balance` ต้องตรงกัน

### 6. `wallet.module.ts`

เพิ่ม `WalletEventsService` ใน `providers`

---

## Frontend Changes

### `studioApi.ts` — เพิ่ม helper

```typescript
export function subscribeTopupStream(
  token: string,
  paymentId: string,
  onPaid: (balance: number) => void,
  onError: (err: Error) => void,
): () => void {
  const controller = new AbortController();
  (async () => {
    const res = await fetch(`/api/proxy/wallet/topup/${paymentId}/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) { onError(new Error(`SSE ${res.status}`)); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = JSON.parse(line.slice(5).trim());
        if (payload.event === 'payment.paid') onPaid(payload.balance);
      }
    }
  })().catch((e) => { if (e.name !== 'AbortError') onError(e); });
  return () => controller.abort();
}
```

### `TopupModal.tsx` — เปลี่ยน polling → SSE

**ลบ**:
```typescript
// Status polling every 3s — ลบออกทั้งหมด
useEffect(() => {
  if (screen !== 'QR_DISPLAY' || !paymentId) return;
  const id = setInterval(poll, 3000);
  return () => clearInterval(id);
}, [screen, paymentId, getIdToken, onSuccess]);
```

**เพิ่มแทน**:
```typescript
useEffect(() => {
  if (screen !== 'QR_DISPLAY' || !paymentId) return;
  let cleanup: (() => void) | null = null;
  getIdToken().then((token) => {
    if (!token) return;
    cleanup = subscribeTopupStream(
      token,
      paymentId,
      (balance) => {
        setSuccessBalance(balance);
        onSuccess(balance);
        window.dispatchEvent(new CustomEvent('mb:coin-balance-update', { detail: { balance } }));
        setScreen('SUCCESS');
      },
      () => { /* silent — QR expiry countdown handles timeout UX */ },
    );
  });
  return () => cleanup?.();
}, [screen, paymentId, getIdToken, onSuccess]);
```

---

## Security Summary

| Layer | Mechanism |
|---|---|
| SSE auth | JWT ใน `Authorization: Bearer` header (ไม่ใช้ query param) |
| SSE ownership | ตรวจ `coin_topups.uid === jwt.uid` ก่อนเปิด stream |
| SSE lifetime | Auto-close เมื่อ `expires_at` ถึง + complete หลัง emit 1 ครั้ง |
| Webhook identity | `x-callback-token` (static) + HMAC-SHA256 signature (request body) |
| Simulate guard | `NODE_ENV !== 'production'` ใน service layer |
| Idempotency | ตรวจ `status !== 'pending'` ก่อนทำซ้ำ |
| Emit ordering | emit หลัง DB UPDATE สำเร็จเท่านั้น |

---

## Files Changed

| File | Action |
|---|---|
| `Backend/src/wallet/wallet-events.service.ts` | สร้างใหม่ |
| `Backend/src/wallet/wallet.service.ts` | แก้ `simulateTopup` + `processXenditWebhook` |
| `Backend/src/wallet/wallet.controller.ts` | เพิ่ม SSE endpoint |
| `Backend/src/wallet/wallet.module.ts` | เพิ่ม `WalletEventsService` |
| `Frontend/app/lib/studioApi.ts` | เพิ่ม `subscribeTopupStream` |
| `Frontend/app/components/TopupModal.tsx` | ลบ polling, เพิ่ม SSE useEffect |

---

## Out of Scope (deferred)

- Rate limiting (`ThrottlerGuard`) — เพิ่มทีหลัง
- Webhook `RawBodyMiddleware` setup — ถ้า Xendit ยังไม่ส่ง signature ใน sandbox ให้ skip HMAC check ก่อน และเพิ่มเมื่อเปิด production
