import {
  BadRequestException,
  Injectable,
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

  async getOrCreateWallet(uid: string) {
    const { data, error } = await this.db
      .from('wallets')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch wallet: ${error.message}`);
    }

    if (data) {
      return {
        uid: data.uid,
        balance: data.balance,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }

    const now = new Date().toISOString();
    const { data: created, error: insertError } = await this.db
      .from('wallets')
      .insert({ uid, balance: 0, created_at: now, updated_at: now })
      .select('*')
      .single();

    if (insertError) {
      throw new Error(`Failed to create wallet: ${insertError.message}`);
    }

    this.logger.log(`Created wallet for user ${uid}`);
    return {
      uid: created.uid,
      balance: created.balance,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  async getBalance(uid: string): Promise<number> {
    const wallet = await this.getOrCreateWallet(uid);
    return wallet.balance;
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

    const wallet = await this.getOrCreateWallet(uid);
    const newBalance = wallet.balance + amount;

    const { error: txError } = await this.db
      .from('wallet_transactions')
      .insert({
        uid,
        type,
        amount,
        balance_after: newBalance,
        description: description ?? '',
      });

    if (txError) {
      throw new Error(`Failed to insert transaction: ${txError.message}`);
    }

    const { error: updateError } = await this.db
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('uid', uid);

    if (updateError) {
      throw new Error(`Failed to update wallet balance: ${updateError.message}`);
    }

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

    const wallet = await this.getOrCreateWallet(uid);
    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const newBalance = wallet.balance - amount;

    const { error: txError } = await this.db
      .from('wallet_transactions')
      .insert({
        uid,
        type: 'purchase',
        amount,
        balance_after: newBalance,
        description,
        reference_id: referenceId ?? null,
      });

    if (txError) {
      throw new Error(`Failed to insert transaction: ${txError.message}`);
    }

    const { error: updateError } = await this.db
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('uid', uid);

    if (updateError) {
      throw new Error(`Failed to update wallet balance: ${updateError.message}`);
    }

    this.logger.log(`Spent ${amount} coins for user ${uid}, new balance: ${newBalance}`);
    return { balance: newBalance };
  }

  async getTransactions(uid: string, limit = 50) {
    const { data, error } = await this.db
      .from('wallet_transactions')
      .select('*')
      .eq('uid', uid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

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
