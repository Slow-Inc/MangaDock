import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { XenditService } from './xendit.service';
import { WalletEventsService } from './wallet-events.service';
import { BusinessMetricsService } from '../metrics/business-metrics.service';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { safeTokenEqual } from './xendit-webhook.config';

/** Hard upper bound per single coin mutation — bounds INTEGER-column overflow and abuse. */
export const MAX_TOPUP_COINS = 100000;

/**
 * THB charged per coin credited. Topup currency is THB-only today and the ratio
 * is 1:1, but "THB amount settled" and "coins to credit" are distinct units —
 * this makes the conversion explicit at the webhook-verification comparison so a
 * future pricing change (e.g. a promo ratio) can't silently break the check by
 * comparing two differently-unitized numbers as if they were interchangeable.
 */
export const THB_PER_COIN = 1;

/** Currency Xendit is configured to settle in; re-asserted on webhook verify. */
export const TOPUP_CURRENCY = 'THB';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly xenditService: XenditService,
    private readonly walletEvents: WalletEventsService,
    private readonly biz: BusinessMetricsService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  async getBalance(uid: string): Promise<number> {
    const { data, error } = await this.db
      .from('wallets')
      .select('balance')
      .eq('uid', uid)
      .maybeSingle();

    if (error)
      throw new InternalServerErrorException(
        `Failed to fetch wallet: ${error.message}`,
      );
    return data?.balance ?? 0;
  }

  async getTopupExpiry(
    paymentId: string,
    uid: string,
  ): Promise<{ expiresAt: string; status: string }> {
    const { data, error } = await this.db
      .from('coin_topups')
      .select('expires_at, status')
      .eq('payment_id', paymentId)
      .eq('uid', uid)
      .maybeSingle();

    if (error)
      throw new InternalServerErrorException(
        `Failed to fetch topup: ${error.message}`,
      );
    if (!data) throw new NotFoundException('Topup not found');
    return { expiresAt: data.expires_at, status: data.status };
  }

  async addCoins(
    uid: string,
    amount: number,
    type: 'topup' | 'reward',
    description?: string,
    referenceId?: string,
  ): Promise<{ balance: number }> {
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_TOPUP_COINS) {
      throw new BadRequestException(
        `Amount must be an integer between 1 and ${MAX_TOPUP_COINS}`,
      );
    }

    const { data, error } = await this.db.rpc('add_coins_atomic', {
      p_uid: uid,
      p_amount: amount,
      p_type: type,
      p_description: description ?? null,
      p_reference_id: referenceId ?? null,
    });

    if (error)
      throw new InternalServerErrorException(
        `Failed to add coins: ${error.message}`,
      );

    const newBalance: number = Array.isArray(data)
      ? data[0]?.balance
      : data?.balance;
    this.logger.log(
      `Added ${amount} coins (${type}) to user ${uid}, new balance: ${newBalance}`,
    );
    this.biz.recordCoinsAdded(amount);
    return { balance: newBalance };
  }

  async spendCoins(
    uid: string,
    amount: number,
    description: string,
    referenceId?: string,
  ): Promise<{ balance: number }> {
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_TOPUP_COINS) {
      throw new BadRequestException(
        `Amount must be an integer between 1 and ${MAX_TOPUP_COINS}`,
      );
    }

    const { data, error } = await this.db.rpc('spend_coins_atomic', {
      p_uid: uid,
      p_amount: amount,
      p_type: 'purchase',
      p_description: description,
      p_reference_id: referenceId ?? null,
    });

    if (error) {
      if (error.message?.includes('INSUFFICIENT_FUNDS')) {
        throw new BadRequestException('Insufficient balance');
      }
      throw new InternalServerErrorException(
        `Failed to spend coins: ${error.message}`,
      );
    }

    const newBalance: number = Array.isArray(data)
      ? data[0]?.balance
      : data?.balance;
    this.logger.log(
      `Spent ${amount} coins for user ${uid}, new balance: ${newBalance}`,
    );
    this.biz.recordCoinsSpent(amount);
    return { balance: newBalance };
  }

  // NOTE: superseded for unlocks by purchase_unlock_atomic; kept for ad-hoc/admin use.
  /**
   * High-level purchase flow that splits revenue between Creator and Platform.
   * Standard Split: 70% to Creator, 30% to Platform.
   */
  async processRevenueSplit(
    userUid: string,
    creatorUid: string,
    amount: number,
    description: string,
    referenceId: string,
  ) {
    const { balance } = await this.spendCoins(
      userUid,
      amount,
      description,
      referenceId,
    );

    const PLATFORM_FEE_PCT = 0.3;
    const platformShare = Math.floor(amount * PLATFORM_FEE_PCT);
    const creatorShare = amount - platformShare;

    if (creatorShare > 0) {
      await this.addCoins(
        creatorUid,
        creatorShare,
        'reward',
        `ส่วนแบ่งรายได้: ${description}`,
      );
      this.logger.log(
        `Revenue Split: User ${userUid} paid ${amount}. Creator ${creatorUid} received ${creatorShare}. Platform took ${platformShare}.`,
      );
    }

    return { balance, platformShare, creatorShare };
  }

  async getCreatorEarnings(uid: string): Promise<{
    totalSales: number;
    totalEarned: number;
    titlesSold: number;
    uniqueBuyers: number;
  }> {
    const { data, error } = await this.db
      .from('translator_earnings')
      .select('*')
      .eq('translator_uid', uid)
      .maybeSingle();

    if (error)
      throw new InternalServerErrorException(
        `Failed to fetch creator earnings: ${error.message}`,
      );
    if (!data)
      return { totalSales: 0, totalEarned: 0, titlesSold: 0, uniqueBuyers: 0 };

    return {
      totalSales: data.total_sales,
      totalEarned: data.total_earned,
      titlesSold: data.titles_sold,
      uniqueBuyers: data.unique_buyers,
    };
  }

  async getTransactions(uid: string, limit = 50) {
    const { data, error } = await this.db
      .from('wallet_transactions')
      .select('*')
      .eq('uid', uid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error)
      throw new InternalServerErrorException(
        `Failed to fetch transactions: ${error.message}`,
      );

    return (data ?? []).map((row) => ({
      id: row.id,
      uid: row.uid,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balance_after,
      description: row.description,
      referenceId: row.reference_id,
      createdAt: row.created_at,
    }));
  }

  // ── Xendit Topup ────────────────────────────────────────────────────────────

  async createTopup(
    uid: string,
    amount: number,
  ): Promise<{ paymentId: string; qrString: string; expiresAt: string }> {
    const referenceId = randomUUID();
    const { payment_id, qr_string, expires_at } =
      await this.xenditService.createPromptPayCharge(
        amount,
        referenceId,
        'เติมเหรียญ MangaDock',
      );

    const { error } = await this.db.from('coin_topups').insert({
      payment_id,
      uid,
      amount_coins: amount,
      status: 'pending',
      qr_string,
      expires_at,
    });

    if (error)
      throw new InternalServerErrorException(
        `Failed to save topup: ${error.message}`,
      );

    return {
      paymentId: payment_id,
      qrString: qr_string,
      expiresAt: expires_at,
    };
  }

  async getTopupStatus(
    paymentId: string,
    uid: string,
  ): Promise<{ status: string; balance?: number }> {
    const { data, error } = await this.db
      .from('coin_topups')
      .select('*')
      .eq('payment_id', paymentId)
      .eq('uid', uid)
      .maybeSingle();

    if (error)
      throw new InternalServerErrorException(
        `Failed to get topup status: ${error.message}`,
      );
    if (!data) throw new NotFoundException('Topup not found');

    if (data.status === 'pending' && new Date(data.expires_at) < new Date()) {
      await this.db
        .from('coin_topups')
        .update({ status: 'expired' })
        .eq('payment_id', paymentId)
        .eq('status', 'pending');
      return { status: 'expired' };
    }

    if (data.status === 'paid') {
      const balance = await this.getBalance(uid);
      return { status: 'paid', balance };
    }

    return { status: data.status };
  }

  async cancelTopup(
    paymentId: string,
    uid: string,
  ): Promise<{ cancelled: boolean }> {
    const { data, error } = await this.db
      .from('coin_topups')
      .select('status')
      .eq('payment_id', paymentId)
      .eq('uid', uid)
      .maybeSingle();

    if (error)
      throw new InternalServerErrorException(
        `Failed to fetch topup: ${error.message}`,
      );
    if (!data) throw new NotFoundException('Topup not found');
    if (data.status !== 'pending') return { cancelled: false };

    const { error: updateError } = await this.db
      .from('coin_topups')
      .update({ status: 'expired' })
      .eq('payment_id', paymentId)
      .eq('uid', uid)
      .eq('status', 'pending');

    if (updateError)
      throw new InternalServerErrorException(
        `Failed to cancel topup: ${updateError.message}`,
      );
    this.logger.log(`Topup cancelled by user ${uid}: ${paymentId}`);
    return { cancelled: true };
  }

  async simulateTopup(
    paymentId: string,
    uid: string,
  ): Promise<{ simulated: boolean }> {
    if (process.env.XENDIT_ALLOW_SIMULATE !== 'true') {
      throw new ForbiddenException('Simulate is not available');
    }

    const { data, error } = await this.db
      .from('coin_topups')
      .select('status, amount_coins')
      .eq('payment_id', paymentId)
      .eq('uid', uid)
      .maybeSingle();

    if (error)
      throw new InternalServerErrorException(
        `Failed to fetch topup: ${error.message}`,
      );
    if (!data) throw new NotFoundException('Topup not found');
    if (data.status !== 'pending')
      throw new BadRequestException('Topup is not in pending state');

    await this.xenditService.simulatePayment(paymentId, data.amount_coins);
    this.logger.log(
      `Simulate payment triggered for ${paymentId} by user ${uid}`,
    );
    return { simulated: true };
  }

  private async revertClaim(paymentId: string): Promise<void> {
    const { error } = await this.db
      .from('coin_topups')
      .update({ status: 'pending' })
      .eq('payment_id', paymentId)
      .eq('status', 'paid');
    if (error) {
      this.logger.warn(`revertClaim failed for ${paymentId}: ${error.message}`);
    }
  }

  async processXenditWebhook(
    payload: Record<string, any>,
    token: string,
    rawBody?: Buffer,
    signature?: string,
  ): Promise<{ received: boolean }> {
    // 1. Static token check (constant-time — V8)
    const expected = process.env.XENDIT_WEBHOOK_TOKEN;
    if (!safeTokenEqual(token, expected)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    // 2. HMAC-SHA256 check — MANDATORY in production (V1). Outside production it
    //    is enforced only when XENDIT_WEBHOOK_SECRET is configured.
    const webhookSecret = process.env.XENDIT_WEBHOOK_SECRET;
    const requireHmac = process.env.NODE_ENV === 'production';
    if (requireHmac && !webhookSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }
    if (webhookSecret) {
      if (!rawBody || !signature) {
        throw new UnauthorizedException('Missing webhook signature');
      }
      if (!/^[0-9a-f]+$/i.test(signature)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
      const computed = createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      let valid = false;
      try {
        const a = Buffer.from(computed, 'hex');
        const b = Buffer.from(signature, 'hex');
        valid = a.length === b.length && timingSafeEqual(a, b);
      } catch {
        valid = false;
      }
      if (!valid) throw new UnauthorizedException('Invalid webhook signature');
    }

    const event: string = payload.event;
    const eventData: Record<string, any> = payload.data ?? {};
    const paymentRequestId: string = eventData.payment_request_id;
    const status: string = eventData.status;

    if (event === 'payment.failed' || status === 'FAILED') {
      if (paymentRequestId) {
        await this.db
          .from('coin_topups')
          .update({ status: 'expired' })
          .eq('payment_id', paymentRequestId)
          .eq('status', 'pending');
        this.logger.warn(`Xendit payment failed: ${paymentRequestId}`);
      }
      return { received: true };
    }

    if (event !== 'payment.succeeded' || status !== 'SUCCEEDED') {
      return { received: true };
    }

    const paymentId: string = paymentRequestId;

    // Atomic claim: UPDATE only if still pending — prevents concurrent webhook retries from double-crediting.
    const { data: claimed, error: claimError } = await this.db
      .from('coin_topups')
      .update({ status: 'paid' })
      .eq('payment_id', paymentId)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (claimError) {
      throw new InternalServerErrorException(
        `Failed to claim topup: ${claimError.message}`,
      );
    }
    if (!claimed) {
      this.logger.warn(
        `Webhook: coin_topup not claimable (not found or already processed) for payment_id=${paymentId}`,
      );
      return { received: true };
    }

    // Active verification (V1/V2): the webhook payload is untrusted. Re-fetch the
    // authoritative payment state from Xendit and reconcile the settled amount
    // before crediting. On any mismatch or fetch failure, revert the claim back
    // to 'pending' so a genuine later webhook can retry, and refuse to credit.
    let verified: { status: string; amount: number; currency: string };
    try {
      verified = await this.xenditService.getPaymentRequest(paymentId);
    } catch (err) {
      await this.revertClaim(paymentId);
      this.logger.error(
        `Webhook verify failed (Xendit unreachable) for ${paymentId}: ${String(err)}`,
      );
      throw new InternalServerErrorException('Payment verification failed');
    }

    // Expected THB Xendit should have settled for this claim, derived from the coin
    // count via the explicit THB_PER_COIN conversion (units are NOT interchangeable).
    const expectedThb = claimed.amount_coins * THB_PER_COIN;
    if (
      verified.status !== 'SUCCEEDED' ||
      verified.currency !== TOPUP_CURRENCY ||
      Number(verified.amount) !== expectedThb
    ) {
      await this.revertClaim(paymentId);
      this.logger.error(
        `SECURITY: webhook verification mismatch for ${paymentId} — ` +
          `xenditStatus=${verified.status} xenditCurrency=${verified.currency} ` +
          `xenditAmount=${verified.amount} expectedCurrency=${TOPUP_CURRENCY} expectedThb=${expectedThb}`,
      );
      throw new UnauthorizedException('Payment verification failed');
    }

    let balance: number;
    try {
      ({ balance } = await this.addCoins(
        claimed.uid,
        claimed.amount_coins,
        'topup',
        'เติมเหรียญ MangaDock',
        paymentId,
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // DB-level topup idempotency (wallet_tx_topup_ref_uidx) means this payment was
      // already credited once. Treat as success: do NOT revert, re-read the balance, emit.
      if (/duplicate key|wallet_tx_topup_ref_uidx/i.test(msg)) {
        const current = await this.getBalance(claimed.uid);
        this.walletEvents.emit(paymentId, { balance: current });
        return { received: true };
      }
      // Genuine credit failure: revert the claim so a Xendit retry re-processes it,
      // then rethrow so Xendit receives a 5xx and retries.
      await this.revertClaim(paymentId);
      this.logger.error(
        `Webhook credit failed after claim for ${paymentId}: ${msg} — claim reverted to pending for retry`,
      );
      throw err;
    }

    // Emit SSE after addCoins succeeds — security ordering invariant
    this.walletEvents.emit(paymentId, { balance });

    return { received: true };
  }
}
