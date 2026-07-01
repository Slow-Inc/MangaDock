import { Logger } from '@nestjs/common';
import { PassThrough, Writable } from 'stream';
import type { Request, Response } from 'express';
import { UploadsController } from './uploads.controller';
import type { StorageProvider } from './storage-provider.interface';

// FR-22 review follow-up: the controller pipes an R2 body straight to the HTTP
// response. If that undici-backed stream errors MID-DOWNLOAD (e.g. the worker
// connection drops after a 200), the Readable emits an 'error' event. With no
// listener attached, Node throws it as an unhandled error and can crash the
// process — a robustness regression vs. the old buffered get() path. These
// tests pin down that a mid-stream failure is caught (logged + response
// destroyed), never thrown out of the handler.
describe('UploadsController streaming errors (FR-22 review)', () => {
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  const makeReq = () => ({ path: '/uploads/foo/bar.png' }) as unknown as Request;

  const makeRes = () => {
    const res = new Writable({ write: (_c, _e, cb) => cb() }) as unknown as Response & {
      headersSent: boolean;
    };
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
    return new UploadsController(storage);
  };

  it('does not throw / crash when the stream errors mid-download after pipe', async () => {
    const stream = new PassThrough();
    const res = makeRes();
    (res as unknown as { headersSent: boolean }).headersSent = true; // bytes already flowing
    const controller = makeController(stream);

    await controller.serve(makeReq(), res);

    const err = new Error('worker connection dropped mid-stream');
    // Without the 'error' handler this synchronous emit throws (unhandled) and
    // would take the process down; with the fix it is swallowed and logged.
    expect(() => stream.emit('error', err)).not.toThrow();

    expect((res as unknown as Writable).destroy).toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalled();
  });

  it('responds 500 when the stream errors before any bytes were sent', async () => {
    const stream = new PassThrough();
    const res = makeRes();
    (res as unknown as { headersSent: boolean }).headersSent = false;
    const controller = makeController(stream);

    await controller.serve(makeReq(), res);

    expect(() => stream.emit('error', new Error('early drop'))).not.toThrow();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(loggerError).toHaveBeenCalled();
  });

  it('destroys the source stream when the client closes the connection early', async () => {
    const stream = new PassThrough();
    const res = makeRes();
    const controller = makeController(stream);

    await controller.serve(makeReq(), res);
    expect(stream.destroyed).toBe(false);

    (res as unknown as Writable).emit('close');

    expect(stream.destroyed).toBe(true);
  });
});
