import type { EmailTemplate } from './types';

export interface WelcomeTemplateData {
  name?: string | null;
  verifyUrl: string;
}

export function welcomeTemplate(data: WelcomeTemplateData): EmailTemplate {
  const greeting = data.name ? `Hi ${data.name},` : 'Hi there,';
  const subject = 'Welcome to Aura Streetwear — please verify your email';
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Welcome to Aura</h1>
      <p>${greeting}</p>
      <p>Thanks for creating an account. Before you can place an order, please verify your email address by clicking the link below:</p>
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(data.verifyUrl)}" style="background: #1a1a1a; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Verify your email
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="background: #f3f4f6; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px;">${escapeHtml(data.verifyUrl)}</p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    </div>
  `;
  const text = `${greeting}\n\nThanks for creating an account. Please verify your email by visiting:\n${data.verifyUrl}\n\nThis link expires in 24 hours.`;
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
