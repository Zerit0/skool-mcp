import { chromium, type BrowserContextOptions } from "playwright";
import { loadConfig } from "./config.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function buildContext(options: { viewportWidth?: number; viewportHeight?: number } = {}) {
  const config = await loadConfig();

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

export async function browserPostScreenshot(args: {
  community: string;
  postSlug: string;
  outputPath: string;
  fullPage?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
}): Promise<BrowserPostScreenshotResult> {
  const { browser, context } = await buildContext({
    viewportWidth: args.viewportWidth,
    viewportHeight: args.viewportHeight,
  });
  const page = await context.newPage();
  const fullPage = args.fullPage ?? false;
  const url = `https://www.skool.com/${args.community}/${args.postSlug}`;

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
}): Promise<string> {
  const { browser, context } = await buildContext();
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
    await page.goto(
      `https://www.skool.com/${args.community}/${args.postSlug}`,
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
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
}): Promise<string> {
  const { browser, context } = await buildContext();
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
    await page.goto(
      `https://www.skool.com/${args.community}/${args.postSlug}`,
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
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
