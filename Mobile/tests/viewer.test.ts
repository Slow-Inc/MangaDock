import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewer } from '../src/viewer.ts';
test('paged swipes respect direction, spread size, bounds, vertical intent and zoom', () => {
  const viewer = createViewer(6);
  viewer.setMode('single'); viewer.swipe(-90, 5);
  assert.equal(viewer.snapshot().pageIndex, 1);
  viewer.swipe(90, 5); assert.equal(viewer.snapshot().pageIndex, 0);
  viewer.setDirection('rtl'); viewer.swipe(90, 5); assert.equal(viewer.snapshot().pageIndex, 1);
  viewer.swipe(10, 90); viewer.swipe(10, 0); assert.equal(viewer.snapshot().pageIndex, 1);
  viewer.setZoom(2); viewer.swipe(90, 0); assert.equal(viewer.snapshot().pageIndex, 1);
  viewer.setZoom(1); viewer.setMode('double'); viewer.swipe(90, 0);
  assert.equal(viewer.snapshot().pageIndex, 3);
  viewer.setMode('strip'); viewer.swipe(90, 0); assert.equal(viewer.snapshot().pageIndex, 3);
});

test('native reader keeps canonical position across long-strip, RTL single and double-page modes', () => {
  const viewer = createViewer(5);
  viewer.goTo(3);
  viewer.setMode('double');
  viewer.setDirection('rtl');
  assert.deepEqual(viewer.visiblePages(), [3, 2]);
  viewer.next();
  assert.deepEqual(viewer.visiblePages(), [4]);
  viewer.next();
  assert.equal(viewer.snapshot().pageIndex, 4);
  viewer.setMode('single');
  viewer.previous();
  assert.deepEqual(viewer.visiblePages(), [3]);
  viewer.setMode('strip');
  assert.equal(viewer.snapshot().pageIndex, 3);
  viewer.goTo(99);
  assert.equal(viewer.snapshot().pageIndex, 4);
});

test('reader zoom is bounded and overlay geometry scales with the displayed image', () => {
  const viewer = createViewer(3);
  viewer.setZoom(9);
  assert.equal(viewer.snapshot().zoom, 3);
  viewer.setZoom(0.1);
  assert.equal(viewer.snapshot().zoom, 1);
  assert.deepEqual(viewer.patchRect({ xPct: 10, yPct: 20, wPct: 30, hPct: 15 }, 300, 600), { left: 30, top: 120, width: 90, height: 90 });
  viewer.setZoom(2);
  assert.deepEqual(viewer.patchRect({ xPct: 10, yPct: 20, wPct: 30, hPct: 15 }, 600, 1200), { left: 60, top: 240, width: 180, height: 180 });
});

test('a very tall chapter page becomes current when it covers the Reader viewport', () => {
  const viewer = createViewer(3);
  viewer.observeViewport([{ index: 0, top: 0, height: 600 }, { index: 1, top: 600, height: 12000 }, { index: 2, top: 12600, height: 600 }], 3000, 500);
  assert.equal(viewer.snapshot().pageIndex, 1);
  viewer.observeViewport([{ index: 1, top: 600, height: 12000 }, { index: 2, top: 12600, height: 600 }], 12500, 500);
  assert.equal(viewer.snapshot().pageIndex, 2);
});

test('returning to strip mode requests the saved page before accepting its initial top-of-list event', () => {
  const viewer = createViewer(5);
  viewer.setMode('single'); viewer.goTo(3); viewer.setMode('strip');
  assert.equal(viewer.scrollRequest(), 3);
  viewer.observeViewport([{ index: 0, top: 0, height: 600 }], 0, 500);
  assert.equal(viewer.snapshot().pageIndex, 3);
  viewer.observeViewport([{ index: 3, top: 1800, height: 600 }], 1800, 500);
  assert.equal(viewer.scrollRequest(), null);
  assert.equal(viewer.snapshot().pageIndex, 3);
});

test('double-tap zooms the Reader and a second double-tap returns to the original scale', () => {
  const viewer = createViewer(5);
  viewer.tap(1000); viewer.tap(1150);
  assert.equal(viewer.snapshot().zoom, 2);
  viewer.tap(2000); viewer.tap(2150);
  assert.equal(viewer.snapshot().zoom, 1);
  viewer.tap(3000); viewer.tap(3500);
  assert.equal(viewer.snapshot().zoom, 1);
});
