import InternshipWorkspaceGate from "@/components/InternshipWorkspaceGate";

// No server work here, so the dashboard's pages are static files: the gate
// sends anyone without workspace access where they belong (from the shell
// request), and the APIs refuse them their data. The few server-rendered
// pages check for themselves (internshipWorkspaceRedirect).
export default function InternshipDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InternshipWorkspaceGate>{children}</InternshipWorkspaceGate>;
}
