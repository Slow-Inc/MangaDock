# Fix: img-cache Storage Mismatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Express `serve-static` for `/img-cache/**` with `ImgCacheController` that reads from `StorageProvider` (R2 or disk), permanently eliminating the local-disk/R2 mismatch that causes intermittent 404s on cached images.

**Architecture:** `ImageCacheService` already writes correctly via `StorageProvider` — the only broken piece is the serve path. Add `ImgCacheController` mirroring the existing `UploadsController` pattern, register it in `StorageModule`, and remove the `useStaticAssets('img-cache')` call from `main.ts`. As a secondary fix, extend `loadPageBytes` in `page-source.ts` to accept an optional `StorageProvider` so the translation flow also works with R2.

**Tech Stack:** NestJS 11, TypeScript, Jest, `StorageProvider` interface (existing `STORAGE_PROVIDER` injection token)

## Global Constraints

- Mirror `UploadsController` patterns exactly: path-traversal guard, streaming via `getStream`, buffered fallback via `get`, `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`, mid-stream error handling
- All new tests must pass before old code is removed
- Test command: `npx jest <path> --no-coverage`
- Solution must work with both `STORAGE_DRIVER=disk` and `STORAGE_DRIVER=r2`
- No changes to Frontend — URL structure `/img-cache/**` is unchanged

---

### Task 1: Add ImgCacheController + register in StorageModule

**Files:**
- Create: `Backend/src/common/storage/img-cache.controller.ts`
- Create: `Backend/src/common/storage/img-cache.controller.spec.ts`
- Modify: `Backend/src/common/storage/storage.module.ts` (add to `controllers`)

**Interfaces:**
- Consumes: `STORAGE_PROVIDER` token → `StorageProvider` (from `storage-provider.interface.ts`)
- Produces: `GET /img-cache/*` → bytes from `StorageProvider`, path-traversal protected, `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`

- [ ] **Step 1: Write the failing spec — `Backend/src/common/storage/img-cache.controller.spec.ts`**

```typescript
import { Logger, NotFoundException } from '@nestjs/common';
import { PassThrough, Writable } from 'stream';
import type { Request, Response } from 'express';
import { ImgCacheController } from './img-cache.controller';
import type { StorageProvider } from './storage-provider.interface';

describe('ImgCacheController streaming errors', () => {
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => { loggerError.mockRestore(); });

  const makeReq = () => ({ path: '/img-cache/uuid/covers/c0.jpg' }) as unknown as Request;

  const makeRes = () => {
    const res = new Writable({ write: (_c, _e, cb) => cb() }) as unknown as Response & { headersSent: boolean };
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

  it.each(traversalPaths)('rejects traversal payload %s without reading storage', async (p) => {
    const { controller, storage } = makeController();
    const req = { path: p } as unknown as Request;
    await expect(controller.serve(req, makeRes())).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('serves a legitimate key within img-cache root', async () => {
    const { controller, storage } = makeController();
    const req = { path: '/img-cache/uuid/covers/c0.jpg' } as unknown as Request;
    const res = makeRes();
    await controller.serve(req, res);
    expect(storage.get).toHaveBeenCalledWith('img-cache/uuid/covers/c0.jpg');
    expect(res.send).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run spec to verify it fails**

```
npx jest src/common/storage/img-cache.controller.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './img-cache.controller'`

- [ ] **Step 3: Create `Backend/src/common/storage/img-cache.controller.ts`**

```typescript
import { Controller, Get, Inject, Logger, NotFoundException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as path from 'path';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import type { StorageProvider } from './storage-provider.interface';

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

/**
 * Serves all /img-cache/** assets via StorageProvider so both disk and R2
 * modes use the same URL scheme. Replaces express.static for img-cache/.
 */
@Controller('img-cache')
export class ImgCacheController {
  private readonly logger = new Logger(ImgCacheController.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Get('*')
  async serve(@Req() req: Request, @Res() res: Response): Promise<void> {
    const filePath = req.path.replace(/^\/img-cache\//, '');
    if (!filePath || filePath === req.path) throw new NotFoundException();
    const key = `img-cache/${filePath}`;
    const imgCacheRoot = path.resolve(process.cwd(), 'img-cache');
    const resolved = path.resolve(process.cwd(), key);
    if (resolved !== imgCacheRoot && !resolved.startsWith(imgCacheRoot + path.sep)) {
      throw new NotFoundException();
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';
    try {
      if (this.storage.getStream) {
        const stream = await this.storage.getStream(key);
        res.setHeader('content-type', contentType);
        res.setHeader('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
        stream.on('error', (err) => {
          this.logger.error(
            `img-cache stream failed mid-download for ${key}`,
            err instanceof Error ? err.stack : String(err),
          );
          if (res.headersSent) res.destroy();
          else res.status(500).end();
        });
        res.on('close', () => stream.destroy());
        stream.pipe(res);
        return;
      }
      const buf = await this.storage.get(key);
      res.setHeader('content-type', contentType);
      res.setHeader('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.send(buf);
    } catch {
      throw new NotFoundException(`not found: ${key}`);
    }
  }
}
```

- [ ] **Step 4: Register `ImgCacheController` in `Backend/src/common/storage/storage.module.ts`**

Add import after the existing `UploadsController` import:
```typescript
import { ImgCacheController } from './img-cache.controller';
```

Change `controllers` array:
```typescript
// Before
controllers: [UploadsController],

// After
controllers: [UploadsController, ImgCacheController],
```

- [ ] **Step 5: Run spec to verify all tests pass**

```
npx jest src/common/storage/img-cache.controller.spec.ts --no-coverage
```

Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add Backend/src/common/storage/img-cache.controller.ts Backend/src/common/storage/img-cache.controller.spec.ts Backend/src/common/storage/storage.module.ts
git commit -m "feat(cache): add ImgCacheController — serve /img-cache/** via StorageProvider (R2/disk)"
```

---

### Task 2: Remove express.static for img-cache from main.ts

**Files:**
- Modify: `Backend/src/main.ts` (remove lines 94-97, update comment)

- [ ] **Step 1: Delete the `useStaticAssets` block and update comment in `Backend/src/main.ts`**

Remove these 4 lines (lines 94-97):
```typescript
  // Serve cached images from img-cache/ under /img-cache/
  app.useStaticAssets(path.resolve(process.cwd(), 'img-cache'), {
    prefix: '/img-cache/',
  });
```

Update the comment at line 98-99 to:
```typescript
  // /uploads/** and /img-cache/** are served by UploadsController and
  // ImgCacheController (StorageModule) so they work with both disk and R2 storage.
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npm run build
```

Expected: exits code 0, no TypeScript errors. (`path` import remains used by `setupFileLogging` on line 20.)

- [ ] **Step 3: Run all backend tests**

```
npx jest --no-coverage
```

Expected: All existing tests PASS (no regressions)

- [ ] **Step 4: Commit**

```bash
git add Backend/src/main.ts
git commit -m "fix(main): remove express.static for img-cache — ImgCacheController now serves /img-cache/**"
```

---

### Task 3: Extend page-source.ts to support StorageProvider (translation flow)

This fixes the secondary issue: `loadPageBytes` reads `/img-cache/` paths from local disk only, which fails when `STORAGE_DRIVER=r2`. The fix adds an optional `storage` param — existing callers (`MitBatchStream`, `MitTranslationService`) are unaffected since they don't pass it and fall back to the current disk-read behavior.

**Files:**
- Modify: `Backend/src/books/page-source.ts`
- Modify: `Backend/src/books/page-source.spec.ts`

**Interfaces:**
- Produces: `loadPageBytes(url, { ..., storage?: Pick<StorageProvider, 'get'> })` — when `storage` is provided, reads `/img-cache/` paths via `storage.get('img-cache/<rel>')` instead of `fs.readFile`

- [ ] **Step 1: Add the failing test to `Backend/src/books/page-source.spec.ts`**

Add import at top of file (after existing imports):
```typescript
import type { StorageProvider } from '../common/storage/storage-provider.interface';
```

Add inside the existing `describe('loadPageBytes', ...)` block, after the existing `/img-cache path` test (after line 38):
```typescript
  it('reads an /img-cache path via StorageProvider.get when storage is provided', async () => {
    const storage = {
      get: jest.fn().mockResolvedValue(Buffer.from('r2-bytes')),
    } as unknown as Pick<StorageProvider, 'get'>;

    const buf = await loadPageBytes('/img-cache/_chapters/chapters/ch1/p0.jpg', {
      imgCacheRoot: root,
      storage,
    });

    expect((storage as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
      'img-cache/_chapters/chapters/ch1/p0.jpg',
    );
    expect(buf.toString()).toBe('r2-bytes');
  });
```

- [ ] **Step 2: Run spec to verify new test fails**

```
npx jest src/books/page-source.spec.ts --no-coverage
```

Expected: 1 test FAIL — `Object literal may only specify known properties 'storage'` (or similar TypeScript / runtime error)

- [ ] **Step 3: Update `Backend/src/books/page-source.ts`**

Add import after the existing `import * as path` line:
```typescript
import type { StorageProvider } from '../common/storage/storage-provider.interface';
```

Update the `loadPageBytes` opts type (add `storage?`):
```typescript
export async function loadPageBytes(
  pageUrl: string,
  opts: {
    imgCacheRoot: string;
    uploadsRoot?: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    storage?: Pick<StorageProvider, 'get'>;
  },
): Promise<Buffer> {
  if (isImgCachePath(pageUrl)) {
    const rel = pageUrl.slice(IMG_CACHE_PREFIX.length);
    if (opts.storage) {
      return opts.storage.get(`img-cache/${rel}`);
    }
    return readLocalPage(opts.imgCacheRoot, rel, 'img-cache', pageUrl);
  }
  // rest of function unchanged — isLocalUploadPath branch and fetch branch stay as-is
```

- [ ] **Step 4: Run spec to verify all tests pass**

```
npx jest src/books/page-source.spec.ts --no-coverage
```

Expected: All tests PASS (new test passes; existing tests unaffected — `storage` is optional)

- [ ] **Step 5: Run full backend test suite**

```
npx jest --no-coverage
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add Backend/src/books/page-source.ts Backend/src/books/page-source.spec.ts
git commit -m "fix(translation): add StorageProvider path to loadPageBytes — enables R2 reads for MIT translation"
```

---

## Self-Review

**Spec coverage:**
- ImgCacheController serving from StorageProvider ✓ Task 1
- StorageModule registration ✓ Task 1 Step 4
- Remove express.static mismatch ✓ Task 2
- Build + test regression check ✓ Task 2 Steps 2-3
- page-source translation fix ✓ Task 3

**Placeholder scan:** None — all steps have exact file paths, complete code, and exact commands.

**Type consistency:**
- `ImgCacheController.serve(req: Request, res: Response): Promise<void>` — matches NestJS pattern, same as UploadsController
- `storage?: Pick<StorageProvider, 'get'>` — `StorageProvider.get(key: string): Promise<Buffer>` defined in `storage-provider.interface.ts:29`
- `loadPageBytes` existing callers (`mit-batch-stream.ts:69`, `mit-translation.service.ts:105`) omit `storage` → type-safe (optional param)

**Wire-up for callers that need R2 (follow-up, not in scope here):**
When you need MIT translation to work with R2, wire `StorageProvider` into `MitBatchStream` and `MitTranslationService` via their `deps` object, then pass `storage: deps.storage` to `loadPageBytes`. The `loadPageBytes` signature is already ready for this.
