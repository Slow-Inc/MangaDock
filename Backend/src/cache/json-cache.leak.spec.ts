import { JsonCacheService } from './json-cache.service';
import { L3DiskService } from './l3-disk.service';

describe('JsonCacheService Memory Leak Repro', () => {
  let service: JsonCacheService;
  let mockL3: jest.Mocked<L3DiskService>;

  beforeEach(() => {
    mockL3 = {
      readAll: jest.fn().mockReturnValue(new Map()),
    } as any;
    service = new JsonCacheService(mockL3);
  });

  it('should grow memoryStore indefinitely without limits', () => {
    const ITERATIONS = 10000;

    for (let i = 0; i < ITERATIONS; i++) {
      service.set(
        `key-${i}`,
        { data: 'some large data string '.repeat(10) },
        10000,
      );
    }

    const size = [...service.keys()].length;
    expect(size).toBe(ITERATIONS);
    console.log(`Current Map Size: ${size}`);
  });
});
