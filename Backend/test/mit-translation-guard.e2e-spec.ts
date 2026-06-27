import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BooksController } from '../src/books/books.controller';
import { BooksService } from '../src/books/books.service';
import { StatsIncrementService } from '../src/cache/stats-increment.service';
import { generateClearanceToken } from '../src/auth/turnstile.guard';
import { TURNSTILE_TEST_SECRET } from '../src/auth/turnstile.config';

/**
 * #227 — every endpoint that triggers the expensive MIT translation pipeline
 * must sit behind TurnstileGuard (HWID-bound captcha clearance). The cheap
 * description-translation endpoint stays open (catalog cards, pre-auth).
 *
 * Mounts only BooksController with a mocked BooksService so the test exercises
 * the guard wiring deterministically, without booting Supabase/Redis/MIT.
 */
describe('MIT translation endpoints — TurnstileGuard (e2e)', () => {
  let app: INestApplication;
  const HWID = 'device-e2e-1234567';
  const validClearance = () => generateClearanceToken(TURNSTILE_TEST_SECRET, HWID);

  const booksServiceMock: Partial<Record<keyof BooksService, jest.Mock>> = {
    translateMangaEpisode: jest.fn().mockResolvedValue({ translations: [] }),
    translateMangaPagePatches: jest.fn().mockResolvedValue({ patches: [] }),
    startOrAttachBatchJob: jest.fn().mockResolvedValue(undefined),
    removeBatchListener: jest.fn(),
    translateDescription: jest.fn().mockResolvedValue('translated'),
  };

  beforeAll(async () => {
    // Non-production + no real secret → resolveTurnstileConfig yields the test
    // key, so a token signed with TURNSTILE_TEST_SECRET verifies (enabled=true).
    delete process.env.TURNSTILE_ENABLED;
    delete process.env.TURNSTILE_SECRET_KEY;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        { provide: BooksService, useValue: booksServiceMock },
        { provide: StatsIncrementService, useValue: { increment: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const guarded = [
    {
      name: 'manga text translation',
      send: () => request(app.getHttpServer()).post('/books/translate/manga').send({ lines: ['x'] }),
    },
    {
      name: 'single-page patch translation',
      send: () =>
        request(app.getHttpServer())
          .post('/books/chapters/ch1/pages/0/translate-patches')
          .send({ pageUrl: 'http://x/p.png' }),
    },
    {
      name: 'full-chapter batch translation',
      send: () =>
        request(app.getHttpServer())
          .post('/books/chapters/ch1/batch-translate-patches')
          .send({ pages: [] }),
    },
  ];

  describe.each(guarded)('$name', ({ send }) => {
    it('returns 401 without a clearance token', async () => {
      const res = await send().set('x-hardware-id', HWID);
      expect(res.status).toBe(401);
    });

    it('proceeds with a valid HWID-bound clearance token', async () => {
      const res = await send()
        .set('x-hardware-id', HWID)
        .set('x-captcha-clearance', validClearance());
      expect(res.status).not.toBe(401);
      expect([200, 201]).toContain(res.status);
    });
  });

  it('keeps the cheap description-translation endpoint open (no captcha)', async () => {
    const res = await request(app.getHttpServer()).get('/books/translate').query({ text: 'hi' });
    expect(res.status).toBe(200);
  });
});
