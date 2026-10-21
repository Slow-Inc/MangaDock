import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { ReaderCommentsService } from './reader-comments.service';

const profile = {
  display_name: 'Reader',
  photo_url: 'https://images.example.test/avatar.jpg',
};
const comment = {
  id: 'comment-1',
  uid: 'reader-1',
  manga_id: 'manga-1',
  chapter_id: 'chapter-1',
  page_number: 2,
  body: 'Hello',
  created_at: '2026-10-02T00:00:00Z',
};

function fixture(profiles: typeof profile | (typeof profile)[] | null) {
  const client = createClient('https://db.example.test', 'public-test-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname !== '/rest/v1/reader_comments')
          return Promise.resolve(Response.json({}, { status: 404 }));
        return Promise.resolve(
          Response.json(
            init?.method === 'POST'
              ? { ...comment, profiles }
              : [{ ...comment, profiles }],
          ),
        );
      },
    },
  });
  class HttpSupabase extends SupabaseService {
    override get client() {
      return client;
    }
  }
  return new ReaderCommentsService(new HttpSupabase());
}

describe('ReaderCommentsService profile join', () => {
  it('retains author details when the profile join is returned as an array', async () => {
    const comments = await fixture([profile]).getComments(
      'manga-1',
      'chapter-1',
      2,
    );
    expect(comments).toEqual([
      {
        id: comment.id,
        uid: comment.uid,
        mangaId: comment.manga_id,
        chapterId: comment.chapter_id,
        pageNumber: comment.page_number,
        body: comment.body,
        createdAt: comment.created_at,
        displayName: profile.display_name,
        photoUrl: profile.photo_url,
      },
    ]);
  });
  it.each([profile, [], null])(
    'preserves object and absent profiles in comment reads and creation: %j',
    async (profiles) => {
      const service = fixture(profiles);
      const [listed] = await service.getComments('manga-1', 'chapter-1', 2);
      const added = await service.addComment(
        'reader-1',
        'manga-1',
        'chapter-1',
        2,
        'Hello',
      );
      const author = {
        displayName: profiles === profile ? profile.display_name : null,
        photoUrl: profiles === profile ? profile.photo_url : null,
      };
      expect(listed).toMatchObject(author);
      expect(added).toEqual(listed);
    },
  );
  it('retains author details on a newly inserted comment with an array profile', async () => {
    expect(
      await fixture([profile]).addComment(
        'reader-1',
        'manga-1',
        'chapter-1',
        2,
        'Hello',
      ),
    ).toMatchObject({
      displayName: profile.display_name,
      photoUrl: profile.photo_url,
    });
  });
});
