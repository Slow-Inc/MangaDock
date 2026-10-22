import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { ReaderCommentsService } from '../reader-comments/reader-comments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserFollowsService } from '../user-follows/user-follows.service';

/**
 * #1015: a malformed id reached Postgres and its invalid-input error (22P02) became a 500. It is a 400 now, and a
 * follow of a user that does not exist (foreign-key violation, 23503) is a 404. The column types are not assumed.
 */
function supabaseAnswering(code: string, details: string | null = null) {
  const client = createClient('https://db.example.test', 'public-test-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: () =>
        Promise.resolve(
          Response.json(
            { code, message: `pg ${code}`, details, hint: null },
            { status: 400 },
          ),
        ),
    },
  });
  class HttpSupabase extends SupabaseService {
    override get client() {
      return client;
    }
  }
  return new HttpSupabase();
}

describe('malformed or unknown ids on write routes (#1015)', () => {
  const bad = supabaseAnswering('22P02');

  it('reader comment delete → 400', async () => {
    await expect(
      new ReaderCommentsService(bad).deleteComment('u1', 'abc'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('notification mark-read → 400', async () => {
    await expect(
      new NotificationsService(bad).markRead('u1', 'abc'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('follow / unfollow → 400', async () => {
    const svc = new UserFollowsService(bad);
    await expect(svc.follow('u1', 'abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.unfollow('u1', 'abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('following a user that does not exist → 404', async () => {
    const svc = new UserFollowsService(
      supabaseAnswering(
        '23503',
        'Key (following_uid)=(00000000-0000-4000-8000-000000000000) is not present in table "profiles".',
      ),
    );
    await expect(
      svc.follow('u1', '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a missing row for the follower is not reported as the followee not existing', async () => {
    const svc = new UserFollowsService(
      supabaseAnswering(
        '23503',
        'Key (follower_uid)=(u1) is not present in table "profiles".',
      ),
    );
    await expect(svc.follow('u1', 'u2')).rejects.not.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('any other database error is still a server error', async () => {
    const svc = new ReaderCommentsService(supabaseAnswering('XX000'));
    await expect(svc.deleteComment('u1', 'abc')).rejects.not.toBeInstanceOf(
      BadRequestException,
    );
  });
});
