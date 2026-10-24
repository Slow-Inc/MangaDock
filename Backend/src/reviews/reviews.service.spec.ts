import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { ReviewsService } from './reviews.service';

const profile = {
  display_name: 'Reviewer',
  photo_url: 'https://images.example.test/reviewer.jpg',
};
const review = {
  id: 'review-1',
  uid: 'reader-1',
  manga_id: 'manga-1',
  rating: 4,
  body: 'Good',
  created_at: '2026-10-02T00:00:00Z',
};

function fixture(profiles: typeof profile | (typeof profile)[] | null) {
  const client = createClient('https://db.example.test', 'public-test-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL) =>
        Promise.resolve(
          new URL(input instanceof Request ? input.url : input).pathname ===
            '/rest/v1/manga_reviews'
            ? Response.json([{ ...review, profiles }])
            : Response.json({}, { status: 404 }),
        ),
    },
  });
  class HttpSupabase extends SupabaseService {
    override get client() {
      return client;
    }
  }
  return new ReviewsService(new HttpSupabase());
}

describe('ReviewsService profile join', () => {
  it('retains reviewer details when listing an array-shaped profile relation', async () => {
    const [item] = await fixture([profile]).getReviews('manga-1');
    expect(item).toEqual({
      id: review.id,
      uid: review.uid,
      mangaId: review.manga_id,
      rating: review.rating,
      body: review.body,
      createdAt: review.created_at,
      displayName: profile.display_name,
      photoUrl: profile.photo_url,
    });
  });
  it.each([profile, [profile], [], null])(
    'keeps list and own-review responses consistent for profile shape %j',
    async (profiles) => {
      const service = fixture(profiles);
      const [listed] = await service.getReviews('manga-1');
      const own = await service.getMyReview('reader-1', 'manga-1');
      const present =
        profiles === profile ||
        (Array.isArray(profiles) && profiles.length > 0);
      expect(listed).toMatchObject({
        displayName: present ? profile.display_name : null,
        photoUrl: present ? profile.photo_url : null,
      });
      expect(own).toEqual(listed);
    },
  );
});
