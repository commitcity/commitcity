// Checks every asset against ART_DIRECTION.md. Exits with 1 and lists each problem
// when something is wrong. Usage: pnpm validate-assets [assets-dir]
import { readAssets } from "./lib/readAssets";

const root = process.argv[2] ?? "assets";
const { buildings, problems } = readAssets(root);

if (problems.length > 0) {
  console.error(`✗ ${problems.length} asset problem${problems.length === 1 ? "" : "s"}:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nSee docs/ART_DIRECTION.md (§4 sprites, §6 palette, §12 manifest).");
  process.exit(1);
}
console.log(`✓ ${buildings.length} building${buildings.length === 1 ? "" : "s"} valid`);
