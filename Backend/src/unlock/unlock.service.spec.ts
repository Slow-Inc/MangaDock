import { UnlockService } from './unlock.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('UnlockService', () => {
  let service: UnlockService;
  let walletService: any;
  let mockChain: any;
  let mockRpc: jest.Mock;

  beforeEach(() => {
    mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };
    mockRpc = jest.fn();
    const supabaseService = {
      client: { from: jest.fn().mockReturnValue(mockChain), rpc: mockRpc },
    } as any;
    walletService = { getBalance: jest.fn().mockResolvedValue(100) };
    const biz = { recordUnlock: jest.fn() } as any;
    service = new UnlockService(supabaseService, walletService, biz);
  });

  describe('purchaseUnlock', () => {
    it('unlocks a published paid chapter via the atomic RPC (no pre-SELECT)', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            balance: 90,
            already_unlocked: false,
            creator_share: 7,
            platform_share: 3,
            price_paid: 10,
          },
        ],
        error: null,
      });

      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ unlocked: true, pricePaid: 10, balance: 90 });
      // No price/creator trusted from the caller anymore.
      expect(mockRpc).toHaveBeenCalledWith(
        'purchase_unlock_atomic',
        expect.objectContaining({
          p_uid: 'u1',
          p_version_id: 'v1',
          p_platform_pct: 0.3,
          p_description_prefix: 'ปลดล็อคตอน: ',
        }),
      );
      expect(mockRpc.mock.calls[0][1]).not.toHaveProperty('p_price');
      // No version pre-read round-trip.
      expect(mockChain.maybeSingle).not.toHaveBeenCalled();
    });

    it('returns alreadyUnlocked when the RPC reports a pre-existing unlock', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            balance: 100,
            already_unlocked: true,
            creator_share: 0,
            platform_share: 0,
            price_paid: 10,
          },
        ],
        error: null,
      });
      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ alreadyUnlocked: true });
    });

    it('unlocks a free published chapter without charging', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            balance: 100,
            already_unlocked: false,
            creator_share: 0,
            platform_share: 0,
            price_paid: 0,
          },
        ],
        error: null,
      });
      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ unlocked: true, pricePaid: 0, balance: 100 });
    });

    it('throws BadRequestException on INSUFFICIENT_FUNDS', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'INSUFFICIENT_FUNDS' },
      });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when the RPC raises VERSION_NOT_FOUND', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'VERSION_NOT_FOUND' },
      });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the RPC raises NOT_PUBLISHED', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'NOT_PUBLISHED' },
      });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the RPC raises CREATOR_MISSING', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'CREATOR_MISSING' },
      });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
