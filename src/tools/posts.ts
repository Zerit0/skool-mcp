import { z } from "zod";
import { nextDataRequest, api2Request } from "../client.js";
import { loadConfig } from "../config.js";

export const postsListTool = {
  name: "skool_posts_list",
  description:
    "List posts in a community feed. Supports category filtering and pagination. Returns post title, content preview, author, likes, and comment count.",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    category: z.string().optional().describe("Category/label UUID to filter by"),
    page: z.number().default(1).describe("Page number (1-based)"),
    sort: z.enum(["newest-cm", "newest", "top"]).default("newest-cm").describe("Sort order: newest-cm (recent activity), newest (created), top (most liked)"),
  },
  async handler(args: { community?: string; category?: string; page: number; sort: string }) {
    const config = await loadConfig();
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

    const data = (await nextDataRequest(`/${slug}`, params)) as {
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
  },
  async handler(args: { community?: string; postSlug: string }) {
    const config = await loadConfig();
    const slug = args.community || config.defaultCommunity;
    if (!slug) throw new Error("No community specified and no defaultCommunity in config");

    const data = (await nextDataRequest(`/${slug}/${args.postSlug}`, {
      group: slug,
      p: args.postSlug,
    })) as { pageProps?: Record<string, unknown> };

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
  },
  async handler(args: { groupId: string; title: string; content: string; label?: string }) {
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
    });

    return JSON.stringify(result, null, 2);
  },
};

async function getCurrentVote(postId: string, groupId: string): Promise<string> {
  try {
    const data = await api2Request(`/posts/${postId}`, {
      queryParams: { group_id: groupId },
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
  },
  async handler(args: { postId: string; groupId: string; vote: string }) {
    const currentVote = await getCurrentVote(args.postId, args.groupId);

    if (currentVote === args.vote) {
      return JSON.stringify({ skipped: true, reason: `Already in state '${args.vote || "no vote"}'`, postId: args.postId });
    }

    await api2Request(`/posts/${args.postId}/vote`, {
      method: "PUT",
      body: { old: currentVote, new: args.vote },
    });

    return JSON.stringify({ success: true, postId: args.postId, previousVote: currentVote, newVote: args.vote });
  },
};

export const postsCommentTool = {
  name: "skool_posts_comment",
  description:
    "Add a comment to a post or reply to an existing comment. Requires auth cookies.",
  inputSchema: {
    postId: z.string().describe("The root post UUID to comment on"),
    groupId: z.string().describe("The group UUID"),
    content: z.string().describe("Comment text content"),
    parentId: z.string().optional().describe("Parent comment UUID for replies (defaults to postId for top-level comments)"),
  },
  async handler(args: { postId: string; groupId: string; content: string; parentId?: string }) {
    const result = await api2Request("/posts?follow=false", {
      method: "POST",
      body: {
        post_type: "comment",
        group_id: args.groupId,
        root_id: args.postId,
        parent_id: args.parentId ?? args.postId,
        metadata: {
          title: "",
          content: args.content,
          attachments: "",
          action: 0,
          video_ids: "",
        },
      },
    });

    return JSON.stringify(result, null, 2);
  },
};
