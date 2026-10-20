import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MascotDto } from './mascot.dto';

const ok = {
  type: 'cat',
  face: 'mouth',
  hat: 'party',
  glasses: 'none',
  headphones: false,
  bowTie: true,
  color: '#ff8c42',
  accessoryColor: '#222222',
};

async function errorsFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(MascotDto, body), {
    whitelist: true,
  });
  return errors.map((e) => e.property);
}

describe('MascotDto — a mascot renders on other users screens, so every field is allow-listed', () => {
  it('accepts a valid mascot', async () => {
    expect(await errorsFor(ok)).toEqual([]);
  });

  it('accepts a mascot without the optional colours', async () => {
    const { color, accessoryColor, ...rest } = ok;
    void color;
    void accessoryColor;
    expect(await errorsFor(rest)).toEqual([]);
  });

  it.each([
    ['type', 'dragon'],
    ['face', 'nose'],
    ['hat', 'tophat'],
    ['glasses', 'monocle'],
  ])('rejects an unknown %s', async (field, value) => {
    expect(await errorsFor({ ...ok, [field]: value })).toEqual([field]);
  });

  it('rejects colours that are not plain #rrggbb', async () => {
    expect(await errorsFor({ ...ok, color: 'red' })).toEqual(['color']);
    expect(
      await errorsFor({ ...ok, accessoryColor: 'url(javascript:alert(1))' }),
    ).toEqual(['accessoryColor']);
  });

  it('rejects non-boolean switches', async () => {
    expect(await errorsFor({ ...ok, headphones: 'yes' })).toEqual([
      'headphones',
    ]);
  });

  it('requires the shape fields', async () => {
    expect((await errorsFor({})).sort()).toEqual(
      ['bowTie', 'face', 'glasses', 'hat', 'headphones', 'type'].sort(),
    );
  });
});
