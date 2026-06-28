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
    const { data, error } = await this.db.rpc('purchase_unlock_atomic', {
      p_uid: uid,
      p_version_id: versionId,
      p_platform_pct: 0.3,
      p_description_prefix: 'ปลดล็อคตอน: ',
    });

    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('INSUFFICIENT_FUNDS')) {
        throw new BadRequestException('Insufficient balance');
      }
      if (msg.includes('VERSION_NOT_FOUND')) {
        throw new NotFoundException(`Chapter version ${versionId} not found`);
      }
      if (msg.includes('NOT_PUBLISHED')) {
        throw new BadRequestException('Chapter is not available for purchase');
      }
      if (msg.includes('CREATOR_MISSING')) {
        throw new BadRequestException('Cannot purchase: Creator information is missing for this version.');
      }
      throw new InternalServerErrorException(`Failed to unlock chapter: ${msg}`);
    }

    const row = Array.isArray(data) ? data[0] : (data as any);
    if (row?.already_unlocked) {
      return { alreadyUnlocked: true };
    }

    this.logger.log(`User ${uid} unlocked version ${versionId} for ${row?.price_paid} coins`);
    return { unlocked: true, pricePaid: row?.price_paid, balance: row?.balance };
  }
}
