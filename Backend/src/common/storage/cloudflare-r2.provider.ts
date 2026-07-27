import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class CloudflareR2StorageProvider implements StorageProvider {
  readonly isRemote = true;

  private readonly logger = new Logger(CloudflareR2StorageProvider.name);

  constructor(
    private readonly workerUrl: string,
    private readonly workerSecret: string,
  ) {}

  // `duplex: 'half'` is required by Node/undici whenever the request body is a
  // stream; it is not yet part of the lib-dom RequestInit type.
  private workerFetch(
    path: string,
    init?: RequestInit & { duplex?: 'half' },
  ): Promise<Response> {
    const url = `${this.workerUrl.replace(/\/$/, '')}${path}`;
    return fetch(url, {
      ...init,
      headers: {
        'x-worker-secret': this.workerSecret,
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    });
  }

  async put(
    key: string,
    data: Buffer | string | Readable,
    options?: { contentType?: string },
  ): Promise<void> {
    // Hand the body straight to fetch — a Readable is streamed to the worker
    // (never drained into a Buffer first), and Buffer/string pass through
    // without an extra copy. Avoids double-buffering the whole object.
    const isStream = data instanceof Readable;
    const res = await this.workerFetch(
      `/v1/object?key=${encodeURIComponent(key)}`,
      {
        method: 'PUT',
        headers: {
          'content-type': options?.contentType ?? 'application/octet-stream',
        },
        body: data as BodyInit,
        ...(isStream ? { duplex: 'half' } : {}),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`R2 put failed [${res.status}] ${key}: ${text}`);
    }
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.workerFetch(
      `/v1/object?key=${encodeURIComponent(key)}`,
    );
    if (!res.ok) throw new Error(`R2 get failed [${res.status}] ${key}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async getStream(key: string): Promise<Readable> {
    const res = await this.workerFetch(
      `/v1/object?key=${encodeURIComponent(key)}`,
    );
    if (!res.ok || !res.body)
      throw new Error(`R2 get failed [${res.status}] ${key}`);
    // Stream the worker response body through instead of buffering it all in
    // memory; the caller pipes it directly to the HTTP response.
    return Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  }

  async delete(key: string): Promise<void> {
    const res = await this.workerFetch(
      `/v1/object?key=${encodeURIComponent(key)}`,
      { method: 'DELETE' },
    );
    if (!res.ok && res.status !== 404) {
      throw new Error(`R2 delete failed [${res.status}] ${key}`);
    }
  }

  async deleteDir(prefix: string): Promise<void> {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const res = await this.workerFetch(
      `/v1/list?prefix=${encodeURIComponent(normalizedPrefix)}&recursive=true`,
    );
    if (!res.ok) return;
    const body = (await res.json()) as { keys?: string[] };
    const keys = body.keys ?? [];
    if (keys.length === 0) return;
    await Promise.all(keys.map((k) => this.delete(k)));
  }

  async exists(key: string): Promise<boolean> {
    const res = await this.workerFetch(
      `/v1/exists?key=${encodeURIComponent(key)}`,
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { exists?: boolean };
    return body.exists ?? false;
  }

  async list(prefix: string): Promise<string[]> {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const res = await this.workerFetch(
      `/v1/list?prefix=${encodeURIComponent(normalizedPrefix)}`,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { keys?: string[] };
    return body.keys ?? [];
  }
}
