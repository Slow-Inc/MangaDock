import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createNativeQr } from '../src/qr.ts';

test('native payment QR rectangles encode the exact UTF-8 payload with a scan-safe quiet zone', () => {
  const reference = JSON.parse(readFileSync(new URL('./support/qr-reference.json', import.meta.url), 'utf8'));
  const qr = createNativeQr(reference.payload, 320);
  const side = qr.size / qr.unit;
  assert.equal(side, reference.side);
  const raster: number[] = [];
  for (let row = 0; row < side; row++) for (let col = 0; col < side; col++) {
    const x = (col + 0.5) * qr.unit; const y = (row + 0.5) * qr.unit;
    raster.push(Number(qr.rects.some((rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height)));
  }
  assert.ok(reference.hashes.includes(createHash('sha256').update(Buffer.from(raster)).digest('hex')), 'Native QR must match an independently generated valid encoding');
  assert.ok(qr.size <= 320);
});

test('a missing payment payload or too-small QR area cannot display an unscannable payment code', () => {
  assert.throws(() => createNativeQr('', 320));
  assert.throws(() => createNativeQr('PAYMENT', 8));
});
