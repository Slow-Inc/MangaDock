import { CheckinService } from './checkin.service';
import { ConflictException } from '@nestjs/common';

describe('CheckinService', () => {
  let service: CheckinService;
  let mockRpc: jest.Mock;
  let mockChain: any;

  beforeEach(() => {
    mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    };
    mockRpc = jest.fn();
    const supabaseService = {
      client: { from: jest.fn().mockReturnValue(mockChain), rpc: mockRpc },
    } as any;
    service = new CheckinService(supabaseService);
  });

  describe('claimCheckin', () => {
    it('claims through the atomic RPC and maps streak/coins', async () => {
      mockRpc.mockResolvedValue({
        data: [{ streak_day: 3, coins: 7, balance: 107 }],
        error: null,
      });

      const res = await service.claimCheckin('u1');

      expect(mockRpc).toHaveBeenCalledWith(
        'claim_checkin_atomic',
        expect.objectContaining({ p_uid: 'u1' }),
      );
      expect(res).toEqual({
        checkedInToday: true,
        streakDay: 3,
        coinsToday: 7,
      });
    });

    // Regression #650/#664: the whole claim (gate + credit) is one atomic call —
    // there is no separate insert-then-credit that could double-credit or lose coins.
    it('performs the claim in a single RPC call (no separate credit)', async () => {
      mockRpc.mockResolvedValue({
        data: [{ streak_day: 1, coins: 5, balance: 5 }],
        error: null,
      });

      await service.claimCheckin('u1');

      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    it('maps ALREADY_CHECKED_IN to a 409 ConflictException', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'ALREADY_CHECKED_IN' },
      });

      await expect(service.claimCheckin('u1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('surfaces other RPC failures as a generic error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

      await expect(service.claimCheckin('u1')).rejects.toThrow(
        'Checkin failed: boom',
      );
    });
  });
});
