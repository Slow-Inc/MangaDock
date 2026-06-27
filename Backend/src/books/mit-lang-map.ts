// ─── MIT language map ─────────────────────────────────────────────────────────
/** Map MangaDex ISO language code → MIT target_lang / source_lang code.
 *  Every value must be a member of VALID_LANGUAGES in
 *  MIT/manga_translator/translators/common.py — pinned by
 *  mit-lang-map.spec.ts (#165: es/pt/vi had drifted to codes MIT rejects). */
export const MIT_LANG_MAP: Record<string, string> = {
  en: 'ENG',
  ja: 'JPN',
  ko: 'KOR',
  zh: 'CHS',
  'zh-hk': 'CHT',
  'zh-ro': 'CHS',
  fr: 'FRA',
  es: 'ESP',
  de: 'DEU',
  ru: 'RUS',
  pt: 'PTB',
  'pt-br': 'PTB',
  it: 'ITA',
  vi: 'VIN',
  th: 'THA',
  id: 'IND',
  ar: 'ARA',
};

export function mitLangCode(isoLang: string): string {
  return MIT_LANG_MAP[isoLang.toLowerCase()] ?? isoLang.toUpperCase();
}
