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
    service = new UnlockService(supabaseService, walletService);
  });

  describe('purchaseUnlock', () => {
    const publishedPaid = {
      version_id: 'v1', price_coins: 10, translator_uid: 'c1',
      title_name: 'Manga X', status: 'published',
    };

    it('charges and unlocks a published paid chapter via the atomic RPC', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: publishedPaid, error: null });
      mockRpc.mockResolvedValue({
        data: [{ balance: 90, already_unlocked: false, creator_share: 7, platform_share: 3 }],
        error: null,
      });

      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ unlocked: true, pricePaid: 10, balance: 90 });
      expect(mockRpc).toHaveBeenCalledWith('purchase_unlock_atomic', expect.objectContaining({
        p_uid: 'u1', p_version_id: 'v1', p_price: 10, p_creator_uid: 'c1', p_platform_pct: 0.3,
      }));
    });

    it('returns alreadyUnlocked when the RPC reports a pre-existing unlock', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: publishedPaid, error: null });
      mockRpc.mockResolvedValue({
        data: [{ balance: 100, already_unlocked: true, creator_share: 0, platform_share: 0 }],
        error: null,
      });

      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ alreadyUnlocked: true });
    });

    it('throws BadRequestException on INSUFFICIENT_FUNDS', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: publishedPaid, error: null });
      mockRpc.mockResolvedValue({ data: null, error: { message: 'INSUFFICIENT_FUNDS' } });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
    });

    it('unlocks a free published chapter without charging', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { ...publishedPaid, price_coins: 0, translator_uid: 'c1' }, error: null,
      });
      mockRpc.mockResolvedValue({
        data: [{ balance: 100, already_unlocked: false, creator_share: 0, platform_share: 0 }],
        error: null,
      });
      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res).toEqual({ unlocked: true, pricePaid: 0, balance: 100 });
    });

    it('throws NotFoundException when version does not exist', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(NotFoundException);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when chapter is not published', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { ...publishedPaid, status: 'draft' }, error: null,
      });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when paid version has no creator', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: { ...publishedPaid, translator_uid: null }, error: null,
      });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
