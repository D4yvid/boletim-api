import { VercelResponse } from "@vercel/node";

type CacheOptions = {
  vercelCacheAge: number;
  cdnCacheAge: number;
  browserCacheAge: number;
};

export const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  vercelCacheAge: 3600,
  cdnCacheAge: 3600,
  browserCacheAge: 3600,
};

export function cache(
  response: VercelResponse,
  cacheOptions: Partial<CacheOptions> = {},
) {
  const { vercelCacheAge, cdnCacheAge, browserCacheAge } = {
    ...DEFAULT_CACHE_OPTIONS,
    ...cacheOptions,
  };

  response.setHeader("Vercel-CDN-Cache-Control", `max-age=${vercelCacheAge}`);
  response.setHeader("CDN-Cache-Control", `max-age=${cdnCacheAge}`);
  response.setHeader("Cache-Control", `max-age=${browserCacheAge}`);
}
