import { EventEmitter } from 'events';

let mockEmitter: EventEmitter;

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => {
    mockEmitter = new EventEmitter();
    return {
      on: (event: string, cb: (...args: any[]) => void) => mockEmitter.on(event, cb),
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      duplicate: jest.fn().mockReturnValue({ on: jest.fn(), subscribe: jest.fn(), quit: jest.fn() }),
    };
  }),
);

import { RedisService } from './redis.service';

function makeService(): RedisService {
  const svc = new RedisService();
  svc.onModuleInit();
  return svc;
}

describe('RedisService.onReconnect()', () => {
  afterEach(() => jest.clearAllMocks());

  // Cycle 1 — registered callback fires when connect event emits
  it('calls the registered callback when the connect event fires', () => {
    const svc = makeService();
    const cb = jest.fn();

    svc.onReconnect(cb);
    mockEmitter.emit('connect');

    expect(cb).toHaveBeenCalledTimes(1);
  });

  // Cycle 2 — unsubscribe stops callback
  it('unsubscribe stops the callback from firing on subsequent connect events', () => {
    const svc = makeService();
    const cb = jest.fn();

    const unsub = svc.onReconnect(cb);
    unsub();
    mockEmitter.emit('connect');

    expect(cb).not.toHaveBeenCalled();
  });

  // Cycle 3 — multiple callbacks are independent
  it('unsubscribing one callback does not affect other registered callbacks', () => {
    const svc = makeService();
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    svc.onReconnect(cb1);
    const unsub2 = svc.onReconnect(cb2);
    unsub2();
    mockEmitter.emit('connect');

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();
  });
});
