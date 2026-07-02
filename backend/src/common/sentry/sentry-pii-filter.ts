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

function redactObject<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_BODY_KEY_RE.test(key)) {
      obj[key] = REDACTED;
    } else if (obj[key] && typeof obj[key] === 'object') {
      obj[key] = redactObject(obj[key] as Record<string, unknown>);
    }
  }
  return obj;
}

export function scrubPii<T extends Record<string, unknown>>(event: T): T {
  // 1. Strip sensitive HTTP request headers.
  if (event.request?.headers && typeof event.request.headers === 'object') {
    const headers = event.request.headers as Record<string, string | string[] | undefined>;
    for (const name of Object.keys(headers)) {
      if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
        headers[name] = REDACTED;
      }
    }
  }

  // 2. Redact sensitive fields inside request data (POST bodies, query, etc.).
  if (event.request?.data && typeof event.request.data === 'object') {
    event.request.data = redactObject(event.request.data as Record<string, unknown>);
  }
  if (event.request?.query_string && typeof event.request.query_string === 'string') {
    // Drop query string entirely — it often carries tokens in reset-password links.
    event.request.query_string = '[REDACTED]';
  }
  if (event.request?.cookies && typeof event.request.cookies === 'object') {
    event.request.cookies = REDACTED;
  }

  // 3. Drop user context fields that are PII by default.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
    if (!event.user.id) {
      // If only PII fields remain, drop the whole user object.
      delete event.user;
    }
  }

  // 4. Drop request URL fragments that may contain tokens.
  if (event.request?.url) {
    try {
      const url = new URL(event.request.url);
      url.search = '';
      url.hash = '';
      event.request.url = url.toString();
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
