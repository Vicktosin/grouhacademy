import AdminShell from "@/components/AdminShell";
import LabScenarioBuilder from "@/components/LabScenarioBuilder";

export default async function EditLabExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminShell workspace="internship">
      <LabScenarioBuilder key={id} id={id} />
    </AdminShell>
  );
}
