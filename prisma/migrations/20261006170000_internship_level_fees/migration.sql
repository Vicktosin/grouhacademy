-- CreateTable
CREATE TABLE "InternshipLevelFee" (
    "programId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "acceptanceFee" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipLevelFee_pkey" PRIMARY KEY ("programId","levelId")
);

-- CreateIndex
CREATE INDEX "InternshipLevelFee_levelId_idx" ON "InternshipLevelFee"("levelId");

-- AddForeignKey
ALTER TABLE "InternshipLevelFee" ADD CONSTRAINT "InternshipLevelFee_programId_fkey" FOREIGN KEY ("programId") REFERENCES "InternshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipLevelFee" ADD CONSTRAINT "InternshipLevelFee_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

