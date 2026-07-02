import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../config/prisma.service";
import { EmailService } from "../email/email.service";
import { ConfigService } from "@nestjs/config";
import { CreateContactDto } from "./dto/create-contact.dto";

/**
 * ContactService — Phase 2 (audit item 2.9).
 *
 * Replaces the previous frontend-only "fake 600ms setTimeout + success
 * toast" in `src/routes/contact.tsx`. Real submissions are persisted to
 * `contact_submissions` so admin can review + reply from the dashboard,
 * and an admin-notification email is queued via EmailService.
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async submit(dto: CreateContactDto) {
    const submission = await this.prisma.contactSubmission.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        message: dto.message.trim(),
        userId: dto.userId ?? null,
      },
      select: { id: true, createdAt: true },
    });

    // Best-effort admin notification. Failures are logged but never block
    // the submission itself — the customer message is already persisted.
    const adminEmail = this.configService.get<string>("ADMIN_EMAIL");
    if (adminEmail) {
      try {
        await this.emailService.sendTemplate(adminEmail, {
          subject: `New contact submission from ${dto.name}`,
          html: `<p><strong>From:</strong> ${dto.name} &lt;${dto.email}&gt;</p>
                 <p><strong>Message:</strong></p>
                 <blockquote style="border-left:3px solid #ccc;padding-left:1em;margin-left:0;">
                   ${dto.message.replace(/</g, "&lt;")}
                 </blockquote>
                 <p style="color:#666;font-size:12px;">Submission ID: ${submission.id}</p>`,
        });
      } catch (err) {
        this.logger.warn(
          `Admin email notification failed for submission ${submission.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Contact submission id=${submission.id} from ${dto.email}`,
    );

    return submission;
  }

  // Admin listing — wired in the admin.returns-style "Contact" section.
  async listAll() {
    return this.prisma.contactSubmission.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }
}
