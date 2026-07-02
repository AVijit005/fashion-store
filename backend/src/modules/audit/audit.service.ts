import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

export const AUDIT_ACTIONS = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_REFUNDED: 'ORDER_REFUNDED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface CreateAuditLogInput {
  userId?: string;
  action: AuditAction | string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
}

/**
 * Fire-and-forget audit logging service.
 *
 * Audit writes are intentionally non-blocking: failures are caught and logged
 * so that observability issues cannot break user-facing operations.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAuditLogInput): void {
    this.prisma.auditLog
      .create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          details: input.details ?? Prisma.JsonNull,
          ipAddress: input.ipAddress,
        },
      })
      .catch((error: Error) => {
        this.logger.error(
          `Failed to persist audit log for action ${input.action}: ${error.message}`,
        );
      });
  }
}
