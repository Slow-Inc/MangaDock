import {productLinkPath} from '../src/navigation/productLinks';

test('existing product links resolve without granting access to another origin or auth flow', () => {
  expect(productLinkPath('mangadock://book/manga-1')).toBe('/book/manga-1');
  expect(productLinkPath('mangadock://community/profile/user-1')).toBe('/community/profile/user-1');
  expect(productLinkPath('mangadock://settings/security')).toBe('/settings/security');
  for (const url of ['mangadock://auth/callback?code=private', 'mangadock://feed', 'mangadock://collections', 'mangadock://book/../settings', 'mangadock://book/%2e%2e', 'https://outside.example/book/manga-1', 'mangadock://user:secret@book/manga-1']) expect(productLinkPath(url)).toBeNull();
});
