import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const CONFIG_NAME = "orchestrator.config.yaml";

export function findWorkspaceRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  while (true) {
    if (existsSync(resolve(dir, CONFIG_NAME))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `governor: ${CONFIG_NAME} not found in ${start} or any parent directory.`,
      );
    }
    dir = parent;
  }
}
