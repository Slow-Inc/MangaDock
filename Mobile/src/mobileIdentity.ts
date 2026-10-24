import AsyncStorage from '@react-native-async-storage/async-storage';

export const MOBILE_HARDWARE_ID_KEY = 'mangadock.mobile.hardwareId';

type MobileHardwareIdOptions = {
  generateUuid?: () => string;
};

function randomHex(length: number) {
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += Math.floor(Math.random() * 16).toString(16);
  }
  return output;
}

function generateUuidV4() {
  return [
    randomHex(8),
    randomHex(4),
    `4${randomHex(3)}`,
    `${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex(3)}`,
    randomHex(12),
  ].join('-');
}

export async function getMobileHardwareId(
  options: MobileHardwareIdOptions = {},
) {
  const existingHardwareId = await AsyncStorage.getItem(MOBILE_HARDWARE_ID_KEY);
  if (existingHardwareId) {
    return existingHardwareId;
  }

  const hardwareId = (options.generateUuid ?? generateUuidV4)();
  await AsyncStorage.setItem(MOBILE_HARDWARE_ID_KEY, hardwareId);
  return hardwareId;
}
