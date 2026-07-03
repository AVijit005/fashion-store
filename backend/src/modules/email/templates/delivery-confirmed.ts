import type { EmailTemplate } from './types';

export interface DeliveryConfirmedTemplateData {
  name?: string | null;
  orderShortId: string;
  /** Absolute URL to the order detail page. */
  orderUrl: string;
}

export function deliveryConfirmedTemplate(d: DeliveryConfirmedTemplateData): EmailTemplate {
  const greeting = d.name ? `Hi ${d.name},` : 'Hi there,';
  const subject = `Order #${d.orderShortId} delivered \u2014 enjoy!`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Delivered.</h1>
      <p>${greeting}</p>
      <p>Your order <strong>#${d.orderShortId}</strong> has been delivered. Hope you love it.</p>
      <p>If anything's off \u2014 wrong size, missing item, damaged in transit \u2014 you have <strong>14 days</strong> from delivery to request a return.</p>
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(d.orderUrl)}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View order
        </a>
      </p>
    </div>
  `;
  const text =
    `${greeting}\n\n` +
    `Order #${d.orderShortId} has been delivered. Hope you love it.\n\n` +
    `14 days from delivery to request a return if anything is off.\n\n` +
    `View order: ${d.orderUrl}\n`;
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
