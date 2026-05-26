import { Test } from '@nestjs/testing';
import type { NestApplication } from '@nestjs/core';
import request = require('supertest');
import { UnauthorizedException } from '@nestjs/common';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';

const TEST_USER = { uid: 'test-uid', email: 'test@test.com', name: 'Test User' };

const MOCK_POST = {
  id: 'p1',
  title: 'Favourite arc in One Piece?',
  content: 'Mine is Marineford.',
  category: 'general',
  authorUid: TEST_USER.uid,
  authorName: 'Test User',
  upvotes: 0,
  downvotes: 0,
  userVote: 0,
  commentCount: 0,
  imageUrls: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_COMMENT = {
  id: 'c1',
  postId: 'p1',
  parentId: null,
  content: 'Wano is better!',
  authorUid: TEST_USER.uid,
  authorName: 'Test User',
  upvotes: 0,
  downvotes: 0,
  userVote: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockForumService = {
  listPosts: jest.fn(),
  getTrendingManga: jest.fn(),
  getPost: jest.fn(),
  createPost: jest.fn(),
  listComments: jest.fn(),
  createComment: jest.fn(),
  vote: jest.fn(),
  uploadImage: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn().mockImplementation((ctx) => {
    ctx.switchToHttp().getRequest()[USER_KEY] = TEST_USER;
    return true;
  }),
};

describe('ForumController', () => {
  let app: NestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [{ provide: ForumService, useValue: mockForumService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(OptionalAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /forum/posts (public) ────────────────────────────────────────────

  describe('GET /forum/posts', () => {
    it('should return a list of posts', async () => {
      mockForumService.listPosts.mockResolvedValue([MOCK_POST]);
      const res = await request(app.getHttpServer()).get('/forum/posts').expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('p1');
    });

    it('should forward category, sort, limit, offset query params', async () => {
      mockForumService.listPosts.mockResolvedValue([]);
      await request(app.getHttpServer())
        .get('/forum/posts?category=general&sort=new&limit=10&offset=20')
        .expect(200);
      expect(mockForumService.listPosts).toHaveBeenCalledWith(
        'general', undefined, 'new', 10, 20, TEST_USER.uid,
      );
    });

    it('should default to sort=hot, limit=20, offset=0', async () => {
      mockForumService.listPosts.mockResolvedValue([]);
      await request(app.getHttpServer()).get('/forum/posts').expect(200);
      expect(mockForumService.listPosts).toHaveBeenCalledWith(
        undefined, undefined, 'hot', 20, 0, TEST_USER.uid,
      );
    });
  });

  // ─── GET /forum/trending-manga ────────────────────────────────────────────

  describe('GET /forum/trending-manga', () => {
    it('should return trending manga with default limit 5', async () => {
      mockForumService.getTrendingManga.mockResolvedValue([
        { mangaId: 'm1', mangaTitle: 'One Piece', postCount: 42 },
        { mangaId: 'm2', mangaTitle: 'Naruto', postCount: 30 },
      ]);
      const res = await request(app.getHttpServer()).get('/forum/trending-manga').expect(200);
      expect(res.body).toHaveLength(2);
      expect(mockForumService.getTrendingManga).toHaveBeenCalledWith(5);
    });

    it('should respect custom limit query param', async () => {
      mockForumService.getTrendingManga.mockResolvedValue([]);
      await request(app.getHttpServer()).get('/forum/trending-manga?limit=3').expect(200);
      expect(mockForumService.getTrendingManga).toHaveBeenCalledWith(3);
    });
  });

  // ─── GET /forum/posts/:id ─────────────────────────────────────────────────

  describe('GET /forum/posts/:id', () => {
    it('should return a single post by ID', async () => {
      mockForumService.getPost.mockResolvedValue(MOCK_POST);
      const res = await request(app.getHttpServer()).get('/forum/posts/p1').expect(200);
      expect(res.body.id).toBe('p1');
      expect(res.body.title).toBe(MOCK_POST.title);
    });
  });

  // ─── POST /forum/posts ────────────────────────────────────────────────────

  describe('POST /forum/posts', () => {
    it('should create a new post and return it', async () => {
      mockForumService.createPost.mockResolvedValue(MOCK_POST);
      const dto = { title: 'Favourite arc in One Piece?', content: 'Mine is Marineford.', category: 'general' };
      const res = await request(app.getHttpServer())
        .post('/forum/posts')
        .send(dto)
        .expect(201);
      expect(res.body.id).toBe('p1');
      expect(mockForumService.createPost).toHaveBeenCalledWith(
        TEST_USER.uid,
        expect.objectContaining({ title: dto.title, category: 'general' }),
      );
    });

    it('should create a manga-linked post with targetMangaId', async () => {
      const mangaPost = { ...MOCK_POST, targetMangaId: 'm1', targetMangaTitle: 'One Piece' };
      mockForumService.createPost.mockResolvedValue(mangaPost);
      const res = await request(app.getHttpServer())
        .post('/forum/posts')
        .send({
          title: 'One Piece discussion',
          content: 'Let\'s talk!',
          category: 'manga_update',
          targetMangaId: 'm1',
          targetMangaTitle: 'One Piece',
        })
        .expect(201);
      expect(res.body.targetMangaId).toBe('m1');
    });
  });

  // ─── GET /forum/posts/:id/comments ───────────────────────────────────────

  describe('GET /forum/posts/:id/comments', () => {
    it('should return comments for a post', async () => {
      mockForumService.listComments.mockResolvedValue([MOCK_COMMENT]);
      const res = await request(app.getHttpServer()).get('/forum/posts/p1/comments').expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].content).toBe('Wano is better!');
    });

    it('should return an empty array when a post has no comments', async () => {
      mockForumService.listComments.mockResolvedValue([]);
      const res = await request(app.getHttpServer()).get('/forum/posts/p1/comments').expect(200);
      expect(res.body).toEqual([]);
    });
  });

  // ─── POST /forum/comments ────────────────────────────────────────────────

  describe('POST /forum/comments', () => {
    it('should create a top-level comment', async () => {
      mockForumService.createComment.mockResolvedValue(MOCK_COMMENT);
      const res = await request(app.getHttpServer())
        .post('/forum/comments')
        .send({ postId: 'p1', content: 'Wano is better!' })
        .expect(201);
      expect(res.body.id).toBe('c1');
      expect(mockForumService.createComment).toHaveBeenCalledWith(
        TEST_USER.uid,
        expect.objectContaining({ postId: 'p1' }),
      );
    });

    it('should create a reply by including parentId', async () => {
      const replyComment = { ...MOCK_COMMENT, id: 'c2', parentId: 'c1', content: 'I agree!' };
      mockForumService.createComment.mockResolvedValue(replyComment);
      const res = await request(app.getHttpServer())
        .post('/forum/comments')
        .send({ postId: 'p1', parentId: 'c1', content: 'I agree!' })
        .expect(201);
      expect(res.body.parentId).toBe('c1');
    });
  });

  // ─── POST /forum/vote ────────────────────────────────────────────────────

  describe('POST /forum/vote', () => {
    it('should upvote a post and return updated counts', async () => {
      mockForumService.vote.mockResolvedValue({ upvotes: 1, downvotes: 0 });
      const res = await request(app.getHttpServer())
        .post('/forum/vote')
        .send({ targetType: 'post', targetId: 'p1', voteValue: 1 })
        .expect(201);
      expect(res.body.upvotes).toBe(1);
      expect(res.body.downvotes).toBe(0);
    });

    it('should downvote a post', async () => {
      mockForumService.vote.mockResolvedValue({ upvotes: 0, downvotes: 1 });
      const res = await request(app.getHttpServer())
        .post('/forum/vote')
        .send({ targetType: 'post', targetId: 'p1', voteValue: -1 })
        .expect(201);
      expect(res.body.downvotes).toBe(1);
    });

    it('should toggle vote off (upvotes back to 0) when same value is cast again', async () => {
      mockForumService.vote.mockResolvedValue({ upvotes: 0, downvotes: 0 });
      const res = await request(app.getHttpServer())
        .post('/forum/vote')
        .send({ targetType: 'post', targetId: 'p1', voteValue: 1 })
        .expect(201);
      expect(res.body.upvotes).toBe(0);
      expect(res.body.downvotes).toBe(0);
    });

    it('should also vote on comments', async () => {
      mockForumService.vote.mockResolvedValue({ upvotes: 3, downvotes: 0 });
      await request(app.getHttpServer())
        .post('/forum/vote')
        .send({ targetType: 'comment', targetId: 'c1', voteValue: 1 })
        .expect(201);
      expect(mockForumService.vote).toHaveBeenCalledWith(
        TEST_USER.uid,
        expect.objectContaining({ targetType: 'comment', targetId: 'c1' }),
      );
    });
  });

  // ─── Full forum flow: browse → post → comment → vote ─────────────────────

  describe('normal user flow', () => {
    it('browse posts, create post, add comment, upvote post', async () => {
      mockForumService.listPosts.mockResolvedValue([]);
      mockForumService.createPost.mockResolvedValue(MOCK_POST);
      mockForumService.createComment.mockResolvedValue(MOCK_COMMENT);
      mockForumService.vote.mockResolvedValue({ upvotes: 1, downvotes: 0 });

      // 1. Browse public feed
      const feed = await request(app.getHttpServer()).get('/forum/posts').expect(200);
      expect(Array.isArray(feed.body)).toBe(true);

      // 2. Create a new post
      const post = await request(app.getHttpServer())
        .post('/forum/posts')
        .send({ title: 'Test', content: 'Hello', category: 'general' })
        .expect(201);
      expect(post.body.id).toBe('p1');

      // 3. Add a comment
      const comment = await request(app.getHttpServer())
        .post('/forum/comments')
        .send({ postId: post.body.id, content: 'Nice!' })
        .expect(201);
      expect(comment.body.postId).toBe('p1');

      // 4. Upvote the post
      const vote = await request(app.getHttpServer())
        .post('/forum/vote')
        .send({ targetType: 'post', targetId: post.body.id, voteValue: 1 })
        .expect(201);
      expect(vote.body.upvotes).toBe(1);
    });
  });

  // ─── AuthGuard enforcement (POST routes) ─────────────────────────────────

  describe('AuthGuard enforcement', () => {
    let unauthApp: NestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [ForumController],
        providers: [{ provide: ForumService, useValue: mockForumService }],
      })
        .overrideGuard(AuthGuard)
        .useValue({ canActivate: () => { throw new UnauthorizedException(); } })
        .overrideGuard(OptionalAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

      unauthApp = moduleRef.createNestApplication();
      await unauthApp.init();
    });

    afterAll(() => unauthApp.close());

    it.each([
      ['/forum/posts', { title: 'x', content: 'y', category: 'general' }],
      ['/forum/comments', { postId: 'p1', content: 'hi' }],
      ['/forum/vote', { targetType: 'post', targetId: 'p1', voteValue: 1 }],
    ])('POST %s → 401 without token', async (path, body) => {
      await request(unauthApp.getHttpServer()).post(path).send(body).expect(401);
    });

    it('GET /forum/posts → 200 without token (public route)', async () => {
      mockForumService.listPosts.mockResolvedValue([]);
      await request(unauthApp.getHttpServer()).get('/forum/posts').expect(200);
    });

    it('GET /forum/trending-manga → 200 without token (public route)', async () => {
      mockForumService.getTrendingManga.mockResolvedValue([]);
      await request(unauthApp.getHttpServer()).get('/forum/trending-manga').expect(200);
    });
  });
});
