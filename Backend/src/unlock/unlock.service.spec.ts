import { UnlockService } from './unlock.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('UnlockService', () => {
  let service: UnlockService;
  let walletService: any;
  let mockChain: any;

  beforeEach(() => {
    mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((resolve) => {
        resolve({ data: null, error: null });
      }),
    };

    const supabaseService = {
      client: { from: jest.fn().mockReturnValue(mockChain) },
    } as any;

    walletService = {
      spendCoins: jest.fn(),
      processRevenueSplit: jest.fn().mockResolvedValue({ balance: 900 }),
      getBalance: jest.fn().mockResolvedValue(100),
    };

    service = new UnlockService(supabaseService, walletService);
  });

  // ─── isUnlocked ──────────────────────────────────────────────────────────

  describe('isUnlocked', () => {
    it('should return true when unlock record exists', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: { uid: 'u1' }, error: null });
      expect(await service.isUnlocked('u1', 'v1')).toBe(true);
    });

    it('should return false when no unlock record exists', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      expect(await service.isUnlocked('u1', 'v1')).toBe(false);
    });
  });

  // ─── purchaseUnlock ───────────────────────────────────────────────────────

  describe('purchaseUnlock', () => {
    it('should return alreadyUnlocked:true if record exists (idempotent)', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: { uid: 'u1' }, error: null });
      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res.alreadyUnlocked).toBe(true);
      expect(walletService.processRevenueSplit).not.toHaveBeenCalled();
    });

    it('should unlock successfully for paid chapters', async () => {
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })  // isUnlocked = false
        .mockResolvedValueOnce({
          data: { version_id: 'v1', price_coins: 10, translator_uid: 'c1', chapters: { manga: { title: 'Manga X' } } },
          error: null,
        }); // fetch version
      mockChain.insert.mockResolvedValue({ error: null });

      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res.unlocked).toBe(true);
      expect(walletService.processRevenueSplit).toHaveBeenCalled();
    });

    it('should not charge coins for free chapters (price = 0)', async () => {
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { version_id: 'v1', price_coins: 0, translator_uid: 'c1', chapters: { manga: { title: 'Free Manga' } } },
          error: null,
        });
      mockChain.insert.mockResolvedValue({ error: null });

      const res = await service.purchaseUnlock('u1', 'v1');
      expect(res.unlocked).toBe(true);
      expect(res.pricePaid).toBe(0);
      expect(walletService.processRevenueSplit).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when chapter version does not exist', async () => {
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null }); // version not found
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if version has price but no creator', async () => {
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { version_id: 'v1', price_coins: 10, translator_uid: null },
          error: null,
        });
      await expect(service.purchaseUnlock('u1', 'v1')).rejects.toThrow(BadRequestException);
    });
  });
});
