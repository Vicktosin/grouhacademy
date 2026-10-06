-- CreateEnum
CREATE TYPE "InternResourceStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "InternResource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "status" "InternResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternResourceTrack" (
    "resourceId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternResourceTrack_pkey" PRIMARY KEY ("resourceId","programId")
);

-- CreateTable
CREATE TABLE "InternResourceModule" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT,
    "content" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternResourceModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternResourceModuleMaterial" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'link',
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternResourceModuleMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternResourceLesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternResourceLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternResourceLessonMaterial" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'link',
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternResourceLessonMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternResourceLessonProgress" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternResourceLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternResource_slug_key" ON "InternResource"("slug");

-- CreateIndex
CREATE INDEX "InternResource_status_idx" ON "InternResource"("status");

-- CreateIndex
CREATE INDEX "InternResourceTrack_programId_idx" ON "InternResourceTrack"("programId");

-- CreateIndex
CREATE INDEX "InternResourceModule_resourceId_idx" ON "InternResourceModule"("resourceId");

-- CreateIndex
CREATE INDEX "InternResourceModuleMaterial_moduleId_idx" ON "InternResourceModuleMaterial"("moduleId");

-- CreateIndex
CREATE INDEX "InternResourceLesson_moduleId_idx" ON "InternResourceLesson"("moduleId");

-- CreateIndex
CREATE INDEX "InternResourceLessonMaterial_lessonId_idx" ON "InternResourceLessonMaterial"("lessonId");

-- CreateIndex
CREATE INDEX "InternResourceLessonProgress_lessonId_idx" ON "InternResourceLessonProgress"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "InternResourceLessonProgress_userId_lessonId_key" ON "InternResourceLessonProgress"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "InternResource" ADD CONSTRAINT "InternResource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceTrack" ADD CONSTRAINT "InternResourceTrack_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "InternResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceTrack" ADD CONSTRAINT "InternResourceTrack_programId_fkey" FOREIGN KEY ("programId") REFERENCES "InternshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceModule" ADD CONSTRAINT "InternResourceModule_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "InternResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceModuleMaterial" ADD CONSTRAINT "InternResourceModuleMaterial_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "InternResourceModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceLesson" ADD CONSTRAINT "InternResourceLesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "InternResourceModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceLessonMaterial" ADD CONSTRAINT "InternResourceLessonMaterial_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "InternResourceLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceLessonProgress" ADD CONSTRAINT "InternResourceLessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternResourceLessonProgress" ADD CONSTRAINT "InternResourceLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "InternResourceLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

