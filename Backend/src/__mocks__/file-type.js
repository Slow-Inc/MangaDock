// Jest manual mock for file-type (ESM-only package — incompatible with CommonJS Jest)
// Tests that exercise uploadBanner/uploadImage should override this mock per-test.
module.exports = {
  fileTypeFromFile: jest.fn().mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' }),
};
