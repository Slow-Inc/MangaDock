/**
 * #963: /forum/posts?authorUid=<not a uuid> answered 500, and offset/limit went straight into .range() (negative or NaN).
 */
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';

/** A query chain whose .range() ends with the given result. */
function listDb(result: {
  data: unknown;
  count: number | null;
  error: unknown;
}) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    'from',
    'select',
    'eq',
    'is',
    'in',
    'order',
    'or',
    'ilike',
    'not',
    'gte',
    'lte',
    'neq',
  ])
    chain[m] = jest.fn().mockReturnValue(chain);
  chain.range = jest.fn().mockResolvedValue(result);
  return { client: chain } as never;
}

describe('ForumService.listPosts — an author id that is not a uuid (#963)', () => {
  it('answers an empty list, not a 500', async () => {
    const service = new ForumService(
      listDb({
        data: null,
        count: null,
        error: { code: '22P02', message: 'invalid input syntax for type uuid' },
      }),
      {} as never,
      {} as never,
    );
    await expect(
      service.listPosts(
        undefined,
        undefined,
        'new',
        20,
        0,
        undefined,
        'not-a-uuid',
      ),
    ).resolves.toEqual({ items: [], total: 0 });
  });
});

describe('ForumController.listPosts — paging params clamped (#963)', () => {
  it('a negative offset and a junk limit never reach the service', async () => {
    const listPosts = jest.fn().mockResolvedValue({ items: [], total: 0 });
    const controller = new ForumController({ listPosts } as never, {} as never);
    await controller.listPosts(
      {} as never,
      undefined,
      undefined,
      'new',
      'abc',
      '-5',
    );
    const [, , , limit, offset] = listPosts.mock.calls[0] as unknown[];
    expect([limit, offset]).toEqual([20, 0]);
  });
});
