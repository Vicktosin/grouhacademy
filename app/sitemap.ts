import type { MetadataRoute } from "next";
import { getPublishedCourses } from "@/lib/course-data";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const now = new Date();
  const publicPages = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/tracks", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/career-navigator", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/internship", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" as const },
    {
      path: "/terms-of-service",
      priority: 0.2,
      changeFrequency: "yearly" as const,
    },
    {
      path: "/privacy-policy",
      priority: 0.2,
      changeFrequency: "yearly" as const,
    },
  ];
  const courses = await getPublishedCourses();
  return [
    ...publicPages.map((page) => ({
      url: `${baseUrl}${page.path}`,
      lastModified: now,
      priority: page.priority,
      changeFrequency: page.changeFrequency,
    })),
    ...courses.map((course) => ({
      url: `${baseUrl}/student/my-courses/${course.slug}/preview`,
      lastModified: course.updatedAt,
      priority: 0.8,
      changeFrequency: "weekly" as const,
    })),
  ];
}
