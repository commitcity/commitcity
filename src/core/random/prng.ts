import { hash128 } from "./hash";

/** A deterministic random number source. Never use `Math.random` in `src/core`. */
export interface Random {
  /** Next unsigned 32-bit integer. */
  nextUint32(): number;
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** `true` with probability `p`. */
  chance(p: number): boolean;
  /** A uniformly chosen element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
}

/**
 * sfc32 (Small Fast Counter, Chris Doty-Humphrey, public domain), seeded from a
 * string through `hash128`. Uses only 32-bit integer math, so every JavaScript
 * engine produces the same sequence.
 */
export function createRandom(seed: string): Random {
  let [a, b, c, d] = hash128(seed);

  const nextUint32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };

  // Mix the seed in before the first output.
  for (let i = 0; i < 12; i++) nextUint32();

  const next = () => nextUint32() / 4294967296;

  return {
    nextUint32,
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`Invalid integer range [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick(items) {
      if (items.length === 0) throw new RangeError("Cannot pick from an empty array");
      return items[Math.floor(next() * items.length)]!;
    },
  };
}
