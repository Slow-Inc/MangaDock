import { BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

/**
 * #1007: DELETE /users/me/avatar built a storage key from the body's filename after checking only its `<uid>_`
 * prefix. It now accepts only the shape the upload route generates — `<uid>_<digits>.<ext>` — so the key can never
 * leave uploads/avatars.
 */
function setup() {
  const storage = {
    put: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const ctrl = new UsersController(
    {} as UsersService,
    storage as never,
    {} as never,
  );
  const req = { supabaseUser: { uid: 'u1' } } as never;
  return { ctrl, storage, req };
}

describe('UsersController.deleteAvatar — only a generated avatar filename (#1007)', () => {
  it.each([
    ['a separator after the prefix', 'u1_/x.png'],
    ['a parent segment', 'u1_..png/../x'],
    ['a backslash', 'u1_1\\x.png'],
    ['no extension', 'u1_123'],
    ['a non-numeric stamp', 'u1_abc.png'],
    ['another user', 'u2_123.png'],
    ['empty', ''],
  ])('rejects %s', async (_label, filename) => {
    const { ctrl, storage, req } = setup();
    await expect(ctrl.deleteAvatar(req, { filename })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('deletes the generated shape', async () => {
    const { ctrl, storage, req } = setup();
    await expect(
      ctrl.deleteAvatar(req, { filename: 'u1_1729600000000.webp' }),
    ).resolves.toEqual({ ok: true });
    expect(storage.delete).toHaveBeenCalledWith(
      'uploads/avatars/u1_1729600000000.webp',
    );
  });
});
