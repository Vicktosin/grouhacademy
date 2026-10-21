-- Repair databases where the original support-admin migration was recorded
-- as applied before the PostgreSQL enum value was actually added.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'SUPPORT_ADMIN';
