import TrainerGuard from "@/components/TrainerGuard";
import AppShell from "@/components/AppShell";

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TrainerGuard>
      <AppShell userType="trainer">{children}</AppShell>
    </TrainerGuard>
  );
}