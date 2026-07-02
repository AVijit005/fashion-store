import type { EmailTemplate } from './types';

export interface VerifyEmailTemplateData {
  name?: string | null;
  verifyUrl: string;
}

export function verifyEmailTemplate(data: VerifyEmailTemplateData): EmailTemplate {
  const greeting = data.name ? `Hi ${data.name},` : 'Hi there,';
  const subject = 'Verify your Aura Streetwear email';
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Verify your email</h1>
      <p>${greeting}</p>
      <p>Click the button below to confirm your email address:</p>
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(data.verifyUrl)}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Verify email
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 24 hours. If you didn't request this, you can ignore the email.</p>
    </div>
  `;
  const text = `${greeting}\n\nVerify your email by visiting:\n${data.verifyUrl}\n\nThis link expires in 24 hours.`;
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
