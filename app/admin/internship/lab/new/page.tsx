import AdminShell from "@/components/AdminShell";
import LabScenarioBuilder from "@/components/LabScenarioBuilder";

export default function NewLabExercisePage() {
  return (
    <AdminShell workspace="internship">
      <LabScenarioBuilder />
    </AdminShell>
  );
}
