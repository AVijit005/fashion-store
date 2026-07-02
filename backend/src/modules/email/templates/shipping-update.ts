import type { EmailTemplate } from './types';

export interface ShippingUpdateTemplateData {
  name?: string | null;
  orderShortId: string;
  /** Carrier name (e.g. "Delhivery", "BlueDart"). Optional. */
  carrier?: string;
  /** Tracking number / URL slug. */
  trackingNumber?: string;
  /** Absolute URL the customer can visit to track the shipment. */
  trackingUrl?: string;
  /** Absolute URL to the order detail page on the storefront. */
  orderUrl: string;
  /** Optional estimated delivery date, ISO 8601 date (YYYY-MM-DD). */
  estimatedDelivery?: string;
}

export function shippingUpdateTemplate(
  d: ShippingUpdateTemplateData,
): EmailTemplate {
  const greeting = d.name ? `Hi ${d.name},` : 'Hi there,';
  const subject = `Your order #${d.orderShortId} is on its way`;
  const trackingLine =
    d.trackingNumber || d.carrier
      ? `<p>Tracking details:</p>
         <p style="background: #f3f4f6; padding: 12px; border-radius: 4px;">
           ${d.carrier ? `<strong>Carrier:</strong> ${escapeHtml(d.carrier)}<br />` : ''}
           ${d.trackingNumber ? `<strong>Tracking #:</strong> ${escapeHtml(d.trackingNumber)}` : ''}
         </p>`
      : '';
  const estimatedLine = d.estimatedDelivery
    ? `<p>Estimated delivery: <strong>${escapeHtml(d.estimatedDelivery)}</strong></p>`
    : '';
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Your order is on its way.</h1>
      <p>${greeting}</p>
      <p>Order <strong>#${d.orderShortId}</strong> has shipped.</p>
      ${trackingLine}
      ${estimatedLine}
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(d.trackingUrl ?? d.orderUrl)}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Track package
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">If the tracking button doesn't work, copy and paste this URL: ${escapeHtml(d.trackingUrl ?? d.orderUrl)}</p>
    </div>
  `;
  const text =
    `${greeting}\n\n` +
    `Order #${d.orderShortId} has shipped.\n\n` +
    (d.carrier ? `Carrier: ${d.carrier}\n` : '') +
    (d.trackingNumber ? `Tracking #: ${d.trackingNumber}\n` : '') +
    (d.estimatedDelivery ? `Estimated delivery: ${d.estimatedDelivery}\n` : '') +
    `\nTrack: ${d.trackingUrl ?? d.orderUrl}\n`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
