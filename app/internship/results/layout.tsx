import FlowExitBar from "@/components/FlowExitBar";

export default function InternshipResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#F0F7FF]">
      <FlowExitBar backHref="/internship/dashboard" backLabel="Back to dashboard" />
      {children}
    </div>
  );
}
