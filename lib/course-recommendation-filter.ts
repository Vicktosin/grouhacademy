export function buildCourseRecommendationFilter(
  sourceLabels: Array<string | null | undefined>,
) {
  const labels = Array.from(
    new Set(
      (sourceLabels ?? [])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (!labels.length) {
    return undefined;
  }

  const clauses: Record<string, unknown>[] = [];

  for (const label of labels) {
    const normalized = label.trim().toLowerCase();
    const cleanTokens = Array.from(
      new Set(normalized.match(/[a-z0-9]+/g) ?? []),
    );

    if (!cleanTokens.length) continue;

    clauses.push(
      {
        category: {
          is: { name: { contains: normalized, mode: "insensitive" as const } },
        },
      },
      { title: { contains: normalized, mode: "insensitive" as const } },
      {
        slug: {
          contains: normalized.replace(/[^a-z0-9]+/g, "-"),
          mode: "insensitive" as const,
        },
      },
    );

    for (const token of cleanTokens) {
      clauses.push(
        {
          category: {
            is: { name: { contains: token, mode: "insensitive" as const } },
          },
        },
        { title: { contains: token, mode: "insensitive" as const } },
      );
    }
  }

  if (!clauses.length) {
    return undefined;
  }

  return { OR: clauses };
}
