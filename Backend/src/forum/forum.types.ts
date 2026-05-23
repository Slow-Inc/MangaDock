export type ForumCategory = 'general' | 'announcement' | 'spoiler' | 'manga_update';

export interface ForumPost {
  id: string;
  authorUid: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  authorRole: string;
  title: string;
  content: string;
  category: ForumCategory;
  targetMangaId: string | null;
  upvotes: number;
  downvotes: number;
  userVote: number; // 1, -1, or 0
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForumComment {
  id: string;
  postId: string;
  parentId: string | null;
  authorUid: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  authorRole: string;
  content: string;
  upvotes: number;
  downvotes: number;
  userVote: number; // 1, -1, or 0
  replies?: ForumComment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostDto {
  title: string;
  content: string;
  category: ForumCategory;
  targetMangaId?: string;
}

export interface CreateCommentDto {
  postId: string;
  parentId?: string;
  content: string;
}

export interface VoteDto {
  targetType: 'post' | 'comment';
  targetId: string;
  voteValue: 1 | -1;
}
