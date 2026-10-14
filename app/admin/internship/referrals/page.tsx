import AdminShell from "@/components/AdminShell";
import ReferralDashboard from "@/components/ReferralDashboard";

export default function AdminReferralsPage() {
  return (
    <AdminShell workspace="internship">
      <ReferralDashboard />
    </AdminShell>
  );
}
