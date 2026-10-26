import {productLinkPath} from '../src/navigation/productLinks';

test('existing product links resolve without granting access to another origin or auth flow', () => {
  expect(productLinkPath('mangadock://book/manga-1')).toBe('/book/manga-1');
  expect(productLinkPath('mangadock://community/profile/user-1')).toBe('/community/profile/user-1');
  expect(productLinkPath('mangadock://settings/security')).toBe('/settings/security');
  expect(productLinkPath('mangadock://feed')).toBe('/feed');
  expect(productLinkPath('mangadock://collections')).toBe('/collections');
  expect(productLinkPath('mangadock://collections/12345678-1234-4123-8123-123456789abc')).toBe('/collections/12345678-1234-4123-8123-123456789abc');
  expect(productLinkPath('mangadock://settings/notifications')).toBe('/settings/notifications');
  for (const url of ['mangadock://auth/callback?code=private', 'mangadock://collections/not-an-id', 'mangadock://collections/%2e%2e/feed', 'mangadock://book/../settings', 'mangadock://book/%2e%2e', 'https://outside.example/book/manga-1', 'mangadock://user:secret@book/manga-1']) expect(productLinkPath(url)).toBeNull();
});
