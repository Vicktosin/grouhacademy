-- Office Life: weekend workdays at a made-up agency, one row per intern, track and day.

-- CreateTable
CREATE TABLE "OfficeLifeDay" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "programId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "score" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeLifeDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficeLifeDay_userId_programId_day_key" ON "OfficeLifeDay"("userId", "programId", "day");

-- AddForeignKey
ALTER TABLE "OfficeLifeDay" ADD CONSTRAINT "OfficeLifeDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
