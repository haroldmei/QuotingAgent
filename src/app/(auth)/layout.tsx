import { ToastProvider } from "@/components/ui/toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <main id="main" className="min-h-screen bg-white flex flex-col">
        {children}
      </main>
    </ToastProvider>
  );
}
