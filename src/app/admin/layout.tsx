import AdminGuard from "@/components/AdminGuard";
import AppShell from "@/components/AppShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <AppShell userType="admin">{children}</AppShell>
    </AdminGuard>
  );
}
