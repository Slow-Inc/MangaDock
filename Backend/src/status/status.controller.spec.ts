import { Test } from '@nestjs/testing';
import type { NestApplication } from '@nestjs/core';
import request = require('supertest');
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { CacheHealthService } from '../cache/cache-health.service';
import { AuthGuard } from '../auth/auth.guard';

const MOCK_HEALTH = {
  dirtyQueueDepth: 3,
  processingQueueDepth: 1,
  deadLetterCount: 0,
  l3KeyCount: 412,
  isLeader: true,
};

const mockStatusService = {
  getStatusStream: jest.fn().mockReturnValue(of()),
};

const mockCacheHealth = {
  getHealth: jest.fn().mockResolvedValue(MOCK_HEALTH),
};

const mockAuthGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

describe('StatusController', () => {
  let app: NestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StatusController],
      providers: [
        { provide: StatusService, useValue: mockStatusService },
        { provide: CacheHealthService, useValue: mockCacheHealth },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /status/cache ────────────────────────────────────────────────────

  describe('GET /status/cache', () => {
    // SC1 — authenticated request returns health snapshot
    it('returns CacheHealthSnapshot for authenticated request', async () => {
      mockAuthGuard.canActivate.mockReturnValue(true);
      mockCacheHealth.getHealth.mockResolvedValue(MOCK_HEALTH);

      const res = await request(app.getHttpServer()).get('/status/cache').expect(200);

      expect(res.body.dirtyQueueDepth).toBe(3);
      expect(res.body.processingQueueDepth).toBe(1);
      expect(res.body.deadLetterCount).toBe(0);
      expect(res.body.l3KeyCount).toBe(412);
      expect(res.body.isLeader).toBe(true);
    });

    // SC2 — unauthenticated request → 401
    it('returns 401 when no valid token is provided', async () => {
      mockAuthGuard.canActivate.mockImplementation(() => {
        throw new UnauthorizedException();
      });

      await request(app.getHttpServer()).get('/status/cache').expect(401);
    });
  });

  // ─── GET /status ─────────────────────────────────────────────────────────────

  describe('GET /status', () => {
    // S1 — shape contract
    it('returns schemaVersion:1 snapshot with correct shape', async () => {
      mockCacheHealth.getHealth.mockResolvedValue(MOCK_HEALTH);
      const res = await request(app.getHttpServer()).get('/status').expect(200);
      expect(res.body.schemaVersion).toBe(1);
      expect(res.body.service).toBe('backend');
      expect(['up', 'degraded', 'down']).toContain(res.body.status);
      expect(typeof res.body.reason).toBe('string');
      expect(Array.isArray(res.body.checks)).toBe(true);
      expect(typeof res.body.uptimeSec).toBe('number');
      expect(typeof res.body.durationMs).toBe('number');
      expect(typeof res.body.checkedAt).toBe('string');
    });

    // S2 — Redis unreachable → status:down
    it('returns status:down when cacheHealth.getHealth throws', async () => {
      mockCacheHealth.getHealth.mockRejectedValue(new Error('ECONNREFUSED'));
      const res = await request(app.getHttpServer()).get('/status').expect(200);
      expect(res.body.status).toBe('down');
      const redis = res.body.checks.find((c: { id: string }) => c.id === 'redis');
      expect(redis.status).toBe('down');
      expect(redis.latencyMs).toBeNull();
    });

    // S3 — no auth guard
    it('returns 200 when AuthGuard would deny (no guard on this route)', async () => {
      mockAuthGuard.canActivate.mockReturnValue(false);
      mockCacheHealth.getHealth.mockResolvedValue(MOCK_HEALTH);
      await request(app.getHttpServer()).get('/status').expect(200);
    });
  });
});
