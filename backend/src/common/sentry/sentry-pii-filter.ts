import * as Sentry from '@sentry/node';

/**
 * Sentry event scrubber that strips PII before events are sent to the
 * third-party Sentry SaaS. Without this, every 5xx response would ship
 * `Authorization` headers, session cookies, password fields, customer
 * email addresses and IP addresses to a third party — a GDPR / PCI-DSS
 * posture problem.
 *
 * Wire in `main.ts` via `Sentry.init({ ..., beforeSend: scrubPii })`.
 */

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-csrf-token',
  'x-xsrf-token',
  'x-cart-session-id',
  'proxy-authorization',
]);

const SENSITIVE_BODY_KEY_RE =
  /password|passwd|secret|token|api[_-]?key|access[_-]?key|cvv|cvc|credit[_-]?card|card[_-]?number|pan|aadhaar|ssn/i;

const REDACTED = '[REDACTED]';

type SentryEvent = Sentry.Event;
type MutableRequest = NonNullable<SentryEvent['request']> & {
  headers?: Record<string, string | string[] | undefined>;
  data?: unknown;
  query_string?: string;
  cookies?: unknown;
  url?: string;
};
type MutableUser = NonNullable<SentryEvent['user']>;

function redactObject<T extends Record<string, unknown>>(obj: T): T {
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_BODY_KEY_RE.test(key)) {
      record[key] = REDACTED;
    } else if (record[key] && typeof record[key] === 'object') {
      record[key] = redactObject(record[key] as Record<string, unknown>);
    }
  }
  return obj;
}

export function scrubPii<T extends SentryEvent>(event: T): T {
  const request = event.request as MutableRequest | undefined;

  // 1. Strip sensitive HTTP request headers.
  if (request?.headers && typeof request.headers === 'object') {
    const headers = request.headers;
    for (const name of Object.keys(headers)) {
      if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
        headers[name] = REDACTED;
      }
    }
  }

  // 2. Redact sensitive fields inside request data (POST bodies, query, etc.).
  if (request?.data && typeof request.data === 'object') {
    request.data = redactObject(request.data as Record<string, unknown>);
  }
  if (request?.query_string && typeof request.query_string === 'string') {
    // Drop query string entirely — it often carries tokens in reset-password links.
    request.query_string = '[REDACTED]';
  }
  if (request?.cookies && typeof request.cookies === 'object') {
    request.cookies = { redacted: REDACTED };
  }

  // 3. Drop user context fields that are PII by default.
  if (event.user) {
    const user = event.user as MutableUser;
    delete user.email;
    delete user.ip_address;
    delete user.username;
    if (!user.id) {
      // If only PII fields remain, drop the whole user object.
      delete event.user;
    }
  }

  // 4. Drop request URL fragments that may contain tokens.
  if (request?.url) {
    try {
      const url = new URL(request.url);
      url.search = '';
      url.hash = '';
      request.url = url.toString();
    } catch {
      // Leave as-is on URL parse failure — better to send a wrong URL than crash.
    }
  }

  // 5. Strip breadcrumbs that may contain PII (console.log of payloads, etc.).
  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.data && typeof crumb.data === 'object') {
        crumb.data = redactObject(crumb.data as Record<string, unknown>);
      }
    }
  }

  return event;
}
