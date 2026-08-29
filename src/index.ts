import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  DEFAULT_MODEL,
  DEFAULT_BASE_URL,
  configPath,
  ensureConfigFile,
  loadConfig,
  saveConfig,
} from "./config.js";
import { DEFAULT_PROMPT, describeImage, imageToDataUrl } from "./vision.js";

const VERSION = "1.0.0";

function configMissingMessage(): string {
  return [
    "vision-mcp is not configured yet. Set your API credentials before describing images.",
    "",
    "Options:",
    "  1. Call the `configure` tool with { apiKey }.",
    `  2. Edit the config file at ${configPath()} and restart.`,
    "",
    "Required: API_KEY.",
  ].join("\n");
}

async function main(): Promise<void> {
  const created = ensureConfigFile();
  if (created) {
    console.error(
      `[vision-mcp] Created a default config file at ${created}. ` +
        `Set API_KEY there, or call the \`configure\` tool.`,
    );
  }

  const server = new McpServer({ name: "vision-mcp", version: VERSION });

  server.registerTool(
    "describe_image",
    {
      description:
        "Convert an image (JPEG, PNG, GIF or WebP) into a text description using a vision model. " +
        "The image may be a local absolute file path or an http(s) URL.",
      inputSchema: {
        image: z
            .string()
            .describe("Local absolute file path or http(s) URL of the image."),
        prompt: z
          .string()
          .optional()
          .describe(`Optional question or instruction about the image. Defaults to "${DEFAULT_PROMPT}".`),
      },
    },
    async ({ image, prompt }) => {
      try {
        const cfg = loadConfig();
        if (!cfg.apiKey) {
          return { content: [{ type: "text", text: configMissingMessage() }], isError: true };
        }
        const encoded = await imageToDataUrl(image);
        const text = await describeImage(
          { baseUrl: cfg.baseUrl ?? DEFAULT_BASE_URL, apiKey: cfg.apiKey, model: cfg.model  ?? DEFAULT_MODEL },
          encoded.dataUrl,
          prompt,
        );
        return { content: [{ type: "text", text }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `[vision-mcp] ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "configure",
    {
      description:
        "Save or update the vision-mcp configuration (baseUrl, apiKey, model) to the .env file.",
      inputSchema: {
        baseUrl: z.string().optional().describe("API base URL, Defaults to ${DEFAULT_BASE_URL}."),
        apiKey: z.string().optional().describe("API key for the configured endpoint."),
        model: z.string().optional().describe(`Vision model name. Defaults to ${DEFAULT_MODEL}.`),
      },
    },
    async ({ baseUrl, apiKey, model }) => {
      try {
        const saved = saveConfig({ baseUrl, apiKey, model });
        return {
          content: [
            {
              type: "text",
              text: [
                `Configuration saved to ${saved.path}`,
                `baseUrl: ${saved.baseUrl}`,
                `model: ${saved.model}`,
                `apiKey: ${saved.apiKeySet ? "******** (saved)" : "(not set)"}`,
              ].join("\n"),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `[vision-mcp] ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[vision-mcp] fatal:", err);
  process.exit(1);
});
