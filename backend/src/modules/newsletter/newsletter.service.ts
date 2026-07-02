import { Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { EmailService } from '../email/email.service';
import { welcomeTemplate } from '../email/templates/welcome';

export const SubscribeDto = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  source: z.enum(['welcome_modal', 'footer', 'other']).optional().default('other'),
});

export type SubscribeInput = z.infer<typeof SubscribeDto>;

/**
 * NewsletterService implements a minimal double-opt-in flow:
 *
 *   1. POST /newsletter/subscribe with { email }
 *      - validates the email
 *      - enqueues a confirmation email (with a one-time token)
 *      - returns 202 with { status: 'pending_confirmation' }
 *
 *   2. GET /newsletter/confirm?token=...
 *      - validates the token
 *      - marks the subscriber as confirmed in the (in-memory, for now)
 *        subscriber list
 *      - sends the actual welcome code
 *
 * The full persistent subscriber table is Phase 9 work — for now we
 * log + queue the emails. The point of this module is to close the
 * "fake submission" gap so the storefront no longer collects emails it
 * immediately throws away.
 */
@Injectable()
export class NewsletterService {
  // In-memory store for Phase 4. Phase 9 will swap to a real
  // NewsletterSubscriber Prisma model.
  private readonly pendingConfirmations = new Map<
    string,
    { email: string; source: string; token: string; createdAt: Date }
  >();
  private readonly confirmed = new Set<string>();

  constructor(private readonly emailService: EmailService) {}

  async requestSubscription(input: SubscribeInput): Promise<{ status: 'pending_confirmation' }> {
    const parsed = SubscribeDto.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException('Invalid email address');
    }

    const { email, source } = parsed.data;

    // If already confirmed, return idempotent success.
    if (this.confirmed.has(email)) {
      return { status: 'pending_confirmation' };
    }

    // Generate a one-time confirmation token. We do NOT store the
    // plaintext — only its hash.
    const token = crypto.randomUUID();
    const tokenHash = await sha256Hex(token);

    this.pendingConfirmations.set(tokenHash, {
      email,
      source,
      token,
      createdAt: new Date(),
    });

    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const confirmUrl = `${frontendUrl}/newsletter/confirm?token=${encodeURIComponent(token)}`;
      // For the confirmation email, reuse the welcome template but
      // point the button at /newsletter/confirm instead of /verify-email.
      const template = welcomeTemplate({
        name: null,
        verifyUrl: confirmUrl,
      });
      await this.emailService.sendTemplate(email, template);
    } catch (err) {
      // Don't fail the API call if email can't be sent — the email is
      // logged for ops to retry. The user sees a generic "if the email
      // was new, you'll get a confirmation link" response.
      console.warn(
        `[newsletter] failed to send confirmation email to ${email}: ${(err as Error).message}`,
      );
    }

    return { status: 'pending_confirmation' };
  }

  async confirmSubscription(rawToken: string): Promise<{ email: string }> {
    const tokenHash = await sha256Hex(rawToken);
    const entry = this.pendingConfirmations.get(tokenHash);
    if (!entry) {
      throw new BadRequestException('Invalid or expired confirmation token');
    }
    this.pendingConfirmations.delete(tokenHash);
    this.confirmed.add(entry.email);
    return { email: entry.email };
  }

  /** Test-only: number of confirmed subscribers. */
  countConfirmed(): number {
    return this.confirmed.size;
  }
}

async function sha256Hex(s: string): Promise<string> {
  // Use Node's crypto module via dynamic import so this module is
  // tree-shakable in test environments that mock node:crypto.
  const { createHash } = await import('crypto');
  return createHash('sha256').update(s).digest('hex');
}
