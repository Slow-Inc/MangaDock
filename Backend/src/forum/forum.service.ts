import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { 
  ForumPost, 
  ForumComment, 
  CreatePostDto, 
  CreateCommentDto, 
  VoteDto,
  ForumCategory
} from './forum.types';

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(private readonly supabase: SupabaseService) {}

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
      `, { count: 'exact' });

    if (category) query = query.eq('category', category);
    if (mangaId) query = query.eq('target_manga_id', mangaId);

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false });
    } else {
      // Simple 'hot' logic: upvotes - downvotes
      query = query.order('upvotes', { ascending: false });
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to list posts: ${error.message}`);

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
      upvotes: p.upvotes,
      downvotes: p.downvotes,
      userVote: userVotes.get(p.id) ?? 0,
      commentCount: p.comments[0]?.count ?? 0,
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
      upvotes: data.upvotes,
      downvotes: data.downvotes,
      userVote: userVotes.get(id) ?? 0,
      commentCount: data.comments[0]?.count ?? 0,
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
      })
      .select('*, author:profiles(display_name, photo_url, role)')
      .single();

    if (error) throw new Error(`Failed to create post: ${error.message}`);

    return {
      ...data,
      authorUid: data.author_uid,
      authorName: data.author?.display_name,
      authorPhotoUrl: data.author?.photo_url,
      authorRole: data.author?.role,
      userVote: 0,
      commentCount: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listComments(postId: string, userUid?: string): Promise<ForumComment[]> {
    const { data, error } = await this.db
      .from('forum_comments')
      .select(`
        *,
        author:profiles(display_name, photo_url, role)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to list comments: ${error.message}`);

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

  async createComment(uid: string, dto: CreateCommentDto): Promise<ForumComment> {
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

    if (error) throw new Error(`Failed to create comment: ${error.message}`);

    return {
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
  }

  async vote(uid: string, dto: VoteDto): Promise<{ upvotes: number, downvotes: number }> {
    // T4-STANDARD Pillar 1: Idempotent voting logic
    // 1. Check if user already voted
    const { data: existingVote } = await this.db
      .from('forum_votes')
      .select('*')
      .eq('uid', uid)
      .eq('target_type', dto.targetType)
      .eq('target_id', dto.targetId)
      .maybeSingle();

    if (existingVote) {
      if (existingVote.vote_value === dto.voteValue) {
        // Remove vote if same value (toggle off)
        await this.db.from('forum_votes').delete().match({ uid, target_type: dto.targetType, target_id: dto.targetId });
      } else {
        // Change vote value
        await this.db.from('forum_votes').update({ vote_value: dto.voteValue }).match({ uid, target_type: dto.targetType, target_id: dto.targetId });
      }
    } else {
      // New vote
      await this.db.from('forum_votes').insert({
        uid,
        target_type: dto.targetType,
        target_id: dto.targetId,
        vote_value: dto.voteValue,
      });
    }

    // 2. Recalculate upvotes/downvotes for the target
    // In a real T4 environment, this should be done via database triggers or a transaction.
    // For this prototype, we'll manually update after voting.
    return await this.recalculateVotes(dto.targetType, dto.targetId);
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

  private async recalculateVotes(type: 'post' | 'comment', id: string) {
    const { data: votes } = await this.db
      .from('forum_votes')
      .select('vote_value')
      .eq('target_id', id)
      .eq('target_type', type);

    const upvotes = (votes ?? []).filter(v => v.vote_value === 1).length;
    const downvotes = (votes ?? []).filter(v => v.vote_value === -1).length;

    const table = type === 'post' ? 'forum_posts' : 'forum_comments';
    await this.db.from(table).update({ upvotes, downvotes }).eq('id', id);

    return { upvotes, downvotes };
  }
}
