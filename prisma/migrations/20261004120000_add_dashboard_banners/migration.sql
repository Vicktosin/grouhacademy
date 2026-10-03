-- CreateTable
CREATE TABLE "DashboardBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "mobileImageUrl" TEXT,
    "buttonLabel" TEXT,
    "buttonUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardBanner_isActive_sortOrder_idx" ON "DashboardBanner"("isActive", "sortOrder");

