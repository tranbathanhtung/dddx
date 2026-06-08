import { join } from "node:path";

const cliPkgPath = join(import.meta.dir, "../../cli/package.json");

/** CLI release version — SDK assets are pinned to match `DDDX_VERSION` in `bin/dddx`. */
export async function getCliVersion(): Promise<string> {
  const pkg = (await Bun.file(cliPkgPath).json()) as { version: string };
  return pkg.version;
}
