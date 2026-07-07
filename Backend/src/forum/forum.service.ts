import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, InternalServerErrorException, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { fileTypeFromFile } from 'file-type';
import { SupabaseService } from '../supabase/supabase.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../common/storage/storage-provider.interface';
import { ForumEventsService } from './forum-events.service';
import {
  ForumPost,
  ForumComment,
  CreatePostDto,
  CreateCommentDto,
  UpdatePostDto,
  UpdateCommentDto,
  VoteDto,
  ForumCategory,
  TrendingManga,
  ProfileComment,
  TranslatedTitle,
  PublicUserProfile,
  UserProfileEarnings,
  UserProfileResponse,
} from './forum.types';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

type ForumPostRow = {
  id: string;
  author_uid: string;
  title: string;
  content: string;
  category: string;
  target_manga_id: string | null;
  target_manga_title: string | null;
  target_manga_cover: string | null;
  image_urls: string[] | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author?: { display_name: string | null; photo_url: string | null; role: string } | null;
  comments?: Array<{ count: number }> | null;
};

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly forumEvents: ForumEventsService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  async listPosts(
    category?: ForumCategory, 
    mangaId?: string, 
    sort: 'new' | 'hot' = 'new',
    limit = 20, 
    offset = 0,
    userUid?: string
  ): Promise<{ items: ForumPost[], total: number }> {
    let query = this.db
      .from('forum_posts')
      .select(`
        *,
        author:profiles(display_name, photo_url, role),
        comments:forum_comments(count)
      `, { count: 'exact' })
      .is('deleted_at', null)
      .is('comments.deleted_at', null);

    if (category) query = query.eq('category', category);
    if (mangaId) query = query.eq('target_manga_id', mangaId);

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false });
    } else {
      // Hot: upvotes desc, recency as tiebreaker
      query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error) throw new InternalServerErrorException(`Failed to list posts: ${error.message}`);

    const userVotes = await this.getUserVotes(userUid, 'post', (data ?? []).map(p => p.id));

    const items: ForumPost[] = (data ?? []).map(p => ({
      id: p.id,
      authorUid: p.author_uid,
      authorName: p.author?.display_name,
      authorPhotoUrl: p.author?.photo_url,
      authorRole: p.author?.role,
      title: p.title,
      content: p.content,
      category: p.category as ForumCategory,
      targetMangaId: p.target_manga_id,
      targetMangaTitle: p.target_manga_title,
      targetMangaCover: p.target_manga_cover,
      imageUrls: p.image_urls ?? [],
      upvotes: p.upvotes,
      downvotes: p.downvotes,
      userVote: userVotes.get(p.id) ?? 0,
      commentCount: p.comments?.[0]?.count ?? 0,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return { items, total: count ?? 0 };
  }

  async getPost(id: string, userUid?: string): Promise<ForumPost> {
    const { data, error } = await this.db
      .from('forum_posts')
      .select(`
        *,
        author:profiles(display_name, photo_url, role),
        comments:forum_comments(count)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .is('comments.deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Post not found');

    const userVotes = await this.getUserVotes(userUid, 'post', [id]);

    return {
      id: data.id,
      authorUid: data.author_uid,
      authorName: data.author?.display_name,
      authorPhotoUrl: data.author?.photo_url,
      authorRole: data.author?.role,
      title: data.title,
      content: data.content,
      category: data.category as ForumCategory,
      targetMangaId: data.target_manga_id,
      targetMangaTitle: data.target_manga_title,
      targetMangaCover: data.target_manga_cover,
      imageUrls: data.image_urls ?? [],
      upvotes: data.upvotes,
      downvotes: data.downvotes,
      userVote: userVotes.get(id) ?? 0,
      commentCount: data.comments?.[0]?.count ?? 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createPost(uid: string, dto: CreatePostDto): Promise<ForumPost> {
    const { data, error } = await this.db
      .from('forum_posts')
      .insert({
        author_uid: uid,
        title: dto.title,
        content: dto.content,
        category: dto.category,
        target_manga_id: dto.targetMangaId,
        target_manga_title: dto.targetMangaTitle,
        target_manga_cover: dto.targetMangaCover,
        image_urls: dto.imageUrls ?? [],
      })
      .select('*, author:profiles(display_name, photo_url, role)')
      .single();

    if (error) throw new InternalServerErrorException(`Failed to create post: ${error.message}`);

    const post: ForumPost = {
      id: data.id,
      authorUid: data.author_uid,
      authorName: data.author?.display_name,
      authorPhotoUrl: data.author?.photo_url,
      authorRole: data.author?.role,
      title: data.title,
      content: data.content,
      category: data.category as ForumCategory,
      targetMangaId: data.target_manga_id,
      targetMangaTitle: data.target_manga_title,
      targetMangaCover: data.target_manga_cover,
      imageUrls: data.image_urls ?? [],
      upvotes: data.upvotes ?? 0,
      downvotes: data.downvotes ?? 0,
      userVote: 0,
      commentCount: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    this.forumEvents.broadcastFeedEvent({
      type: 'new_post',
      id: post.id,
      title: post.title,
      authorName: post.authorName ?? null,
      authorPhotoUrl: post.authorPhotoUrl ?? null,
      category: post.category,
      createdAt: post.createdAt,
    }).catch(err => this.logger.warn(`SSE feed broadcast failed: ${String(err)}`));

    return post;
  }

  async getPublicProfile(uid: string, viewerUid?: string): Promise<UserProfileResponse> {
    const [profileRes, postsRes, commentsRes, likedVotesRes, versionsRes] = await Promise.all([
      this.db.from('profiles')
        .select('uid, display_name, photo_url, banner_url, banner_position, role, bio, country, translator_languages, rating_avg, rating_count, created_at')
        .eq('uid', uid)
        .single(),
      this.db.from('forum_posts')
        .select('*, author:profiles(display_name, photo_url, role), comments:forum_comments(count)')
        .eq('author_uid', uid)
        .is('deleted_at', null)
        .is('comments.deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20),
      this.db.from('forum_comments')
        .select('id, post_id, content, upvotes, downvotes, created_at, post:forum_posts(id, title)')
        .eq('author_uid', uid)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30),
      this.db.from('forum_votes')
        .select('target_id, created_at')
        .eq('uid', uid)
        .eq('target_type', 'post')
        .eq('vote_value', 1)
        .order('created_at', { ascending: false })
        .limit(20),
      this.db.from('chapter_versions')
        .select('title_id, title_name, language, status')
        .eq('translator_uid', uid)
        .in('status', ['published', 'approved']),
    ]);

    if (profileRes.error || !profileRes.data) throw new NotFoundException('Profile not found');

    // Secondary sections degrade gracefully to empty on error, but a silently
    // empty section is indistinguishable from a real "no data" state. Log each
    // failure so a transient query error is observable instead of masked.
    for (const [name, r] of [
      ['posts', postsRes],
      ['comments', commentsRes],
      ['likedVotes', likedVotesRes],
      ['versions', versionsRes],
    ] as const) {
      if (r.error) {
        this.logger.warn(
          `getPublicProfile: ${name} query failed for uid=${uid}: ${JSON.stringify(r.error)}`,
        );
      }
    }
    const p = profileRes.data;

    // Fetch liked posts by IDs
    const likedPostIds = (likedVotesRes.data ?? []).map((v: { target_id: string }) => v.target_id);
    let likedPostsRaw: ForumPostRow[] = [];
    if (likedPostIds.length > 0) {
      const { data } = await this.db
        .from('forum_posts')
        .select('*, author:profiles(display_name, photo_url, role), comments:forum_comments(count)')
        .in('id', likedPostIds)
        .is('deleted_at', null)
        .is('comments.deleted_at', null);
      likedPostsRaw = data ?? [];
    }

    // Viewer votes on all shown posts
    const allPostIds = [...(postsRes.data ?? []).map((x: any) => x.id), ...likedPostIds];
    const viewerVotes = await this.getUserVotes(viewerUid, 'post', allPostIds);

    const mapPost = (raw: ForumPostRow): ForumPost => ({
      id: raw.id,
      authorUid: raw.author_uid,
      authorName: raw.author?.display_name ?? null,
      authorPhotoUrl: raw.author?.photo_url ?? null,
      authorRole: raw.author?.role ?? 'user',
      title: raw.title,
      content: raw.content,
      category: raw.category as ForumCategory,
      targetMangaId: raw.target_manga_id ?? null,
      targetMangaTitle: raw.target_manga_title ?? null,
      targetMangaCover: raw.target_manga_cover ?? null,
      imageUrls: raw.image_urls ?? [],
      upvotes: raw.upvotes,
      downvotes: raw.downvotes,
      userVote: viewerVotes.get(raw.id) ?? 0,
      commentCount: raw.comments?.[0]?.count ?? 0,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    });

    const profileComments: ProfileComment[] = (commentsRes.data ?? []).map((c: any) => ({
      id: c.id,
      postId: c.post_id,
      postTitle: c.post?.title ?? 'ไม่พบโพสต์',
      content: c.content,
      upvotes: c.upvotes,
      downvotes: c.downvotes,
      createdAt: c.created_at,
    }));

    // Group chapter_versions by title
    const titleMap = new Map<string, TranslatedTitle>();
    (versionsRes.data ?? []).forEach((v: any) => {
      if (!titleMap.has(v.title_id)) {
        titleMap.set(v.title_id, { titleId: v.title_id, titleName: v.title_name, language: v.language, chapterCount: 0 });
      }
      titleMap.get(v.title_id)!.chapterCount++;
    });

    // Earnings: only for own creator/translator profile
    let earnings: UserProfileEarnings | null = null;
    const isCreator = p.role === 'translator' || p.role === 'creator';
    if (isCreator && viewerUid === uid) {
      const { data: earningsData } = await this.db
        .from('translator_earnings')
        .select('*')
        .eq('translator_uid', uid)
        .maybeSingle();
      if (earningsData) {
        earnings = {
          totalSales: earningsData.total_sales ?? 0,
          totalEarned: earningsData.total_earned ?? 0,
          titlesSold: earningsData.titles_sold ?? 0,
          uniqueBuyers: earningsData.unique_buyers ?? 0,
        };
      }
    }

    const profile: PublicUserProfile = {
      uid: p.uid,
      displayName: p.display_name,
      photoUrl: p.photo_url,
      bannerUrl: p.banner_url ?? null,
      bannerPosition: p.banner_position != null ? Number(p.banner_position) : 50,
      role: p.role,
      bio: p.bio,
      country: p.country,
      translatorLanguages: p.translator_languages ?? [],
      ratingAvg: p.rating_avg ?? 0,
      ratingCount: p.rating_count ?? 0,
      createdAt: p.created_at,
    };

    return {
      profile,
      posts: (postsRes.data ?? []).map(mapPost),
      comments: profileComments,
      likedPosts: likedPostsRaw.map(mapPost),
      translatedTitles: Array.from(titleMap.values()),
      earnings,
    };
  }

  async deletePost(uid: string, id: string): Promise<void> {
    const { data: existing, error: fetchErr } = await this.db
      .from('forum_posts')
      .select('author_uid')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw new NotFoundException('Post not found');
    if (existing.author_uid !== uid) throw new ForbiddenException('Not authorized to delete this post');

    const { error } = await this.db
      .from('forum_posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new InternalServerErrorException(`Failed to delete post: ${error.message}`);

    this.forumEvents.broadcastPostEvent({ type: 'post_deleted', postId: id })
      .catch(err => this.logger.warn(`SSE broadcast failed: ${String(err)}`));
  }

  async deleteComment(uid: string, id: string): Promise<void> {
    const { data: existing, error: fetchErr } = await this.db
      .from('forum_comments')
      .select('author_uid, post_id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw new NotFoundException('Comment not found');
    if (existing.author_uid !== uid) throw new ForbiddenException('Not authorized to delete this comment');

    const { error } = await this.db
      .from('forum_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new InternalServerErrorException(`Failed to delete comment: ${error.message}`);

    this.forumEvents.broadcastPostEvent({
      type: 'comment_deleted',
      postId: existing.post_id,
      commentId: id,
    }).catch(err => this.logger.warn(`SSE broadcast failed: ${String(err)}`));
  }

  async updatePost(uid: string, id: string, dto: UpdatePostDto): Promise<ForumPost> {
    const { data: existing, error: fetchErr } = await this.db
      .from('forum_posts')
      .select('author_uid')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw new NotFoundException('Post not found');
    if (existing.author_uid !== uid) throw new ForbiddenException('Not authorized to edit this post');

    const updates: Record<string, unknown> = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.content !== undefined) updates.content = dto.content;

    const { error } = await this.db
      .from('forum_posts')
      .update(updates)
      .eq('id', id);

    if (error) throw new InternalServerErrorException(`Failed to update post: ${error.message}`);
    const updated = await this.getPost(id, uid);

    this.forumEvents.broadcastPostEvent({
      type: 'post_edited',
      postId: id,
      title: updated.title,
      content: updated.content,
      updatedAt: updated.updatedAt,
    }).catch(err => this.logger.warn(`SSE broadcast failed: ${String(err)}`));

    return updated;
  }

  async updateComment(uid: string, id: string, dto: UpdateCommentDto): Promise<ForumComment> {
    const { data: existing, error: fetchErr } = await this.db
      .from('forum_comments')
      .select('author_uid')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw new NotFoundException('Comment not found');
    if (existing.author_uid !== uid) throw new ForbiddenException('Not authorized to edit this comment');

    const { data, error } = await this.db
      .from('forum_comments')
      .update({ content: dto.content })
      .eq('id', id)
      .select('*, author:profiles(display_name, photo_url, role)')
      .single();

    if (error) throw new InternalServerErrorException(`Failed to update comment: ${error.message}`);

    return {
      id: data.id,
      postId: data.post_id,
      parentId: data.parent_id,
      authorUid: data.author_uid,
      authorName: data.author?.display_name,
      authorPhotoUrl: data.author?.photo_url,
      authorRole: data.author?.role,
      content: data.content,
      upvotes: data.upvotes,
      downvotes: data.downvotes,
      userVote: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async uploadBanner(uid: string, tempFilePath: string, _clientMime: string): Promise<{ bannerUrl: string }> {
    // Validate by magic bytes, not the client-supplied Content-Type header
    const detected = await fileTypeFromFile(tempFilePath);
    if (!detected || !ALLOWED_IMAGE_MIME.has(detected.mime)) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      throw new BadRequestException('Only JPEG, PNG, WebP and GIF are allowed');
    }
    const mimeType = detected.mime;

    const ext = MIME_TO_EXT[mimeType];
    const filename = `${crypto.randomUUID()}${ext}`;
    const key = `uploads/banners/${filename}`;

    try {
      const fileData = fs.readFileSync(tempFilePath);
      await this.storage.put(key, fileData, { contentType: mimeType });
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      this.logger.error(`Banner upload failed: ${String(err)}`);
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      throw new InternalServerErrorException('Failed to upload banner');
    }

    const bannerUrl = `/${key}`;

    const { error } = await this.db
      .from('profiles')
      .update({ banner_url: bannerUrl })
      .eq('uid', uid);

    if (error) throw new InternalServerErrorException(`Failed to update profile banner: ${error.message}`);

    return { bannerUrl };
  }

  async updateBannerPosition(uid: string, position: number): Promise<{ bannerPosition: number }> {
    const clamped = Math.max(0, Math.min(100, position));
    const { error } = await this.db
      .from('profiles')
      .update({ banner_position: clamped })
      .eq('uid', uid);
    if (error) throw new InternalServerErrorException(`Failed to update banner position: ${error.message}`);
    return { bannerPosition: clamped };
  }

  async uploadImage(uid: string, tempFilePath: string, _clientMime: string): Promise<{ imageUrl: string }> {
    // Validate by magic bytes, not the client-supplied Content-Type header
    const detected = await fileTypeFromFile(tempFilePath);
    if (!detected || !ALLOWED_IMAGE_MIME.has(detected.mime)) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      throw new BadRequestException('Only JPEG, PNG, WebP and GIF are allowed');
    }
    const mimeType = detected.mime;

    const ext = MIME_TO_EXT[mimeType];
    const filename = `${crypto.randomUUID()}${ext}`;
    const key = `uploads/forum/${filename}`;

    try {
      const fileData = fs.readFileSync(tempFilePath);
      await this.storage.put(key, fileData, { contentType: mimeType });
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      this.logger.error(`Forum image upload failed: ${String(err)}`);
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      throw new InternalServerErrorException('Failed to upload image');
    }

    return { imageUrl: `/${key}` };
  }

  async listComments(postId: string, userUid?: string): Promise<ForumComment[]> {
    const { data, error } = await this.db
      .from('forum_comments')
      .select(`
        *,
        author:profiles(display_name, photo_url, role)
      `)
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) throw new InternalServerErrorException(`Failed to list comments: ${error.message}`);

    const userVotes = await this.getUserVotes(userUid, 'comment', (data ?? []).map(c => c.id));

    const allComments: ForumComment[] = (data ?? []).map(c => ({
      id: c.id,
      postId: c.post_id,
      parentId: c.parent_id,
      authorUid: c.author_uid,
      authorName: c.author?.display_name,
      authorPhotoUrl: c.author?.photo_url,
      authorRole: c.author?.role,
      content: c.content,
      upvotes: c.upvotes,
      downvotes: c.downvotes,
      userVote: userVotes.get(c.id) ?? 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    // Build nested structure
    const commentMap = new Map<string, ForumComment>();
    const rootComments: ForumComment[] = [];

    allComments.forEach(c => {
      c.replies = [];
      commentMap.set(c.id, c);
    });

    allComments.forEach(c => {
      if (c.parentId && commentMap.has(c.parentId)) {
        commentMap.get(c.parentId)!.replies!.push(c);
      } else {
        rootComments.push(c);
      }
    });

    return rootComments;
  }

  async getTrendingManga(limit = 5): Promise<TrendingManga[]> {
    try {
      // Group + rank in Postgres. The old path pulled a 200-row sample into Node and
      // tallied it, which undercounted / mis-ranked once a manga's within-window posts
      // spilled past the sample. The RPC reproduces the same filter semantics
      // (non-null id, non-empty title, created within the last 7 days) but counts and
      // orders across the full table (FR-16).
      const { data, error } = await this.db.rpc('get_trending_manga', {
        p_limit: limit,
      });

      if (error) {
        this.logger.error(`Supabase error fetching trending: ${error.message}`);
        return []; // Fallback to empty list instead of crashing
      }

      // post_count arrives as a bigint string over PostgREST — coerce to number.
      return ((data ?? []) as any[]).map(row => ({
        mangaId: row.manga_id,
        mangaTitle: row.manga_title || 'Unknown',
        mangaCover: row.manga_cover,
        postCount: Number(row.post_count),
      }));
    } catch (err) {
      this.logger.error(`Unexpected error in getTrendingManga: ${String(err)}`);
      return [];
    }
  }

  async createComment(uid: string, dto: CreateCommentDto): Promise<ForumComment> {
    if (dto.parentId) {
      const { data: parentComment, error: parentError } = await this.db
        .from('forum_comments')
        .select('id, post_id')
        .eq('id', dto.parentId)
        .is('deleted_at', null)
        .maybeSingle();

      if (parentError) {
        throw new InternalServerErrorException(
          `Failed to validate parent comment: ${parentError.message}`,
        );
      }
      if (!parentComment) throw new NotFoundException('Parent comment not found');
      // Supabase row keys mirror DB column names (snake_case).
      if (parentComment.post_id !== dto.postId) {
        throw new BadRequestException('Parent comment must belong to the same post');
      }
    }

    const { data, error } = await this.db
      .from('forum_comments')
      .insert({
        post_id: dto.postId,
        parent_id: dto.parentId,
        author_uid: uid,
        content: dto.content,
      })
      .select('*, author:profiles(display_name, photo_url, role)')
      .single();

    if (error) throw new InternalServerErrorException(`Failed to create comment: ${error.message}`);

    const comment: ForumComment = {
      ...data,
      postId: data.post_id,
      parentId: data.parent_id,
      authorUid: data.author_uid,
      authorName: data.author?.display_name,
      authorPhotoUrl: data.author?.photo_url,
      authorRole: data.author?.role,
      userVote: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    this.forumEvents.broadcastPostEvent({ type: 'comment', postId: comment.postId, comment })
      .catch(err => this.logger.warn(`SSE broadcast failed: ${String(err)}`));

    return comment;
  }

  async vote(uid: string, dto: VoteDto): Promise<{ upvotes: number, downvotes: number }> {
    // Atomic upsert/toggle + recalculate in a single transaction. Replaces the old
    // select-then-write, which let concurrent votes 500 on the PK or interleave
    // delete/update/insert into an inconsistent state (FR-9).
    const { data, error } = await this.db.rpc('cast_vote_atomic', {
      p_uid: uid,
      p_target_type: dto.targetType,
      p_target_id: dto.targetId,
      p_vote_value: dto.voteValue,
    });
    if (error) throw new InternalServerErrorException(`Vote failed: ${error.message}`);

    const row = Array.isArray(data) ? data[0] : (data as any);
    // Postgres bigint may arrive as a string over PostgREST — coerce to number.
    const result = { upvotes: Number(row?.upvotes ?? 0), downvotes: Number(row?.downvotes ?? 0) };

    // Resolve postId for the broadcast (comment votes need a lookup)
    let postId: string | null = null;
    if (dto.targetType === 'post') {
      postId = dto.targetId;
    } else {
      const { data: commentRow } = await this.db
        .from('forum_comments')
        .select('post_id')
        .eq('id', dto.targetId)
        .single();
      postId = commentRow?.post_id ?? null;
    }

    if (postId) {
      this.forumEvents.broadcastPostEvent({
        type: 'vote',
        postId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        upvotes: result.upvotes,
        downvotes: result.downvotes,
      }).catch(err => this.logger.warn(`SSE broadcast failed: ${String(err)}`));
    }

    return result;
  }

  private async getUserVotes(uid: string | undefined, type: 'post' | 'comment', ids: string[]): Promise<Map<string, number>> {
    const votes = new Map<string, number>();
    if (!uid || ids.length === 0) return votes;

    const { data } = await this.db
      .from('forum_votes')
      .select('target_id, vote_value')
      .eq('uid', uid)
      .eq('target_type', type)
      .in('target_id', ids);

    (data ?? []).forEach(v => votes.set(v.target_id, v.vote_value));
    return votes;
  }
}
