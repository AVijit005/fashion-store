const DEFAULT_CONNECTION_LIMIT = '20';
const DEFAULT_POOL_TIMEOUT = '30';
const DEFAULT_STATEMENT_TIMEOUT = '15000';
const DEFAULT_LOCK_TIMEOUT = '5000';

/**
 * Applies sensible database connection/pool/timeout defaults to a PostgreSQL
 * URL only when the source URL does not already specify them.
 */
export function buildDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', DEFAULT_CONNECTION_LIMIT);
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', DEFAULT_POOL_TIMEOUT);
    }
    if (!url.searchParams.has('statement_timeout')) {
      url.searchParams.set('statement_timeout', DEFAULT_STATEMENT_TIMEOUT);
    }
    if (!url.searchParams.has('lock_timeout')) {
      url.searchParams.set('lock_timeout', DEFAULT_LOCK_TIMEOUT);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}
