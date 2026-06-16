import { z } from "zod";
import { nextDataRequest, rawRequest } from "../client.js";
import { loadConfig } from "../config.js";

const accountParam = z.string().optional().describe("Account name from config (e.g. 'piqueran'). Uses defaultAccount if omitted.");

export const membersListTool = {
  name: "skool_members_list",
  description:
    "List community members with pagination. Returns member info including name, bio, role, and online status.",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    page: z.number().default(1).describe("Page number (1-based)"),
    account: accountParam,
  },
  async handler(args: { community?: string; page: number; account?: string }) {
    const config = await loadConfig(args.account);
    const slug = args.community || config.defaultCommunity;
    if (!slug) throw new Error("No community specified and no defaultCommunity in config");

    const data = (await nextDataRequest(`/${slug}/-/members`, {
      group: slug,
      p: String(args.page),
    }, args.account)) as { pageProps?: Record<string, unknown> };

    const props = data?.pageProps;
    if (!props) throw new Error("No pageProps in response");

    return JSON.stringify(props, null, 2);
  },
};

export const membersPendingTool = {
  name: "skool_members_pending",
  description:
    "List pending membership requests. Requires auth cookies with admin/moderator access.",
  inputSchema: {
    community: z.string().optional().describe("Community slug. Uses default from config if omitted."),
    account: accountParam,
  },
  async handler(args: { community?: string; account?: string }) {
    const config = await loadConfig(args.account);
    const slug = args.community || config.defaultCommunity;
    if (!slug) throw new Error("No community specified and no defaultCommunity in config");

    const data = (await nextDataRequest(`/${slug}/-/members`, {
      group: slug,
      tab: "pending",
    }, args.account)) as { pageProps?: Record<string, unknown> };

    const props = data?.pageProps;
    if (!props) throw new Error("No pageProps in response");

    return JSON.stringify(props, null, 2);
  },
};

export const membersApproveTool = {
  name: "skool_members_approve",
  description:
    "Approve a pending member by their membership request ID. Requires admin/moderator auth.",
  inputSchema: {
    memberId: z.string().describe("The member/membership request UUID to approve"),
    groupId: z.string().describe("The group UUID"),
    account: accountParam,
  },
  async handler(args: { memberId: string; groupId: string; account?: string }) {
    const result = await rawRequest(
      `https://api2.skool.com/groups/${args.groupId}/members/${args.memberId}/approve`,
      { method: "POST", account: args.account },
    );

    if (result.status >= 400) {
      throw new Error(`Approve failed: ${result.status} — ${result.body.slice(0, 500)}`);
    }

    return `Member ${args.memberId} approved. Status: ${result.status}\n${result.body}`;
  },
};

export const membersRejectTool = {
  name: "skool_members_reject",
  description:
    "Reject a pending member by their membership request ID. Requires admin/moderator auth.",
  inputSchema: {
    memberId: z.string().describe("The member/membership request UUID to reject"),
    groupId: z.string().describe("The group UUID"),
    account: accountParam,
  },
  async handler(args: { memberId: string; groupId: string; account?: string }) {
    const result = await rawRequest(
      `https://api2.skool.com/groups/${args.groupId}/members/${args.memberId}/reject`,
      { method: "POST", account: args.account },
    );

    if (result.status >= 400) {
      throw new Error(`Reject failed: ${result.status} — ${result.body.slice(0, 500)}`);
    }

    return `Member ${args.memberId} rejected. Status: ${result.status}\n${result.body}`;
  },
};
