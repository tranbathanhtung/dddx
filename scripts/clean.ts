import { rm } from "fs/promises";
import { join } from "path";

const packages = ["sdk", "cli"];

async function remove(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
    console.log(`  ✓ ${path}`);
  } catch (err) {
    console.error(`  ✗ ${path}: ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  console.log("Cleaning node_modules and lock files...\n");

  // Root
  await remove("node_modules");
  await remove("bun.lock");

  // Packages
  for (const pkg of packages) {
    const base = join("packages", pkg);
    await remove(join(base, "node_modules"));
    await remove(join(base, "bun.lock"));
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
