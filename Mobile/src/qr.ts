import QRCode from '../vendor/qrcode/index.js';
export type QrRect = { x: number; y: number; width: number; height: number };
export function createNativeQr(payload: string, maxSize: number): { size: number; unit: number; rects: QrRect[] } {
  if (!payload || !Number.isFinite(maxSize)) throw new Error('ข้อมูล QR ไม่ถูกต้อง');
  const code = new QRCode(-1, 0); // ECC M in the upstream QR core.
  const bytes = new TextEncoder().encode(payload);
  code.addData(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  code.make();
  const side = code.getModuleCount();
  const unit = Math.floor(maxSize / (side + 8));
  if (unit < 2) throw new Error('พื้นที่แสดง QR เล็กเกินไป');
  const rects: QrRect[] = [];
  for (let row = 0; row < side; row++) {
    let col = 0;
    while (col < side) {
      if (!code.isDark(row, col)) { col++; continue; }
      const start = col;
      while (col < side && code.isDark(row, col)) col++;
      rects.push({ x: (start + 4) * unit, y: (row + 4) * unit, width: (col - start) * unit, height: unit });
    }
  }
  return { size: (side + 8) * unit, unit, rects };
}
