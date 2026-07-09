export type ForumCategory = 'general' | 'announcement' | 'spoiler' | 'manga_update';

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

export interface PublicUserProfile {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number;
  role: number;
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
  authorRole: number;
  content: string;
  upvotes: number;
  downvotes: number;
  userVote: number;
  replies?: ForumComment[];
  createdAt: string;
  updatedAt: string;
}
