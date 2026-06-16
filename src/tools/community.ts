import { z } from "zod";
import { nextDataRequest, api2Request } from "../client.js";
import { loadConfig } from "../config.js";

const accountParam = z.string().optional().describe("Account name from config (e.g. 'piqueran'). Uses defaultAccount if omitted.");

export const communityInfoTool = {
  name: "skool_community_info",
  description:
    "Get community details including name, description, member count, and settings. Uses Next.js data route for read access.",
  inputSchema: {
    community: z.string().optional().describe("Community slug (e.g. 'ai-agent-academy-6994'). Uses default from config if omitted."),
    account: accountParam,
  },
  async handler(args: { community?: string; account?: string }) {
    const config = await loadConfig(args.account);
    const slug = args.community || config.defaultCommunity;
    if (!slug) throw new Error("No community specified and no defaultCommunity in config");

    const data = (await nextDataRequest(`/${slug}/about`, { group: slug }, args.account)) as {
      pageProps?: Record<string, unknown>;
    };

    const props = data?.pageProps;
    if (!props) throw new Error("No pageProps in response");

    return JSON.stringify(props, null, 2);
  },
};

export const communityLabelsTool = {
  name: "skool_community_labels",
  description: "Get category labels for a community from api2.skool.com.",
  inputSchema: {
    groupId: z.string().describe("The group UUID (find via skool_community_info)"),
    account: accountParam,
  },
  async handler(args: { groupId: string; account?: string }) {
    const result = await api2Request(`/groups/${args.groupId}/labels`, { account: args.account });
    return JSON.stringify(result, null, 2);
  },
};
