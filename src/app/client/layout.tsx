import AppShell from "@/components/AppShell";
import ClientGuard from "@/components/ClientGuard";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientGuard>
      <AppShell userType="client">{children}</AppShell>
    </ClientGuard>
  );
}