import { Test } from '@nestjs/testing';
import type { NestApplication } from '@nestjs/core';
import request = require('supertest');
import { UnauthorizedException } from '@nestjs/common';
import { UnlockController } from './unlock.controller';
import { UnlockService } from './unlock.service';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';

const TEST_USER = {
  uid: 'test-uid',
  email: 'test@test.com',
  name: 'Test User',
};

const mockUnlockService = {
  isUnlocked: jest.fn(),
  getUnlockedVersions: jest.fn(),
  purchaseUnlock: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn().mockImplementation((ctx) => {
    ctx.switchToHttp().getRequest()[USER_KEY] = TEST_USER;
    return true;
  }),
};

describe('UnlockController', () => {
  let app: NestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UnlockController],
      providers: [{ provide: UnlockService, useValue: mockUnlockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /unlock/check/:versionId ────────────────────────────────────────

  describe('GET /unlock/check/:versionId', () => {
    it('should return unlocked:false before purchase', async () => {
      mockUnlockService.isUnlocked.mockResolvedValue(false);
      const res = await request(app.getHttpServer())
        .get('/unlock/check/v1')
        .expect(200);
      expect(res.body).toEqual({ unlocked: false });
      expect(mockUnlockService.isUnlocked).toHaveBeenCalledWith(
        TEST_USER.uid,
        'v1',
      );
    });

    it('should return unlocked:true once chapter has been purchased', async () => {
      mockUnlockService.isUnlocked.mockResolvedValue(true);
      const res = await request(app.getHttpServer())
        .get('/unlock/check/v1')
        .expect(200);
      expect(res.body).toEqual({ unlocked: true });
    });
  });

  // ─── POST /unlock/:versionId ─────────────────────────────────────────────

  describe('POST /unlock/:versionId', () => {
    it('should unlock a paid chapter and return the price paid', async () => {
      mockUnlockService.purchaseUnlock.mockResolvedValue({
        unlocked: true,
        pricePaid: 10,
        newBalance: 90,
      });
      const res = await request(app.getHttpServer())
        .post('/unlock/v1')
        .expect(201);
      expect(res.body.unlocked).toBe(true);
      expect(res.body.pricePaid).toBe(10);
      expect(mockUnlockService.purchaseUnlock).toHaveBeenCalledWith(
        TEST_USER.uid,
        'v1',
      );
    });

    it('should unlock a free chapter without deducting coins (pricePaid: 0)', async () => {
      mockUnlockService.purchaseUnlock.mockResolvedValue({
        unlocked: true,
        pricePaid: 0,
        newBalance: 100,
      });
      const res = await request(app.getHttpServer())
        .post('/unlock/free-v1')
        .expect(201);
      expect(res.body.pricePaid).toBe(0);
      expect(res.body.unlocked).toBe(true);
    });

    it('should be idempotent — return alreadyUnlocked:true on repeat purchase', async () => {
      mockUnlockService.purchaseUnlock.mockResolvedValue({
        alreadyUnlocked: true,
      });
      const res = await request(app.getHttpServer())
        .post('/unlock/v1')
        .expect(201);
      expect(res.body.alreadyUnlocked).toBe(true);
    });
  });

  // ─── GET /unlock/title/:titleId ──────────────────────────────────────────

  describe('GET /unlock/title/:titleId', () => {
    it('should return list of unlocked version IDs for the given title', async () => {
      mockUnlockService.getUnlockedVersions.mockResolvedValue([
        'v1',
        'v2',
        'v3',
      ]);
      const res = await request(app.getHttpServer())
        .get('/unlock/title/t1')
        .expect(200);
      expect(res.body).toEqual(['v1', 'v2', 'v3']);
      expect(mockUnlockService.getUnlockedVersions).toHaveBeenCalledWith(
        TEST_USER.uid,
        't1',
      );
    });

    it('should return an empty array when user has unlocked nothing for that title', async () => {
      mockUnlockService.getUnlockedVersions.mockResolvedValue([]);
      const res = await request(app.getHttpServer())
        .get('/unlock/title/t1')
        .expect(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── Normal user flow: check → purchase → check ──────────────────────────

  describe('full unlock flow', () => {
    it('check returns false, purchase, then check returns true', async () => {
      mockUnlockService.isUnlocked
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      mockUnlockService.purchaseUnlock.mockResolvedValue({
        unlocked: true,
        pricePaid: 10,
        newBalance: 90,
      });

      // Step 1 — not yet unlocked
      const check1 = await request(app.getHttpServer())
        .get('/unlock/check/v1')
        .expect(200);
      expect(check1.body.unlocked).toBe(false);

      // Step 2 — purchase
      const purchase = await request(app.getHttpServer())
        .post('/unlock/v1')
        .expect(201);
      expect(purchase.body.unlocked).toBe(true);

      // Step 3 — now unlocked
      const check2 = await request(app.getHttpServer())
        .get('/unlock/check/v1')
        .expect(200);
      expect(check2.body.unlocked).toBe(true);
    });
  });

  // ─── AuthGuard enforcement ───────────────────────────────────────────────

  describe('AuthGuard enforcement', () => {
    let unauthApp: NestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [UnlockController],
        providers: [{ provide: UnlockService, useValue: mockUnlockService }],
      })
        .overrideGuard(AuthGuard)
        .useValue({
          canActivate: () => {
            throw new UnauthorizedException();
          },
        })
        .compile();

      unauthApp = moduleRef.createNestApplication();
      await unauthApp.init();
    });

    afterAll(() => unauthApp.close());

    it.each(['/unlock/check/v1', '/unlock/title/t1'])(
      'GET %s → 401 without token',
      async (path) => {
        await request(unauthApp.getHttpServer()).get(path).expect(401);
      },
    );

    it('POST /unlock/v1 → 401 without token', async () => {
      await request(unauthApp.getHttpServer()).post('/unlock/v1').expect(401);
    });
  });
});
