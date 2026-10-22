/**
 * #915: forum single-row lookups answered 404 for any Supabase error, so a database outage read as
 * "not found". Only "there is no such row" may be a 404; any other failure must reach the client as the
 * app's database-down signal (503, code SUPABASE_OFFLINE — what the frontend's Supabase toast listens for)
 * with the Postgres cause in the server log.
 */
import { HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { lookupFailure } from './assert-found';

/** Runs what lookupFailure throws through the app's real exception filter. */
function respond(error: { code?: string; message?: string } | null) {
  const replies: { body: { code: string; message: string }; status: number }[] =
    [];
  const filter = new AllExceptionsFilter({
    httpAdapter: {
      getRequestUrl: () => '/forum/posts/x',
      reply: (
        _res: unknown,
        body: { code: string; message: string },
        status: number,
      ) => replies.push({ body, status }),
    },
  } as never);
  const host = {
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as ArgumentsHost;
  try {
    lookupFailure(error, 'Post not found');
  } catch (e) {
    filter.catch(e, host);
  }
  return replies[0];
}

describe('lookupFailure — 404 only for a missing row (#915)', () => {
  let logged: jest.SpyInstance;
  beforeEach(() => {
    logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => logged.mockRestore());

  it('no row and no error → 404', () => {
    expect(() => lookupFailure(null, 'Post not found')).toThrow(
      NotFoundException,
    );
  });

  it('PGRST116 (.single() matched zero rows) → 404', () => {
    expect(() =>
      lookupFailure({ code: 'PGRST116', message: 'no rows' }, 'Post not found'),
    ).toThrow(NotFoundException);
  });

  it('22P02 (the id is not a uuid, so the row cannot exist) → 404', () => {
    expect(() =>
      lookupFailure(
        { code: '22P02', message: 'invalid input syntax for type uuid' },
        'Post not found',
      ),
    ).toThrow(NotFoundException);
  });

  it('keeps the caller message on the 404', () => {
    expect(respond(null)).toMatchObject({
      status: 404,
      body: { message: 'Post not found' },
    });
  });

  it('any other error (outage, timeout) → 503 SUPABASE_OFFLINE, not "not found", and logs the Postgres cause', () => {
    const reply = respond({
      code: '57014',
      message: 'canceling statement due to statement timeout',
    });
    expect(reply.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(reply.body.code).toBe('SUPABASE_OFFLINE');
    const log = (logged.mock.calls as unknown[][])
      .map((c) => String(c[0]))
      .join('\n');
    expect(log).toContain('57014');
    expect(log).toContain('statement timeout');
  });

  it('a network failure with no code is the same database-down signal', () => {
    expect(respond({ message: 'fetch failed' })).toMatchObject({
      status: 503,
      body: { code: 'SUPABASE_OFFLINE' },
    });
  });
});
