import { Module, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EmailService, EmailProcessor, EmailJob } from './email.service';

export const EMAIL_QUEUE = 'email-queue';

/**
 * EmailModule owns the transactional email pipeline:
 *
 *   EmailService (facade)
 *      |
 *      | enqueue EmailJob
 *      v
 *   BullMQ 'email-queue'
 *      |
 *      v
 *   EmailProcessor (worker)
 *      |
 *      v
 *   SMTP via nodemailer
 *
 * The processor is wired with `runOnStart: false` so it doesn't try to
 * send during the test suite unless we explicitly enable it.
 *
 * Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM in
 * the environment to deliver real mail. With SMTP_HOST unset, the
 * processor throws on first job; the queue will retry per its policy.
 */
export class EmailQueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueProcessor.name);
  private worker: Worker<EmailJob> | null = null;

  constructor(
    private readonly processor: EmailProcessor,
    private readonly configService: ConfigService,
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJob>,
  ) {}

  onModuleInit() {
    if (this.configService.get<string>('EMAIL_WORKER_DISABLED') === 'true') {
      this.logger.log(
        'Email worker disabled (EMAIL_WORKER_DISABLED=true); jobs will accumulate in queue.',
      );
      return;
    }

    this.worker = new Worker<EmailJob>(
      EMAIL_QUEUE,
      async (job: Job<EmailJob>) => this.processor.process({ data: job.data, id: job.id }),
      {
        connection: {
          host: new URL(this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379')
            .hostname,
          port: parseInt(
            new URL(this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379').port ||
              '6379',
            10,
          ),
        },
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Email job ${job?.id} failed after ${job?.attemptsMade} attempts: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [EmailService, EmailProcessor, EmailQueueProcessor],
  exports: [EmailService],
})
export class EmailModule {}
