import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { UserFollowsService } from './user-follows.service';

const profile = {
  uid: 'reader-2',
  display_name: 'Other reader',
  photo_url: 'https://images.example.test/reader.jpg',
};

function fixture(profiles: (typeof profile | (typeof profile)[] | null)[]) {
  const client = createClient('https://db.example.test', 'public-test-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname !== '/rest/v1/user_follows')
          return Promise.resolve(Response.json({}, { status: 404 }));
        if (
          url.searchParams.get('follower_uid') !== 'eq.reader-1' &&
          url.searchParams.get('following_uid') !== 'eq.reader-1'
        )
          return Promise.resolve(Response.json([]));
        return Promise.resolve(
          Response.json(profiles.map((joined) => ({ profiles: joined }))),
        );
      },
    },
  });
  class HttpSupabase extends SupabaseService {
    override get client() {
      return client;
    }
  }
  return new UserFollowsService(new HttpSupabase());
}

describe('UserFollowsService profile join', () => {
  it('returns the followed profile when the joined relation is an array', async () => {
    expect(await fixture([[profile]]).getFollowing('reader-1')).toEqual([
      {
        uid: profile.uid,
        displayName: profile.display_name,
        photoUrl: profile.photo_url,
      },
    ]);
  });
  it('keeps both follow directions compatible with objects and excludes null or empty joins', async () => {
    const service = fixture([null, [], profile, [profile]]);
    const expected = [
      {
        uid: profile.uid,
        displayName: profile.display_name,
        photoUrl: profile.photo_url,
      },
      {
        uid: profile.uid,
        displayName: profile.display_name,
        photoUrl: profile.photo_url,
      },
    ];
    expect(await service.getFollowing('reader-1')).toEqual(expected);
    expect(await service.getFollowers('reader-1')).toEqual(expected);
  });
});
