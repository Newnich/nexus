import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsModal } from "@/components/shortcuts-modal";
import { QuickCapture } from "@/components/quick-capture";
import { ThemeProvider } from "@/components/theme-toggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="md:ml-60 pb-16 md:pb-0">
          <Header />
          <main className="p-4 md:p-6">{children}</main>
        </div>
        <MobileNav />
        <CommandPalette />
        <ShortcutsModal />
        <QuickCapture />
      </div>
    </ThemeProvider>
  );
}
