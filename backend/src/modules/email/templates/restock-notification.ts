import type { EmailTemplate } from "./types";

export interface RestockNotificationTemplateData {
  productTitle: string;
  size: string;
  color: string;
  productUrl: string;
}

/**
 * Back-in-stock notification email. Sent when a previously out-of-stock
 * variant comes back and at least one customer had subscribed.
 */
export function restockNotificationTemplate(
  d: RestockNotificationTemplateData,
): EmailTemplate {
  const subject = `\u2705 Back in stock: ${d.productTitle} (${d.size}/${d.color})`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">It's back.</h1>
      <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
        <strong>${escapeHtml(d.productTitle)}</strong> in ${escapeHtml(d.size)} / ${escapeHtml(d.color)} is back in stock.
      </p>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(d.productUrl)}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Shop now &rarr;
        </a>
      </p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">
        You subscribed to back-in-stock notifications. We're sending this because it's back &mdash; grab it before it sells out again.
      </p>
    </div>
  `;
  const text =
    `${d.productTitle} (${d.size}/${d.color}) is back in stock.\n\n` +
    `Shop now: ${d.productUrl}\n\n` +
    `You subscribed to back-in-stock notifications. We're sending this because it's back — grab it before it sells out again.\n`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
