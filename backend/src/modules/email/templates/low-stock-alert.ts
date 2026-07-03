import type { EmailTemplate } from './types';

export interface LowStockItem {
  sku: string;
  name: string;
  stockQuantity: number;
  threshold: number;
  variantUrl: string;
}

export interface LowStockAlertTemplateData {
  items: LowStockItem[];
  /** Absolute URL to the admin products page. */
  adminProductsUrl: string;
}

export function lowStockAlertTemplate(d: LowStockAlertTemplateData): EmailTemplate {
  const rows = d.items
    .map(
      (it) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${escapeHtml(it.name)}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-family: monospace;">${escapeHtml(it.sku)}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #c84b1e;">${it.stockQuantity}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">${it.threshold}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <a href="${escapeHtml(it.variantUrl)}" style="color: #1a1a1a;">Restock \u2192</a>
          </td>
        </tr>
      `,
    )
    .join('');

  const subject = `\ud83d\udea8 Low stock alert: ${d.items.length} variant${d.items.length === 1 ? '' : 's'} below threshold`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 22px; font-weight: 600; margin-bottom: 16px;">Low stock alert</h1>
      <p>The following variants are at or below their restock threshold:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="border-bottom: 2px solid #1a1a1a; text-align: left;">
            <th style="padding: 8px 0;">Product</th>
            <th style="padding: 8px 0;">SKU</th>
            <th style="padding: 8px 0; text-align: right;">In stock</th>
            <th style="padding: 8px 0; text-align: right;">Threshold</th>
            <th style="padding: 8px 0; text-align: right;"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(d.adminProductsUrl)}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Open admin
        </a>
      </p>
    </div>
  `;
  const text =
    `Low stock alert (${d.items.length} variants):\n\n` +
    d.items
      .map(
        (it) =>
          `  - ${it.name} (${it.sku}): ${it.stockQuantity} in stock (threshold ${it.threshold}) \u2014 ${it.variantUrl}`,
      )
      .join('\n') +
    `\n\nOpen admin: ${d.adminProductsUrl}\n`;
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
