export type ForumCategory =
  | 'general'
  | 'announcement'
  | 'spoiler'
  | 'manga_update';

export interface ForumPost {
  id: string;
  authorUid: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  authorRole: number;
  title: string;
  content: string;
  category: ForumCategory;
  targetMangaId: string | null;
  targetMangaTitle: string | null;
  targetMangaCover: string | null;
  imageUrls: string[];
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
  authorRole: number;
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
  targetMangaTitle?: string;
  targetMangaCover?: string;
  imageUrls?: string[];
}

export interface CreateCommentDto {
  postId: string;
  parentId?: string;
  content: string;
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
}

export interface UpdateCommentDto {
  content: string;
}

export interface VoteDto {
  targetType: 'post' | 'comment';
  targetId: string;
  voteValue: 1 | -1;
}

export interface TrendingManga {
  mangaId: string;
  mangaTitle: string;
  mangaCover: string | null;
  postCount: number;
}

export interface ProfileComment {
  id: string;
  postId: string;
  postTitle: string;
  content: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

export interface TranslatedTitle {
  titleId: string;
  titleName: string;
  language: string;
  chapterCount: number;
}

export interface UpdateBannerPositionDto {
  position: number;
}

export interface PublicUserProfile {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number;
  role: string;
  bio: string | null;
  country: string | null;
  translatorLanguages: string[];
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
}

export interface UserProfileEarnings {
  totalSales: number;
  totalEarned: number;
  titlesSold: number;
  uniqueBuyers: number;
}

export interface UserProfileResponse {
  profile: PublicUserProfile;
  posts: ForumPost[];
  comments: ProfileComment[];
  likedPosts: ForumPost[];
  translatedTitles: TranslatedTitle[];
  earnings: UserProfileEarnings | null;
}
