import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { WelcomeModal } from "@/components/WelcomeModal";
import { CommandPalette } from "@/components/CommandPalette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} name={user.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        </main>
      </div>
      <WelcomeModal />
      <CommandPalette />
    </div>
  );
}
