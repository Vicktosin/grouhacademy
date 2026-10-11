CREATE TABLE "OfficeLifeContent" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeLifeContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfficeLifeContent_programId_key" ON "OfficeLifeContent"("programId");

ALTER TABLE "OfficeLifeContent"
ADD CONSTRAINT "OfficeLifeContent_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "InternshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;