import type { EmailTemplate } from './types';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  image?: string;
}

export interface OrderConfirmationTemplateData {
  name?: string | null;
  orderId: string;
  orderShortId: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency?: string;
  /** Payment method shown to the customer, e.g. "Razorpay" or "Cash on Delivery". */
  paymentMethod: string;
  /** Absolute URL to the order detail page on the storefront. */
  orderUrl: string;
}

function inr(amount: number): string {
  return `\u20b9${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function orderConfirmationTemplate(d: OrderConfirmationTemplateData): EmailTemplate {
  const greeting = d.name ? `Hi ${d.name},` : 'Hi there,';
  const items = d.items
    .map(
      (it) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
            ${it.image ? `<img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.name)}" width="64" height="64" style="display: block; border-radius: 4px; object-fit: cover; margin-right: 12px; vertical-align: middle;" />` : ''}
            <span style="vertical-align: middle;">
              <strong>${escapeHtml(it.name)}</strong>
              ${
                it.size || it.color
                  ? `<br /><span style="color: #6b7280; font-size: 13px;">${[it.size, it.color]
                      .filter((value): value is string => Boolean(value))
                      .map(escapeHtml)
                      .join(' \u00b7 ')}</span>`
                  : ''
              }
            </span>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: center;">${it.quantity}</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${inr(it.price * it.quantity)}</td>
        </tr>
      `,
    )
    .join('');

  const subject = `Order #${d.orderShortId} confirmed \u2014 thank you!`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Thanks for your order!</h1>
      <p>${greeting}</p>
      <p>Your order <strong>#${d.orderShortId}</strong> has been confirmed. We've sent this to our warehouse and will email you again the moment it ships.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <thead>
          <tr style="border-bottom: 2px solid #1a1a1a;">
            <th style="text-align: left; padding: 8px 0;">Item</th>
            <th style="text-align: center; padding: 8px 0; width: 60px;">Qty</th>
            <th style="text-align: right; padding: 8px 0; width: 100px;">Price</th>
          </tr>
        </thead>
        <tbody>${items}</tbody>
      </table>

      <table style="width: 100%; margin: 16px 0;">
        <tr><td style="padding: 4px 0; color: #6b7280;">Subtotal</td><td style="padding: 4px 0; text-align: right;">${inr(d.subtotal)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Shipping</td><td style="padding: 4px 0; text-align: right;">${d.shipping === 0 ? 'Free' : inr(d.shipping)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Tax (incl.)</td><td style="padding: 4px 0; text-align: right;">${inr(d.tax)}</td></tr>
        <tr style="border-top: 1px solid #1a1a1a;"><td style="padding: 12px 0; font-weight: 600;">Total</td><td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 18px;">${inr(d.total)}</td></tr>
      </table>

      <p style="color: #6b7280; font-size: 14px;">Payment method: <strong>${escapeHtml(d.paymentMethod)}</strong></p>

      <p style="margin: 28px 0;">
        <a href="${escapeHtml(d.orderUrl)}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View order
        </a>
      </p>
    </div>
  `;
  const text =
    `${greeting}\n\n` +
    `Your order #${d.orderShortId} has been confirmed.\n\n` +
    `Items:\n${d.items.map((it) => `  - ${it.name} x${it.quantity} = ${inr(it.price * it.quantity)}`).join('\n')}\n\n` +
    `Subtotal: ${inr(d.subtotal)}\n` +
    `Shipping: ${d.shipping === 0 ? 'Free' : inr(d.shipping)}\n` +
    `Tax (incl.): ${inr(d.tax)}\n` +
    `Total: ${inr(d.total)}\n\n` +
    `Payment method: ${d.paymentMethod}\n\n` +
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
