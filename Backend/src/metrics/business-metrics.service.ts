import { Injectable } from '@nestjs/common';
import { Counter } from 'prom-client';

@Injectable()
export class BusinessMetricsService {
  private readonly chapterReadsTotal = new Counter({
    name: 'mangadock_chapter_reads_total',
    help: 'Total chapter page fetches served successfully',
  });

  private readonly chapterUnlocksTotal = new Counter({
    name: 'mangadock_chapter_unlocks_total',
    help: 'Total new chapter unlock purchases',
  });

  private readonly coinsSpentTotal = new Counter({
    name: 'mangadock_coins_spent_total',
    help: 'Total coins spent across all paths',
  });

  private readonly coinsAddedTotal = new Counter({
    name: 'mangadock_coins_added_total',
    help: 'Total coins credited to wallets',
  });

  recordRead(): void {
    this.chapterReadsTotal.inc(1);
  }

  recordUnlock(pricePaid: number): void {
    this.chapterUnlocksTotal.inc(1);
    this.coinsSpentTotal.inc(pricePaid);
  }

  recordCoinsSpent(amount: number): void {
    this.coinsSpentTotal.inc(amount);
  }

  recordCoinsAdded(amount: number): void {
    this.coinsAddedTotal.inc(amount);
  }
}
