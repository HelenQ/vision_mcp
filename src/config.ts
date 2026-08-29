import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Config {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface SavedConfig {
  path: string;
  baseUrl: string;
  model: string;
  apiKeySet: boolean;
}

export const DEFAULT_MODEL = "deepseek-v4-flash-vision-exp";
export const DEFAULT_BASE_URL = "https://api.deepseek.com";

const ENV_KEYS = {
  baseUrl: "BASE_URL",
  apiKey: "API_KEY",
  model: "MODEL",
} as const;

const FIELD_TO_KEY: Record<keyof Config, string> = {
  baseUrl: ENV_KEYS.baseUrl,
  apiKey: ENV_KEYS.apiKey,
  model: ENV_KEYS.model,
};

/**
 * Directory that holds the `.env` file: the package root, unless the
 * `VISION_MCP_HOME` environment variable overrides it to a stable location.
 */
export function configDir(): string {
  if (process.env.VISION_MCP_HOME) {
    return process.env.VISION_MCP_HOME;
  }
  // `import.meta.url` points at `<root>/dist/index.js` (compiled) or
  // `<root>/src/index.ts` (tsx), so the package root is one directory up.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

export function configPath(): string {
  return path.join(configDir(), ".env");
}

/** Parse a `.env` body into an ordered key/value map (ignoring comments and blank lines). */
export function parseEnv(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key) map.set(key, value);
  }
  return map;
}

/** Apply field updates onto existing `.env` text, preserving comments and unknown keys. */
function applyUpdates(content: string, updates: Config): string {
  const applied = new Set<string>();
  const out: string[] = [];
  const lines = content === "" ? [] : content.split(/\r?\n/);

  for (const raw of lines) {
    const trimmed = raw.trim();
    let matched = false;
    for (const field of Object.keys(FIELD_TO_KEY) as (keyof Config)[]) {
      const value = updates[field];
      if (value === undefined) continue;
      const key = FIELD_TO_KEY[field];
      if (trimmed === key || trimmed.startsWith(`${key}=`)) {
        out.push(`${key}=${value}`);
        applied.add(field);
        matched = true;
        break;
      }
    }
    if (!matched) out.push(raw);
  }

  for (const field of Object.keys(FIELD_TO_KEY) as (keyof Config)[]) {
    const value = updates[field];
    if (value !== undefined && !applied.has(field)) {
      out.push(`${FIELD_TO_KEY[field]}=${value}`);
    }
  }

  return `${out.join("\n").replace(/\n+$/, "")}\n`;
}

/** Load configuration with precedence: process env > .env file > default (model only). */
export function loadConfig(): Config {
  const p = configPath();
  const file = fs.existsSync(p) ? parseEnv(fs.readFileSync(p, "utf8")) : new Map<string, string>();
  const get = (key: string): string | undefined => process.env[key] ?? file.get(key);
  return {
    baseUrl: get(ENV_KEYS.baseUrl) ?? DEFAULT_BASE_URL,
    apiKey: get(ENV_KEYS.apiKey),
    model: get(ENV_KEYS.model) ?? DEFAULT_MODEL,
  };
}

/** Create a template `.env` if none exists; returns its path, or null if it already existed. */
export function ensureConfigFile(): string | null {
  const p = configPath();
  if (fs.existsSync(p)) return null;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    [
      "# vision-mcp configuration",
      "# Set API_KEY (required), and optionally BASE_URL and MODEL.",
      `${ENV_KEYS.baseUrl}=${DEFAULT_BASE_URL}`,
      `${ENV_KEYS.apiKey}=`,
      `${ENV_KEYS.model}=${DEFAULT_MODEL}`,
      "",
    ].join("\n"),
    "utf8",
  );
  return p;
}

/** Merge updates into the `.env` file and return the resulting configuration. */
export function saveConfig(updates: Config): SavedConfig {
  const p = configPath();
  const exists = fs.existsSync(p);
  const existing = exists ? parseEnv(fs.readFileSync(p, "utf8")) : new Map<string, string>();

  const merged = new Map(existing);
  if (updates.baseUrl !== undefined) merged.set(ENV_KEYS.baseUrl, updates.baseUrl);
  if (updates.apiKey !== undefined) merged.set(ENV_KEYS.apiKey, updates.apiKey);
  if (updates.model !== undefined) merged.set(ENV_KEYS.model, updates.model);

  const hasUpdate =
    updates.baseUrl !== undefined || updates.apiKey !== undefined || updates.model !== undefined;
  if (hasUpdate) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, applyUpdates(exists ? fs.readFileSync(p, "utf8") : "", updates), "utf8");
  }

  return {
    path: p,
    baseUrl: merged.get(ENV_KEYS.baseUrl) ?? DEFAULT_BASE_URL,
    model: merged.get(ENV_KEYS.model) ?? DEFAULT_MODEL,
    apiKeySet: !!merged.get(ENV_KEYS.apiKey),
  };
}
