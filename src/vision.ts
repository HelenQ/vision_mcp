import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const DEFAULT_PROMPT = "What is in this image?";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export const SUPPORTED_MIMES: ReadonlySet<string> = new Set(Object.values(MIME_BY_EXT));

export function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

export function extFromPath(filePath: string): string {
  return path.extname(filePath).toLowerCase().replace(/^\./, "");
}

export function extFromUrl(url: string): string {
  const { pathname } = new URL(url);
  return path.extname(pathname).toLowerCase().replace(/^\./, "");
}

export function mimeFromExt(ext: string): string | undefined {
  return MIME_BY_EXT[ext];
}

export interface EncodedImage {
  dataUrl: string;
  mime: string;
  source: "file" | "url";
}

/** Read a local file or download a URL and encode it as a base64 data URL. */
export async function imageToDataUrl(input: string): Promise<EncodedImage> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("image must be a non-empty path or URL");

  if (isHttpUrl(trimmed)) {
    let response: Response;
    try {
      response = await fetch(trimmed);
    } catch {
      throw new Error(`failed to download image: ${trimmed}`);
    }
    if (!response.ok) {
      throw new Error(`failed to download image: HTTP ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    let mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!SUPPORTED_MIMES.has(mime)) {
      mime = mimeFromExt(extFromUrl(trimmed)) ?? "";
    }
    if (!mime) throw new Error("unsupported image type (expected JPEG, PNG, GIF or WebP)");
    return { dataUrl: `data:${mime};base64,${buffer.toString("base64")}`, mime, source: "url" };
  }

  const ext = extFromPath(trimmed);
  const mime = mimeFromExt(ext);
  if (!mime) {
    throw new Error(`unsupported image format ".${ext || "(none)"}" (expected JPEG, PNG, GIF or WebP)`);
  }
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(trimmed);
  } catch {
    throw new Error(`cannot read image file: ${trimmed}`);
  }
  return { dataUrl: `data:${mime};base64,${buffer.toString("base64")}`, mime, source: "file" };
}

export interface VisionRequestConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const CACHE_DIR = path.join(os.tmpdir(), "vision_mcp_cache");

function cacheFileName(dataUrl: string): string {
  return createHash("sha256").update(dataUrl).digest("hex");
}

/** Call an OpenAI-compatible chat.completions endpoint with an image and return the text description. */
export async function describeImage(
  cfg: VisionRequestConfig,
  dataUrl: string,
  prompt?: string,
): Promise<string> {
  const cacheFile = path.join(CACHE_DIR, cacheFileName(dataUrl));
  try {
    return await fs.readFile(cacheFile, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[vision-mcp] failed to read cache: ${(err as Error).message}`);
    }
    // cache miss or unreadable cache — fall through to the API
  }

  const endpoint = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt?.trim() || DEFAULT_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API request failed (HTTP ${response.status}): ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("API response contained no description");

  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, content, "utf8");
  } catch {
    // cache is best-effort — ignore write failures
  }

  return content;
}
