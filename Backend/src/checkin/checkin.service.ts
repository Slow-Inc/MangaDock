import { ConflictException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WalletService } from '../wallet/wallet.service';

const BASE_COINS = 5;
const MAX_COINS = 20;

function coinsForStreak(streakDay: number): number {
  return Math.min(BASE_COINS + streakDay - 1, MAX_COINS);
}

export type CheckinStatus = {
  checkedInToday: boolean;
  streakDay: number;
  coinsToday: number;
};

@Injectable()
export class CheckinService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly wallet: WalletService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  async getStatus(uid: string): Promise<CheckinStatus> {
    const today = new Date().toISOString().slice(0, 10);

    const { data: todayRow } = await this.db
      .from('daily_checkins')
      .select('streak_day, coins')
      .eq('uid', uid)
      .eq('check_date', today)
      .maybeSingle();

    if (todayRow) {
      return { checkedInToday: true, streakDay: todayRow.streak_day, coinsToday: todayRow.coins };
    }

    const streakDay = await this.computeNextStreak(uid);
    return { checkedInToday: false, streakDay, coinsToday: coinsForStreak(streakDay) };
  }

  async claimCheckin(uid: string): Promise<CheckinStatus> {
    const today = new Date().toISOString().slice(0, 10);

    const existing = await this.db
      .from('daily_checkins')
      .select('id')
      .eq('uid', uid)
      .eq('check_date', today)
      .maybeSingle();

    if (existing.data) throw new ConflictException('Already checked in today');

    const streakDay = await this.computeNextStreak(uid);
    const coins = coinsForStreak(streakDay);

    const { error } = await this.db.from('daily_checkins').insert({
      uid,
      check_date: today,
      coins,
      streak_day: streakDay,
    });
    if (error) throw new Error(`Checkin failed: ${error.message}`);

    await this.wallet.addCoins(uid, coins, 'reward', `เช็คอินวันที่ ${streakDay} ติดต่อกัน`);

    return { checkedInToday: true, streakDay, coinsToday: coins };
  }

  private async computeNextStreak(uid: string): Promise<number> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);

    const { data: yRow } = await this.db
      .from('daily_checkins')
      .select('streak_day')
      .eq('uid', uid)
      .eq('check_date', yStr)
      .maybeSingle();

    return yRow ? yRow.streak_day + 1 : 1;
  }
}
