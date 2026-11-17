/**
 * Keeps the Shopify admin from landing on the public root page.
 *
 * `/` is the app's marketing page, and it is also `application_url`, so the
 * admin's iframe reaches it in several shapes. Only one of them carries
 * `?shop=`, and any other shape that fell through rendered the marketing page
 * inside the admin with no way back. That was seen live on 2026-11-17, opening
 * Kurir Connector – HopHop from the admin search (`?link_source=search`).
 *
 * The shapes that are recognised, in order:
 *
 *  1. `?shop=` -- a normal launch. Every parameter is forwarded; `host`,
 *     `embedded` and `id_token` all mean something to the embedded app.
 *  2. An `Authorization` header -- a client-side navigation to `/` from inside
 *     the app (clicking the app's name in the admin nav arrives as
 *     `GET /_root.data` with no params at all). App Bridge's patched fetch
 *     stamps the session token on it, and that token authenticates the next
 *     request to `/app`, so a bare `/app` is enough.
 *  3. `?host=` -- base64 of `admin.shopify.com/store/<handle>`, so it names
 *     the shop even when `shop` itself is missing.
 *  4. A framed load whose `Referer` is an admin store URL.
 *  5. A framed load on a Worker that serves exactly one shop (`soleShop`).
 *  6. `?embedded=1` / `?appLoadId=` -- an admin load that named no shop; `/app`
 *     handles it better than a marketing page does.
 *
 * In 4 and 5 the shop is a claim, not a credential: `/app` still authenticates
 * through App Bridge's session-token bounce, which only the admin that really
 * framed the page can complete.
 */

const SHOP_HANDLE = /^[a-z0-9][a-z0-9-]*$/i;
const ADMIN_STORE_PATH = /admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/i;

/** `<handle>.myshopify.com`, or null for anything that is not one. */
export function normalizeShop(shop: string | null | undefined): string | null {
  const value = (shop ?? "").trim().toLowerCase();
  const match = /^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/.exec(value);
  return match ? value : null;
}

/** The shop named by App Bridge's `host` param (modern or legacy shape). */
export function shopFromHostParam(host: string | null): string | null {
  if (!host) return null;
  try {
    const decoded = atob(host.replace(/-/g, "+").replace(/_/g, "/"));
    const modern = ADMIN_STORE_PATH.exec(decoded);
    if (modern && decoded.startsWith("admin.shopify.com/")) {
      return `${modern[1].toLowerCase()}.myshopify.com`;
    }
    const legacy = /^([a-z0-9][a-z0-9-]*\.myshopify\.com)\/admin/i.exec(decoded);
    return legacy ? legacy[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/** The shop named by an admin URL (`https://admin.shopify.com/store/<handle>/…`). */
export function shopFromAdminUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "admin.shopify.com") return null;
    const match = /^\/store\/([^/]+)/.exec(url.pathname);
    if (!match || !SHOP_HANDLE.test(match[1])) return null;
    return `${match[1].toLowerCase()}.myshopify.com`;
  } catch {
    return null;
  }
}

/** The `host` param Shopify itself would send for this shop. */
export function adminHostParam(shop: string): string {
  const handle = shop.replace(/\.myshopify\.com$/i, "");
  return btoa(`admin.shopify.com/store/${handle}`).replace(/=+$/, "");
}

/** Whether the browser is loading this document inside a frame. */
export function isFramedRequest(request: Request): boolean {
  return request.headers.get("sec-fetch-dest") === "iframe";
}

function appUrl(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `/app?${query}` : "/app";
}

/**
 * Where an admin request to `/` should go instead, or null when it is a
 * visitor and the public page is the right answer.
 */
export function embeddedEntryRedirect(
  request: Request,
  options: { soleShop?: string | null } = {},
): string | null {
  const params = new URL(request.url).searchParams;

  if (params.get("shop")) return appUrl(params);
  if (request.headers.get("authorization")) return appUrl(params);

  const fromHost = shopFromHostParam(params.get("host"));
  if (fromHost) {
    params.set("shop", fromHost);
    return appUrl(params);
  }

  if (isFramedRequest(request)) {
    const shop =
      shopFromAdminUrl(request.headers.get("referer")) ?? normalizeShop(options.soleShop);
    if (shop) {
      params.set("embedded", "1");
      params.set("shop", shop);
      params.set("host", adminHostParam(shop));
      return appUrl(params);
    }
  }

  if (params.get("embedded") === "1" || params.has("appLoadId")) return appUrl(params);

  return null;
}
