import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  async getBalance(uid: string): Promise<number> {
    // Upsert is handled inside the RPC; a plain SELECT suffices for read-only balance check
    const { data, error } = await this.db
      .from('wallets')
      .select('balance')
      .eq('uid', uid)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(`Failed to fetch wallet: ${error.message}`);
    return data?.balance ?? 0;
  }

  async addCoins(
    uid: string,
    amount: number,
    type: 'topup' | 'reward',
    description?: string,
  ): Promise<{ balance: number }> {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const { data, error } = await this.db.rpc('add_coins_atomic', {
      p_uid: uid,
      p_amount: amount,
      p_type: type,
      p_description: description ?? null,
    });

    if (error) throw new InternalServerErrorException(`Failed to add coins: ${error.message}`);

    const newBalance: number = Array.isArray(data) ? data[0]?.balance : (data as any)?.balance;
    this.logger.log(`Added ${amount} coins (${type}) to user ${uid}, new balance: ${newBalance}`);
    return { balance: newBalance };
  }

  async spendCoins(
    uid: string,
    amount: number,
    description: string,
    referenceId?: string,
  ): Promise<{ balance: number }> {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const { data, error } = await this.db.rpc('spend_coins_atomic', {
      p_uid: uid,
      p_amount: amount,
      p_type: 'purchase',
      p_description: description,
      p_reference_id: referenceId ?? null,
    });

    if (error) {
      if (error.message?.includes('INSUFFICIENT_FUNDS')) {
        throw new BadRequestException('Insufficient balance');
      }
      throw new InternalServerErrorException(`Failed to spend coins: ${error.message}`);
    }

    const newBalance: number = Array.isArray(data) ? data[0]?.balance : (data as any)?.balance;
    this.logger.log(`Spent ${amount} coins for user ${uid}, new balance: ${newBalance}`);
    return { balance: newBalance };
  }

  /**
   * High-level purchase flow that splits revenue between Creator and Platform.
   * Standard Split: 70% to Creator, 30% to Platform.
   */
  async processRevenueSplit(
    userUid: string,
    creatorUid: string,
    amount: number,
    description: string,
    referenceId: string,
  ) {
    const { balance } = await this.spendCoins(userUid, amount, description, referenceId);

    const PLATFORM_FEE_PCT = 0.3;
    const platformShare = Math.floor(amount * PLATFORM_FEE_PCT);
    const creatorShare = amount - platformShare;

    if (creatorShare > 0) {
      await this.addCoins(
        creatorUid,
        creatorShare,
        'reward',
        `ส่วนแบ่งรายได้: ${description}`,
      );
      this.logger.log(
        `Revenue Split: User ${userUid} paid ${amount}. Creator ${creatorUid} received ${creatorShare}. Platform took ${platformShare}.`,
      );
    }

    return { balance, platformShare, creatorShare };
  }

  async getCreatorEarnings(uid: string): Promise<{
    totalSales: number;
    totalEarned: number;
    titlesSold: number;
    uniqueBuyers: number;
  }> {
    const { data, error } = await this.db
      .from('translator_earnings')
      .select('*')
      .eq('translator_uid', uid)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(`Failed to fetch creator earnings: ${error.message}`);
    if (!data) return { totalSales: 0, totalEarned: 0, titlesSold: 0, uniqueBuyers: 0 };

    return {
      totalSales: data.total_sales,
      totalEarned: data.total_earned,
      titlesSold: data.titles_sold,
      uniqueBuyers: data.unique_buyers,
    };
  }

  async getTransactions(uid: string, limit = 50) {
    const { data, error } = await this.db
      .from('wallet_transactions')
      .select('*')
      .eq('uid', uid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new InternalServerErrorException(`Failed to fetch transactions: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      uid: row.uid,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balance_after,
      description: row.description,
      referenceId: row.reference_id,
      createdAt: row.created_at,
    }));
  }
}
