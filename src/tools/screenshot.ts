import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { browserPostScreenshot } from "../browser.js";
import { loadConfig } from "../config.js";

const DEFAULT_VIEWPORT_WIDTH = 1280;
const DEFAULT_VIEWPORT_HEIGHT = 900;

function safeFilePart(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 100) || "post"
  );
}

function withPngExtension(path: string): string {
  return path.toLowerCase().endsWith(".png") ? path : `${path}.png`;
}

function defaultOutputPath(postSlug: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(
    process.cwd(),
    "skool-screenshots",
    `${timestamp}-${safeFilePart(postSlug)}.png`,
  );
}

function resolveOutputPath(outputPath: string | undefined, postSlug: string): string {
  return resolve(withPngExtension(outputPath?.trim() || defaultOutputPath(postSlug)));
}

export const postScreenshotTool = {
  name: "skool_post_screenshot",
  description:
    "Capture a contextual PNG screenshot of a Skool post using the configured auth cookies. Saves a viewport or full-page screenshot and returns the saved path.",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    postSlug: z.string().min(1).describe("Post slug from the URL (e.g. 'mi-avatar-esta-listo')"),
    outputPath: z.string().optional().describe("Output PNG path. If omitted, saves under the current working directory."),
    fullPage: z.boolean().default(false).describe("Capture the full page instead of the current viewport."),
    viewportWidth: z.number().int().min(320).max(3840).default(DEFAULT_VIEWPORT_WIDTH).describe("Browser viewport width in pixels."),
    viewportHeight: z.number().int().min(480).max(4000).default(DEFAULT_VIEWPORT_HEIGHT).describe("Browser viewport height in pixels."),
  },
  async handler(args: {
    community?: string;
    postSlug: string;
    outputPath?: string;
    fullPage?: boolean;
    viewportWidth?: number;
    viewportHeight?: number;
  }) {
    const config = await loadConfig();
    const community = (args.community ?? config.defaultCommunity).trim();
    const postSlug = args.postSlug.trim();

    if (!community) throw new Error("No community specified and no defaultCommunity in config");
    if (!postSlug) throw new Error("postSlug is required");

    const outputPath = resolveOutputPath(args.outputPath, postSlug);
    await mkdir(dirname(outputPath), { recursive: true });

    const result = await browserPostScreenshot({
      community,
      postSlug,
      outputPath,
      fullPage: args.fullPage ?? false,
      viewportWidth: args.viewportWidth ?? DEFAULT_VIEWPORT_WIDTH,
      viewportHeight: args.viewportHeight ?? DEFAULT_VIEWPORT_HEIGHT,
    });

    return JSON.stringify(result, null, 2);
  },
};
