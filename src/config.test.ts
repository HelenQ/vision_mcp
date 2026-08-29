import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_MODEL,
  ensureConfigFile,
  loadConfig,
  parseEnv,
  saveConfig,
} from "./config.js";

function withTempHome(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vision-mcp-test-"));
  const prev = process.env.VISION_MCP_HOME;
  process.env.VISION_MCP_HOME = dir;
  try {
    fn(dir);
  } finally {
    if (prev === undefined) delete process.env.VISION_MCP_HOME;
    else process.env.VISION_MCP_HOME = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("parseEnv parses key/value pairs and strips quotes", () => {
  const map = parseEnv('# comment\nBASE_URL=https://api.deepseek.com\nAPI_KEY="abc123"\nMODEL=\'m\'\n');
  assert.equal(map.get("BASE_URL"), "https://api.deepseek.com");
  assert.equal(map.get("API_KEY"), "abc123");
  assert.equal(map.get("MODEL"), "m");
});

test("saveConfig merges updates and preserves comments/unknown keys", () => {
  withTempHome((dir) => {
    fs.writeFileSync(path.join(dir, ".env"), "# keep me\nBASE_URL=old\nCUSTOM=x\n");
    saveConfig({ apiKey: "secret", model: "m2" });

    const content = fs.readFileSync(path.join(dir, ".env"), "utf8");
    assert.match(content, /^# keep me$/m);
    assert.match(content, /^BASE_URL=old$/m);
    assert.match(content, /^API_KEY=secret$/m);
    assert.match(content, /^MODEL=m2$/m);
    assert.match(content, /^CUSTOM=x$/m);
  });
});

test("saveConfig appends missing keys and overwrites existing ones", () => {
  withTempHome((dir) => {
    saveConfig({ baseUrl: "https://api.deepseek.com" });
    const first = fs.readFileSync(path.join(dir, ".env"), "utf8");
    assert.match(first, /^BASE_URL=https:\/\/api\.deepseek\.com$/m);

    saveConfig({ baseUrl: "https://other.example.com", apiKey: "k" });
    const second = fs.readFileSync(path.join(dir, ".env"), "utf8");
    assert.match(second, /^BASE_URL=https:\/\/other\.example\.com$/m);
    assert.match(second, /^API_KEY=k$/m);
  });
});

test("loadConfig reads .env and applies the default model", () => {
  withTempHome((dir) => {
    fs.writeFileSync(path.join(dir, ".env"), "BASE_URL=https://x\nAPI_KEY=k\n");
    const cfg = loadConfig();
    assert.equal(cfg.baseUrl, "https://x");
    assert.equal(cfg.apiKey, "k");
    assert.equal(cfg.model, DEFAULT_MODEL);
  });
});

test("ensureConfigFile creates a template only when missing", () => {
  withTempHome((dir) => {
    assert.ok(ensureConfigFile());
    assert.ok(fs.existsSync(path.join(dir, ".env")));
    assert.equal(ensureConfigFile(), null);
  });
});
