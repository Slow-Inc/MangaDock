import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let mockRpc: jest.Mock;

  beforeEach(() => {
    mockRpc = jest.fn();
    const supabaseService = {
      client: { from: jest.fn(), rpc: mockRpc },
    } as any;
    service = new ReviewsService(supabaseService);
  });

  describe('getReviewSummary', () => {
    // Regression #652: summary is computed DB-side over ALL rows, so a manga with
    // >1000 reviews reports the true count/average, not the PostgREST 1000-row cap.
    it('returns the DB aggregate avg/count', async () => {
      mockRpc.mockResolvedValue({
        data: [{ average_rating: 4.3, review_count: 1500 }],
        error: null,
      });

      const res = await service.getReviewSummary('m1');

      expect(mockRpc).toHaveBeenCalledWith('get_review_summary', {
        p_manga_id: 'm1',
      });
      expect(res).toEqual({ averageRating: 4.3, count: 1500 });
    });

    it('coerces string-encoded numeric/bigint aggregates', async () => {
      mockRpc.mockResolvedValue({
        data: [{ average_rating: '4.0', review_count: '1200' }],
        error: null,
      });

      expect(await service.getReviewSummary('m1')).toEqual({
        averageRating: 4,
        count: 1200,
      });
    });

    it('returns zeros for a manga with no reviews', async () => {
      mockRpc.mockResolvedValue({
        data: [{ average_rating: 0, review_count: 0 }],
        error: null,
      });

      expect(await service.getReviewSummary('m1')).toEqual({
        averageRating: 0,
        count: 0,
      });
    });

    it('throws when the RPC errors', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });

      await expect(service.getReviewSummary('m1')).rejects.toThrow(
        'Failed to fetch review summary: x',
      );
    });
  });
});
