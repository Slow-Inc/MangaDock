/**
 * #915: forum single-row lookups answered 404 for any Supabase error, so a database outage read as
 * "not found". Only "there is no such row" may be a 404; any other failure is a 503.
 */
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { lookupFailure } from './assert-found';

describe('lookupFailure — 404 only for a missing row (#915)', () => {
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

  it('any other error (outage, timeout) → 503, not "not found"', () => {
    expect(() =>
      lookupFailure(
        {
          code: '57014',
          message: 'canceling statement due to statement timeout',
        },
        'Post not found',
      ),
    ).toThrow(ServiceUnavailableException);
    expect(() =>
      lookupFailure({ message: 'fetch failed' }, 'Profile not found'),
    ).toThrow(ServiceUnavailableException);
  });

  it('keeps the caller message on the 404', () => {
    expect(() => lookupFailure(null, 'Comment not found')).toThrow(
      'Comment not found',
    );
  });
});
