import { NextResponse } from "next/server";
import { requireInternApi } from "@/lib/lab-api";
import {
  runAdsCampaign,
  runAutomationTest,
  runSocialWeek,
} from "@/lib/practice-lab";

// Judging with Claude plus the simulation can take a few seconds.
export const maxDuration = 60;

/**
 * Runs a simulator exercise. Body: { campaign } for an ad campaign,
 * { plan } for a social media week, or { workflow } to test an automation
 * on the sample records.
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
  } | null;
  const id = (await params).id;
  if (!body?.campaign && !body?.plan && !body?.workflow)
    return NextResponse.json({ error: "Nothing to run." }, { status: 400 });
  const result = body.workflow
    ? await runAutomationTest(userId, id, body.workflow)
    : body.plan
      ? await runSocialWeek(userId, id, body.plan)
      : await runAdsCampaign(userId, id, body.campaign);
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
