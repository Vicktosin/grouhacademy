// The onboarding page draws its own top bar: its back button steps back
// through the onboarding steps before leaving to the home page.
export default function InternshipOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
