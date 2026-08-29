# vision-mcp

一个 MCP Server，把图片（JPEG / PNG / GIF / WebP）转换为文本描述。基于 OpenAI 兼容的视觉模型接口（默认 DeepSeek 的 `deepseek-v4-flash-vision-exp`）。

## 功能

- **`describe_image`** — 输入图片（本地绝对路径或 http(s) URL），返回文本描述。
- **`configure`** — 保存 / 更新 `baseUrl` / `apiKey` / `model` 到 `.env` 文件。
- **首次使用自动配置** — 首次启动时若 `.env` 不存在，会自动生成模板并在日志中提示。

## 安装与运行

```bash
npm install
npm run build
npx .        # 在项目目录内运行（走 package.json 的 bin）
# 或
npm start    # 等价于 node dist/index.js
```

发布到 npm 后可直接：

```bash
npx vision-mcp
```

## 配置

配置通过 `.env` 文件保存，读取优先级为：**环境变量 > `.env` 文件 > 默认值（仅 model）**。

| 变量 | 说明                                                 | 必填 |
| --- |------------------------------------------------------| --- |
| `BASE_URL` | OpenAI 兼容接口地址，默认 `https://api.deepseek.com` | 否 |
| `API_KEY` | API 密钥                                             | 是 |
| `MODEL` | 视觉模型名，默认 `deepseek-v4-flash-vision-exp`      | 否 |

三种配置方式：

1. **调用 `configure` 工具**（推荐，在 MCP 客户端里调用即可）：
   ```json
   { "apiKey": "sk-..." }
   ```
2. **编辑 `.env` 文件**：首次启动会自动在包目录生成模板，填入后重启即可。
3. **环境变量**：直接设置 `BASE_URL` / `API_KEY` / `MODEL`（优先级最高）。

### `.env` 的位置

默认保存在**包自身目录**下（由 `import.meta.url` 解析到包根目录）。注意：`npx <pkg>` 会把包装进 `~/.npm/_npx/<hash>/...` 缓存，缓存清理后 `.env` 会丢失。

如需固定位置，设置环境变量 `VISION_MCP_HOME`，例如：

```bash
VISION_MCP_HOME="$HOME/.vision-mcp" npx vision-mcp
```

此时 `.env` 会保存为 `~/.vision-mcp/.env`，跨 npx 缓存清理依然保留。

## 工具说明

### `describe_image`

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `image` | string | 本地绝对路径，或 http(s) URL |
| `prompt` | string（可选） | 关于图片的提问/指令，默认 `"What is in this image?"` |

### `configure`

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `baseUrl` | string（可选） | 接口地址 |
| `apiKey` | string（可选） | API 密钥 |
| `model` | string（可选） | 模型名 |

## 接入 Claude Desktop

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "vision-mcp": {
      "command": "npx",
      "args": ["vision-mcp"],
      "env": {
        "VISION_MCP_HOME": "/Users/你的用户名/.vision-mcp"
      }
    }
  }
}
```

本地开发调试时也可直接指向编译产物：

```json
{
  "mcpServers": {
    "vision-mcp": {
      "command": "node",
      "args": ["/绝对路径/vision_mcp/dist/index.js"]
    }
  }
}
```

## 开发

```bash
npm run dev     # 开发模式（tsx 直跑源码）
npm run build   # tsc 编译到 dist/
npm test        # 运行单元测试（node:test + tsx）
```

## 支持的图片格式

JPEG（`jpg`/`jpeg`）、PNG（`png`）、GIF（`gif`）、WebP（`webp`）。本地文件按扩展名识别；URL 优先使用响应的 `content-type`，否则回退到 URL 扩展名。
