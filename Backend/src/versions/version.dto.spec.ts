import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVersionDto, UpdateVersionMetadataDto } from './version.dto';

/**
 * #1017: POST /versions stored a negative price (PATCH refused it) and 500'd on a fractional or overflowing one.
 * Both bodies are DTOs now; the studio's own payloads still validate.
 */
async function errorsFor<T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(cls, body), {
    whitelist: true,
  });
  return errors.map((e) => e.property).sort();
}

const studioCreate = {
  titleId: 'b2c4e8f0-1234-4abc-9def-0123456789ab',
  titleName: 'A Manga',
  titleAltName: 'Alt',
  chapterNumber: '12.5',
  chapterTitle: 'The chapter',
  language: 'th',
  description: 'notes',
  priceCoins: 5,
};

describe('CreateVersionDto (#1017)', () => {
  it('accepts the studio payload, with or without a chapterId', async () => {
    expect(await errorsFor(CreateVersionDto, studioCreate)).toEqual([]);
    expect(
      await errorsFor(CreateVersionDto, { ...studioCreate, chapterId: 'c1' }),
    ).toEqual([]);
    const { priceCoins, description, titleAltName, ...minimal } = studioCreate;
    void priceCoins;
    void description;
    void titleAltName;
    expect(await errorsFor(CreateVersionDto, minimal)).toEqual([]);
  });

  it.each([
    ['a negative price', { priceCoins: -50 }, ['priceCoins']],
    ['a fractional price', { priceCoins: 1.5 }, ['priceCoins']],
    ['an int4-overflowing price', { priceCoins: 1e10 }, ['priceCoins']],
    ['a numeric description', { description: 1 }, ['description']],
    [
      'a description over 1,000',
      { description: 'x'.repeat(1001) },
      ['description'],
    ],
    ['a numeric title', { titleName: 1 }, ['titleName']],
  ])('rejects %s', async (_l, patch, props) => {
    expect(
      await errorsFor(CreateVersionDto, { ...studioCreate, ...patch }),
    ).toEqual(props);
  });
});

describe('UpdateVersionMetadataDto (#1017)', () => {
  it('accepts the studio metadata save', async () => {
    expect(
      await errorsFor(UpdateVersionMetadataDto, {
        description: 'd',
        priceCoins: 0,
      }),
    ).toEqual([]);
  });

  it.each([
    ['a negative price', { priceCoins: -1 }, ['priceCoins']],
    ['an overflowing price', { priceCoins: 1e10 }, ['priceCoins']],
    ['a numeric chapter number', { chapterNumber: 3 }, ['chapterNumber']],
  ])('rejects %s', async (_l, body, props) => {
    expect(await errorsFor(UpdateVersionMetadataDto, body)).toEqual(props);
  });
});
