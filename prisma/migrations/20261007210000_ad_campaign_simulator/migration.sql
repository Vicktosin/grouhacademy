-- AlterEnum
ALTER TYPE "LabKind" ADD VALUE 'ADS';

-- AlterTable
ALTER TABLE "LabAttempt" ADD COLUMN     "runs" JSONB;

-- AlterTable
ALTER TABLE "LabScenario" ADD COLUMN     "config" JSONB;

