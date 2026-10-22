import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { UsersController } from './users.controller';
import {
  PhotoHistoryDto,
  TranslatorProfileDto,
  UpdateProfileDto,
} from './profile.dto';

/**
 * #1025: the profile bodies were plain types, so the global ValidationPipe checked nothing under a 50 MB body limit —
 * a multi-MB display name was joined into every forum feed, and a non-string bio 500'd on `.trim()`.
 * The pipe here is the app's own (main.ts), run against the controller's real parameter types.
 */
const pipe = new ValidationPipe({ whitelist: true, transform: true });

function bodyOf(method: keyof UsersController): ArgumentMetadata {
  const types = Reflect.getMetadata(
    'design:paramtypes',
    UsersController.prototype,
    method,
  ) as unknown[];
  return { type: 'body', metatype: types[1] as ArgumentMetadata['metatype'] };
}

const accepts = (method: keyof UsersController, body: unknown) =>
  expect(pipe.transform(body, bodyOf(method))).resolves.toBeDefined();
const rejects = (method: keyof UsersController, body: unknown) =>
  expect(pipe.transform(body, bodyOf(method))).rejects.toThrow();

describe('controller bodies are the DTOs (#1025)', () => {
  it.each([
    ['updateMyProfile', UpdateProfileDto],
    ['becomeTranslator', TranslatorProfileDto],
    ['updateTranslatorProfile', TranslatorProfileDto],
    ['updatePhotoHistory', PhotoHistoryDto],
  ] as const)('%s', (method, dto) => {
    expect(bodyOf(method).metatype).toBe(dto);
  });
});

describe('PATCH /users/me (#1025)', () => {
  it('takes what AuthContext sends', async () => {
    await accepts('updateMyProfile', { displayName: 'Xeno ゼノ' });
    await accepts('updateMyProfile', {
      photoURL: 'https://lh3.googleusercontent.com/a/abc=s96-c',
    });
    await accepts('updateMyProfile', { photoURL: '/uploads/avatars/u_1.png' });
  });

  it('refuses a non-string or over-long name or URL', async () => {
    await rejects('updateMyProfile', { displayName: 'x'.repeat(101) });
    await rejects('updateMyProfile', { displayName: { a: 1 } });
    await rejects('updateMyProfile', {
      photoURL: 'https://x/' + 'a'.repeat(2048),
    });
    await rejects('updateMyProfile', { photoURL: 42 });
    // null is not a value here: the service would store it or call a string method on it
    await rejects('updateMyProfile', { displayName: null });
    await rejects('updateMyProfile', { photoURL: null });
  });
});

describe('translator profile bodies (#1025)', () => {
  const studioSave = {
    bio: 'I translate.',
    translatorLanguages: ['th', 'en', 'ja'],
    country: 'Thailand',
    preferredLanguage: '',
  };

  it('take what the studio sends', async () => {
    await accepts('becomeTranslator', {});
    await accepts('becomeTranslator', undefined); // studio layout sends no body
    await accepts('updateTranslatorProfile', studioSave);
    await accepts('updateTranslatorProfile', {
      ...studioSave,
      translatorLanguages: Array.from({ length: 13 }, (_, i) => `l${i}`),
      bio: 'b'.repeat(500),
    });
  });

  it.each([
    ['a non-string bio', { bio: 5 }],
    ['an over-long bio', { bio: 'b'.repeat(501) }],
    ['languages that are not an array', { translatorLanguages: 'th' }],
    ['a non-string language', { translatorLanguages: [1] }],
    ['too many languages', { translatorLanguages: Array(21).fill('th') }],
    ['an over-long country', { country: 'c'.repeat(101) }],
    ['an over-long preferred language', { preferredLanguage: 'p'.repeat(36) }],
    ['a null bio', { bio: null }],
    ['null languages', { translatorLanguages: null }],
    ['a null country', { country: null }],
  ])('refuse %s', async (_name, body) => {
    await rejects('updateTranslatorProfile', body);
    await rejects('becomeTranslator', body);
  });
});

describe('POST /users/me/photo-history (#1025)', () => {
  it('takes a list of URLs', async () => {
    await accepts('updatePhotoHistory', {
      photos: ['https://lh3.googleusercontent.com/a/x', '/uploads/a.png'],
    });
  });

  it.each([
    ['a missing list', {}],
    ['a non-string entry', { photos: [{}] }],
    ['an over-long URL', { photos: ['u'.repeat(2049)] }],
    ['more than 50 URLs', { photos: Array(51).fill('/uploads/a.png') }],
  ])('refuses %s', async (_name, body) => {
    await rejects('updatePhotoHistory', body);
  });
});
