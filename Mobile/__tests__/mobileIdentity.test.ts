import AsyncStorage from '@react-native-async-storage/async-storage';
import {getMobileHardwareId} from '../src/mobileIdentity';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('Mobile Hardware ID', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates and persists an app-scoped UUID on first use', async () => {
    mockStorage.getItem.mockResolvedValueOnce(null);
    mockStorage.setItem.mockResolvedValueOnce();

    const hardwareId = await getMobileHardwareId({
      generateUuid: () => '11111111-2222-4333-8444-555555555555',
    });

    expect(hardwareId).toBe('11111111-2222-4333-8444-555555555555');
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'mangadock.mobile.hardwareId',
      '11111111-2222-4333-8444-555555555555',
    );
  });

  it('reuses the persisted app-scoped UUID on later calls', async () => {
    mockStorage.getItem.mockResolvedValueOnce(
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    );

    await expect(getMobileHardwareId()).resolves.toBe(
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    );
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });
});
