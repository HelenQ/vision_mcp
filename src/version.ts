import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Single source of truth for the server version: read from `package.json`
 * at runtime so it can never drift from the published version.
 *
 * A static `import "../package.json"` would break the build (the file sits
 * outside `rootDir: "src"`), so we resolve it relative to this module:
 * works under tsx (src/) and compiled (dist/), and npm always ships
 * package.json alongside dist/.
 */
const FALLBACK_VERSION = "0.0.0";

function readVersion(): string {
  try {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

export const VERSION = readVersion();
