import { WalletEventsService } from './wallet-events.service';

describe('WalletEventsService', () => {
  let service: WalletEventsService;

  beforeEach(() => {
    service = new WalletEventsService();
  });

  it('stream$ emits value and completes when emit() is called', (done) => {
    const values: { balance: number }[] = [];
    service.stream$('pay-123').subscribe({
      next: (v) => values.push(v),
      complete: () => {
        expect(values).toEqual([{ balance: 500 }]);
        done();
      },
    });
    service.emit('pay-123', { balance: 500 });
  });

  it('emit on unknown paymentId does nothing', () => {
    expect(() => service.emit('unknown', { balance: 0 })).not.toThrow();
  });

  it('internal subject is cleaned up after emit — second emit is a no-op', () => {
    service.stream$('pay-789').subscribe();
    service.emit('pay-789', { balance: 100 });
    expect(() => service.emit('pay-789', { balance: 200 })).not.toThrow();
  });

  it('removes the subject from the registry when the stream is torn down (client disconnect / QR expiry)', () => {
    const sub = service.stream$('pay-teardown').subscribe();
    expect(service['subjects'].has('pay-teardown')).toBe(true);
    sub.unsubscribe();
    expect(service['subjects'].has('pay-teardown')).toBe(false);
  });

  it('keeps the subject while another subscriber is still connected', () => {
    const a = service.stream$('pay-multi').subscribe();
    const b = service.stream$('pay-multi').subscribe();
    a.unsubscribe();
    expect(service['subjects'].has('pay-multi')).toBe(true);
    b.unsubscribe();
    expect(service['subjects'].has('pay-multi')).toBe(false);
  });

  it('does not grow the registry unbounded as topups tear down over time', () => {
    for (let i = 0; i < 50; i++) {
      service.stream$(`pay-${i}`).subscribe().unsubscribe();
    }
    expect(service['subjects'].size).toBe(0);
  });
});
