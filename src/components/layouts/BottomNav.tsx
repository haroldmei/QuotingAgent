"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/leads", label: "Leads", Icon: Home },
  { href: "/history", label: "History", Icon: Clock },
  { href: "/settings/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 h-16 bg-white border-t border-slate-200",
        "pb-safe",  // iOS safe area
        // Tablet+: hide BottomNav (could show sidebar nav instead)
        "md:hidden"
      )}
    >
      <ul className="flex h-full items-center justify-around px-2">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            href === "/leads"
              ? pathname === "/leads" || pathname.startsWith("/leads/")
              : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-11 rounded-xl transition-colors",
                  isActive
                    ? "text-[#F97316]"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Icon
                  className="h-5 w-5"
                  aria-hidden
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={cn(
                    "text-xs",
                    isActive ? "font-semibold" : "font-medium"
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
