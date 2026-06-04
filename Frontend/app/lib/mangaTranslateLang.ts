export const MANGA_TARGET_LANGUAGES = [
  { code: 'th', label: 'ไทย (Thai)' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文简体 (Chinese Simplified)' },
  { code: 'zh-hk', label: '中文繁體 (Chinese Traditional)' },
  { code: 'ja', label: '日本語 (Japanese)' },
  { code: 'ko', label: '한국어 (Korean)' },
  { code: 'fr', label: 'Français (French)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'de', label: 'Deutsch (German)' },
  { code: 'ru', label: 'Русский (Russian)' },
  { code: 'pt', label: 'Português (Portuguese)' },
  { code: 'pt-br', label: 'Português BR (Brazilian Portuguese)' },
  { code: 'it', label: 'Italiano (Italian)' },
  { code: 'vi', label: 'Tiếng Việt (Vietnamese)' },
  { code: 'id', label: 'Bahasa Indonesia (Indonesian)' },
  { code: 'ar', label: 'العربية (Arabic)' },
  { code: 'zh-ro', label: 'Chinese (Romanized)' },
] as const;

export type MangaTargetLangCode = (typeof MANGA_TARGET_LANGUAGES)[number]['code'];

export const MANGA_TARGET_LANG_KEY = 'mangaTargetLang';
export const DEFAULT_TARGET_LANG: MangaTargetLangCode = 'th';

export function getTargetLangFromStorage(): MangaTargetLangCode {
  if (typeof window === 'undefined') return DEFAULT_TARGET_LANG;
  const stored = localStorage.getItem(MANGA_TARGET_LANG_KEY) as MangaTargetLangCode | null;
  return MANGA_TARGET_LANGUAGES.some(l => l.code === stored) ? stored! : DEFAULT_TARGET_LANG;
}

export function setTargetLangToStorage(code: MangaTargetLangCode): void {
  localStorage.setItem(MANGA_TARGET_LANG_KEY, code);
}
