import { z } from "zod";
import { nextDataRequest, api2Request } from "../client.js";
import { loadConfig } from "../config.js";
import { browserPostComment, browserReplyComment } from "../browser.js";

const accountParam = z.string().optional().describe("Account name from config (e.g. 'piqueran'). Uses defaultAccount if omitted.");

export const postsListTool = {
  name: "skool_posts_list",
  description:
    "List posts in a community feed. Supports category filtering and pagination. Returns post title, content preview, author, likes, and comment count.",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    category: z.string().optional().describe("Category/label UUID to filter by"),
    page: z.number().default(1).describe("Page number (1-based)"),
    sort: z.enum(["newest-cm", "newest", "top"]).default("newest-cm").describe("Sort order: newest-cm (recent activity), newest (created), top (most liked)"),
    account: accountParam,
  },
  async handler(args: { community?: string; category?: string; page: number; sort: string; account?: string }) {
    const config = await loadConfig(args.account);
    const slug = args.community || config.defaultCommunity;
    if (!slug) throw new Error("No community specified and no defaultCommunity in config");

    const params: Record<string, string> = {
      group: slug,
      p: String(args.page),
      s: args.sort,
    };
    if (args.category) {
      params.c = args.category;
    }

    const data = (await nextDataRequest(`/${slug}`, params, args.account)) as {
      pageProps?: Record<string, unknown>;
    };

    const props = data?.pageProps;
    if (!props) throw new Error("No pageProps in response");

    return JSON.stringify(props, null, 2);
  },
};

export const postsGetTool = {
  name: "skool_posts_get",
  description:
    "Get a single post with its full content and comments. Provide the post slug (name field from posts list).",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    postSlug: z.string().describe("The post slug/name (from the 'name' field in posts list)"),
    account: accountParam,
  },
  async handler(args: { community?: string; postSlug: string; account?: string }) {
    const config = await loadConfig(args.account);
    const slug = args.community || config.defaultCommunity;
    if (!slug) throw new Error("No community specified and no defaultCommunity in config");

    const data = (await nextDataRequest(`/${slug}/${args.postSlug}`, {
      group: slug,
      p: args.postSlug,
    }, args.account)) as { pageProps?: Record<string, unknown> };

    const props = data?.pageProps;
    if (!props) throw new Error("No pageProps in response");

    return JSON.stringify(props, null, 2);
  },
};

export const postsCreateTool = {
  name: "skool_posts_create",
  description:
    "Create a new post in a community. Requires auth cookies. Posts to api2.skool.com.",
  inputSchema: {
    groupId: z.string().describe("The group UUID"),
    title: z.string().describe("Post title"),
    content: z.string().describe("Post body content"),
    label: z.string().optional().describe("Category label UUID"),
    account: accountParam,
  },
  async handler(args: { groupId: string; title: string; content: string; label?: string; account?: string }) {
    const metadata: Record<string, unknown> = {
      action: 0,
      content: args.content,
      title: args.title,
    };
    if (args.label) {
      metadata.labels = args.label;
    }

    const result = await api2Request("/posts?notify=false&follow=true", {
      method: "POST",
      body: {
        post_type: "generic",
        group_id: args.groupId,
        metadata,
      },
      account: args.account,
    });

    return JSON.stringify(result, null, 2);
  },
};

async function getCurrentVote(postId: string, groupId: string, account?: string): Promise<string> {
  try {
    const data = await api2Request(`/posts/${postId}`, {
      queryParams: { group_id: groupId },
      account,
    }) as { metadata?: { my_vote?: string } };
    return data?.metadata?.my_vote ?? "";
  } catch {
    return "";
  }
}

export const postsVoteTool = {
  name: "skool_posts_vote",
  description:
    "Upvote or remove your upvote from a post or comment. Automatically checks current vote state to avoid toggling an existing vote. Use vote='up' to like, vote='' to unlike.",
  inputSchema: {
    postId: z.string().describe("The post or comment UUID to vote on"),
    groupId: z.string().describe("The group UUID (required to fetch current vote state)"),
    vote: z.enum(["up", ""]).default("up").describe("'up' to like, '' to remove your like"),
    account: accountParam,
  },
  async handler(args: { postId: string; groupId: string; vote: string; account?: string }) {
    const currentVote = await getCurrentVote(args.postId, args.groupId, args.account);

    if (currentVote === args.vote) {
      return JSON.stringify({ skipped: true, reason: `Already in state '${args.vote || "no vote"}'`, postId: args.postId });
    }

    await api2Request(`/posts/${args.postId}/vote`, {
      method: "PUT",
      body: { old: currentVote, new: args.vote },
      account: args.account,
    });

    return JSON.stringify({ success: true, postId: args.postId, previousVote: currentVote, newVote: args.vote });
  },
};

export const postsCommentTool = {
  name: "skool_posts_comment",
  description:
    "Add a comment or reply to a Skool post via browser (bypasses WAF). " +
    "For top-level comments, automatically @mentions the post creator by typing '@' and waiting for the suggestion dropdown. " +
    "For replies, provide parentCommentSnippet to find the parent comment — clicking Reply auto-fills the @mention of its author. " +
    "Requires community slug and post slug from the URL (e.g. skool.com/sim-club/mi-avatar-esta-listo).",
  inputSchema: {
    community: z.string().optional().describe("Community slug (e.g. 'sim-club'). Uses default from config if omitted."),
    postSlug: z.string().describe("Post slug from the URL (e.g. 'mi-avatar-esta-listo')"),
    content: z.string().describe("Comment text WITHOUT any @mention — the mention is added automatically"),
    mentionCreator: z.boolean().default(true).describe("Auto-mention the post creator for top-level comments. Default true."),
    parentCommentSnippet: z.string().optional().describe("Short unique text snippet from the comment to reply to. If provided, clicks Reply on that comment (auto-fills @mention of its author)."),
    account: accountParam,
  },
  async handler(args: {
    community?: string;
    postSlug: string;
    content: string;
    mentionCreator?: boolean;
    parentCommentSnippet?: string;
    account?: string;
  }) {
    const config = await loadConfig(args.account);
    const community = args.community ?? config.defaultCommunity;
    if (!community) throw new Error("No community specified and no defaultCommunity in config");

    let rawBody: string;

    if (args.parentCommentSnippet) {
      rawBody = await browserReplyComment({
        community,
        postSlug: args.postSlug,
        parentCommentSnippet: args.parentCommentSnippet,
        content: args.content,
        account: args.account,
      });
    } else {
      rawBody = await browserPostComment({
        community,
        postSlug: args.postSlug,
        content: args.content,
        mentionCreator: args.mentionCreator ?? true,
        account: args.account,
      });
    }

    if (!rawBody) return JSON.stringify({ warning: "Comment submitted but no response body captured" });
    try { return JSON.stringify(JSON.parse(rawBody), null, 2); } catch { return rawBody; }
  },
};
