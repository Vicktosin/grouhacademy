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
  const settings = await db.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data, updatedById },
    update: { ...data, updatedById },
  });

  // When the cohort system is switched OFF, start self-paced mode for every
  // paid intern still waiting for a cohort.
  if (data.cohortSystemEnabled === false) {
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
        data: { selfPacedStartDate: new Date() },
      });
      console.info(
        `[cohort-switch] Activated self-paced for ${stranded.length} stranded intern(s).`,
      );
    }
  }

  return settings;
}
