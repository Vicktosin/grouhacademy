import AdminShell from "@/components/AdminShell";
import ResourceBuilder from "@/components/ResourceBuilder";

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminShell workspace="internship">
      <ResourceBuilder key={id} resourceId={id} />
    </AdminShell>
  );
}
