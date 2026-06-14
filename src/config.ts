import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { assertAllowedSkoolUrl } from "./urlSafety.js";

export interface SkoolConfig {
  cookies: string;
  defaultCommunity: string;
  baseUrl: string;
}

interface AccountEntry {
  cookies?: string;
  defaultCommunity?: string;
}

interface RawConfig {
  // Multi-account format
  accounts?: Record<string, AccountEntry>;
  defaultAccount?: string;
  // Legacy single-account format
  cookies?: string;
  defaultCommunity?: string;
  baseUrl?: string;
}

const CONFIG_PATH = process.env.SKOOL_MCP_CONFIG ?? join(homedir(), ".config", "skool-mcp", "config.json");

let rawConfigCache: RawConfig | null = null;

async function loadRawConfig(): Promise<RawConfig> {
  if (rawConfigCache) return rawConfigCache;

  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    rawConfigCache = JSON.parse(raw) as RawConfig;
    return rawConfigCache;
  } catch (err) {
    const msg =
      err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
        ? `Config file not found at ${CONFIG_PATH}. Create it with: { "accounts": { "main": { "cookies": "auth_token=...", "defaultCommunity": "sim-club" } }, "defaultAccount": "main", "baseUrl": "https://www.skool.com" }`
        : `Failed to read config: ${err}`;
    throw new Error(msg);
  }
}

export async function loadConfig(account?: string): Promise<SkoolConfig> {
  const raw = await loadRawConfig();
  const baseUrl = assertAllowedSkoolUrl(raw.baseUrl ?? "https://www.skool.com").origin;

  if (raw.accounts) {
    // Multi-account mode
    const accountName = account ?? raw.defaultAccount ?? Object.keys(raw.accounts)[0];
    const entry = raw.accounts[accountName];
    if (!entry) {
      const available = Object.keys(raw.accounts).join(", ");
      throw new Error(`Account '${accountName}' not found in config. Available accounts: ${available}`);
    }
    return {
      cookies: entry.cookies ?? "",
      defaultCommunity: entry.defaultCommunity ?? "",
      baseUrl,
    };
  }

  // Legacy single-account format (backward compatible)
  return {
    cookies: raw.cookies ?? "",
    defaultCommunity: raw.defaultCommunity ?? "",
    baseUrl,
  };
}
