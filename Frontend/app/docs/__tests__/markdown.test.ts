import { describe, expect, test } from 'bun:test';
import { extractHeadings, filterLangBlocks, headingsOfUnits, makeSlugger, needsTranslation, partNeedsTranslation, readingMinutes, splitParts, thaiShare } from '../markdown';

describe('makeSlugger', () => {
  test('lowercases, hyphenates, keeps Thai letters', () => {
    const slug = makeSlugger();
    expect(slug('Hello, World!')).toBe('hello-world');
    expect(slug('ภาพรวมระบบ 2')).toBe('ภาพรวมระบบ-2');
  });
  test('dedupes repeated headings', () => {
    const slug = makeSlugger();
    expect([slug('Setup'), slug('Setup'), slug('setup')]).toEqual(['setup', 'setup-2', 'setup-3']);
  });
  test('never returns an empty id', () => {
    expect(makeSlugger()('!!!')).toBe('section');
  });
});

describe('extractHeadings', () => {
  const doc = ['# Title', 'intro', '## One', '```', '## not a heading', '```', '### Two `code`', '#### deep', '## One'].join('\n');
  test('h2/h3 only, skips fenced code, dedupes, strips inline markers', () => {
    expect(extractHeadings(doc)).toEqual([
      { id: 'one', level: 2, text: 'One' },
      { id: 'two-code', level: 3, text: 'Two code' },
      { id: 'one-2', level: 2, text: 'One' },
    ]);
  });
  test('h1 and h4 consume slugs so ids match the renderer', () => {
    expect(extractHeadings('# A\n## A')).toEqual([{ id: 'a-2', level: 2, text: 'A' }]);
  });
});

describe('filterLangBlocks', () => {
  const raw = ['all', '<!-- lang:th -->', 'ไทย', '<!-- lang:en -->', 'english', '<!-- lang:end -->', 'tail'].join('\n');
  test('keeps shared lines and only the chosen language', () => {
    expect(filterLangBlocks(raw, 'th')).toBe('all\nไทย\ntail');
    expect(filterLangBlocks(raw, 'en')).toBe('all\nenglish\ntail');
  });
});

describe('readingMinutes', () => {
  test('at least one minute; scales with length', () => {
    expect(readingMinutes('short')).toBe(1);
    expect(readingMinutes('word '.repeat(2200))).toBe(10);
    expect(readingMinutes('ก'.repeat(9000))).toBe(10);
  });
});

describe('needsTranslation', () => {
  const en = '# Title\n\nThe cache has three tiers and each one expires on its own.';
  const th = '# หัวข้อ\n\nระบบแคชมีสามชั้นและแต่ละชั้นหมดอายุแยกกันอย่างเป็นอิสระ';
  test('English needs Thai; Thai needs English; the matching language needs nothing', () => {
    expect(needsTranslation(en, 'th')).toBe(true);
    expect(needsTranslation(en, 'en')).toBe(false);
    expect(needsTranslation(th, 'en')).toBe(true);
    expect(needsTranslation(th, 'th')).toBe(false);
  });
  test('a document with both language blocks never does', () => {
    expect(needsTranslation('<!-- lang:th -->\nไทย\n<!-- lang:en -->\nEnglish\n<!-- lang:end -->', 'th')).toBe(false);
  });
  test('code does not count as English', () => {
    const doc = 'ระบบแคชมีสามชั้นและแต่ละชั้นหมดอายุแยกกัน\n\n```ts\nconst veryLongEnglishIdentifier = computeEverythingNow();\n```';
    expect(thaiShare(doc)).toBeGreaterThan(0.9);
    expect(needsTranslation(doc, 'th')).toBe(false);
  });
});

describe('splitParts', () => {
  test('a short document is one part and round-trips', () => {
    const doc = '# A\n\nOne.\n\nTwo.';
    const parts = splitParts(doc);
    expect(parts.length).toBe(1);
    expect(parts[0].original).toBe(doc);
  });

  test('a long one is cut at block boundaries, never mid-paragraph, and loses nothing', () => {
    const para = (n: number) => `Paragraph ${n}: ` + 'word '.repeat(120).trim();
    const doc = Array.from({ length: 20 }, (_, i) => para(i)).join('\n\n');
    const parts = splitParts(doc);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map(p => p.original).join('\n\n')).toBe(doc);
    for (const p of parts) expect(p.original.length).toBeLessThanOrEqual(2100);
  });

  test('Thai parts stay under the URL budget (9 bytes per character once encoded)', () => {
    const doc = Array.from({ length: 12 }, () => 'ก'.repeat(500)).join('\n\n');
    for (const p of splitParts(doc)) expect(encodeURIComponent(p.text).length).toBeLessThanOrEqual(7200);
  });

  test('a section heading starts a new part once the current one is half full', () => {
    const body = 'x '.repeat(900).trim();
    const parts = splitParts(`# T\n\n${body}\n\n## Next\n\nshort`);
    expect(parts[parts.length - 1].original.startsWith('## Next')).toBe(true);
  });

  test('fenced code is lifted out and comes back untouched, blank lines inside included', () => {
    const code = '```ts\nconst a = 1;\n\nconst b = 2;\n```';
    const [p] = splitParts(`Before.\n\n${code}\n\nAfter.`);
    expect(p.text).toBe('Before.\n\n[[CODE_0]]\n\nAfter.');
    expect(p.restore('ก่อน\n\n[[CODE_0]]\n\nหลัง')).toBe(`ก่อน\n\n${code}\n\nหลัง`);
  });

  test('restore refuses a translation that dropped or repeated a marker', () => {
    const [p] = splitParts('A.\n\n```js\nx\n```\n\nB.');
    expect(p.restore('ก\n\nข')).toBeNull();
    expect(p.restore('[[CODE_0]]\n\n[[CODE_0]]')).toBeNull();
    expect(p.restore('[[CODE_7]]')).toBeNull();
  });

  test('a code-only part has nothing to translate', () => {
    const [p] = splitParts('```sh\nls\n```');
    expect(partNeedsTranslation(p, 'th')).toBe(false);
  });

  test('partNeedsTranslation follows the target language', () => {
    const [en] = splitParts('The cache has three tiers.');
    const [th] = splitParts('ระบบแคชมีสามชั้นและหมดอายุแยกกัน');
    expect([partNeedsTranslation(en, 'th'), partNeedsTranslation(en, 'en')]).toEqual([true, false]);
    expect([partNeedsTranslation(th, 'th'), partNeedsTranslation(th, 'en')]).toEqual([false, true]);
  });
});

describe('headingsOfUnits', () => {
  const whole = ['# T', '## Setup', 'a', '## Other', '```', '## not a heading', '```', '### Setup', '## Setup'].join('\n');

  test('pieces get the same ids as the whole document, with repeats counted across pieces', () => {
    const units = ['# T\n\n## Setup\n\na', '## Other\n\n```\n## not a heading\n```', '### Setup', '## Setup'];
    const split = headingsOfUnits(units);
    expect(split.headings).toEqual(extractHeadings(whole));
    expect(split.ids).toEqual([['t', 'setup'], ['other'], ['setup-2'], ['setup-3']]);
  });

  test('a fence that opens in one piece and closes in the next still hides its content', () => {
    const { headings } = headingsOfUnits(['## A\n\n```', '## inside', '```\n\n## B']);
    expect(headings.map(h => h.text)).toEqual(['A', 'B']);
  });
});
