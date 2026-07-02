import { ReturnStatus } from '@prisma/client';

/**
 * Returns state machine — Phase 1 (audit item 1.5).
 *
 * Allowed transitions:
 *   REQUESTED       → APPROVED | REJECTED | CANCELLED
 *   APPROVED        → RECEIVED | CANCELLED
 *   REJECTED        → (terminal)
 *   RECEIVED        → REFUND_INITIATED
 *   REFUND_INITIATED → REFUNDED | CANCELLED
 *   REFUNDED        → (terminal)
 *   CANCELLED       → (terminal)
 *
 * The terminal states have empty transition arrays. Any attempt to
 * transition out of a terminal state throws BadRequestException.
 */
const ALLOWED: Record<ReturnStatus, ReturnStatus[]> = {
  [ReturnStatus.REQUESTED]: [
    ReturnStatus.APPROVED,
    ReturnStatus.REJECTED,
    ReturnStatus.CANCELLED,
  ],
  [ReturnStatus.APPROVED]: [ReturnStatus.RECEIVED, ReturnStatus.CANCELLED],
  [ReturnStatus.REJECTED]: [],
  [ReturnStatus.RECEIVED]: [ReturnStatus.REFUND_INITIATED],
  [ReturnStatus.REFUND_INITIATED]: [ReturnStatus.REFUNDED, ReturnStatus.CANCELLED],
  [ReturnStatus.REFUNDED]: [],
  [ReturnStatus.CANCELLED]: [],
};

export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export const TERMINAL_STATES: ReadonlyArray<ReturnStatus> = [
  ReturnStatus.REJECTED,
  ReturnStatus.REFUNDED,
  ReturnStatus.CANCELLED,
];
