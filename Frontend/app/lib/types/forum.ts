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
  userVote: number;
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
  userVote: number;
  replies?: ForumComment[];
  createdAt: string;
  updatedAt: string;
}
