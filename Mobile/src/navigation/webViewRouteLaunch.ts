export type WebViewQuickAction =
  | 'openMangaDock'
  | 'search'
  | 'library'
  | 'studio'
  | 'community';

const quickActionPaths: Record<WebViewQuickAction, string> = {
  openMangaDock: '/',
  search: '/search',
  library: '/mylist',
  studio: '/studio',
  community: '/community',
};

export function createWebViewRouteLaunch(action: WebViewQuickAction) {
  return {
    screen: 'WebView',
    params: {
      initialPath: quickActionPaths[action],
    },
  } as const;
}

export function getContinueReadingPath(lastKnownReaderPath?: string) {
  return lastKnownReaderPath ?? '/mylist';
}
