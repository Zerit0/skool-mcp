const ALLOWED_HOSTS = new Set([
  "www.skool.com",
  "api2.skool.com",
]);

export function assertAllowedSkoolUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`Blocked non-Skool host: ${url.hostname}`);
  }

  if (url.username || url.password) {
    throw new Error("Credentials in URLs are not allowed");
  }

  return url;
}

export function assertAllowedSkoolPageUrl(input: string | URL): URL {
  const url = assertAllowedSkoolUrl(input);
  if (url.hostname.toLowerCase() !== "www.skool.com") {
    throw new Error(`Expected www.skool.com page URL, got: ${url.hostname}`);
  }
  return url;
}

export function buildSkoolPostUrl(community: string, postSlug: string): string {
  const url = new URL("https://www.skool.com");
  url.pathname = `/${encodeURIComponent(community.trim())}/${encodeURIComponent(postSlug.trim())}`;
  return assertAllowedSkoolUrl(url).toString();
}
