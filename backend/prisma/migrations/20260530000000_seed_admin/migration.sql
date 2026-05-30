INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt", "updatedAt")
VALUES (
  'admin-uuid-0001',
  'admin@example.com',
  '$argon2id$v=19$m=65536,t=3,p=4$GuOSK3alyXLE+tgqtl6Jqw$4D119/OpGBMzezZnkHxZPtdo+8/F8s9MLZfzrEX/lKc',
  'ADMIN',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("email") DO UPDATE SET "role" = 'ADMIN';
