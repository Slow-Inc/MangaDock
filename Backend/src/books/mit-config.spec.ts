import {
  shouldSendMitSourceLang,
  mitLangPair,
  normalizeGeminiModelName,
  imageModelKey,
  renderConfigHash,
  patchCacheKey,
  buildJobKey,
  buildMitConfig,
  parseJobKey,
} from './mit-config';

/**
 * #229: the MIT key/config builders extracted as pure, dependency-light free
 * functions taking explicit args + an injected `env`. These are the single
 * source of truth whose drift silently breaks cancellation (jobKey) and cache
 * hits (patch cache key), so they are pinned here with ZERO mocks — every call
 * passes a literal env, constructs no BooksService, and snapshots the exact
 * shapes. The BooksService delegation is separately guarded byte-identical by
 * books-mit-config / books-image-model / books-batch-cancel.
 */
describe('mit-config pure builders (#229)', () => {
  describe('shouldSendMitSourceLang', () => {
    it('defaults to true when MIT_SEND_SOURCE_LANG is unset', () => {
      expect(shouldSendMitSourceLang({})).toBe(true);
    });
    it('is false for the documented off values (case/space-insensitive)', () => {
      for (const v of ['false', '0', 'no', 'off', ' OFF ', 'False']) {
        expect(shouldSendMitSourceLang({ MIT_SEND_SOURCE_LANG: v })).toBe(
          false,
        );
      }
    });
    it('is true for any other value', () => {
      expect(shouldSendMitSourceLang({ MIT_SEND_SOURCE_LANG: 'yes' })).toBe(
        true,
      );
    });
  });

  describe('normalizeGeminiModelName', () => {
    it('strips a leading models/ prefix and trims', () => {
      expect(normalizeGeminiModelName('models/gemini-2.5-flash')).toBe(
        'gemini-2.5-flash',
      );
      expect(normalizeGeminiModelName('  gemini-2.5-pro  ')).toBe(
        'gemini-2.5-pro',
      );
    });
    it('returns null for empty/absent input', () => {
      expect(normalizeGeminiModelName('')).toBeNull();
      expect(normalizeGeminiModelName(undefined)).toBeNull();
      expect(normalizeGeminiModelName(null)).toBeNull();
    });
  });

  describe('imageModelKey', () => {
    it('passes a safe model name through, normalizing models/ prefix', () => {
      expect(imageModelKey('gemini-2.5-pro')).toBe('gemini-2.5-pro');
      expect(imageModelKey('models/gemini-2.5-flash')).toBe('gemini-2.5-flash');
    });
    it('returns undefined for absent or unsafe names (#87 fallback to default)', () => {
      expect(imageModelKey(undefined)).toBeUndefined();
      expect(imageModelKey('evil name!:{}')).toBeUndefined();
    });
  });

  describe('mitLangPair', () => {
    it('maps ISO → MIT codes and sends the source lang by default', () => {
      expect(mitLangPair({}, 'ja', 'th')).toEqual({
        srcMIT: 'JPN',
        tgtMIT: 'THA',
      });
    });
    it('uses ANY source when MIT_SEND_SOURCE_LANG is off', () => {
      expect(
        mitLangPair({ MIT_SEND_SOURCE_LANG: 'false' }, 'ja', 'th'),
      ).toEqual({ srcMIT: 'ANY', tgtMIT: 'THA' });
    });
    it('defaults the target to THA and source to ANY when absent', () => {
      expect(mitLangPair({})).toEqual({ srcMIT: 'ANY', tgtMIT: 'THA' });
    });
  });

  describe('renderConfigHash', () => {
    it('is the 10-char sha1 of the empty knob set when no MIT_* env is present', () => {
      // sha1('') = da39a3ee5e6b4b0d3255bfef95601890afd80709
      expect(renderConfigHash({})).toBe('da39a3ee5e');
    });
    it('changes when any MIT_* knob changes (cache-bust)', () => {
      const before = renderConfigHash({});
      expect(renderConfigHash({ MIT_FONT_SIZE_MAX: '20' })).not.toBe(before);
    });
    it('ignores non-MIT_ env entirely', () => {
      expect(renderConfigHash({ PATH: '/usr/bin', HOME: '/root' })).toBe(
        renderConfigHash({}),
      );
    });
  });

  describe('buildJobKey / patchCacheKey consistency', () => {
    it('builds the registry jobKey from the resolved lang pair + model + derivative', () => {
      expect(buildJobKey({}, 'ch1', 'ja', 'th')).toBe('ch1:JPN:THA:default:hd');
      expect(
        buildJobKey({}, 'ch1', 'ja', 'th', 'gemini-2.5-pro', 'saver'),
      ).toBe('ch1:JPN:THA:gemini-2.5-pro:saver');
    });
    it('builds the v7 patch cache key with the render-config hash suffix', () => {
      expect(patchCacheKey({}, 'ch1', 0, 'JPN', 'THA')).toBe(
        'translate:manga-patches:v7:ch1:0:JPN:THA:default:hd:da39a3ee5e',
      );
    });
    it('parseJobKey round-trips a "ver:<uuid>" chapterId (right-split)', () => {
      const key = buildJobKey(
        {},
        'ver:752fc515-72ce-4890',
        'ja',
        'th',
        'gemini-2.5-pro',
        'saver',
      );
      expect(parseJobKey(key)).toEqual({
        chapterId: 'ver:752fc515-72ce-4890',
        srcMIT: 'JPN',
        tgtMIT: 'THA',
        model: 'gemini-2.5-pro',
        derivative: 'saver',
      });
    });
  });

  describe('buildMitConfig', () => {
    it('snapshots the exact default config string (clean env, ja → THA)', () => {
      expect(buildMitConfig({}, 'JPN', 'THA', 'ja')).toBe(
        '{"translator":{"target_lang":"THA","source_lang":"JPN","source_lang_only":true},' +
          '"detector":{"detection_size":2560},' +
          '"inpainter":{"inpainter":"lama_large","inpainting_size":2048,"inpainting_precision":"bf16"},' +
          '"render":{"direction":"auto","rtl":true}}',
      );
    });
    it('omits source_lang for ANY and sets rtl:false for a non-RTL source', () => {
      const cfg = JSON.parse(buildMitConfig({}, 'ANY', 'THA', 'en')) as {
        translator: { source_lang?: string; source_lang_only?: boolean };
        render: { rtl: boolean };
      };
      expect(cfg.translator.source_lang).toBeUndefined();
      expect(cfg.translator.source_lang_only).toBeUndefined();
      expect(cfg.render.rtl).toBe(false);
    });
    it('is byte-identical whether series_context is undefined or omitted (local-first)', () => {
      expect(buildMitConfig({}, 'JPN', 'THA', 'ja', undefined, undefined)).toBe(
        buildMitConfig({}, 'JPN', 'THA', 'ja'),
      );
    });
  });
});
