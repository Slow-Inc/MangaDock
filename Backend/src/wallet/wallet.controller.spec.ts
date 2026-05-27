import { Test } from '@nestjs/testing';
import type { NestApplication } from '@nestjs/core';
import request = require('supertest');
import { UnauthorizedException } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';

const TEST_USER = { uid: 'test-uid', email: 'test@test.com', name: 'Test User' };

const mockWalletService = {
  getBalance: jest.fn(),
  addCoins: jest.fn(),
  getTransactions: jest.fn(),
  getCreatorEarnings: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn().mockImplementation((ctx) => {
    ctx.switchToHttp().getRequest()[USER_KEY] = TEST_USER;
    return true;
  }),
};

describe('WalletController', () => {
  let app: NestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletService, useValue: mockWalletService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /wallet/balance ─────────────────────────────────────────────────

  describe('GET /wallet/balance', () => {
    it('should return the authenticated user balance', async () => {
      mockWalletService.getBalance.mockResolvedValue(250);
      const res = await request(app.getHttpServer()).get('/wallet/balance').expect(200);
      expect(res.body).toEqual({ balance: 250 });
      expect(mockWalletService.getBalance).toHaveBeenCalledWith(TEST_USER.uid);
    });

    it('should return zero balance for a new user', async () => {
      mockWalletService.getBalance.mockResolvedValue(0);
      const res = await request(app.getHttpServer()).get('/wallet/balance').expect(200);
      expect(res.body).toEqual({ balance: 0 });
    });
  });

  // ─── POST /wallet/topup ──────────────────────────────────────────────────

  describe('POST /wallet/topup', () => {
    it('should top up coins and return updated wallet', async () => {
      mockWalletService.addCoins.mockResolvedValue({ uid: TEST_USER.uid, balance: 350 });
      const res = await request(app.getHttpServer())
        .post('/wallet/topup')
        .send({ amount: 100 })
        .expect(201);
      expect(res.body.balance).toBe(350);
      expect(mockWalletService.addCoins).toHaveBeenCalledWith(
        TEST_USER.uid,
        100,
        'topup',
        expect.any(String),
      );
    });
  });

  // ─── GET /wallet/transactions ────────────────────────────────────────────

  describe('GET /wallet/transactions', () => {
    it('should return the transaction history', async () => {
      const txList = [
        { id: 't1', amount: 100, type: 'topup', created_at: '2025-01-01' },
        { id: 't2', amount: -30, type: 'buy', created_at: '2025-01-02' },
      ];
      mockWalletService.getTransactions.mockResolvedValue(txList);
      const res = await request(app.getHttpServer()).get('/wallet/transactions').expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].type).toBe('topup');
      expect(res.body[1].amount).toBe(-30);
    });

    it('should return an empty array when no transactions exist', async () => {
      mockWalletService.getTransactions.mockResolvedValue([]);
      const res = await request(app.getHttpServer()).get('/wallet/transactions').expect(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── GET /wallet/earnings ────────────────────────────────────────────────

  describe('GET /wallet/earnings', () => {
    it('should return creator earnings for a translator', async () => {
      mockWalletService.getCreatorEarnings.mockResolvedValue({
        totalSales: 5,
        totalEarned: 350,
        titlesSold: 2,
        uniqueBuyers: 4,
      });
      const res = await request(app.getHttpServer()).get('/wallet/earnings').expect(200);
      expect(res.body.totalSales).toBe(5);
      expect(res.body.totalEarned).toBe(350);
      expect(res.body.titlesSold).toBe(2);
      expect(res.body.uniqueBuyers).toBe(4);
    });

    it('should return zeros for a reader who has never sold anything', async () => {
      mockWalletService.getCreatorEarnings.mockResolvedValue({
        totalSales: 0,
        totalEarned: 0,
        titlesSold: 0,
        uniqueBuyers: 0,
      });
      const res = await request(app.getHttpServer()).get('/wallet/earnings').expect(200);
      expect(res.body).toEqual({ totalSales: 0, totalEarned: 0, titlesSold: 0, uniqueBuyers: 0 });
    });
  });

  // ─── AuthGuard enforcement ───────────────────────────────────────────────

  describe('AuthGuard enforcement', () => {
    let unauthApp: NestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [WalletController],
        providers: [{ provide: WalletService, useValue: mockWalletService }],
      })
        .overrideGuard(AuthGuard)
        .useValue({ canActivate: () => { throw new UnauthorizedException(); } })
        .compile();

      unauthApp = moduleRef.createNestApplication();
      await unauthApp.init();
    });

    afterAll(() => unauthApp.close());

    it.each([
      ['GET', '/wallet/balance'],
      ['GET', '/wallet/transactions'],
      ['GET', '/wallet/earnings'],
    ])('%s %s → 401 without token', async (method, path) => {
      const req = method === 'GET'
        ? request(unauthApp.getHttpServer()).get(path)
        : request(unauthApp.getHttpServer()).post(path);
      await req.expect(401);
    });

    it('POST /wallet/topup → 401 without token', async () => {
      await request(unauthApp.getHttpServer()).post('/wallet/topup').send({ amount: 100 }).expect(401);
    });
  });
});
