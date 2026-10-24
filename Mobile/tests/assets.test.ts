import test from 'node:test';
import assert from 'node:assert/strict';
import { imageUri } from '../src/assets.ts';

test('native images resolve local paths directly and proxy only remote origins', () => {
  const origin = 'https://api.example.test';
  assert.equal(imageUri('/uploads/page.jpg', origin), `${origin}/uploads/page.jpg`);
  assert.equal(imageUri(`${origin}/img-cache/page.jpg`, origin), `${origin}/img-cache/page.jpg`);
  assert.equal(imageUri('https://images.example.test/page.jpg', origin), `${origin}/books/img-proxy?url=https%3A%2F%2Fimages.example.test%2Fpage.jpg`);
});
