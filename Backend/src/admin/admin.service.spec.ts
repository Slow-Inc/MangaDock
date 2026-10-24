import { AdminService } from './admin.service';

/**
 * Pin/unpin is an admin moderation action like delete/ban/role, so it must
 * leave an audit_logs row (#675).
 */
function buildSupabase(pinError: { message: string } | null = null) {
  const insert = jest.fn().mockResolvedValue({ error: null });
  const postChain = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockResolvedValue({ error: pinError }),
  };
  const from = jest.fn((table: string) =>
    table === 'audit_logs' ? { insert } : postChain,
  );
  return { supabase: { client: { from } }, insert };
}

describe('AdminService.pinPost audit (#675)', () => {
  it.each([
    [true, 'pin_post'],
    [false, 'unpin_post'],
  ])('pinned=%s writes a %s audit row', async (pinned, action) => {
    const { supabase, insert } = buildSupabase();
    const svc = new AdminService(supabase as any);

    await svc.pinPost('admin-1', 'post-1', pinned);
    await Promise.resolve();

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_uid: 'admin-1',
        action,
        target_type: 'post',
        target_id: 'post-1',
      }),
    );
  });

  it('does not write an audit row when the update fails', async () => {
    const { supabase, insert } = buildSupabase({ message: 'boom' });
    const svc = new AdminService(supabase as any);

    await expect(svc.pinPost('admin-1', 'post-1', true)).rejects.toThrow(
      'Failed to update pin',
    );
    expect(insert).not.toHaveBeenCalled();
  });
});
