import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import type { PlatformSettingsPatch } from "@/lib/platform-settings-validation";

const SETTINGS_ID = "singleton";

/**
 * Saves already-validated settings (lib/platform-settings-validation) and
 * runs their side effects. Used by the admin settings page and the MCP
 * update_platform_settings tool so both behave the same.
 */
export async function applyPlatformSettingsPatch(
  data: PlatformSettingsPatch,
  updatedById: string | null,
  db: PrismaClient = getPrisma(),
) {
  // Self-paced vs cohort: the three-way policy and the old on/off switch
  // stay in step (an old caller setting only the switch means cohort only
  // or self-paced only, as it always did).
  if (data.learningModePolicy) data = { ...data, cohortSystemEnabled: data.learningModePolicy !== "SELF_PACED_ONLY" };
  else if (data.cohortSystemEnabled !== undefined)
    data = { ...data, learningModePolicy: data.cohortSystemEnabled ? "COHORT_ONLY" : "SELF_PACED_ONLY" };

  const settings = await db.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data, updatedById },
    update: { ...data, updatedById },
  });

  // Self-paced only: start self-paced for every paid intern without a
  // cohort (waiting or not chosen yet). Interns in cohorts never change.
  if (data.learningModePolicy === "SELF_PACED_ONLY") {
    const stranded = await db.internshipApplication.findMany({
      where: {
        cohortId: null,
        selfPacedStartDate: null,
        status: { not: "REMOVED" },
        payment: { is: { status: "PAID" } },
        program: { excludeFromSelfPacedAndPools: false },
      },
      select: { id: true },
    });
    if (stranded.length > 0) {
      await db.internshipApplication.updateMany({
        where: { id: { in: stranded.map((a) => a.id) } },
        data: {
          selfPacedStartDate: new Date(),
          learningMode: "SELF_PACED",
          learningModeChosenAt: new Date(),
          cohortWaitlistedAt: null,
        },
      });
      console.info(
        `[cohort-switch] Activated self-paced for ${stranded.length} stranded intern(s).`,
      );
    }
  }

  return settings;
}
