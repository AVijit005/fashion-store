-- Make AuditLog.userId nullable so unauthenticated/guest actions can still be logged.
ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;
