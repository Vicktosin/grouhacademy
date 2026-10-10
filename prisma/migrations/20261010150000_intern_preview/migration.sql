-- "Experience as intern": each admin's hidden preview intern.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isPreview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "previewOwnerId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "User_previewOwnerId_key" ON "User"("previewOwnerId");
