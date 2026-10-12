export interface BlockPosition {
  x: number;
  y: number;
}

/** Ring of a block: its Chebyshev distance from the center block. */
export function blockRing(block: BlockPosition): number {
  return Math.max(Math.abs(block.x), Math.abs(block.y));
}

/**
 * The n-th block of the spiral. Ring 0 is the center block. Ring r > 0 has 8r
 * blocks, starting at its back corner (-r, -r) and going clockwise on screen at
 * orientation 0: along +x, then +y, then -x, then -y.
 */
export function blockAt(index: number): BlockPosition {
  if (!Number.isInteger(index) || index < 0) throw new RangeError(`Invalid block index ${index}`);
  if (index === 0) return { x: 0, y: 0 };

  // Rings 0..r-1 hold (2r - 1)² blocks.
  let ring = 1;
  while ((2 * ring + 1) ** 2 <= index) ring++;
  const step = index - (2 * ring - 1) ** 2;
  const side = Math.floor(step / (2 * ring));
  const along = step % (2 * ring);

  switch (side) {
    case 0:
      return { x: -ring + along, y: -ring };
    case 1:
      return { x: ring, y: -ring + along };
    case 2:
      return { x: ring - along, y: ring };
    default:
      return { x: -ring, y: ring - along };
  }
}
