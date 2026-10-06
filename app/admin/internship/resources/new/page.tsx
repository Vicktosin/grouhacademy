import AdminShell from "@/components/AdminShell";
import ResourceBuilder from "@/components/ResourceBuilder";

export default function NewResourcePage() {
  return (
    <AdminShell workspace="internship">
      <ResourceBuilder />
    </AdminShell>
  );
}
