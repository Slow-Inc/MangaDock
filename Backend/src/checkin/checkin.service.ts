import { ConflictException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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
  constructor(private readonly supabase: SupabaseService) {}

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
      return {
        checkedInToday: true,
        streakDay: todayRow.streak_day,
        coinsToday: todayRow.coins,
      };
    }

    const streakDay = await this.computeNextStreak(uid);
    return {
      checkedInToday: false,
      streakDay,
      coinsToday: coinsForStreak(streakDay),
    };
  }

  async claimCheckin(uid: string): Promise<CheckinStatus> {
    const today = new Date().toISOString().slice(0, 10);

    // Single atomic RPC: gates on the (uid, check_date) unique constraint and
    // credits the reward in the SAME transaction — no double-claim, and no
    // partial-failure window where the row is recorded but coins never land.
    const { data, error } = (await this.db.rpc('claim_checkin_atomic', {
      p_uid: uid,
      p_date: today,
    })) as {
      data: Array<{
        streak_day: number;
        coins: number;
        balance: number;
      }> | null;
      error: { message: string } | null;
    };

    if (error) {
      if (error.message?.includes('ALREADY_CHECKED_IN')) {
        throw new ConflictException('Already checked in today');
      }
      throw new Error(`Checkin failed: ${error.message}`);
    }

    const row = data?.[0];
    return {
      checkedInToday: true,
      streakDay: row?.streak_day ?? 1,
      coinsToday: row?.coins ?? 0,
    };
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
