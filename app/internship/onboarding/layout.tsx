import FlowExitBar from "@/components/FlowExitBar";

export default function InternshipOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FlowExitBar backHref="/" backLabel="Back to home" />
      {children}
    </>
  );
}
