import { BusinessMetricsService } from './business-metrics.service';
import { Counter } from 'prom-client';

jest.mock('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({ inc: jest.fn() })),
}));

describe('BusinessMetricsService', () => {
  let service: BusinessMetricsService;
  let reads: { inc: jest.Mock };
  let unlocks: { inc: jest.Mock };
  let spent: { inc: jest.Mock };
  let added: { inc: jest.Mock };

  beforeEach(() => {
    (Counter as jest.Mock).mockClear();
    service = new BusinessMetricsService();
    // mock.results captures the returned object from each new Counter() call
    [reads, unlocks, spent, added] = (Counter as jest.Mock).mock.results.map((r) => r.value);
  });

  it('recordRead() calls chapterReadsTotal.inc(1)', () => {
    service.recordRead();
    expect(reads.inc).toHaveBeenCalledWith(1);
  });

  it('recordUnlock(5) increments chapterUnlocksTotal by 1 and coinsSpentTotal by 5', () => {
    service.recordUnlock(5);
    expect(unlocks.inc).toHaveBeenCalledWith(1);
    expect(spent.inc).toHaveBeenCalledWith(5);
  });

  it('recordCoinsSpent(10) increments coinsSpentTotal by 10', () => {
    service.recordCoinsSpent(10);
    expect(spent.inc).toHaveBeenCalledWith(10);
  });

  it('recordCoinsAdded(100) increments coinsAddedTotal by 100', () => {
    service.recordCoinsAdded(100);
    expect(added.inc).toHaveBeenCalledWith(100);
  });
});
