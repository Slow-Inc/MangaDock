import { MIT_LANG_MAP, mitLangCode } from './mit-lang-map';

/**
 * MIT_LANG_MAP must only emit codes MIT's translator vocabulary actually
 * contains (#165) — es/pt/vi silently mapped to SPA/POR/VIE, which MIT
 * rejects as ESP/PTB/VIN. The literal list below mirrors VALID_LANGUAGES in
 * MIT/manga_translator/translators/common.py (the source of truth); update
 * both together.
 */
const MIT_VALID_LANGUAGES = [
  'CHS',
  'CHT',
  'CSY',
  'NLD',
  'ENG',
  'FRA',
  'DEU',
  'HUN',
  'ITA',
  'JPN',
  'KOR',
  'POL',
  'PTB',
  'ROM',
  'RUS',
  'ESP',
  'TRK',
  'UKR',
  'VIN',
  'ARA',
  'CNR',
  'SRP',
  'HRV',
  'THA',
  'IND',
  'FIL',
];

describe('MIT_LANG_MAP (#165)', () => {
  it('maps every entry to a code MIT recognizes — no silent drift', () => {
    for (const [iso, mit] of Object.entries(MIT_LANG_MAP)) {
      expect({ iso, mit, valid: MIT_VALID_LANGUAGES.includes(mit) }).toEqual({
        iso,
        mit,
        valid: true,
      });
    }
  });

  it('corrects the three drifted languages: es→ESP, pt/pt-br→PTB, vi→VIN', () => {
    expect(mitLangCode('es')).toBe('ESP');
    expect(mitLangCode('pt')).toBe('PTB');
    expect(mitLangCode('pt-br')).toBe('PTB');
    expect(mitLangCode('vi')).toBe('VIN');
  });

  it('keeps the live language pairs unchanged', () => {
    expect(mitLangCode('th')).toBe('THA');
    expect(mitLangCode('en')).toBe('ENG');
    expect(mitLangCode('zh')).toBe('CHS');
    expect(mitLangCode('ja')).toBe('JPN');
    expect(mitLangCode('ko')).toBe('KOR');
  });
});
