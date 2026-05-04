"use client";

import * as React from "react";

/**
 * Hamburger nav for the marketing header at <sm breakpoints.
 *
 * Pre-fix: nav links (How it works / Pricing / FAQ) were only visible on
 * desktop, so a mobile visitor literally couldn't reach pricing or FAQ
 * without scrolling to the footer. Trade owners overwhelmingly browse on
 * phones — this is a marketing-page conversion blocker.
 *
 * Kept as a focused client component so the rest of the marketing page
 * stays server-rendered (RSC bundle stays tiny).
 */
export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        className="sm:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 h-11 w-11"
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id="mobile-nav-menu"
          className="sm:hidden absolute left-0 right-0 top-full bg-white border-b border-slate-200 shadow-lg"
        >
          <nav
            className="flex flex-col px-4 py-2"
            aria-label="Mobile navigation"
          >
            <a
              href="#features"
              onClick={close}
              className="px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 rounded"
            >
              How it works
            </a>
            <a
              href="#pricing"
              onClick={close}
              className="px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 rounded"
            >
              Pricing
            </a>
            <a
              href="#faq"
              onClick={close}
              className="px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 rounded"
            >
              FAQ
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
