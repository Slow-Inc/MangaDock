export function imageUri(url: string, apiOrigin: string) {
  if (!url) return '';
  const resolved = new URL(url, apiOrigin);
  if (!['http:', 'https:'].includes(resolved.protocol)) throw new Error('ที่อยู่ภาพไม่ถูกต้อง');
  if (resolved.origin === new URL(apiOrigin).origin) return resolved.toString();
  return new URL(`books/img-proxy?url=${encodeURIComponent(resolved.toString())}`, apiOrigin.replace(/\/?$/, '/')).toString();
}
