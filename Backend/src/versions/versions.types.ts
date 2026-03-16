export type VersionStatus = 'draft' | 'pending_moderation' | 'published' | 'rejected';

export type ChapterVersion = {
  versionId: string;
  titleId: string;
  titleName: string;
  titleAltName?: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  translatorUid: string;
  translatorName: string | null;
  status: VersionStatus;
  pages: string[];
  priceCoins: number;
  qualityScore: number;
  isDefault: boolean;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
