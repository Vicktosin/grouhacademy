import AdminShell from "@/components/AdminShell";
import FinanceInventory from "@/components/FinanceInventory";

export const dynamic = "force-dynamic";

export default function FinanceInventoryPage() {
  return (
    <AdminShell workspace="student">
      <FinanceInventory />
    </AdminShell>
  );
}
