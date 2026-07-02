import type { EmailTemplate } from './types';

export interface PasswordResetTemplateData {
  name?: string | null;
  resetUrl: string;
  expiresInMinutes: number;
}

export function passwordResetTemplate(data: PasswordResetTemplateData): EmailTemplate {
  const greeting = data.name ? `Hi ${data.name},` : 'Hi there,';
  const subject = 'Reset your Aura Streetwear password';
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Reset your password</h1>
      <p>${greeting}</p>
      <p>We received a request to reset the password for your Aura account. Click the button below to choose a new password:</p>
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(data.resetUrl)}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Reset password
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in ${data.expiresInMinutes} minutes and can only be used once. If you didn't request a password reset, you can ignore this email — your password will remain unchanged.</p>
      <p style="color: #6b7280; font-size: 14px;">For security, all other sessions will be signed out when the new password is set.</p>
    </div>
  `;
  const text = `${greeting}\n\nReset your password by visiting:\n${data.resetUrl}\n\nThis link expires in ${data.expiresInMinutes} minutes and can only be used once. If you didn't request this, you can ignore the email.`;
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
