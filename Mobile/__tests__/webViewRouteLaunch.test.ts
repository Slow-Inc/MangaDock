import {
  createWebViewRouteLaunch,
  getContinueReadingPath,
} from '../src/navigation/webViewRouteLaunch';

describe('WebView Route Launch', () => {
  it('maps Native Shell Home quick actions to MangaDock web paths', () => {
    expect(createWebViewRouteLaunch('openMangaDock')).toEqual({
      screen: 'WebView',
      params: {initialPath: '/'},
    });
    expect(createWebViewRouteLaunch('search')).toEqual({
      screen: 'WebView',
      params: {initialPath: '/search'},
    });
    expect(createWebViewRouteLaunch('library')).toEqual({
      screen: 'WebView',
      params: {initialPath: '/mylist'},
    });
    expect(createWebViewRouteLaunch('studio')).toEqual({
      screen: 'WebView',
      params: {initialPath: '/studio'},
    });
    expect(createWebViewRouteLaunch('community')).toEqual({
      screen: 'WebView',
      params: {initialPath: '/community'},
    });
  });

  it('uses Last Known Reader Path for Continue reading with a Library fallback', () => {
    expect(getContinueReadingPath('/book/demo/chapter/1')).toBe(
      '/book/demo/chapter/1',
    );
    expect(getContinueReadingPath(undefined)).toBe('/mylist');
  });
});
