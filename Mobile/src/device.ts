type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };

export async function getDeviceId(storage: Storage, nativeId: () => Promise<string | null>): Promise<string> {
  const existing = await storage.getItem('mangadock_native_device_id');
  if (existing) return existing;
  const id = await nativeId();
  if (!id) throw new Error('ไม่สามารถอ่านรหัสอุปกรณ์ได้');
  const deviceId = `mdock_native_${id}`;
  await storage.setItem('mangadock_native_device_id', deviceId);
  return deviceId;
}
