import { WalletService } from './wallet.service';
import { BadRequestException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;
  let mockRpc: jest.Mock;
  let mockChain: any;

  beforeEach(() => {
    mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };
    mockRpc = jest.fn();

    const supabaseService = {
      client: {
        from: jest.fn().mockReturnValue(mockChain),
        rpc: mockRpc,
      },
    } as any;

    service = new WalletService(supabaseService);
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
  });

  // ─── processRevenueSplit ─────────────────────────────────────────────────

  describe('processRevenueSplit', () => {
    it('should split 70/30', async () => {
      // spend → balance 900, add → balance 970 (not checked here)
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
});
