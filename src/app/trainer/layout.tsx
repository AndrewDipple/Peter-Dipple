import TrainerGuard from "@/components/TrainerGuard";

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TrainerGuard>{children}</TrainerGuard>;
}