import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class UnlockService {
  private readonly logger = new Logger(UnlockService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly walletService: WalletService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  async isUnlocked(uid: string, versionId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('unlocks')
      .select('uid')
      .eq('uid', uid)
      .eq('version_id', versionId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Failed to check unlock status: ${error.message}`);
    }

    return !!data;
  }

  async getUnlockedVersions(uid: string, titleId?: string): Promise<string[]> {
    if (titleId) {
      // Join with chapter_versions to filter by title
      const { data, error } = await this.db
        .from('unlocks')
        .select('version_id, chapter_versions!inner(title_id)')
        .eq('uid', uid)
        .eq('chapter_versions.title_id', titleId);

      if (error) {
        throw new InternalServerErrorException(`Failed to fetch unlocked versions: ${error.message}`);
      }

      return (data ?? []).map((row) => row.version_id);
    }

    const { data, error } = await this.db
      .from('unlocks')
      .select('version_id')
      .eq('uid', uid);

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch unlocked versions: ${error.message}`);
    }

    return (data ?? []).map((row) => row.version_id);
  }

  async purchaseUnlock(uid: string, versionId: string) {
    // Fetch chapter version (price, creator, title, status)
    const { data: version, error: versionError } = await this.db
      .from('chapter_versions')
      .select('version_id, price_coins, translator_uid, title_name, status')
      .eq('version_id', versionId)
      .maybeSingle();

    if (versionError) {
      throw new InternalServerErrorException(`Failed to fetch chapter version: ${versionError.message}`);
    }
    if (!version) {
      throw new NotFoundException(`Chapter version ${versionId} not found`);
    }

    // V7: only live (published) versions are purchasable.
    if (version.status !== 'published') {
      throw new BadRequestException('This chapter version is not available for purchase.');
    }

    const priceCoins = version.price_coins ?? 0;
    const creatorUid = version.translator_uid;
    const mangaTitle = version.title_name || 'Unknown Manga';
    if (priceCoins > 0 && !creatorUid) {
      throw new BadRequestException('Cannot purchase: Creator information is missing for this version.');
    }

    // Atomic: insert unlock + debit buyer + credit creator in ONE transaction (V6/V7).
    const { data, error } = await this.db.rpc('purchase_unlock_atomic', {
      p_uid: uid,
      p_version_id: versionId,
      p_price: priceCoins,
      p_creator_uid: creatorUid ?? null,
      p_platform_pct: 0.3,
      p_description: `ปลดล็อคตอน: ${mangaTitle}`,
    });

    if (error) {
      if (error.message?.includes('INSUFFICIENT_FUNDS')) {
        throw new BadRequestException('Insufficient balance');
      }
      throw new InternalServerErrorException(`Failed to unlock chapter: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : (data as any);
    if (row?.already_unlocked) {
      return { alreadyUnlocked: true };
    }

    this.logger.log(`User ${uid} unlocked version ${versionId} for ${priceCoins} coins`);
    return { unlocked: true, pricePaid: priceCoins, balance: row?.balance };
  }
}
