import ForgotPasswordView from "@/components/auth/ForgotPasswordView";
import { parseTrack } from "@/lib/learner-tracks";

// Shared by both sides; `?track=courses` keeps courses learners on the
// courses login when they finish.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const track = parseTrack((await searchParams).track) ?? "internship";
  return <ForgotPasswordView track={track} />;
}
