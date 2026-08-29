import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extFromPath,
  extFromUrl,
  imageToDataUrl,
  isHttpUrl,
  mimeFromExt,
} from "./vision.js";

test("isHttpUrl detects http(s) URLs", () => {
  assert.equal(isHttpUrl("https://example.com/a.png"), true);
  assert.equal(isHttpUrl("http://example.com/a.png"), true);
  assert.equal(isHttpUrl("/local/file.png"), false);
  assert.equal(isHttpUrl("C:\\images\\a.png"), false);
});

test("mimeFromExt maps the four supported formats", () => {
  assert.equal(mimeFromExt("jpg"), "image/jpeg");
  assert.equal(mimeFromExt("jpeg"), "image/jpeg");
  assert.equal(mimeFromExt("png"), "image/png");
  assert.equal(mimeFromExt("gif"), "image/gif");
  assert.equal(mimeFromExt("webp"), "image/webp");
  assert.equal(mimeFromExt("bmp"), undefined);
});

test("extFromPath lowercases and strips the dot", () => {
  assert.equal(extFromPath("/a/b/photo.PNG"), "png");
  assert.equal(extFromPath("noext"), "");
});

test("extFromUrl ignores query and fragment", () => {
  assert.equal(extFromUrl("https://x/i.webp?size=1#frag"), "webp");
});

test("imageToDataUrl encodes a local file to a base64 data URL", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vision-mcp-img-"));
  try {
    const p = path.join(dir, "t.png");
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    fs.writeFileSync(p, bytes);

    const { dataUrl, mime, source } = await imageToDataUrl(p);
    assert.equal(mime, "image/png");
    assert.equal(source, "file");
    assert.equal(dataUrl, `data:image/png;base64,${bytes.toString("base64")}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("imageToDataUrl rejects unsupported extensions", async () => {
  await assert.rejects(() => imageToDataUrl("/tmp/whatever.bmp"), /unsupported image format/);
});
