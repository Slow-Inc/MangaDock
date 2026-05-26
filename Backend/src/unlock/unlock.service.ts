import {
  BadRequestException,
  Injectable,
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
      throw new Error(`Failed to check unlock status: ${error.message}`);
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
        throw new Error(`Failed to fetch unlocked versions: ${error.message}`);
      }

      return (data ?? []).map((row) => row.version_id);
    }

    const { data, error } = await this.db
      .from('unlocks')
      .select('version_id')
      .eq('uid', uid);

    if (error) {
      throw new Error(`Failed to fetch unlocked versions: ${error.message}`);
    }

    return (data ?? []).map((row) => row.version_id);
  }

  async purchaseUnlock(uid: string, versionId: string) {
    // Check if already unlocked
    const alreadyUnlocked = await this.isUnlocked(uid, versionId);
    if (alreadyUnlocked) {
      return { alreadyUnlocked: true };
    }

    // Fetch chapter version to get price and creator
    const { data: version, error: versionError } = await this.db
      .from('chapter_versions')
      .select('version_id, price_coins, translator_uid, title_name')
      .eq('version_id', versionId)
      .maybeSingle();

    if (versionError) {
      throw new Error(`Failed to fetch chapter version: ${versionError.message}`);
    }
    if (!version) {
      throw new NotFoundException(`Chapter version ${versionId} not found`);
    }

    const priceCoins = version.price_coins ?? 0;
    const creatorUid = version.translator_uid;
    const mangaTitle = version.title_name || 'Unknown Manga';
    if (priceCoins > 0 && !creatorUid) {
      throw new BadRequestException('Cannot purchase: Creator information is missing for this version.');
    }

    // Insert unlock record FIRST so access is granted even if creator payment has issues
    const { error: unlockError } = await this.db
      .from('unlocks')
      .insert({ uid, version_id: versionId, price_paid: priceCoins });

    if (unlockError) {
      throw new Error(`Failed to insert unlock record: ${unlockError.message}`);
    }

    let newBalance: number | undefined;

    if (priceCoins > 0 && creatorUid) {
      try {
        const result = await this.walletService.processRevenueSplit(
          uid,
          creatorUid,
          priceCoins,
          `ปลดล็อคตอน: ${mangaTitle}`,
          versionId,
        );
        newBalance = result.balance;
      } catch (err) {
        // Payment failed after unlock was already granted — roll back unlock row
        await this.db.from('unlocks').delete().match({ uid, version_id: versionId });
        throw err;
      }
    }

    this.logger.log(`User ${uid} unlocked version ${versionId} for ${priceCoins} coins`);

    return {
      unlocked: true,
      pricePaid: priceCoins,
      balance: newBalance ?? (await this.walletService.getBalance(uid)),
    };
  }
}
