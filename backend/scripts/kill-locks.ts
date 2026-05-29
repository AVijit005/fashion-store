import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('Attempting to kill zombie database connections holding Prisma migration locks...');
  try {
    const result = await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND (state IN ('idle', 'idle in transaction') OR query LIKE '%pg_advisory_lock%');
    `);
    console.log('Successfully terminated zombie connections. Rows affected:', result);
  } catch (error) {
    console.error('Failed to terminate connections (this is usually fine if no locks exist):', (error as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
