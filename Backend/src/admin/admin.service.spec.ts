import { AdminService } from './admin.service';
import { BadRequestException } from '@nestjs/common';

/** Thenable query-builder stub: every builder method returns itself; awaiting resolves to `result`. */
const thenable = (result: any) => {
  const c: any = {};
  for (const m of ['select', 'eq', 'gte', 'is', 'not', 'order', 'limit']) {
    c[m] = jest.fn(() => c);
  }
  c.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return c;
};

describe('AdminService', () => {
  let service: AdminService;
  let mockRpc: jest.Mock;
  let mockInsert: jest.Mock;
  let fromMock: jest.Mock;

  beforeEach(() => {
    mockRpc = jest.fn();
    mockInsert = jest.fn().mockResolvedValue({ error: null });
    fromMock = jest.fn().mockReturnValue({ insert: mockInsert });
    const supabaseService = {
      client: { from: fromMock, rpc: mockRpc },
    } as any;
    service = new AdminService(supabaseService);
  });

  describe('adjustWallet', () => {
    // Regression #651: a money-mutating admin action now leaves a persistent audit
    // trail and a traceable ledger reference (was logger-only + null reference).
    it('credits with a traceable reference and writes an adjust_wallet audit log', async () => {
      mockRpc.mockResolvedValue({ data: [{ balance: 150 }], error: null });

      const res = await service.adjustWallet('admin1', 'target1', 50, 'promo');

      expect(res).toEqual({ balance: 150 });
      expect(mockRpc).toHaveBeenCalledWith(
        'add_coins_atomic',
        expect.objectContaining({
          p_uid: 'target1',
          p_amount: 50,
          p_reference_id: expect.stringContaining(
            'admin_adjust:admin1:target1:',
          ),
        }),
      );
      expect(fromMock).toHaveBeenCalledWith('audit_logs');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_uid: 'admin1',
          action: 'adjust_wallet',
          target_type: 'user',
          target_id: 'target1',
        }),
      );
    });

    it('debits via spend_coins_atomic for a negative delta', async () => {
      mockRpc.mockResolvedValue({ data: [{ balance: 10 }], error: null });

      await service.adjustWallet('admin1', 'target1', -40, 'refund');

      expect(mockRpc).toHaveBeenCalledWith(
        'spend_coins_atomic',
        expect.objectContaining({ p_amount: 40 }),
      );
    });

    it('rejects a zero delta', async () => {
      await expect(
        service.adjustWallet('a', 't', 0, 'x'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getStats', () => {
    // Regression #653: transactionsToday count/sum come from a DB aggregate, not
    // from counting/summing a PostgREST-capped (~1000) row set in JS.
    it('reads tx count/sum from the DB aggregate RPC', async () => {
      const queued = [
        { count: 500 }, // total users
        { count: 12 }, // new users today
        { count: 34 }, // active posts
        { data: [] }, // recent bans
      ];
      let i = 0;
      fromMock.mockImplementation(() => thenable(queued[i++]));
      mockRpc.mockResolvedValue({
        data: [{ tx_count: 5000, coin_sum: 99999 }],
        error: null,
      });

      const stats = await service.getStats();

      expect(mockRpc).toHaveBeenCalledWith(
        'get_tx_stats_since',
        expect.any(Object),
      );
      expect(stats.transactionsToday).toEqual({ count: 5000, coinSum: 99999 });
    });
  });
});
