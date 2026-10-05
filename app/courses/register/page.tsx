import type { Metadata } from "next";
import RegisterView from "@/components/auth/RegisterView";

export const metadata: Metadata = { title: "Create your student account" };

// Courses (LMS) sign-up. Same accounts as the internship, separate entry.
export default function CoursesRegisterPage() {
  return <RegisterView track="courses" />;
}
