import type { Metadata } from "next";
import LoginView from "@/components/auth/LoginView";

export const metadata: Metadata = { title: "Log in to your courses" };

// Courses (LMS) login. Same accounts as the internship, separate entry.
export default function CoursesLoginPage() {
  return <LoginView track="courses" />;
}
