import { StatusService } from './status.service';

describe('StatusService', () => {
  let service: StatusService;

  beforeEach(() => {
    service = new StatusService();
  });

  it('delivers a broadcast status event to a prior subscriber with a numeric timestamp', () => {
    const received: unknown[] = [];
    service.getStatusStream().subscribe((evt) => received.push(evt));

    service.broadcastStatus('mit', 'online');

    expect(received).toHaveLength(1);
    const evt = received[0] as {
      service: string;
      status: string;
      timestamp: number;
    };
    expect(evt.service).toBe('mit');
    expect(evt.status).toBe('online');
    expect(typeof evt.timestamp).toBe('number');
  });

  it('multicasts a subsequent broadcast to two independent subscribers (Subject, not unicast)', () => {
    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];
    service.getStatusStream().subscribe((evt) => receivedA.push(evt));
    service.getStatusStream().subscribe((evt) => receivedB.push(evt));

    service.broadcastStatus('backend', 'maintenance');

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
    expect(receivedA[0]).toEqual(receivedB[0]);
  });

  it('does not deliver events broadcast before subscribe (Subject, not BehaviorSubject)', () => {
    service.broadcastStatus('backend', 'offline');

    const received: unknown[] = [];
    service.getStatusStream().subscribe((evt) => received.push(evt));

    expect(received).toHaveLength(0);
  });

  it.each(['online', 'offline', 'maintenance'] as const)(
    'passes the status value %s through unchanged',
    (status) => {
      const received: Array<{ status: string }> = [];
      service.getStatusStream().subscribe((evt) => received.push(evt));

      service.broadcastStatus('backend', status);

      expect(received[0].status).toBe(status);
    },
  );
});
