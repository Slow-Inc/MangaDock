import type { SimScenario, SimNode } from '../engine';

const UPLOAD_NODES: SimNode[] = [
  { id: 'browser',  label: 'Browser',      sub: 'user' },
  { id: 'frontend', label: 'Frontend',     sub: 'multipart/form-data' },
  { id: 'backend',  label: 'Backend',      sub: 'upload endpoint' },
  { id: 'mime',     label: 'MIME Validator', sub: 'magic bytes (file-type)' },
  { id: 'storage',  label: 'Storage',      sub: '/uploads/ or R2' },
];

export const uploadScenarios: SimScenario[] = [
  {
    id: 'upload-valid',
    labelEN: 'Valid Image Upload',
    labelTH: 'Upload รูปปกติ',
    badge: 'UP',
    layout: 'linear',
    nodes: UPLOAD_NODES,
    steps: [
      {
        descEN: 'User selects an image file',
        descTH: 'ผู้ใช้เลือกไฟล์รูปภาพ',
        techEN: 'User picks a .jpg/.png/.webp file from their device. Frontend sends a multipart/form-data POST request to the upload endpoint.',
        techTH: 'ผู้ใช้เลือกไฟล์ .jpg/.png/.webp จากอุปกรณ์ Frontend ส่ง multipart/form-data POST ไปยัง upload endpoint',
        states: { browser: 'active' },
      },
      {
        descEN: 'Frontend sends file to Backend',
        descTH: 'Frontend ส่งไฟล์ไป Backend',
        techEN: 'Frontend POSTs the file stream to /api/proxy/upload with the Authorization header. Next.js proxy forwards to Backend\'s upload endpoint.',
        techTH: 'Frontend POST file stream ไปยัง /api/proxy/upload พร้อม Authorization header Next.js proxy ส่งต่อไป Backend upload endpoint',
        states: { browser: 'ok', frontend: 'active' },
      },
      {
        descEN: 'Backend reads magic bytes',
        descTH: 'Backend อ่าน magic bytes',
        techEN: 'Backend reads the first 12 bytes of the file stream — these are the "magic bytes" or file signature that every file format begins with. Extension is ignored at this point.',
        techTH: 'Backend อ่าน 12 bytes แรกของ file stream — เรียกว่า "magic bytes" หรือ file signature ที่ทุก format ใช้ขึ้นต้น — extension ถูกละเว้น ณ จุดนี้',
        states: { browser: 'ok', frontend: 'ok', backend: 'active' },
      },
      {
        descEN: 'file-type validates MIME from magic bytes',
        descTH: 'file-type ตรวจ MIME จาก magic bytes',
        techEN: 'The file-type npm library identifies the true MIME type from the magic bytes pattern. For a real JPEG: first bytes are FF D8 FF → identified as image/jpeg.',
        techTH: 'file-type library ระบุ MIME type ที่แท้จริงจาก magic bytes pattern สำหรับ JPEG จริง: bytes แรกคือ FF D8 FF → ระบุเป็น image/jpeg',
        states: { browser: 'ok', frontend: 'ok', backend: 'ok', mime: 'active' },
      },
      {
        descEN: 'MIME matches allowed types — validation passes',
        descTH: 'MIME ตรงกับ type ที่อนุญาต — ผ่าน',
        techEN: 'Detected MIME is image/jpeg, image/png, or image/webp — all allowed. Validation passes. Backend proceeds to save the file.',
        techTH: 'MIME ที่ detect ได้คือ image/jpeg, image/png หรือ image/webp — อนุญาตทั้งหมด validation ผ่าน Backend ดำเนินการบันทึกไฟล์',
        states: { browser: 'ok', frontend: 'ok', backend: 'ok', mime: 'ok' },
      },
      {
        descEN: 'File saved to storage',
        descTH: 'บันทึกไฟล์ลง storage',
        techEN: 'StorageProvider saves the file to the configured destination (local disk /uploads/ in dev, R2-compatible in production). Returns a public URL.',
        techTH: 'StorageProvider บันทึกไฟล์ลงปลายทางที่กำหนด (local /uploads/ ใน dev, R2-compatible ใน production) คืน public URL กลับ',
        states: { browser: 'ok', frontend: 'ok', backend: 'ok', mime: 'ok', storage: 'active' },
      },
      {
        descEN: 'Upload URL returned to client',
        descTH: 'คืน URL กลับ client',
        techEN: 'Storage URL returned in the response. Frontend receives the confirmed image URL and can use it in the post or profile update.',
        techTH: 'Storage URL ถูกส่งกลับใน response Frontend ได้รับ URL ยืนยันและนำไปใช้ใน post หรือ profile ได้',
        states: { browser: 'ok', frontend: 'ok', backend: 'ok', mime: 'ok', storage: 'ok' },
      },
    ],
  },
  {
    id: 'upload-spoof',
    labelEN: 'Extension Spoof (magic-byte reject)',
    labelTH: 'Extension Spoof ถูก Reject',
    badge: 'BL',
    layout: 'linear',
    nodes: UPLOAD_NODES,
    steps: [
      {
        descEN: 'Attacker renames malicious file to .jpg',
        descTH: 'ผู้โจมตี rename ไฟล์อันตรายเป็น .jpg',
        techEN: 'An attacker has a malicious file (executable, PHP script, etc.) and renames it to image.jpg — hoping the server trusts the extension.',
        techTH: 'ผู้โจมตีมีไฟล์อันตราย (executable, PHP script ฯลฯ) และ rename เป็น image.jpg — หวังว่า server จะเชื่อ extension',
        states: { browser: 'active' },
      },
      {
        descEN: 'File uploaded to Backend',
        descTH: 'Upload ไฟล์ไป Backend',
        techEN: 'The file is uploaded. It has a .jpg extension, a JPEG Content-Type header — everything looks legitimate at the surface level.',
        techTH: 'ไฟล์ถูก upload extension เป็น .jpg, Content-Type header เป็น image/jpeg — ดูเหมือนถูกต้องจาก surface',
        states: { browser: 'ok', frontend: 'ok', backend: 'active' },
      },
      {
        descEN: 'Backend reads first 12 bytes',
        descTH: 'Backend อ่าน magic bytes แรก',
        techEN: 'Backend ignores the filename and Content-Type header entirely. Reads the actual first bytes of the file stream to identify its true nature.',
        techTH: 'Backend ละเว้น filename และ Content-Type header ทั้งหมด อ่าน bytes จริงๆ แรกของ file stream เพื่อระบุ format ที่แท้จริง',
        states: { browser: 'ok', frontend: 'ok', backend: 'active', mime: 'active' },
      },
      {
        descEN: 'Magic bytes: MZ header (Windows PE executable)',
        descTH: 'Magic bytes: MZ header (Windows PE executable)',
        techEN: 'First two bytes are 4D 5A (hex) — the "MZ" signature of Windows PE executables. This is definitively not an image, regardless of the .jpg extension.',
        techTH: 'Bytes แรกคือ 4D 5A (hex) — "MZ" signature ของ Windows PE executable นี่ไม่ใช่รูปภาพอย่างแน่นอน ไม่ว่า extension จะบอกอะไร',
        states: { browser: 'ok', frontend: 'ok', backend: 'ok', mime: 'err' },
      },
      {
        descEN: 'file-type rejects — MIME mismatch',
        descTH: 'file-type ปฏิเสธ — MIME ไม่ตรง',
        techEN: 'file-type library returns "application/x-msdownload" (or similar), which is not in the allowed list {image/jpeg, image/png, image/webp}. Validation fails.',
        techTH: 'file-type library คืนค่า "application/x-msdownload" ซึ่งไม่อยู่ใน allowed list {image/jpeg, image/png, image/webp} — validation ล้มเหลว',
        states: { browser: 'ok', frontend: 'ok', backend: 'ok', mime: 'err', storage: 'skip' },
      },
      {
        descEN: '400 Bad Request — file never touches disk',
        descTH: '400 Bad Request — ไฟล์ไม่ถึง disk',
        techEN: 'Backend returns 400 Bad Request. The file is never written to disk or storage. User receives error: "ไฟล์ไม่ใช่รูปภาพที่รองรับ". Security boundary held.',
        techTH: 'Backend คืน 400 Bad Request ไฟล์ไม่ถูกเขียนลง disk หรือ storage เลย ผู้ใช้ได้รับ error: "ไฟล์ไม่ใช่รูปภาพที่รองรับ" — security boundary ยังอยู่',
        states: { browser: 'err', frontend: 'ok', backend: 'ok', mime: 'err', storage: 'skip' },
      },
    ],
  },
];
