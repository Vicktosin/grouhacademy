import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";

type SummaryRow = {
  id: string;
  name: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  checksPassed: number | null;
  checksTotal: number | null;
  rating: number | null;
  submittedRun: number | null;
  submittedScore: number | null;
  runCount: number;
  bestScore: number | null;
  submittedAt: Date | null;
  updatedAt: Date;
};

/**
 * Interns' attempts at an exercise, newest first, as short summaries. The
 * counts and scores are worked out in the database so the code files and
 * simulator runs (which can be large) aren't sent; open one attempt with
 * ./[attemptId] for the full work.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const scenarioId = (await params).id;

  const rows = await getPrisma().$queryRaw<SummaryRow[]>`
    SELECT a."id", u."name", u."email", p."firstName", p."lastName",
           a."status"::text AS "status", a."checksPassed", a."checksTotal",
           (a."review"->>'rating')::int AS "rating",
           (a."review"->>'submittedRun')::int AS "submittedRun",
           (a."review"->>'score')::int AS "submittedScore",
           COALESCE(jsonb_array_length(a."runs"), 0)::int AS "runCount",
           (SELECT MAX((r->'result'->>'score')::int)
              FROM jsonb_array_elements(COALESCE(a."runs", '[]'::jsonb)) r) AS "bestScore",
           a."submittedAt", a."updatedAt"
    FROM "LabAttempt" a
    JOIN "User" u ON u."id" = a."userId"
    LEFT JOIN "Profile" p ON p."userId" = a."userId"
    WHERE a."scenarioId" = ${scenarioId}
    ORDER BY a."updatedAt" DESC
    LIMIT 200`;

  return NextResponse.json({
    attempts: rows.map((row) => ({
      id: row.id,
      intern:
        [row.firstName, row.lastName].filter(Boolean).join(" ") ||
        row.name ||
        row.email,
      email: row.email,
      status: row.status,
      checksPassed: row.checksPassed,
      checksTotal: row.checksTotal,
      rating: row.rating,
      submittedRun: row.submittedRun,
      submittedScore: row.submittedScore,
      runCount: row.runCount,
      bestScore: row.bestScore,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}
