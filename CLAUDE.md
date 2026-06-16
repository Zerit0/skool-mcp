# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An MCP (Model Context Protocol) server that provides programmatic access to Skool.com communities. Since Skool has no public API, this server reverse-engineers Skool's internal Next.js frontend and `api2.skool.com` REST endpoints, supplemented by Playwright browser automation for operations that require a real browser session.

## Commands

```bash
npm run build   # Compile TypeScript → dist/
npm run dev     # Run directly with tsx (no build step needed for development)
npm start       # Run the compiled server
```

There are no test or lint scripts defined yet.

## Architecture

### Tool Pattern

Every tool is a plain object exported from `src/tools/`:

```typescript
export const myTool = {
  name: "skool_my_tool",
  description: "...",
  inputSchema: { field: z.string().describe("...") },
  async handler(args): Promise<string> { ... }
}
```

`src/index.ts` imports each tool and registers it with `server.tool(name, description, schema, handler)`. All handlers return a plain `string` (JSON-serialized), which `index.ts` wraps in `{ content: [{ type: "text", text }] }` before returning to the MCP client.

### Three-Tier Request Strategy (`src/client.ts`)

1. **`nextDataRequest`** — Read operations. Calls `GET /_next/data/{buildId}/{path}.json`. The `buildId` is a Next.js deploy artifact extracted dynamically from Skool's homepage HTML and cached for 30 minutes in module-level state.

2. **`api2Request`** — Write and admin operations. Calls `https://api2.skool.com` REST endpoints. Requires `Origin: https://www.skool.com` and `Referer` headers in addition to cookies.

3. **`rawRequest`** — Generic discovery. Used only by the `skool_request` tool for exploring unknown endpoints.

When adding a new read operation, prefer `nextDataRequest`. For mutations (create, approve, reject, vote), prefer `api2Request`.

### Browser Automation (`src/browser.ts`)

Playwright is used for three things that can't go through HTTP:

- **Comment/reply posting** (`browserPostComment`, `browserReplyComment`) — Skool's comment flow is browser-only and WAF-protected.
- **Screenshots** (`browserPostScreenshot`) — Renders a post page in an authenticated headless browser.
- **Video discovery** (`browserDiscoverVideos`) — Intercepts network requests and parses `__NEXT_DATA__` to extract embedded video metadata.

Browser functions receive cookies from `loadConfig()` and inject them via Playwright's `context.addCookies()`.

### Configuration (`src/config.ts`)

Config is loaded from `~/.config/skool-mcp/config.json` (or `$SKOOL_MCP_CONFIG`). Two formats are supported:

**Multi-account (preferred):**
```json
{
  "accounts": {
    "main": { "cookies": "auth_token=...", "defaultCommunity": "my-community" }
  },
  "defaultAccount": "main",
  "baseUrl": "https://www.skool.com"
}
```

**Legacy single-account:**
```json
{ "cookies": "auth_token=...", "defaultCommunity": "my-community", "baseUrl": "https://www.skool.com" }
```

The config is cached in memory after the first load. `loadConfig(account?)` accepts an optional account name to select a non-default account — tool input schemas can expose an `account` parameter for this.

### URL Safety (`src/urlSafety.ts`)

`assertAllowedSkoolUrl(url)` is called on every URL before any network request. It throws if the URL is not `https://www.skool.com` or `https://api2.skool.com`. All new HTTP requests must pass through this function.

### Response Shape Conventions

- `nextDataRequest` responses follow camelCase (Next.js convention).
- `api2Request` responses follow snake_case.
- All tool handlers serialize their return value to a JSON string with `JSON.stringify(result, null, 2)`.

### Adding a New Tool

1. Create `src/tools/mytool.ts` following the tool object pattern above.
2. Use Zod for all input fields; add `.describe()` to each field.
3. Choose the appropriate client function (`nextDataRequest` / `api2Request` / browser automation).
4. Import and register in `src/index.ts`.
