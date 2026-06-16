import { chromium, type BrowserContextOptions, type Page } from "playwright";
import { loadConfig } from "./config.js";
import { assertAllowedSkoolPageUrl, buildSkoolPostUrl } from "./urlSafety.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function buildContext(options: { viewportWidth?: number; viewportHeight?: number; account?: string } = {}) {
  const config = await loadConfig(options.account);

  const cookies = config.cookies
    .split(";")
    .map((c: string) => c.trim())
    .filter(Boolean)
    .map((c: string) => {
      const idx = c.indexOf("=");
      return {
        name: c.slice(0, idx).trim(),
        value: c.slice(idx + 1).trim(),
        domain: ".skool.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "Lax" as const,
      };
    });

  const browser = await chromium.launch({ headless: true });
  const contextOptions: BrowserContextOptions = { userAgent: USER_AGENT };
  if (options.viewportWidth || options.viewportHeight) {
    contextOptions.viewport = {
      width: options.viewportWidth ?? 1280,
      height: options.viewportHeight ?? 720,
    };
  }

  const context = await browser.newContext(contextOptions);
  await context.addCookies(cookies);
  return { browser, context };
}

export interface BrowserPostScreenshotResult {
  success: boolean;
  path: string;
  url: string;
  postSlug: string;
  fullPage: boolean;
}

type VideoProvider = "skool-native" | "loom" | "vimeo" | "youtube" | "wistia" | "unknown";
type VideoSourceType = "iframe" | "video" | "source" | "network" | "metadata";

export interface BrowserVideoCandidate {
  provider: VideoProvider;
  sourceType: VideoSourceType;
  host: string;
  url?: string;
  redactedUrl?: string;
  id?: string;
  mimeType?: string;
  durationMs?: number;
}

export interface BrowserVideoDiscoverResult {
  pageUrl: string;
  pageType: "classroom" | "community-post" | "about" | "unknown";
  providerSummary: Record<string, number>;
  videos: BrowserVideoCandidate[];
  notes: string[];
}

function inferPageType(url: URL): BrowserVideoDiscoverResult["pageType"] {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.includes("classroom")) return "classroom";
  if (parts.includes("about")) return "about";
  if (parts.length >= 2) return "community-post";
  return "unknown";
}

function summarizeUrl(value: string, includeUrls: boolean): Pick<BrowserVideoCandidate, "url" | "redactedUrl"> {
  if (includeUrls) return { url: value };
  try {
    const url = new URL(value);
    return { redactedUrl: `${url.origin}${url.pathname}` };
  } catch {
    return { redactedUrl: value.startsWith("blob:") ? "blob:" : value.slice(0, 120) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function classifyVideoUrl(value: string): { provider: VideoProvider; host: string; id?: string } {
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    return { provider: value.startsWith("blob:") ? "skool-native" : "unknown", host: "" };
  }

  const host = url.hostname.toLowerCase();
  const text = value.toLowerCase();

  if (host.includes("loom.com")) {
    const id = value.match(/(?:share|embed)\/([a-z0-9-]+)/i)?.[1];
    return { provider: "loom", host, id };
  }
  if (host.includes("vimeo.com") || host.includes("vimeocdn.com")) {
    const id = value.match(/video\/(\d+)/i)?.[1];
    return { provider: "vimeo", host, id };
  }
  if (host.includes("youtube.com") || host.includes("youtube-nocookie.com") || host === "youtu.be") {
    const id = value.match(/(?:embed\/|watch\?v=|youtu\.be\/)([a-z0-9_-]+)/i)?.[1];
    return { provider: "youtube", host, id };
  }
  if (host.includes("wistia.com") || host.includes("wistia.net") || host === "wi.st") {
    const id = value.match(/(?:iframe|medias)\/([a-z0-9]+)/i)?.[1] ?? url.searchParams.get("wvideo") ?? undefined;
    return { provider: "wistia", host, id };
  }
  if (
    host === "video.skool.com" ||
    host.endsWith(".video.skool.com") ||
    host.includes("mux.com") ||
    text.includes(".m3u8") ||
    text.includes("application/x-mpegurl")
  ) {
    return { provider: "skool-native", host };
  }

  return { provider: "unknown", host };
}

function addVideoCandidate(
  candidates: BrowserVideoCandidate[],
  seen: Set<string>,
  sourceType: VideoSourceType,
  rawUrl: string,
  includeUrls: boolean,
  mimeType?: string,
) {
  const value = rawUrl.trim();
  if (!value || seen.has(`${sourceType}:${value}`)) return;

  const classified = classifyVideoUrl(value);
  const isVideoElement = sourceType === "video" || sourceType === "source" || mimeType?.toLowerCase().startsWith("video/");
  if (classified.provider === "unknown" && !isVideoElement) return;

  seen.add(`${sourceType}:${value}`);
  candidates.push({
    provider: classified.provider,
    sourceType,
    host: classified.host,
    id: classified.id,
    mimeType,
    ...summarizeUrl(value, includeUrls),
  });
}

function addSkoolNativeCandidate(
  candidates: BrowserVideoCandidate[],
  seen: Set<string>,
  args: {
    id?: string;
    playbackId?: string;
    playbackToken?: string;
    thumbnailUrl?: string;
    includeUrls: boolean;
    durationMs?: number;
  },
) {
  const id = args.playbackId || args.id;
  if (!id) return;

  const key = `metadata:skool-native:${id}`;
  if (seen.has(key)) return;
  seen.add(key);

  const redactedStreamUrl = args.playbackId ? `https://stream.mux.com/${args.playbackId}.m3u8` : undefined;
  const streamUrl = args.playbackId && args.playbackToken
    ? `${redactedStreamUrl}?token=${args.playbackToken}`
    : undefined;
  const redactedThumbnail = args.thumbnailUrl ? summarizeUrl(args.thumbnailUrl, false).redactedUrl : undefined;

  candidates.push({
    provider: "skool-native",
    sourceType: "metadata",
    host: args.playbackId ? "stream.mux.com" : "video.skool.com",
    id,
    durationMs: args.durationMs,
    ...(args.includeUrls && streamUrl
      ? { url: streamUrl }
      : { redactedUrl: redactedStreamUrl ?? redactedThumbnail }),
  });
}

function addAttachmentVideoCandidates(
  candidates: BrowserVideoCandidate[],
  seen: Set<string>,
  attachmentData: string,
  includeUrls: boolean,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(attachmentData);
  } catch {
    return;
  }

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isRecord(value)) return;

    const metadata = isRecord(value.metadata) ? value.metadata : {};
    const contentType =
      asString(value.content_type) ??
      asString(value.contentType) ??
      asString(metadata.content_type) ??
      asString(metadata.contentType);
    const readUrl =
      asString(value.read_url) ??
      asString(value.readUrl) ??
      asString(value.url) ??
      asString(value.src) ??
      asString(metadata.read_url) ??
      asString(metadata.readUrl) ??
      asString(metadata.url) ??
      asString(metadata.src);
    const attachmentId = asString(value.id) ?? asString(metadata.id);
    const isVideoContent = contentType?.toLowerCase().startsWith("video/") ?? false;

    if (attachmentId && isVideoContent) {
      addSkoolNativeCandidate(candidates, seen, { id: attachmentId, includeUrls });
    }
    if (readUrl && (isVideoContent || classifyVideoUrl(readUrl).provider !== "unknown")) {
      addVideoCandidate(candidates, seen, "metadata", readUrl, includeUrls, contentType);
    }

    for (const nested of Object.values(value)) {
      if (Array.isArray(nested) || isRecord(nested)) visit(nested);
    }
  };

  visit(parsed);
}

function addSkoolMetadataCandidates(
  candidates: BrowserVideoCandidate[],
  seen: Set<string>,
  metadata: { video: unknown; postMetadata: unknown },
  includeUrls: boolean,
) {
  if (isRecord(metadata.video)) {
    addSkoolNativeCandidate(candidates, seen, {
      id: asString(metadata.video.id),
      playbackId: asString(metadata.video.playbackId),
      playbackToken: asString(metadata.video.playbackToken),
      durationMs: asNumber(metadata.video.duration),
      includeUrls,
    });
  }

  if (!isRecord(metadata.postMetadata)) return;

  const imagePreview =
    asString(metadata.postMetadata.imagePreview) ??
    asString(metadata.postMetadata.imagePreviewSmall);
  const videoIds = asString(metadata.postMetadata.videoIds)
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

  for (const id of videoIds) {
    addSkoolNativeCandidate(candidates, seen, {
      id,
      thumbnailUrl: imagePreview,
      includeUrls,
    });
  }

  const attachmentsData = asString(metadata.postMetadata.attachmentsData);
  if (attachmentsData) {
    addAttachmentVideoCandidates(candidates, seen, attachmentsData, includeUrls);
  }
}

async function clickLikelyPlayButton(page: Page) {
  const selectors = [
    "button[aria-label*='play' i]",
    "[role='button'][aria-label*='play' i]",
    "button:has-text('Play')",
    "button:has-text('▶')",
  ];

  for (const selector of selectors) {
    const target = page.locator(selector).first();
    if (await target.isVisible().catch(() => false)) {
      await target.click().catch(() => undefined);
      return;
    }
  }
}

export async function browserDiscoverVideos(args: {
  url: string;
  includeUrls?: boolean;
  pressPlay?: boolean;
  waitMs?: number;
}): Promise<BrowserVideoDiscoverResult> {
  const pageUrl = assertAllowedSkoolPageUrl(args.url);
  const includeUrls = args.includeUrls ?? false;
  const waitMs = Math.min(Math.max(args.waitMs ?? 5000, 1000), 30000);
  const candidates: BrowserVideoCandidate[] = [];
  const seen = new Set<string>();
  const { browser, context } = await buildContext({ account: undefined });
  const page = await context.newPage();

  page.on("request", (req) => {
    const url = req.url();
    if (/\.(m3u8|mp4|webm)(?:[?#]|$)/i.test(url) || /(?:vimeo|loom|youtube|youtu\.be|wistia|mux)/i.test(url)) {
      addVideoCandidate(candidates, seen, "network", url, includeUrls);
    }
  });

  try {
    await page.goto(pageUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("body", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

    if (args.pressPlay) {
      await clickLikelyPlayButton(page);
    }

    await page.waitForTimeout(waitMs);

    const skoolMetadata = await page.evaluate(() => {
      const pageProps = (window as typeof window & {
        __NEXT_DATA__?: {
          props?: {
            pageProps?: Record<string, unknown>;
          };
        };
      }).__NEXT_DATA__?.props?.pageProps;
      const postTree = pageProps?.postTree as { post?: { metadata?: unknown } } | undefined;
      return {
        video: pageProps?.video ?? null,
        postMetadata: postTree?.post?.metadata ?? null,
      };
    });
    addSkoolMetadataCandidates(candidates, seen, skoolMetadata, includeUrls);

    const domSources = await page.evaluate(() => {
      const iframeSources = Array.from(document.querySelectorAll("iframe"))
        .map((node) => ({ sourceType: "iframe" as const, url: node.src, mimeType: node.getAttribute("type") ?? undefined }));
      const videoSources = Array.from(document.querySelectorAll("video"))
        .flatMap((node) => {
          const values = [];
          if (node.currentSrc) values.push({ sourceType: "video" as const, url: node.currentSrc, mimeType: node.getAttribute("type") ?? undefined });
          if (node.src) values.push({ sourceType: "video" as const, url: node.src, mimeType: node.getAttribute("type") ?? undefined });
          return values;
        });
      const sourceSources = Array.from(document.querySelectorAll("source"))
        .map((node) => ({ sourceType: "source" as const, url: node.src, mimeType: node.type || undefined }));
      return [...iframeSources, ...videoSources, ...sourceSources];
    });

    for (const source of domSources) {
      addVideoCandidate(candidates, seen, source.sourceType, source.url, includeUrls, source.mimeType);
    }

    const providerSummary = candidates.reduce<Record<string, number>>((acc, candidate) => {
      acc[candidate.provider] = (acc[candidate.provider] ?? 0) + 1;
      return acc;
    }, {});

    return {
      pageUrl: pageUrl.toString(),
      pageType: inferPageType(pageUrl),
      providerSummary,
      videos: candidates,
      notes: [
        "Discovery only; download/extraction is not implemented in this MCP tool.",
        "Full URLs are redacted by default because signed media URLs can contain temporary tokens.",
      ],
    };
  } finally {
    await browser.close();
  }
}

export async function browserPostScreenshot(args: {
  community: string;
  postSlug: string;
  outputPath: string;
  fullPage?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
  account?: string;
}): Promise<BrowserPostScreenshotResult> {
  const { browser, context } = await buildContext({
    viewportWidth: args.viewportWidth,
    viewportHeight: args.viewportHeight,
    account: args.account,
  });
  const page = await context.newPage();
  const fullPage = args.fullPage ?? false;
  const url = buildSkoolPostUrl(args.community, args.postSlug);

  page.on("download", (download) => {
    void download.cancel().catch(() => undefined);
  });

  await page.route("**/*", (route) => {
    if (route.request().resourceType() === "media") {
      return route.abort();
    }
    return route.continue();
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("body", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: args.outputPath,
      fullPage,
      type: "png",
      animations: "disabled",
      caret: "hide",
      timeout: 60000,
    });

    return {
      success: true,
      path: args.outputPath,
      url,
      postSlug: args.postSlug,
      fullPage,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Post a top-level comment on a Skool post via browser.
 *
 * - If mentionCreator is true: types "@" and waits for the creator-suggestion
 *   dropdown (Skool surfaces only the post author when no query is typed),
 *   then selects the first option.
 * - content is appended after the mention (or alone if mentionCreator=false).
 *
 * Returns the raw API response body captured from the network.
 */
export async function browserPostComment(args: {
  community: string;
  postSlug: string;
  content: string;
  mentionCreator?: boolean;
  account?: string;
}): Promise<string> {
  const { browser, context } = await buildContext({ account: args.account });
  const page = await context.newPage();

  let capturedBody = "";
  page.on("request", (req) => {
    if (
      req.url().includes("api2.skool.com/posts") &&
      req.method() === "POST"
    ) {
      capturedBody = req.postData() ?? "";
    }
  });

  try {
    await page.goto(buildSkoolPostUrl(args.community, args.postSlug), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(5000);

    // Click the main comment box (first/only contenteditable before any reply box opens)
    const commentBox = page.locator("div[contenteditable='true']").last();
    await commentBox.scrollIntoViewIfNeeded();
    await commentBox.click();
    await page.waitForTimeout(400);

    if (args.mentionCreator !== false) {
      // Type "@" and wait for Skool to surface the post creator in the dropdown
      await page.keyboard.type("@");
      await page.waitForTimeout(2500);

      // Select the first suggestion (always the post creator when no name typed)
      const suggestion = page
        .locator('[class*="suggestion"]')
        .filter({ hasText: "@" })
        .locator("..")
        .locator('[class*="suggestion"]')
        .nth(1);

      // Simpler: just grab all suggestion items and click the one that isn't "@"
      const suggestions = page.locator('[class*="suggestion"]');
      const count = await suggestions.count();
      let clicked = false;
      for (let i = 0; i < count; i++) {
        const text = await suggestions.nth(i).textContent().catch(() => "");
        if (text && text.trim() !== "@" && text.trim().length > 1) {
          await suggestions.nth(i).click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        // Fallback: keyboard ArrowDown + Enter
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(300);
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(300);
    }

    await page.keyboard.type(` ${args.content}`);
    await page.waitForTimeout(600);

    // Click the COMMENT submit button
    const submitBtn = page
      .locator("button")
      .filter({ hasText: /^COMMENT$|^Comment$/ })
      .first();
    if ((await submitBtn.count()) > 0) {
      await submitBtn.click();
    } else {
      await page.keyboard.press("Control+Enter");
    }
    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }

  return capturedBody;
}

/**
 * Reply to a specific comment on a Skool post via browser.
 *
 * Finds the comment containing parentCommentSnippet, clicks its Reply button,
 * which auto-fills "@AuthorName" in the inline reply box. Then appends content
 * and submits.
 *
 * Returns the raw API response body captured from the network.
 */
export async function browserReplyComment(args: {
  community: string;
  postSlug: string;
  parentCommentSnippet: string;
  content: string;
  account?: string;
}): Promise<string> {
  const { browser, context } = await buildContext({ account: args.account });
  const page = await context.newPage();

  let capturedBody = "";
  page.on("request", (req) => {
    if (
      req.url().includes("api2.skool.com/posts") &&
      req.method() === "POST"
    ) {
      capturedBody = req.postData() ?? "";
    }
  });

  try {
    await page.goto(buildSkoolPostUrl(args.community, args.postSlug), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(5000);

    // Find the parent comment and click its Reply button
    const parentEl = page.locator(`text=${args.parentCommentSnippet}`).first();
    await parentEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    const parentBox = await parentEl.boundingBox();
    if (!parentBox) throw new Error("Parent comment not found on page");

    await parentEl.hover();
    await page.waitForTimeout(400);

    // Click the Reply button closest to the parent comment
    const replyBtns = await page.locator("button:has-text('Reply')").all();
    let closest: typeof replyBtns[0] | null = null;
    let closestDist = Infinity;
    for (const btn of replyBtns) {
      const b = await btn.boundingBox().catch(() => null);
      if (!b) continue;
      const dist = Math.abs(b.y - parentBox.y);
      if (dist < closestDist) { closestDist = dist; closest = btn; }
    }
    if (!closest) throw new Error("Reply button not found near parent comment");
    await closest.click();
    await page.waitForTimeout(2000);

    // Find the inline reply box that appeared just below the parent comment
    const allBoxes = await page.locator("div[contenteditable='true']").all();
    let replyBox: typeof allBoxes[0] | null = null;
    let nearestDist = Infinity;
    for (const box of allBoxes) {
      const b = await box.boundingBox().catch(() => null);
      if (!b) continue;
      const diff = b.y - parentBox.y;
      if (diff > 0 && diff < nearestDist) { nearestDist = diff; replyBox = box; }
    }
    if (!replyBox) throw new Error("Reply input box not found");

    // Click at end of box (after auto-filled @mention) and type content
    await replyBox.click();
    await page.keyboard.press("End");
    await page.waitForTimeout(200);
    await page.keyboard.type(` ${args.content}`);
    await page.waitForTimeout(600);

    // Click the REPLY submit button (must be below the reply box)
    const replyBoxBounds = await replyBox.boundingBox();
    const allBtns = await page.locator("button").all();
    let submitBtn: typeof allBtns[0] | null = null;
    let submitDist = Infinity;
    for (const btn of allBtns) {
      const b = await btn.boundingBox().catch(() => null);
      if (!b) continue;
      const text = (await btn.textContent().catch(() => "")) ?? "";
      if (/^REPLY$/i.test(text.trim()) && replyBoxBounds && b.y > replyBoxBounds.y) {
        const dist = b.y - replyBoxBounds.y;
        if (dist < submitDist) { submitDist = dist; submitBtn = btn; }
      }
    }
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press("Control+Enter");
    }
    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }

  return capturedBody;
}
