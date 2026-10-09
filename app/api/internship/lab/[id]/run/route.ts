import { NextResponse } from "next/server";
import { requireInternApi } from "@/lib/lab-api";
import {
  runAdsCampaign,
  runContent,
  runAutomationTest,
  runSocialWeek,
} from "@/lib/practice-lab";

// Judging plus the simulation takes seconds; AI content runs (an AI
// writes, then another judges, on free models) can take a minute or two.
export const maxDuration = 300;

/**
 * Runs a simulator exercise. Body: { campaign } for an ad campaign,
 * { plan } for a social media week, { workflow } to test an automation
 * on the sample records, or { work } to mark AI content.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  const body = (await request.json().catch(() => null)) as {
    campaign?: unknown;
    plan?: unknown;
    workflow?: unknown;
    work?: unknown;
  } | null;
  const id = (await params).id;
  if (!body?.campaign && !body?.plan && !body?.workflow && !body?.work)
    return NextResponse.json({ error: "Nothing to run." }, { status: 400 });
  const result = body.work
    ? await runContent(userId, id, body.work)
    : body.workflow
    ? await runAutomationTest(userId, id, body.workflow)
    : body.plan
      ? await runSocialWeek(userId, id, body.plan)
      : await runAdsCampaign(userId, id, body.campaign);
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
