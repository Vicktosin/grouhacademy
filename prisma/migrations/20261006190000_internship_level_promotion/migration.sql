-- AlterTable
ALTER TABLE "InternshipApplication" ADD COLUMN     "promotedFromId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InternshipApplication_promotedFromId_key" ON "InternshipApplication"("promotedFromId");

-- AddForeignKey
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_promotedFromId_fkey" FOREIGN KEY ("promotedFromId") REFERENCES "InternshipApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

