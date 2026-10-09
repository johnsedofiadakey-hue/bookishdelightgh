/**
 * CSRF guard for admin route handlers.
 *
 * Behind Firebase App Hosting the server sees an internal URL, so
 * `request.nextUrl.origin` never equals the browser's `Origin`. Like Next.js's
 * own Server Action check, compare the `Origin` host with the public host from
 * `x-forwarded-host` (or `host`). The configured site URL is also accepted so
 * the custom domain works when a proxy rewrites the host header.
 */

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim().toLowerCase() || null;
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function isSameOriginRequest(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  const originHost = hostOf(origin);
  if (!originHost) return false;
  const allowed = new Set(
    [firstHeaderValue(headers.get("x-forwarded-host")), firstHeaderValue(headers.get("host")), hostOf(process.env.NEXT_PUBLIC_SITE_URL)].filter(
      (host): host is string => Boolean(host),
    ),
  );
  return allowed.has(originHost);
}
