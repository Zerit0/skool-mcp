import { z } from "zod";
import { rawRequest } from "../client.js";

export const requestTool = {
  name: "skool_request",
  description:
    "Make an authenticated HTTP request to an allowed Skool URL. Only https://www.skool.com and https://api2.skool.com are permitted. Useful for API discovery and debugging. Cookies and User-Agent are injected automatically.",
  inputSchema: {
    url: z.string().url().describe("Full HTTPS Skool URL to request (e.g. https://www.skool.com/some/path or https://api2.skool.com/endpoint)"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET").describe("HTTP method"),
    headers: z.record(z.string()).optional().describe("Additional headers as key-value pairs"),
    body: z.string().optional().describe("Request body (for POST/PUT/PATCH)"),
    account: z.string().optional().describe("Account name from config (e.g. 'piqueran'). Uses defaultAccount if omitted."),
  },
  async handler(args: { url: string; method: string; headers?: Record<string, string>; body?: string; account?: string }) {
    const result = await rawRequest(args.url, {
      method: args.method,
      headers: args.headers,
      body: args.body,
      account: args.account,
    });

    let formattedBody = result.body;
    try {
      formattedBody = JSON.stringify(JSON.parse(result.body), null, 2);
    } catch {
      // leave as-is
    }

    return `HTTP ${result.status}\n\nHeaders:\n${JSON.stringify(result.headers, null, 2)}\n\nBody:\n${formattedBody}`;
  },
};
