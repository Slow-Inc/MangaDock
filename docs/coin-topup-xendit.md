# Coin Topup System — Xendit PromptPay QR (Sandbox)

> สถานะ: **Design complete — ready for implementation**
> ตัดสินใจออกแบบทั้งหมดใน grill session 2026-06-19

---

## 1. Design Decisions (สรุปสิ่งที่ตกลงแล้ว)

| หัวข้อ | ตัดสินใจ |
|--------|---------|
| Payment provider | Xendit (sandbox) |
| Payment method | PromptPay QR เท่านั้น |
| Coin tiers | 20, 50, 100, 200, 500, 1000, custom (≥20) |
| Exchange rate | 1 Coin = 1 THB |
| UI flow | Inline QR modal (ไม่ redirect ออก) |
| Status update | Frontend polling `GET /wallet/topup/status/:paymentId` ทุก 3s |
| Entry points | Navbar (login แล้วเท่านั้น) + BookDetailModal (เหรียญไม่พอ) |
| Studio Wallet page | Read-only, ไม่มี topup |
| Webhook security | Header `x-callback-token` verification |
| Idempotency | `coin_topups` table + UNIQUE constraint บน `payment_id` |
| QR expiry | Countdown 15 นาที + ปุ่ม "สร้าง QR ใหม่" |
| ปิด modal กลางคัน | ปล่อย QR หมดอายุเอง (webhook ยังยิงได้ถ้า user สแกนก่อนหมด) |
| Sandbox webhook URL | `https://web.2552667.xyz/api/xendit/webhook` |

---

## 2. Full Payment Flow

```
[User กด "ซื้อเหรียญ"]
      │
      ▼
[TopupModal เปิด — แสดง tier selector]
      │
      │ user เลือก tier แล้วกด "ดำเนินการ"
      ▼
POST /wallet/topup/create  { amount: 100 }
      │
      │ Backend เรียก Xendit API: POST /v2/payment_methods (QR)
      ▼
Backend INSERT coin_topups (payment_id, uid, amount, status='pending', qr_string, expires_at)
      │
      │ ส่ง response กลับ
      ▼
{ paymentId, qrString, expiresAt }
      │
      ▼
[TopupModal แสดง QR + countdown timer]
      │
      │ Frontend poll ทุก 3s
      ▼
GET /wallet/topup/status/:paymentId
      │
      │ ─── ขณะเดียวกัน user สแกน QR ───
      ▼
Xendit ยิง POST /wallet/xendit/webhook
      │
      │ Backend verify x-callback-token
      │ Backend check coin_topups.status ≠ 'paid' (idempotency)
      │ Backend UPDATE coin_topups SET status='paid'
      │ Backend addCoins(uid, amount, 'topup', reference_id=payment_id)
      ▼
GET /wallet/topup/status/:paymentId → { status: 'paid', balance: 250 }
      │
      ▼
[TopupModal แสดง "ชำระเงินสำเร็จ ✓" + balance ใหม่]
      │
      ▼
[Modal ปิดอัตโนมัติ หรือ user กด X]
```

---

## 3. Database — สิ่งที่ต้องสร้างใหม่

### 3.1 Table: `coin_topups`

```sql
CREATE TABLE coin_topups (
  payment_id   TEXT PRIMARY KEY,          -- Xendit payment/charge ID
  uid          UUID NOT NULL,             -- Supabase auth user
  amount_coins INTEGER NOT NULL CHECK (amount_coins >= 20),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','paid','expired')),
  qr_string    TEXT NOT NULL,             -- raw QR string จาก Xendit
  expires_at   TIMESTAMPTZ NOT NULL,      -- หมดอายุเมื่อไหร่ (Xendit ให้มา)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ป้องกัน credit ซ้ำ (webhook retry)
CREATE UNIQUE INDEX coin_topups_payment_id_idx ON coin_topups(payment_id);

-- ดึงประวัติ topup ของ user
CREATE INDEX coin_topups_uid_idx ON coin_topups(uid, created_at DESC);
```

**Apply ผ่าน Supabase MCP `apply_migration`** — ไม่แก้ `supabase-migration.sql` โดยตรง

### 3.2 ไม่ต้องแตะ table อื่น

- `wallets` — ใช้เดิม (balance update ผ่าน `add_coins_atomic` RPC เดิม)
- `wallet_transactions` — ใช้เดิม (`add_coins_atomic` log อัตโนมัติ, `reference_id = payment_id`)

---

## 4. Backend — สิ่งที่ต้องสร้าง/แก้

### 4.1 Environment Variables ใหม่ใน `.env` / `.env.example`

```env
# ==============================
# Xendit Payment Gateway
# ==============================
XENDIT_SECRET_KEY=xnd_development_XXXXXXXX
XENDIT_WEBHOOK_TOKEN=your-xendit-callback-token
```

- `XENDIT_SECRET_KEY` — ใช้ Basic Auth (base64 encode เป็น `Authorization: Basic <base64(key:)>`)
- `XENDIT_WEBHOOK_TOKEN` — ค่าที่ตั้งใน Xendit dashboard → Webhooks → Token

### 4.2 ไฟล์ใหม่: `Backend/src/wallet/xendit.service.ts`

Service เดียวที่ wrap Xendit HTTP API — ไม่ใช้ Xendit SDK (ลด dependency)

**Methods:**
```typescript
createPromptPayCharge(amount: number, referenceId: string, description: string): Promise<{
  payment_id: string;
  qr_string: string;
  expires_at: string; // ISO string
}>
```

**Implementation detail:**
- เรียก `POST https://api.xendit.co/payment_requests` (Xendit API v2)
- Body:
  ```json
  {
    "reference_id": "<referenceId>",
    "currency": "THB",
    "amount": <amount>,
    "country": "TH",
    "payment_method": {
      "type": "QR_CODE",
      "reusability": "ONE_TIME_USE",
      "qr_code": { "channel_code": "PROMPTPAY" }
    },
    "description": "<description>"
  }
  ```
- Authorization: `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`
- Map response → `{ payment_id, qr_string, expires_at }`

### 4.3 ไฟล์ใหม่: `Backend/src/wallet/dto/create-topup.dto.ts`

```typescript
export class CreateTopupDto {
  @IsInt()
  @Min(20)
  amount: number;
}
```

### 4.4 แก้ไข: `Backend/src/wallet/wallet.service.ts`

เพิ่ม 3 methods:

**`createTopup(uid, amount)`**
1. สร้าง `referenceId = crypto.randomUUID()`
2. เรียก `xenditService.createPromptPayCharge(amount, referenceId, 'เติมเหรียญ MangaDock')`
3. INSERT `coin_topups` (status='pending')
4. Return `{ paymentId, qrString, expiresAt }`

**`getTopupStatus(paymentId, uid)`**
1. SELECT `coin_topups` WHERE `payment_id = paymentId AND uid = uid`
2. ถ้าไม่เจอ → throw `NotFoundException`
3. ถ้า `expires_at < NOW()` และ status ยัง 'pending' → UPDATE status='expired', return `{ status: 'expired' }`
4. Return `{ status, balance?: number }` (balance มีเฉพาะตอน status='paid')

**`processXenditWebhook(payload, token)`**
1. Verify `token === process.env.XENDIT_WEBHOOK_TOKEN` → ถ้าไม่ตรง throw `UnauthorizedException`
2. ตรวจ `payload.status === 'SUCCEEDED'` และ `payload.event === 'payment.succeeded'`
3. ดึง `payment_id` จาก `payload.id`
4. SELECT `coin_topups` WHERE `payment_id` — ถ้าไม่เจอ log แล้ว return 200 (safe)
5. ถ้า status ≠ 'pending' → return 200 (idempotency — webhook retry)
6. UPDATE `coin_topups` SET status='paid'
7. เรียก `addCoins(uid, amount_coins, 'topup', referenceId=payment_id)`
8. Return `{ received: true }`

### 4.5 แก้ไข: `Backend/src/wallet/wallet.controller.ts`

เพิ่ม 3 endpoints:

```
POST /wallet/topup/create     @UseGuards(AuthGuard)   → createTopup
GET  /wallet/topup/status/:paymentId  @UseGuards(AuthGuard)  → getTopupStatus
POST /wallet/xendit/webhook   (NO AuthGuard — public)  → processXenditWebhook
```

**หมายเหตุ `/wallet/xendit/webhook`:**
- ต้องอยู่ก่อน `@Controller('wallet')` จัดการได้ หรือใช้ path เต็ม
- ไม่ใช้ `AuthGuard` เพราะ Xendit ไม่ส่ง Bearer token
- ตรวจ `x-callback-token` header ใน service แทน
- ต้อง skip `HardwareIdMiddleware` สำหรับ path นี้

**`POST /wallet/xendit/webhook` controller:**
```typescript
@Post('xendit/webhook')
async xenditWebhook(
  @Body() body: any,
  @Headers('x-callback-token') token: string,
) {
  return this.wallet.processXenditWebhook(body, token);
}
```

### 4.6 แก้ไข: `Backend/src/wallet/wallet.module.ts`

- import และ provide `XenditService`
- XenditService ต้องการ `ConfigModule` หรืออ่าน `process.env` โดยตรง (ง่ายกว่า)

### 4.7 แก้ไข: `Backend/src/app.module.ts` (ถ้ามี HardwareIdMiddleware)

Exclude `/wallet/xendit/webhook` จาก `HardwareIdMiddleware`:
```typescript
consumer.apply(HardwareIdMiddleware)
  .exclude({ path: 'wallet/xendit/webhook', method: RequestMethod.POST })
  .forRoutes(...)
```

---

## 5. Frontend — สิ่งที่ต้องสร้าง/แก้

### 5.1 API calls ใหม่ใน `Frontend/app/lib/studioApi.ts`

```typescript
export type TopupResult = {
  paymentId: string;
  qrString: string;
  expiresAt: string; // ISO string
};

export type TopupStatus = {
  status: 'pending' | 'paid' | 'expired';
  balance?: number;
};

export async function createTopup(token: string, amount: number): Promise<TopupResult>

export async function getTopupStatus(token: string, paymentId: string): Promise<TopupStatus>
```

### 5.2 ไฟล์ใหม่: `Frontend/app/components/TopupModal.tsx`

**Props:**
```typescript
type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
  initialAmount?: number; // ถ้าส่งมา = ข้ามหน้า tier selector ตรงไป QR
}
```

**State machine (3 screens):**

```
SCREEN 1: TIER_SELECT
  - แสดง 6 preset buttons: 20 / 50 / 100 / 200 / 500 / 1000
  - Custom input (≥20, integer, ไม่ใส่ไม่ให้กด confirm)
  - ปุ่ม "ดำเนินการ" → เรียก createTopup → เข้า SCREEN 2

SCREEN 2: QR_DISPLAY
  - แสดง QR code (ใช้ library `qrcode.react` หรือ render <img> จาก qr_string)
  - Countdown timer (expiresAt - now)
  - ข้อความ "สแกน QR ด้วยแอปธนาคาร"
  - เมื่อ countdown = 0 → เข้า SCREEN 2b (expired)
  - Polling ทุก 3s → ถ้า status='paid' → เข้า SCREEN 3

SCREEN 2b: QR_EXPIRED
  - QR ซีด/blur
  - ปุ่ม "สร้าง QR ใหม่" → กลับ SCREEN 1 (หรือ call createTopup ใหม่ด้วย amount เดิม)

SCREEN 3: SUCCESS
  - ✓ icon + "ชำระเงินสำเร็จ"
  - แสดงยอดเหรียญใหม่
  - ปุ่ม "ปิด" หรือ auto-close หลัง 2 วินาที
```

**Polling logic:**
```typescript
useEffect(() => {
  if (screen !== 'QR_DISPLAY' || !paymentId) return;
  const interval = setInterval(async () => {
    const result = await getTopupStatus(token, paymentId);
    if (result.status === 'paid') {
      clearInterval(interval);
      onSuccess(result.balance!);
      setScreen('SUCCESS');
    } else if (result.status === 'expired') {
      clearInterval(interval);
      setScreen('QR_EXPIRED');
    }
  }, 3000);
  return () => clearInterval(interval);
}, [screen, paymentId]);
```

**QR rendering:**
- ใช้ package `qrcode.react` (`<QRCodeSVG value={qrString} size={200} />`)
- ถ้าไม่อยาก install: ใช้ `<img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrString)}`} />` (external service — เหมาะ sandbox เท่านั้น)
- **แนะนำ qrcode.react** เพราะ render locally ไม่ต้องพึ่ง external

**Animation:** ใช้ pattern เดิม (double `requestAnimationFrame` enter, `setTimeout` exit)

### 5.3 แก้ไข: `Frontend/app/components/NavbarActions.tsx`

เพิ่ม coin balance display ก่อน avatar button:

```tsx
// เพิ่ม state
const [coinBalance, setCoinBalance] = useState<number | null>(null);
const [showTopup, setShowTopup] = useState(false);

// เพิ่ม fetch balance เมื่อ user login
useEffect(() => {
  if (!user) return;
  getWalletBalance(token).then(r => setCoinBalance(r.balance));
}, [user]);

// Listen for balance update event (หลัง TopupModal success)
useEffect(() => {
  const handler = (e: CustomEvent<{ balance: number }>) => {
    setCoinBalance(e.detail.balance);
  };
  window.addEventListener('mb:coin-balance-update', handler);
  return () => window.removeEventListener('mb:coin-balance-update', handler);
}, []);
```

**UI ที่เพิ่ม** (วางก่อน avatar button, แสดงเฉพาะ `user` ไม่ใช่ `loading`):
```tsx
{user && coinBalance !== null && (
  <button
    onClick={() => setShowTopup(true)}
    className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-300 smooth-hover-fast hover:bg-amber-400/20"
  >
    🪙 {coinBalance.toLocaleString()}
  </button>
)}

<TopupModal
  isOpen={showTopup}
  onClose={() => setShowTopup(false)}
  onSuccess={(balance) => {
    setCoinBalance(balance);
    setShowTopup(false);
  }}
/>
```

### 5.4 แก้ไข: `Frontend/app/components/BookDetailModal.tsx`

**ปัจจุบัน:** มี state `showTopup` + function `handleTopup` ที่เรียก dev endpoint `topupCoins()`

**เปลี่ยนเป็น:**
1. ลบ `handleTopup` function เดิม
2. ลบ state `topupAmount`
3. เพิ่ม `<TopupModal>` แทน inline topup form
4. `showTopup` state เดิมใช้เป็น `isOpen` prop ของ TopupModal
5. `onSuccess` ของ TopupModal → `setCoinBalance(balance)`

```tsx
// แทน inline topup UI
<TopupModal
  isOpen={showTopup}
  onClose={() => setShowTopup(false)}
  initialAmount={/* ราคาของ chapter ที่กำลังจะซื้อ ถ้ามี */}
  onSuccess={(balance) => {
    setCoinBalance(balance);
    setShowTopup(false);
  }}
/>
```

---

## 6. สรุป Files ที่ต้องแตะ

### Backend — ไฟล์ใหม่
| ไฟล์ | Action |
|------|--------|
| `Backend/src/wallet/xendit.service.ts` | สร้างใหม่ |
| `Backend/src/wallet/dto/create-topup.dto.ts` | สร้างใหม่ |
| Supabase migration (coin_topups) | apply ผ่าน MCP |

### Backend — แก้ไข
| ไฟล์ | สิ่งที่เพิ่ม |
|------|-------------|
| `Backend/src/wallet/wallet.service.ts` | `createTopup`, `getTopupStatus`, `processXenditWebhook` |
| `Backend/src/wallet/wallet.controller.ts` | 3 endpoints ใหม่ |
| `Backend/src/wallet/wallet.module.ts` | provide `XenditService` |
| `Backend/.env.example` | `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN` |
| `Backend/src/app.module.ts` | exclude webhook path จาก HardwareIdMiddleware |

### Frontend — ไฟล์ใหม่
| ไฟล์ | Action |
|------|--------|
| `Frontend/app/components/TopupModal.tsx` | สร้างใหม่ |

### Frontend — แก้ไข
| ไฟล์ | สิ่งที่เพิ่ม |
|------|-------------|
| `Frontend/app/lib/studioApi.ts` | `createTopup`, `getTopupStatus`, types |
| `Frontend/app/components/NavbarActions.tsx` | coin balance chip + TopupModal |
| `Frontend/app/components/BookDetailModal.tsx` | swap inline topup → TopupModal |

---

## 7. สิ่งที่ต้อง Setup บน Xendit Dashboard (sandbox)

1. สร้าง account sandbox ที่ dashboard.xendit.co
2. ได้ `Secret API Key` (เริ่มด้วย `xnd_development_`)
3. ตั้ง Webhook URL = `https://web.2552667.xyz/api/xendit/webhook`
4. Copy `Webhook Verification Token` → ใส่ใน `XENDIT_WEBHOOK_TOKEN`
5. Subscribe event: `payment.succeeded`

---

## 8. สิ่งที่ยังไม่ทำในรอบนี้ (Deferred)

- Real payment gateway (production keys)
- Bonus coins per tier
- Refund mechanism
- Creator cashout / withdrawal
- Transaction pagination (limit > 50)
- Mobile app deep-link กลับจาก QR

---

## 9. Dependencies ใหม่

| Package | ใช้ที่ | เหตุผล |
|---------|--------|--------|
| `qrcode.react` | Frontend | render QR code locally จาก qr_string |

ไม่มี Xendit SDK — เรียก HTTP ตรงเพื่อลด dependency
