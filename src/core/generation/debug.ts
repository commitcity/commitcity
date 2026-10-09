import { LOTS_PER_BLOCK_SIDE } from "./layout";
import type { LotAssignment } from "./placement";

/**
 * ASCII map of occupied lots, seen from above (x to the right, y down). Each lot
 * shows its spiral index; `.` is a free lot; blank rows and columns are roads.
 * For debugging and snapshot tests only.
 */
export function formatLotGrid(assignments: readonly LotAssignment[]): string {
  if (assignments.length === 0) return "(empty)";

  const byCell = new Map<string, number>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { lot } of assignments) {
    const cx = lot.block.x * LOTS_PER_BLOCK_SIDE + lot.cell.x;
    const cy = lot.block.y * LOTS_PER_BLOCK_SIDE + lot.cell.y;
    byCell.set(`${cx},${cy}`, lot.index);
    minX = Math.min(minX, lot.block.x);
    minY = Math.min(minY, lot.block.y);
    maxX = Math.max(maxX, lot.block.x);
    maxY = Math.max(maxY, lot.block.y);
  }

  const width = String(assignments.length - 1).length;
  const lines: string[] = [];
  for (let by = minY; by <= maxY; by++) {
    for (let ly = 0; ly < LOTS_PER_BLOCK_SIDE; ly++) {
      const blocks: string[] = [];
      for (let bx = minX; bx <= maxX; bx++) {
        const cells: string[] = [];
        for (let lx = 0; lx < LOTS_PER_BLOCK_SIDE; lx++) {
          const index = byCell.get(
            `${bx * LOTS_PER_BLOCK_SIDE + lx},${by * LOTS_PER_BLOCK_SIDE + ly}`,
          );
          cells.push((index === undefined ? "." : String(index)).padStart(width));
        }
        blocks.push(cells.join(" "));
      }
      lines.push(blocks.join("   ").trimEnd());
    }
    if (by < maxY) lines.push("");
  }
  return lines.join("\n");
}
