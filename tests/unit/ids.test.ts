import { describe, expect, it } from 'vitest';
import { idSchema } from '@shared/schemas/application';
import { ulid } from '../../src/main/ids';

describe('ulid', () => {
  it('makes 26-character ids that pass the id schema', () => {
    expect(idSchema.safeParse(ulid()).success).toBe(true);
  });

  it('sorts by creation time', () => {
    expect(ulid(1_000) < ulid(2_000)).toBe(true);
  });

  it('keeps ids made in the same millisecond in creation order', () => {
    const ids = Array.from({ length: 200 }, () => ulid(5_000));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(200);
  });
});
