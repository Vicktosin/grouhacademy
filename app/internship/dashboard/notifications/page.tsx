import InternshipShell from "@/components/InternshipShell";
import NotificationsCenter from "@/components/NotificationsCenter";

export const metadata = {
  title: "Notifications | Internship Workspace",
};

// Interns' own notifications page, so the header bell never leaves the
// internship workspace.
export default function InternshipNotificationsPage() {
  return (
    <InternshipShell>
      <NotificationsCenter variant="internship" />
    </InternshipShell>
  );
}
