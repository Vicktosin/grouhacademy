import AdminShell from "@/components/AdminShell";
import GuideVideoSetting from "@/components/admin/GuideVideoSetting";
import OfficeLifeBuilder from "@/components/OfficeLifeBuilder";

export default function AdminOfficeLifePage() {
  return (
    <AdminShell workspace="internship">
      <div className="space-y-5">
        <GuideVideoSetting guide="office-life" area="Office Life" />
        <OfficeLifeBuilder />
      </div>
    </AdminShell>
  );
}
