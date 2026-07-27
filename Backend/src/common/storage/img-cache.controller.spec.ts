import { Logger, NotFoundException } from '@nestjs/common';
import { PassThrough, Writable } from 'stream';
import type { Request, Response } from 'express';
import { ImgCacheController } from './img-cache.controller';
import type { StorageProvider } from './storage-provider.interface';

describe('ImgCacheController streaming errors', () => {
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  const makeReq = () =>
    ({ path: '/img-cache/uuid/covers/c0.jpg' }) as unknown as Request;

  const makeRes = () => {
    const res = new Writable({
      write: (_c, _e, cb) => cb(),
    }) as unknown as Response & { headersSent: boolean };
    res.setHeader = jest.fn() as unknown as Response['setHeader'];
    res.status = jest.fn(() => res) as unknown as Response['status'];
    (res as unknown as { headersSent: boolean }).headersSent = false;
    jest.spyOn(res as unknown as Writable, 'destroy');
    jest.spyOn(res as unknown as Writable, 'end');
    return res;
  };

  const makeController = (stream: PassThrough) => {
    const storage = {
      isRemote: true,
      getStream: jest.fn().mockResolvedValue(stream),
      get: jest.fn(),
    } as unknown as StorageProvider;
    return new ImgCacheController(storage);
  };

  it('does not crash when stream errors mid-download after headers sent', async () => {
    const stream = new PassThrough();
    const res = makeRes();
    (res as unknown as { headersSent: boolean }).headersSent = true;
    const controller = makeController(stream);
    await controller.serve(makeReq(), res);
    expect(() => stream.emit('error', new Error('drop'))).not.toThrow();
    expect((res as unknown as Writable).destroy).toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalled();
  });

  it('responds 500 when stream errors before any bytes sent', async () => {
    const stream = new PassThrough();
    const res = makeRes();
    const controller = makeController(stream);
    await controller.serve(makeReq(), res);
    expect(() => stream.emit('error', new Error('early drop'))).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(loggerError).toHaveBeenCalled();
  });

  it('destroys source stream when client closes early', async () => {
    const stream = new PassThrough();
    const res = makeRes();
    const controller = makeController(stream);
    await controller.serve(makeReq(), res);
    (res as unknown as Writable).emit('close');
    expect(stream.destroyed).toBe(true);
  });
});

describe('ImgCacheController path traversal guard', () => {
  const makeRes = () => {
    const res = {} as unknown as Response;
    res.setHeader = jest.fn() as unknown as Response['setHeader'];
    res.send = jest.fn() as unknown as Response['send'];
    return res;
  };

  const makeController = () => {
    const storage = {
      isRemote: false,
      get: jest.fn().mockResolvedValue(Buffer.from('img-bytes')),
    } as unknown as StorageProvider & { get: jest.Mock };
    return { controller: new ImgCacheController(storage), storage };
  };

  const traversalPaths = [
    '/img-cache/../../../etc/passwd',
    '/img-cache/foo/../../../../etc/passwd',
    '/img-cache/../src/main.ts',
  ];

  it.each(traversalPaths)(
    'rejects traversal payload %s without reading storage',
    async (p) => {
      const { controller, storage } = makeController();
      const req = { path: p } as unknown as Request;
      await expect(controller.serve(req, makeRes())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(storage.get).not.toHaveBeenCalled();
    },
  );

  it('serves a legitimate key within img-cache root', async () => {
    const { controller, storage } = makeController();
    const req = { path: '/img-cache/uuid/covers/c0.jpg' } as unknown as Request;
    const res = makeRes();
    await controller.serve(req, res);
    expect(storage.get).toHaveBeenCalledWith('img-cache/uuid/covers/c0.jpg');
    expect(res.send).toHaveBeenCalled();
  });
});
