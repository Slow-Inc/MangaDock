export const ROLE = { USER: 0, TRANSLATOR: 1, CREATOR: 2, ADMIN: 8, DEV: 9 } as const;
export type UserRole = typeof ROLE[keyof typeof ROLE]; // 0 | 1 | 2 | 8 | 9
export type UserPlan = 'free' | 'premium' | 'pro';

export type FavoriteItem = {
  id: string;
  title: string;
  thumbnail: string;
  addedAt: string | Date;
  authors?: string[];
  description?: string;
  categories?: string[];
  publishedDate?: string;
  averageRating?: number;
  ratingsCount?: number;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  plan: UserPlan;
  trustScore: number;
  ratingAvg: number;
  ratingCount: number;
  country: string | null;
  preferredLanguage: string | null;
  bio: string | null;
  translatorLanguages: string[];
  favorites: FavoriteItem[];
};

export type PublicTranslatorProfile = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  bio: string | null;
  translatorLanguages: string[];
  trustScore: number;
  ratingAvg: number;
  ratingCount: number;
  country: string | null;
};
