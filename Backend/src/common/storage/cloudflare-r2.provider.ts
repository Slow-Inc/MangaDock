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

  private workerFetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.workerUrl.replace(/\/$/, '')}${path}`;
    return fetch(url, {
      ...init,
      headers: {
        'x-worker-secret': this.workerSecret,
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    });
  }

  async put(key: string, data: Buffer | string | Readable, options?: { contentType?: string }): Promise<void> {
    let body: Buffer;
    if (data instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
      }
      body = Buffer.concat(chunks);
    } else if (typeof data === 'string') {
      body = Buffer.from(data);
    } else {
      body = data;
    }

    const res = await this.workerFetch(`/v1/object?key=${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'content-type': options?.contentType ?? 'application/octet-stream' },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`R2 put failed [${res.status}] ${key}: ${text}`);
    }
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.workerFetch(`/v1/object?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`R2 get failed [${res.status}] ${key}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.workerFetch(`/v1/object?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
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
    const res = await this.workerFetch(`/v1/exists?key=${encodeURIComponent(key)}`);
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
