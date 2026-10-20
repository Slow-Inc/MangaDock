import { BadRequestException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

/**
 * POST /users/me/avatar trusted the client's Content-Type and file name: an SVG (image/svg+xml) or a
 * file named x.html sent as image/png was stored as-is and served from /uploads. The type now comes
 * from the file's magic bytes, and so do the stored extension and Content-Type.
 */
function setup() {
  const storage = {
    put: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
  };
  const ctrl = new UsersController({} as UsersService, storage as never);
  const req = { supabaseUser: { uid: 'u1' } } as never;
  const file = (originalname: string, mimetype: string) =>
    ({
      originalname,
      mimetype,
      buffer: Buffer.from('x'),
    }) as Express.Multer.File;
  return { ctrl, storage, req, file };
}

describe('UsersController.uploadAvatar — type from magic bytes', () => {
  const detect = fileTypeFromBuffer as jest.Mock;

  it('rejects an SVG even though its Content-Type says image/*', async () => {
    detect.mockResolvedValueOnce({ mime: 'image/svg+xml', ext: 'svg' });
    const { ctrl, storage, req, file } = setup();
    await expect(
      ctrl.uploadAvatar(req, file('a.svg', 'image/svg+xml')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects bytes that are not an image at all', async () => {
    detect.mockResolvedValueOnce(undefined);
    const { ctrl, storage, req, file } = setup();
    await expect(
      ctrl.uploadAvatar(req, file('a.png', 'image/png')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('stores a real PNG named x.html as .png with Content-Type image/png', async () => {
    detect.mockResolvedValueOnce({ mime: 'image/png', ext: 'png' });
    const { ctrl, storage, req, file } = setup();
    const out = await ctrl.uploadAvatar(req, file('x.html', 'image/png'));
    const [key, , opts] = storage.put.mock.calls[0] as [
      string,
      Buffer,
      { contentType: string },
    ];
    expect(key).toMatch(/^uploads\/avatars\/u1_\d+\.png$/);
    expect(opts).toEqual({ contentType: 'image/png' });
    expect(out.url).toBe(`/${key}`);
  });
});
