import { NotFoundException } from '@nestjs/common';
import { PatchesController } from './patches.controller';

/**
 * #1009: GET /r2-patches/* is public. It used to hand any key to StorageProvider.get; it now serves only keys in the
 * patch store's own layout — `uploads/patches/<safe segments>/<name>.png` — and answers 404 for everything else
 * without touching storage.
 */
function setup() {
  const storage = { get: jest.fn().mockResolvedValue(Buffer.from('png')) };
  const ctrl = new PatchesController(storage as never);
  const res = { setHeader: jest.fn(), send: jest.fn() };
  const serve = (path: string) => ctrl.serve({ path } as never, res as never);
  return { storage, res, serve };
}

describe('PatchesController.serve — patch keys only (#1009)', () => {
  it('serves a patch the store wrote', async () => {
    const { storage, res, serve } = setup();
    const key = 'uploads/patches/ver_abc/en__th__default__p0__r1.png';
    await serve(`/r2-patches/${key}`);
    expect(storage.get).toHaveBeenCalledWith(key);
    expect(res.send).toHaveBeenCalledWith(Buffer.from('png'));
  });

  it.each([
    ['outside the patch store', '/r2-patches/img-cache/abc/page.png'],
    ['a parent segment', '/r2-patches/uploads/patches/../x.png'],
    ['a parent segment deeper', '/r2-patches/uploads/patches/a/../../x.png'],
    ['a POSIX absolute key', '/r2-patches//tmp/x.png'],
    ['a Windows drive key', '/r2-patches/C:/x.png'],
    ['a backslash', '/r2-patches/uploads/patches/a\\b.png'],
    ['an encoded separator', '/r2-patches/uploads/patches/a%2Fb.png'],
    ['an empty segment', '/r2-patches/uploads/patches//x.png'],
    ['not a png', '/r2-patches/uploads/patches/a/x.txt'],
    ['the store root itself', '/r2-patches/uploads/patches/'],
    ['empty', '/r2-patches/'],
  ])('404 for %s, without reading storage', async (_label, path) => {
    const { storage, serve } = setup();
    await expect(serve(path)).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.get).not.toHaveBeenCalled();
  });
});
