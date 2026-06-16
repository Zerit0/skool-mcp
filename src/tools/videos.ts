import { z } from "zod";
import { browserDiscoverVideos } from "../browser.js";

export const videoDiscoverTool = {
  name: "skool_video_discover",
  description:
    "Discover video embeds and streaming candidates on a Skool page. Detects likely Skool native/Mux, Loom, Vimeo, YouTube, and Wistia sources. This only discovers sources; it does not download videos.",
  inputSchema: {
    url: z.string().url().describe("Full Skool page URL to inspect. Must be https://www.skool.com/..."),
    pressPlay: z.boolean().default(false).describe("Try to click a visible play button before collecting network signals."),
    includeUrls: z.boolean().default(false).describe("Return full detected URLs. Defaults false to avoid exposing signed media tokens."),
    waitMs: z.number().int().min(1000).max(30000).default(5000).describe("Milliseconds to wait after load/play for embeds and network requests."),
  },
  async handler(args: {
    url: string;
    pressPlay?: boolean;
    includeUrls?: boolean;
    waitMs?: number;
  }) {
    const result = await browserDiscoverVideos({
      url: args.url,
      pressPlay: args.pressPlay ?? false,
      includeUrls: args.includeUrls ?? false,
      waitMs: args.waitMs ?? 5000,
    });

    return JSON.stringify(result, null, 2);
  },
};
