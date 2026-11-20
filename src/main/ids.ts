import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = -1;
let lastRandom: number[] = [];

function encode(value: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out = `${ALPHABET[value % 32] ?? '0'}${out}`;
    value = Math.floor(value / 32);
  }
  return out;
}

/**
 * A ULID: 10 characters of millisecond time, then 16 of randomness. Ids made in the same
 * millisecond count upward, so they sort in the order they were created.
 */
export function ulid(now: number = Date.now()): string {
  if (now === lastTime) {
    for (let i = lastRandom.length - 1; i >= 0; i--) {
      if ((lastRandom[i] ?? 0) < 31) {
        lastRandom[i] = (lastRandom[i] ?? 0) + 1;
        break;
      }
      lastRandom[i] = 0;
    }
  } else {
    lastTime = now;
    lastRandom = Array.from(randomBytes(16), (byte) => byte % 32);
  }
  return encode(now, 10) + lastRandom.map((n) => ALPHABET[n]).join('');
}
