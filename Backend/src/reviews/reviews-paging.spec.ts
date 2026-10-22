/**
 * #963: /reviews/:mangaId?limit=abc&offset=-1 passed NaN / a negative offset straight into .range().
 */
import { ReviewsController } from './reviews.controller';

describe('ReviewsController.getReviews — paging params clamped (#963)', () => {
  it('junk and out-of-range values become sane bounds', () => {
    const getReviews = jest.fn().mockResolvedValue([]);
    const controller = new ReviewsController({ getReviews } as never);
    void controller.getReviews('m1', 'abc', '-1');
    expect(getReviews).toHaveBeenLastCalledWith('m1', 20, 0);
    void controller.getReviews('m1', '500', '40');
    expect(getReviews).toHaveBeenLastCalledWith('m1', 50, 40);
  });
});
