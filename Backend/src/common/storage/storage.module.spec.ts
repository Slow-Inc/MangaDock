import { Logger } from '@nestjs/common';
import { createStorageProvider } from './storage.module';
import { DiskStorageProvider } from './disk-storage.provider';
import { CloudflareR2StorageProvider } from './cloudflare-r2.provider';

// Silence the per-call selection log so test output stays clean.
const silentLogger = { log: () => {} } as unknown as Logger;
const provider = (env: NodeJS.ProcessEnv) =>
  createStorageProvider(env, silentLogger);

const R2_CREDS = { WORKER_URL: 'https://w.example', WORKER_SECRET: 's3cr3t' };

describe('createStorageProvider', () => {
  describe('explicit STORAGE_DRIVER wins', () => {
    it('disk → DiskStorageProvider even when R2 creds are present', () => {
      expect(provider({ STORAGE_DRIVER: 'disk', ...R2_CREDS })).toBeInstanceOf(
        DiskStorageProvider,
      );
    });

    it('local is an alias for disk', () => {
      expect(provider({ STORAGE_DRIVER: 'local', ...R2_CREDS })).toBeInstanceOf(
        DiskStorageProvider,
      );
    });

    it('r2 → CloudflareR2StorageProvider when creds are present', () => {
      expect(provider({ STORAGE_DRIVER: 'r2', ...R2_CREDS })).toBeInstanceOf(
        CloudflareR2StorageProvider,
      );
    });

    it('cloudflare is an alias for r2', () => {
      expect(
        provider({ STORAGE_DRIVER: 'cloudflare', ...R2_CREDS }),
      ).toBeInstanceOf(CloudflareR2StorageProvider);
    });

    it('is case-insensitive and trims whitespace', () => {
      expect(
        provider({ STORAGE_DRIVER: '  DISK  ', ...R2_CREDS }),
      ).toBeInstanceOf(DiskStorageProvider);
      expect(provider({ STORAGE_DRIVER: 'R2', ...R2_CREDS })).toBeInstanceOf(
        CloudflareR2StorageProvider,
      );
    });

    it('r2 without creds throws a clear error', () => {
      expect(() => provider({ STORAGE_DRIVER: 'r2' })).toThrow(
        /WORKER_URL and WORKER_SECRET/,
      );
    });

    it('an unknown driver throws listing the valid values', () => {
      expect(() => provider({ STORAGE_DRIVER: 'azure', ...R2_CREDS })).toThrow(
        /disk, local, r2, cloudflare/,
      );
    });
  });

  describe('auto-detect (STORAGE_DRIVER unset) — backward compatible', () => {
    it('both worker creds set → R2', () => {
      expect(provider({ ...R2_CREDS })).toBeInstanceOf(
        CloudflareR2StorageProvider,
      );
    });

    it('no creds → local disk', () => {
      expect(provider({})).toBeInstanceOf(DiskStorageProvider);
    });

    it('only one cred set → local disk (incomplete R2 config)', () => {
      expect(provider({ WORKER_URL: 'https://w.example' })).toBeInstanceOf(
        DiskStorageProvider,
      );
      expect(provider({ WORKER_SECRET: 's3cr3t' })).toBeInstanceOf(
        DiskStorageProvider,
      );
    });

    it('empty/whitespace driver falls through to auto-detect', () => {
      expect(provider({ STORAGE_DRIVER: '   ', ...R2_CREDS })).toBeInstanceOf(
        CloudflareR2StorageProvider,
      );
      expect(provider({ STORAGE_DRIVER: '' })).toBeInstanceOf(
        DiskStorageProvider,
      );
    });
  });
});
