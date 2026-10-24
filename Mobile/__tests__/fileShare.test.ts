import {MAX_SHARE_BYTES, parseFileDownloadMessage} from '../src/fileShare';

const csv = Buffer.from('title,chapter\nOne,1\n').toString('base64');

test('accepts a web CSV export and normalises its MIME parameters', () => {
  expect(parseFileDownloadMessage({
    type: 'file_download', filename: 'reading-history.csv', mimeType: 'text/csv; charset=utf-8', data: csv,
  })).toEqual({filename: 'reading-history.csv', mimeType: 'text/csv', base64: csv});
});

test('strips directories and unsafe characters from the suggested name', () => {
  expect(parseFileDownloadMessage({
    type: 'file_download', filename: '../../data/<évil>:name', mimeType: 'text/plain', data: csv,
  })?.filename).toBe('_évil__name.txt');
  expect(parseFileDownloadMessage({
    type: 'file_download', filename: '', mimeType: 'text/csv', data: csv,
  })?.filename).toBe('mangadock-export.csv');
});

test('rejects executable types, malformed payloads and oversized files', () => {
  expect(parseFileDownloadMessage({type: 'file_download', filename: 'a.apk', mimeType: 'application/vnd.android.package-archive', data: csv})).toBeNull();
  expect(parseFileDownloadMessage({type: 'file_download', filename: 'a.csv', mimeType: 'text/csv', data: 'not base64!'})).toBeNull();
  expect(parseFileDownloadMessage({type: 'file_download', filename: 'a.csv', mimeType: 'text/csv', data: ''})).toBeNull();
  expect(parseFileDownloadMessage({type: 'other', filename: 'a.csv', mimeType: 'text/csv', data: csv})).toBeNull();
  const oversized = 'A'.repeat(Math.ceil(MAX_SHARE_BYTES / 3) * 4 + 4);
  expect(parseFileDownloadMessage({type: 'file_download', filename: 'a.csv', mimeType: 'text/csv', data: oversized})).toBeNull();
});
