export type FileShareRequest = {filename: string; mimeType: string; base64: string};

// Web exports the shell hands to the Android share sheet. Anything executable stays out.
const SHAREABLE_TYPES: Record<string, string> = {
  'text/csv': '.csv',
  'text/plain': '.txt',
  'application/json': '.json',
};
export const MAX_SHARE_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_SHARE_BYTES / 3) * 4;

/** Validates a `file_download` bridge message from the web page. */
export function parseFileDownloadMessage(message: unknown): FileShareRequest | null {
  if (!message || typeof message !== 'object') return null;
  const {type, filename, mimeType, data} = message as Record<string, unknown>;
  if (type !== 'file_download' || typeof mimeType !== 'string' || typeof data !== 'string') return null;
  const normalisedType = mimeType.split(';')[0].trim().toLowerCase();
  const extension = SHAREABLE_TYPES[normalisedType];
  if (!extension || !data || data.length > MAX_BASE64_LENGTH || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;

  let name = (typeof filename === 'string' ? filename : '').split(/[\\/]/).pop() ?? '';
  name = name.replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^[.\s]+/, '').trim().slice(0, 100);
  if (!name) name = 'mangadock-export';
  if (!/\.[\p{L}\p{N}]+$/u.test(name)) name += extension;
  return {filename: name, mimeType: normalisedType, base64: data};
}
