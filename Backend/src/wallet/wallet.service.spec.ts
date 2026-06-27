import { WalletService } from './wallet.service';
import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;
  let mockRpc: jest.Mock;
  let mockChain: any;
  let mockUpdateChain: any;
  let mockXendit: { createPromptPayCharge: jest.Mock; simulatePayment: jest.Mock; getPaymentRequest: jest.Mock };
  let mockWalletEvents: { emit: jest.Mock };

  // Helper: returns a thenable chain supporting .eq()/.select()/.maybeSingle() — used to mock update() chains.
  // The webhook atomic-claim path does: update().eq().eq().select().maybeSingle()
  const makeUpdateChain = (result: any) => {
    const chain: any = {};
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.maybeSingle = jest.fn().mockResolvedValue(result);
    chain.then = (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject);
    return chain;
  };

  beforeEach(() => {
    // mockUpdateChain is a shared instance returned by every mockChain.update() call.
    // Tests that need update().eq().eq().select().maybeSingle() (webhook atomic-claim) set
    // mockUpdateChain.maybeSingle.mockResolvedValue(...) directly.
    mockUpdateChain = makeUpdateChain({ error: null });
    mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnValue(mockUpdateChain),
    };
    mockRpc = jest.fn();
    mockXendit = {
      createPromptPayCharge: jest.fn(),
      simulatePayment: jest.fn(),
      getPaymentRequest: jest.fn(),
    };
    mockWalletEvents = { emit: jest.fn() };

    const supabaseService = {
      client: {
        from: jest.fn().mockReturnValue(mockChain),
        rpc: mockRpc,
      },
    } as any;

    service = new WalletService(supabaseService, mockXendit as any, mockWalletEvents as any);
  });

  // ─── getBalance ──────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('should return balance from wallet row', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: { balance: 100 }, error: null });
      const balance = await service.getBalance('u1');
      expect(balance).toBe(100);
    });

    it('should return 0 when no wallet row exists', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
      const balance = await service.getBalance('u1');
      expect(balance).toBe(0);
    });

    it('should throw when Supabase returns an error', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
      await expect(service.getBalance('u1')).rejects.toThrow('Failed to fetch wallet');
    });
  });

  // ─── addCoins ────────────────────────────────────────────────────────────

  describe('addCoins', () => {
    it('should call add_coins_atomic RPC and return new balance', async () => {
      mockRpc.mockResolvedValue({ data: [{ balance: 150 }], error: null });
      const res = await service.addCoins('u1', 50, 'topup');
      expect(res.balance).toBe(150);
      expect(mockRpc).toHaveBeenCalledWith('add_coins_atomic', expect.objectContaining({ p_amount: 50, p_type: 'topup' }));
    });

    it('should throw BadRequestException when amount is 0', async () => {
      await expect(service.addCoins('u1', 0, 'topup')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount is negative', async () => {
      await expect(service.addCoins('u1', -5, 'topup')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount exceeds MAX_TOPUP_COINS', async () => {
      await expect(service.addCoins('u1', 100001, 'topup')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount is not an integer', async () => {
      await expect(service.addCoins('u1', 10.5, 'topup')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── spendCoins ──────────────────────────────────────────────────────────

  describe('spendCoins', () => {
    it('should call spend_coins_atomic RPC and return new balance', async () => {
      mockRpc.mockResolvedValue({ data: [{ balance: 70 }], error: null });
      const res = await service.spendCoins('u1', 30, 'buy');
      expect(res.balance).toBe(70);
      expect(mockRpc).toHaveBeenCalledWith('spend_coins_atomic', expect.objectContaining({ p_amount: 30, p_type: 'purchase' }));
    });

    it('should throw BadRequestException when RPC raises INSUFFICIENT_FUNDS', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'INSUFFICIENT_FUNDS' } });
      await expect(service.spendCoins('u1', 50, 'buy')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount is 0', async () => {
      await expect(service.spendCoins('u1', 0, 'buy')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount exceeds MAX_TOPUP_COINS', async () => {
      await expect(service.spendCoins('u1', 100001, 'buy')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount is not an integer', async () => {
      await expect(service.spendCoins('u1', 10.5, 'buy')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── processRevenueSplit ─────────────────────────────────────────────────

  describe('processRevenueSplit', () => {
    it('should split 70/30', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [{ balance: 900 }], error: null }) // spend_coins_atomic
        .mockResolvedValueOnce({ data: [{ balance: 970 }], error: null }); // add_coins_atomic
      const res = await service.processRevenueSplit('u1', 'c1', 100, 'desc', 'ref');
      expect(res.creatorShare).toBe(70);
      expect(res.platformShare).toBe(30);
    });

    it('should floor platform share (no fractional coins)', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [{ balance: 990 }], error: null })
        .mockResolvedValueOnce({ data: [{ balance: 997 }], error: null });
      const res = await service.processRevenueSplit('u1', 'c1', 10, 'desc', 'ref');
      expect(res.platformShare).toBe(3);
      expect(res.creatorShare).toBe(7);
    });
  });

  // ─── getCreatorEarnings ──────────────────────────────────────────────────

  describe('getCreatorEarnings', () => {
    it('should return zeros when no row exists in translator_earnings VIEW', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const res = await service.getCreatorEarnings('u1');
      expect(res).toEqual({ totalSales: 0, totalEarned: 0, titlesSold: 0, uniqueBuyers: 0 });
    });

    it('should map VIEW columns correctly', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { total_sales: 5, total_earned: 350, titles_sold: 2, unique_buyers: 4 },
        error: null,
      });
      const res = await service.getCreatorEarnings('u1');
      expect(res.totalSales).toBe(5);
      expect(res.totalEarned).toBe(350);
      expect(res.titlesSold).toBe(2);
      expect(res.uniqueBuyers).toBe(4);
    });

    it('should throw when Supabase returns an error', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'view error' } });
      await expect(service.getCreatorEarnings('u1')).rejects.toThrow('Failed to fetch creator earnings');
    });
  });

  // ─── createTopup ─────────────────────────────────────────────────────────

  describe('createTopup', () => {
    it('should call xendit, insert row, and return payment details', async () => {
      mockXendit.createPromptPayCharge.mockResolvedValue({
        payment_id: 'pay_123',
        qr_string: 'qr_data',
        expires_at: '2026-06-19T20:00:00Z',
      });

      const result = await service.createTopup('u1', 100);

      expect(mockXendit.createPromptPayCharge).toHaveBeenCalledWith(100, expect.any(String), 'เติมเหรียญ MangaDock');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ payment_id: 'pay_123', uid: 'u1', amount_coins: 100, status: 'pending' }),
      );
      expect(result).toEqual({ paymentId: 'pay_123', qrString: 'qr_data', expiresAt: '2026-06-19T20:00:00Z' });
    });

    it('should throw when insert fails', async () => {
      mockXendit.createPromptPayCharge.mockResolvedValue({
        payment_id: 'pay_123', qr_string: 'qr_data', expires_at: '2026-06-19T20:00:00Z',
      });
      mockChain.insert.mockResolvedValue({ error: { message: 'unique violation' } });

      await expect(service.createTopup('u1', 100)).rejects.toThrow('Failed to save topup');
    });
  });

  // ─── getTopupStatus ───────────────────────────────────────────────────────

  describe('getTopupStatus', () => {
    it('should return pending status for active topup', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      mockChain.maybeSingle.mockResolvedValue({ data: { status: 'pending', expires_at: future }, error: null });

      const result = await service.getTopupStatus('pay_123', 'u1');
      expect(result.status).toBe('pending');
    });

    it('should update to expired and return expired when past expires_at', async () => {
      const past = new Date(Date.now() - 1_000).toISOString();
      mockChain.maybeSingle.mockResolvedValue({ data: { status: 'pending', expires_at: past }, error: null });

      const result = await service.getTopupStatus('pay_123', 'u1');
      expect(result.status).toBe('expired');
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'expired' });
    });

    it('should return paid status with balance', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: { status: 'paid', expires_at: future, uid: 'u1' }, error: null })
        .mockResolvedValueOnce({ data: { balance: 200 }, error: null }); // getBalance call

      const result = await service.getTopupStatus('pay_123', 'u1');
      expect(result.status).toBe('paid');
      expect(result.balance).toBe(200);
    });

    it('should throw NotFoundException when topup row not found', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
      await expect(service.getTopupStatus('pay_xxx', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── cancelTopup ─────────────────────────────────────────────────────────

  describe('cancelTopup', () => {
    it('should update to expired and return cancelled:true when pending', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: { status: 'pending' }, error: null });

      const result = await service.cancelTopup('pay_1', 'u1');
      expect(result).toEqual({ cancelled: true });
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'expired' });
    });

    it('should return cancelled:false when already paid', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: { status: 'paid' }, error: null });

      const result = await service.cancelTopup('pay_1', 'u1');
      expect(result).toEqual({ cancelled: false });
      expect(mockChain.update).not.toHaveBeenCalled();
    });

    it('should return cancelled:false when already expired', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: { status: 'expired' }, error: null });

      const result = await service.cancelTopup('pay_1', 'u1');
      expect(result).toEqual({ cancelled: false });
    });

    it('should throw NotFoundException when row not found', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.cancelTopup('pay_x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── simulateTopup ────────────────────────────────────────────────────────

  describe('simulateTopup', () => {
    const ORIGINAL_FLAG = process.env.XENDIT_ALLOW_SIMULATE;

    beforeEach(() => {
      process.env.XENDIT_ALLOW_SIMULATE = 'true';
    });
    afterEach(() => {
      if (ORIGINAL_FLAG === undefined) delete process.env.XENDIT_ALLOW_SIMULATE;
      else process.env.XENDIT_ALLOW_SIMULATE = ORIGINAL_FLAG;
    });

    it('should call xendit.simulatePayment with amount and return simulated:true when pending', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: { status: 'pending', amount_coins: 100 }, error: null });
      mockXendit.simulatePayment.mockResolvedValue(undefined);

      const result = await service.simulateTopup('pay_1', 'u1');
      expect(result).toEqual({ simulated: true });
      expect(mockXendit.simulatePayment).toHaveBeenCalledWith('pay_1', 100);
    });

    it('should throw ForbiddenException when XENDIT_ALLOW_SIMULATE is not "true"', async () => {
      delete process.env.XENDIT_ALLOW_SIMULATE;
      await expect(service.simulateTopup('pay_1', 'u1')).rejects.toThrow(ForbiddenException);
      expect(mockXendit.simulatePayment).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when row not found', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.simulateTopup('pay_x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when not pending', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: { status: 'paid' }, error: null });
      await expect(service.simulateTopup('pay_1', 'u1')).rejects.toThrow(BadRequestException);
      expect(mockXendit.simulatePayment).not.toHaveBeenCalled();
    });
  });

  // ─── processXenditWebhook ─────────────────────────────────────────────────

  describe('processXenditWebhook', () => {
    const WEBHOOK_TOKEN = 'test-webhook-token';

    beforeEach(() => {
      process.env.XENDIT_WEBHOOK_TOKEN = WEBHOOK_TOKEN;
    });

    afterEach(() => {
      delete process.env.XENDIT_WEBHOOK_TOKEN;
    });

    const succeededPayload = (prId: string) => ({
      event: 'payment.succeeded',
      data: { id: `pay_${prId}`, payment_request_id: prId, status: 'SUCCEEDED' },
    });
    const failedPayload = (prId: string) => ({
      event: 'payment.failed',
      data: { id: `pay_${prId}`, payment_request_id: prId, status: 'FAILED' },
    });
    const pendingPayload = (prId: string) => ({
      event: 'payment.pending',
      data: { id: `pay_${prId}`, payment_request_id: prId, status: 'PENDING' },
    });

    it('should throw UnauthorizedException on wrong token', async () => {
      await expect(
        service.processXenditWebhook(succeededPayload('pr-1'), 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when XENDIT_WEBHOOK_TOKEN env var is unset', async () => {
      delete process.env.XENDIT_WEBHOOK_TOKEN;
      await expect(
        service.processXenditWebhook(succeededPayload('pr-1'), 'any-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return received:true for non-succeeded events without crediting coins', async () => {
      const result = await service.processXenditWebhook(pendingPayload('pr-1'), WEBHOOK_TOKEN);
      expect(result).toEqual({ received: true });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('should mark topup expired on payment.failed event', async () => {
      const result = await service.processXenditWebhook(failedPayload('pr-1'), WEBHOOK_TOKEN);
      expect(result).toEqual({ received: true });
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'expired' });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('should credit coins on first succeeded webhook using data.payment_request_id', async () => {
      // Atomic claim succeeds: UPDATE returns the claimed row
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      mockRpc.mockResolvedValue({ data: [{ balance: 200 }], error: null });
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });

      const result = await service.processXenditWebhook(succeededPayload('pr-1'), WEBHOOK_TOKEN);
      expect(result).toEqual({ received: true });
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'paid' });
      expect(mockRpc).toHaveBeenCalledWith('add_coins_atomic', expect.objectContaining({ p_uid: 'u1', p_amount: 100 }));
    });

    it('should throw and propagate error when addCoins RPC fails after atomic claim', async () => {
      // Atomic claim succeeds (status set to paid), but addCoins RPC fails
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC down' } });
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });

      await expect(
        service.processXenditWebhook(succeededPayload('pr-1'), WEBHOOK_TOKEN),
      ).rejects.toThrow();

      // Atomic claim update WAS called (this is the new design — claim first, then credit)
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'paid' });
    });

    it('should be idempotent — no double credit if already paid', async () => {
      // UPDATE .eq('status','pending') matches nothing → maybeSingle returns null
      mockUpdateChain.maybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await service.processXenditWebhook(succeededPayload('pr-1'), WEBHOOK_TOKEN);
      expect(result).toEqual({ received: true });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('should return received:true when payment_id not found (safe unknown webhook)', async () => {
      // UPDATE finds no matching row → maybeSingle returns null
      mockUpdateChain.maybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await service.processXenditWebhook(succeededPayload('pr-unknown'), WEBHOOK_TOKEN);
      expect(result).toEqual({ received: true });
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('processXenditWebhook — SSE emit + HMAC', () => {
    const WEBHOOK_TOKEN = 'test-webhook-token';

    beforeEach(() => {
      process.env.XENDIT_WEBHOOK_TOKEN = WEBHOOK_TOKEN;
      mockWalletEvents.emit.mockClear();
    });

    afterEach(() => {
      delete process.env.XENDIT_WEBHOOK_TOKEN;
      delete process.env.XENDIT_WEBHOOK_SECRET;
    });

    it('emits SSE event with balance after successful payment', async () => {
      // Atomic claim returns the claimed row
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      mockRpc.mockResolvedValue({ data: [{ balance: 350 }], error: null });
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 100, currency: 'THB' });

      await service.processXenditWebhook(
        { event: 'payment.succeeded', data: { payment_request_id: 'pr-sse', status: 'SUCCEEDED' } },
        WEBHOOK_TOKEN,
      );

      expect(mockWalletEvents.emit).toHaveBeenCalledWith('pr-sse', { balance: 350 });
    });

    it('does NOT emit SSE on payment.failed', async () => {
      await service.processXenditWebhook(
        { event: 'payment.failed', data: { payment_request_id: 'pr-fail', status: 'FAILED' } },
        WEBHOOK_TOKEN,
      );
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
    });

    it('does NOT emit SSE when already paid (idempotency)', async () => {
      // UPDATE finds no pending row (already paid) → maybeSingle returns null → no addCoins, no SSE
      mockUpdateChain.maybeSingle.mockResolvedValue({ data: null, error: null });
      await service.processXenditWebhook(
        { event: 'payment.succeeded', data: { payment_request_id: 'pr-dup', status: 'SUCCEEDED' } },
        WEBHOOK_TOKEN,
      );
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
    });

    it('skips HMAC check when XENDIT_WEBHOOK_SECRET is not set', async () => {
      delete process.env.XENDIT_WEBHOOK_SECRET;
      // Atomic claim returns the claimed row
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 50, status: 'paid' },
        error: null,
      });
      mockRpc.mockResolvedValue({ data: [{ balance: 50 }], error: null });
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 50, currency: 'THB' });

      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-nohmac', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
          Buffer.from('body'),
          'any-sig',
        ),
      ).resolves.toEqual({ received: true });
    });

    it('throws UnauthorizedException when XENDIT_WEBHOOK_SECRET is set but rawBody is absent', async () => {
      process.env.XENDIT_WEBHOOK_SECRET = 'secret';
      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-1', status: 'SUCCEEDED' } },
          'test-webhook-token',
          undefined,  // no rawBody
          undefined,  // no signature
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on invalid HMAC when XENDIT_WEBHOOK_SECRET is set', async () => {
      process.env.XENDIT_WEBHOOK_SECRET = 'secret-key';
      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-1', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
          Buffer.from('{"body":true}'),
          'deadbeef',
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
    });

    it('SECURITY: reverts claim and refuses credit when Xendit amount mismatches', async () => {
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      // Xendit says only 10 was actually paid → must NOT credit 100
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'SUCCEEDED', amount: 10, currency: 'THB' });

      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-mm', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRpc).not.toHaveBeenCalled();          // no addCoins
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
      // claim reverted back to pending
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('SECURITY: reverts claim and refuses credit when Xendit status is not SUCCEEDED', async () => {
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'PENDING', amount: 100, currency: 'THB' });

      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-ns', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('SECURITY: reverts claim and throws when Xendit is unreachable (coins never credited unverified)', async () => {
      mockUpdateChain.maybeSingle.mockResolvedValue({
        data: { uid: 'u1', amount_coins: 100, status: 'paid' },
        error: null,
      });
      mockXendit.getPaymentRequest.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-down', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
        ),
      ).rejects.toThrow();

      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockWalletEvents.emit).not.toHaveBeenCalled();
      // claim reverted so a genuine later webhook retry can re-process
      expect(mockChain.update).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('revertClaim: logs warn but propagates original error when revert DB call fails (Xendit unreachable path)', async () => {
      const claimChain = makeUpdateChain({ data: { uid: 'u1', amount_coins: 100, status: 'paid' }, error: null });
      const revertChain = makeUpdateChain({ error: { message: 'DB unavailable' } });
      mockChain.update
        .mockReturnValueOnce(claimChain)
        .mockReturnValueOnce(revertChain);
      mockXendit.getPaymentRequest.mockRejectedValue(new Error('ECONNREFUSED'));
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-rv-down', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
        ),
      ).rejects.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pr-rv-down'));
    });

    it('revertClaim: logs warn but propagates UnauthorizedException when revert DB call fails (mismatch path)', async () => {
      const claimChain = makeUpdateChain({ data: { uid: 'u1', amount_coins: 100, status: 'paid' }, error: null });
      const revertChain = makeUpdateChain({ error: { message: 'DB unavailable' } });
      mockChain.update
        .mockReturnValueOnce(claimChain)
        .mockReturnValueOnce(revertChain);
      mockXendit.getPaymentRequest.mockResolvedValue({ status: 'PENDING', amount: 100, currency: 'THB' });
      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

      await expect(
        service.processXenditWebhook(
          { event: 'payment.succeeded', data: { payment_request_id: 'pr-rv-mm', status: 'SUCCEEDED' } },
          WEBHOOK_TOKEN,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pr-rv-mm'));
    });

    it('production: throws UnauthorizedException when secret is not configured', async () => {
      const ORIGINAL = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.XENDIT_WEBHOOK_SECRET;
      try {
        await expect(
          service.processXenditWebhook(
            { event: 'payment.succeeded', data: { payment_request_id: 'pr-prod', status: 'SUCCEEDED' } },
            WEBHOOK_TOKEN,
            Buffer.from('body'),
            'deadbeef',
          ),
        ).rejects.toThrow(UnauthorizedException);
      } finally {
        process.env.NODE_ENV = ORIGINAL;
      }
    });
  });

  describe('getTopupExpiry', () => {
    it('returns expiresAt and status for owned pending topup', async () => {
      mockChain.maybeSingle.mockResolvedValue({
        data: { expires_at: '2026-06-19T10:00:00Z', status: 'pending' },
        error: null,
      });
      const result = await service.getTopupExpiry('pay-1', 'u1');
      expect(result).toEqual({ expiresAt: '2026-06-19T10:00:00Z', status: 'pending' });
    });

    it('throws NotFoundException when topup not found or uid mismatch', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
      await expect(service.getTopupExpiry('pay-x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
