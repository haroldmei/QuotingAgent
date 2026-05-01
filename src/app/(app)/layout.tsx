import { BottomNav } from "@/components/layouts/BottomNav";
import { ToastProvider } from "@/components/ui/toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {/* Main content — padded for bottom nav */}
      <main id="main" className="main-content min-h-screen bg-slate-50">
        {children}
      </main>
      <BottomNav />
    </ToastProvider>
  );
}
