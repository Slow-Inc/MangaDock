import { StatsIncrementService } from './stats-increment.service';
import { RedisService } from './redis.service';

/**
 * recordChapterView atomicity (#139): all counters AND their TTLs must land in
 * ONE Redis round-trip (Lua EVAL — same pattern as ElectionService scripts).
 * The old two-phase write (INCR/PFADD/SADD/SET, then EXPIREs) left immortal
 * keys whenever the process died between the phases.
 */
function makeRedis() {
  const client = { eval: jest.fn().mockResolvedValue(1) };
  const redis = {
    available: true,
    getClient: jest.fn().mockResolvedValue(client),
    incr: jest.fn(),
    pfadd: jest.fn(),
    sadd: jest.fn(),
    set: jest.fn(),
    expire: jest.fn(),
  };
  return { redis, client };
}

function makeService() {
  const { redis, client } = makeRedis();
  return { svc: new StatsIncrementService(redis as unknown as RedisService), redis, client };
}

describe('StatsIncrementService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('records views, unique readers, active set, and mangaId in a single EVAL', async () => {
    const { svc, client } = makeService();

    await svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28');

    expect(client.eval).toHaveBeenCalledTimes(1);
    const flat = client.eval.mock.calls[0].map(String).join('|');
    expect(flat).toContain('stats:chapter:ch:1:views:2026-05-28');
    expect(flat).toContain('stats:chapter:ch:1:hll:2026-05-28');
    expect(flat).toContain('stats:active:2026-05-28');
    expect(flat).toContain('stats:chapter:ch:1:manga:2026-05-28');
    expect(flat).toContain('uid:x');
    expect(flat).toContain('manga:A');
  });

  it('never issues separate write/expire round-trips (atomicity)', async () => {
    const { svc, redis } = makeService();

    await svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28');

    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.pfadd).not.toHaveBeenCalled();
    expect(redis.sadd).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('does nothing when Redis is unavailable', async () => {
    const { svc, redis, client } = makeService();
    (redis as { available: boolean }).available = false;

    await svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28');

    expect(client.eval).not.toHaveBeenCalled();
  });

  it('swallows Redis errors — stats must never break page serving', async () => {
    const { svc, client } = makeService();
    client.eval.mockRejectedValue(new Error('boom'));

    await expect(
      svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28'),
    ).resolves.toBeUndefined();
  });
});
