import { ALLOWED_IMAGE_MIME, extForMime } from './image-mime';

describe('ALLOWED_IMAGE_MIME', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])(
    'includes allowed mime: %s',
    (mime) => {
      expect(ALLOWED_IMAGE_MIME.has(mime)).toBe(true);
    },
  );

  it.each([
    'image/svg+xml',
    'image/bmp',
    'application/pdf',
    'text/html',
    'image/avif',
  ])('excludes disallowed mime: %s', (mime) => {
    expect(ALLOWED_IMAGE_MIME.has(mime)).toBe(false);
  });
});

describe('extForMime', () => {
  it.each([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
    ['image/gif', '.gif'],
  ])('maps %s to %s', (mime, ext) => {
    expect(extForMime(mime)).toBe(ext);
  });

  it.each([
    'image/svg+xml',
    'image/bmp',
    'application/pdf',
    'text/html',
    'image/avif',
    '',
  ])('returns null for disallowed/empty mime: %s', (mime) => {
    expect(extForMime(mime)).toBeNull();
  });

  it('yields a non-null ext for every allowed mime', () => {
    for (const mime of ALLOWED_IMAGE_MIME) {
      expect(extForMime(mime)).not.toBeNull();
    }
  });
});
