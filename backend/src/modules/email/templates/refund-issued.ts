import type { EmailTemplate } from './types';

export interface RefundIssuedTemplateData {
  name?: string | null;
  orderShortId: string;
  /** Refund amount in major currency units (rupees). */
  refundAmount: number;
  /** Currency code (e.g. "INR"). Defaults to INR. */
  currency?: string;
  /** Razorpay refund id (optional). */
  refundId?: string;
  /** Optional human-readable reason. */
  reason?: string;
  /** Absolute URL to the order detail page. */
  orderUrl: string;
}

function fmt(amount: number, currency: string): string {
  if (currency === 'INR' || currency === undefined) {
    return `\u20b9${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

export function refundIssuedTemplate(
  d: RefundIssuedTemplateData,
): EmailTemplate {
  const greeting = d.name ? `Hi ${d.name},` : 'Hi there,';
  const currency = d.currency ?? 'INR';
  const subject = `Refund of ${fmt(d.refundAmount, currency)} issued for order #${d.orderShortId}`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Your refund has been issued.</h1>
      <p>${greeting}</p>
      <p>We've issued a refund of <strong>${escapeHtml(fmt(d.refundAmount, currency))}</strong> for order <strong>#${d.orderShortId}</strong>.</p>
      ${d.refundId ? `<p style="color: #6b7280; font-size: 14px;">Refund reference: ${escapeHtml(d.refundId)}</p>` : ''}
      ${d.reason ? `<p>Reason: ${escapeHtml(d.reason)}</p>` : ''}
      <p style="background: #f3f4f6; padding: 12px; border-radius: 4px;">
        Most refunds reach your account within <strong>5-7 business days</strong>, depending on your bank.
      </p>
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(d.orderUrl)}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View order
        </a>
      </p>
    </div>
  `;
  const text =
    `${greeting}\n\n` +
    `Refund of ${fmt(d.refundAmount, currency)} issued for order #${d.orderShortId}.\n\n` +
    (d.refundId ? `Refund reference: ${d.refundId}\n` : '') +
    (d.reason ? `Reason: ${d.reason}\n` : '') +
    `\nMost refunds reach your account within 5-7 business days.\n\n` +
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
