-- CreateTable
CREATE TABLE "InternResourceRecommendation" (
    "programId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternResourceRecommendation_pkey" PRIMARY KEY ("programId","levelId","resourceId")
);

-- CreateIndex
CREATE INDEX "InternResourceRecommendation_programId_levelId_order_idx" ON "InternResourceRecommendation"("programId", "levelId", "order");

-- CreateIndex
CREATE INDEX "InternResourceRecommendation_resourceId_idx" ON "InternResourceRecommendation"("resourceId");

-- AddForeignKey
ALTER TABLE "InternResourceRecommendation" ADD CONSTRAINT "InternResourceRecommendation_programId_fkey" FOREIGN KEY ("programId") REFERENCES "InternshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceRecommendation" ADD CONSTRAINT "InternResourceRecommendation_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceRecommendation" ADD CONSTRAINT "InternResourceRecommendation_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "InternResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

