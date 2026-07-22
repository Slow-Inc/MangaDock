export type ReviewItem = {
  id: string;
  uid: string;
  mangaId: string;
  rating: number;
  body: string;
  createdAt: string;
  displayName: string | null;
  photoUrl: string | null;
};

export type ReviewSummary = {
  averageRating: number;
  count: number;
};
