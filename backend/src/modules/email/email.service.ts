import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Headers added to the SMTP envelope; visible in email clients. */
  headers?: Record<string, string>;
}

/**
 * EmailService is the thin facade the rest of the app talks to. It does
 * NOT call SMTP directly — every send is enqueued onto the
 * `email-queue` BullMQ queue and processed by EmailProcessor. This keeps
 * the request path fast (no SMTP latency) and lets us retry failed
 * sends with exponential backoff (3 attempts by default).
 *
 * Templates live in `./templates/` as plain TS functions returning
 * `{ subject, html, text }` so they can be unit-tested without a real
 * SMTP transport.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromAddress: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('email-queue') private readonly emailQueue: Queue<EmailJob>,
  ) {
    this.fromAddress =
      configService.get<string>('EMAIL_FROM') ?? '"Aura Streetwear" <no-reply@aurastreetwear.com>';
  }

  /**
   * Enqueue an email for delivery. Returns the BullMQ job id so callers
   * can correlate logs. Failures are retried by the processor; the queue
   * is intentionally fire-and-forget from the caller's perspective.
   */
  async send(job: EmailJob): Promise<string> {
    const enqueued = await this.emailQueue.add(
      'send',
      { ...job, headers: { 'X-Aura-Job': Date.now().toString(), ...(job.headers ?? {}) } },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 3600, count: 1000 }, // keep last hour for debugging
        removeOnFail: false, // retain failures for inspection
      },
    );
    return String(enqueued.id);
  }

  /** Convenience wrapper used by AuthModule. */
  async sendTemplate(
    to: string,
    template: { subject: string; html: string; text: string },
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.send({ to, ...template, headers });
  }

  getFromAddress(): string {
    return this.fromAddress;
  }
}

/**
 * EmailProcessor is the BullMQ worker that actually talks to SMTP.
 * Separated from EmailService so the SMTP transporter is only created
 * inside the worker (lazy), not on every API request.
 */
@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = this.configService.get<string>('SMTP_HOST');
    const port = parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';

    if (!host) {
      throw new Error('SMTP_HOST is not configured; cannot send emails');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      // Pooled connections for high throughput.
      pool: true,
      maxConnections: 5,
      // Reasonable timeout for slow SMTP servers.
      connectionTimeout: 10_000,
    });

    return this.transporter;
  }

  async process(job: { data: EmailJob; id?: string }): Promise<void> {
    const { to, subject, html, text, headers } = job.data;
    const fromAddress =
      this.configService.get<string>('EMAIL_FROM') ??
      '"Aura Streetwear" <no-reply@aurastreetwear.com>';

    const transporter = this.getTransporter();

    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text,
        headers,
      });
      this.logger.log(
        `Sent email to=${to} subject="${subject}" messageId=${info.messageId} jobId=${job.id ?? 'n/a'}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send email to=${to} subject="${subject}" error=${msg}`);
      throw err; // surface to BullMQ for retry
    }
  }
}
