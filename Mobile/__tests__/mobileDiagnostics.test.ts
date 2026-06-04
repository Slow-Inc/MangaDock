import {
  appendMobileDiagnosticsEvent,
  createMobileDiagnosticsEvent,
  formatMobileDiagnosticsLog,
} from '../src/mobileDiagnostics';

describe('Mobile diagnostics', () => {
  it('formats compact QA logs without exposing the full hardware ID', () => {
    const event = createMobileDiagnosticsEvent({
      type: 'webview_http_error',
      hardwareId: '11111111-2222-4333-8444-555555555555',
      url: 'https://hayateotsu.space/api/proxy/books/translate/mit-health',
      statusCode: 502,
    });

    const logLine = formatMobileDiagnosticsLog(event);

    expect(logLine).toContain('MangaDockMobile ');
    expect(logLine).toContain('"hardwareId":"11111111...5555"');
    expect(logLine).toContain('"type":"webview_http_error"');
    expect(logLine).toContain('"statusCode":502');
    expect(logLine).not.toContain('11111111-2222-4333-8444-555555555555');
  });

  it('keeps only the latest 20 diagnostics events in memory', () => {
    const events = Array.from({length: 25}, (_, index) =>
      createMobileDiagnosticsEvent({
        type: 'webview_load_end',
        sequence: index + 1,
      }),
    ).reduce(appendMobileDiagnosticsEvent, []);

    expect(events).toHaveLength(20);
    expect(events[0].sequence).toBe(6);
    expect(events[19].sequence).toBe(25);
  });
});
