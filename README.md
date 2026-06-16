# Skool MCP Server

An MCP (Model Context Protocol) server for interacting with Skool.com communities.

## Overview

Skool does not expose a public API, so this MCP uses authenticated requests to the
Skool web app and internal API endpoints.

Current capabilities include:

- Reading community, post, member, notification, and Classroom data.
- Creating posts and comments.
- Replying to comments through Playwright when browser interaction is needed.
- Giving or removing a thumbUp/thumbs-up/like on posts and comments.
- Capturing screenshots of Skool posts.
- Discovering video sources on Skool pages, including Skool native/Mux metadata.

## Setup

### 1. Install And Build

```bash
cd /path/to/skool-mcp
npm install
npm run build
```

### 2. Configure Skool Auth

By default the server looks for `~/.config/skool-mcp/config.json`. You can
override the path with the `SKOOL_MCP_CONFIG` environment variable:

```bash
export SKOOL_MCP_CONFIG=/custom/path/config.json
```

Create the config file at the chosen location.

Single-account format:

```json
{
  "cookies": "auth_token=YOUR_JWT_HERE",
  "defaultCommunity": "sim-club",
  "baseUrl": "https://www.skool.com"
}
```

Multi-account format:

```json
{
  "defaultAccount": "main",
  "baseUrl": "https://www.skool.com",
  "accounts": {
    "main": {
      "cookies": "auth_token=YOUR_JWT_HERE",
      "defaultCommunity": "sim-club"
    }
  }
}
```

To get cookies, open Skool in Chrome, then DevTools, Application, Cookies, and
copy the `auth_token` value. The cookie string should be:

```text
auth_token=YOUR_JWT_HERE
```

## MCP Configuration

Add the server to your MCP client configuration:

```json
{
  "mcpServers": {
    "skool": {
      "command": "node",
      "args": ["/path/to/skool-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

## Authentication

The MCP uses session cookies from an authenticated Skool session. Keep the config
file private because the `auth_token` acts as your logged-in Skool session.

Most tools accept an optional `account` parameter. If omitted, the MCP uses
`defaultAccount` in multi-account mode or the legacy top-level config.

## Security

Outbound Skool URL access is restricted.

Allowed hosts:

- `https://www.skool.com`
- `https://api2.skool.com`

The MCP blocks:

- Non-HTTPS URLs.
- Non-Skool hosts.
- URLs containing embedded username/password credentials.

This is especially important for `skool_request` and browser-backed tools that
open a page URL.

## Tools

### Discovery

- `skool_request`: Make an authenticated HTTP request to an allowed Skool URL.
  Useful for API discovery and debugging. Only `www.skool.com` and
  `api2.skool.com` are permitted.

### Community

- `skool_community_info`: Get community details, including name, description,
  member count, and settings.
- `skool_community_labels`: Get category labels for a community from
  `api2.skool.com`.

### Members

- `skool_members_list`: List community members with pagination.
- `skool_members_pending`: List pending membership requests.
- `skool_members_approve`: Approve a pending member. Requires admin/moderator
  access.
- `skool_members_reject`: Reject a pending member. Requires admin/moderator
  access.

### Posts And Comments

- `skool_posts_list`: List posts in a community feed. Supports category,
  pagination, and sort order.
- `skool_posts_get`: Get a specific post with full content and comments.
- `skool_posts_create`: Create a new post in a community.
- `skool_posts_comment`: Add a top-level comment or reply to a comment using
  Playwright. This helps bypass WAF/browser-only flows.
- `skool_posts_vote`: Give or remove a thumbUp/thumbs-up/like on a post or comment.

`skool_posts_vote` is state-aware: it checks the current vote before acting so
it does not accidentally toggle an existing like off.

Use:

```json
{
  "postId": "POST_OR_COMMENT_UUID",
  "groupId": "GROUP_UUID",
  "vote": "up"
}
```

To remove your like:

```json
{
  "postId": "POST_OR_COMMENT_UUID",
  "groupId": "GROUP_UUID",
  "vote": ""
}
```

### Screenshots

- `skool_post_screenshot`: Capture a PNG screenshot of a Skool post using the
  configured auth cookies. Supports viewport screenshots and full-page
  screenshots.

Example:

```json
{
  "community": "sim-club",
  "postSlug": "nike-x-river-plate-reto-sim30-semana-2",
  "fullPage": false,
  "viewportWidth": 1280,
  "viewportHeight": 900
}
```

### Videos

- `skool_video_discover`: Discover video embeds and streaming candidates on a
  Skool page.

It can detect likely:

- Skool native/Mux videos.
- Loom embeds.
- Vimeo embeds.
- YouTube embeds.
- Wistia embeds.

The tool discovers sources only. It does not download videos.

By default, full media URLs are redacted because Skool/Mux URLs can contain
temporary signed tokens.

Example:

```json
{
  "url": "https://www.skool.com/sim-club/classroom/52c2b79b?md=be8edbb90c004ebdbc27b83ccb16196d",
  "pressPlay": true,
  "includeUrls": false,
  "waitMs": 5000
}
```

Typical result shape:

```json
{
  "pageType": "classroom",
  "providerSummary": {
    "skool-native": 1
  },
  "videos": [
    {
      "provider": "skool-native",
      "sourceType": "metadata",
      "host": "stream.mux.com",
      "durationMs": 310766,
      "redactedUrl": "https://stream.mux.com/VIDEO_PLAYBACK_ID.m3u8"
    }
  ]
}
```

Use `includeUrls: true` only when you explicitly need full signed URLs and are
comfortable handling temporary media tokens.

### Classroom

- `skool_courses_list`: List courses in a community Classroom.
- `skool_lessons_list`: List lessons/modules in a specific course.

### Notifications

- `skool_notifications`: Get recent notifications.

## API Notes

- Read operations mostly use Next.js data routes (`/_next/data/{buildId}/...`).
  The `buildId` is fetched dynamically.
- Write operations use `api2.skool.com` endpoints where available.
- Some comment and screenshot flows use Playwright because Skool behavior can be
  browser-dependent.
- A `User-Agent` header is required because CloudFront blocks bare requests with
  403 responses.
- See `API-DISCOVERY.md` for endpoint notes and response shapes when available.
