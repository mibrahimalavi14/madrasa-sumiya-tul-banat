"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AppShell({
  sidebar,
  children,
  dir,
  menuLabel,
  closeLabel,
  brandTitle,
  searchPlaceholder,
  searchLabel,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  dir: "ltr" | "rtl";
  menuLabel: string;
  closeLabel: string;
  brandTitle: string;
  searchPlaceholder?: string;
  searchLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen md:flex bg-emerald-50/30" dir={dir}>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white px-3 py-2.5 flex items-center justify-between gap-2 shadow-lg no-print">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-700/60 bg-white/10 px-3 py-2 text-sm font-medium"
          aria-label={menuLabel}
        >
          <span className="text-lg leading-none">☰</span>
          <span>{menuLabel}</span>
        </button>
        <div className="text-xs font-semibold truncate text-emerald-50/95">{brandTitle}</div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 z-50 md:z-auto w-72 max-w-[85vw] bg-gradient-to-b from-emerald-950 via-emerald-900 to-teal-950 text-white p-4 flex flex-col no-print shadow-2xl border-r border-emerald-800/40 transform transition-transform duration-200 ease-out md:transform-none md:translate-x-0 ${
          open ? "translate-x-0" : dir === "rtl" ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${dir === "rtl" ? "right-0 md:right-auto" : "left-0 md:left-auto"}`}
      >
        <div className="md:hidden flex items-center justify-end mb-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/60 bg-white/10 px-2.5 py-1.5 text-xs font-medium hover:bg-white/15"
          >
            <span aria-hidden>✕</span>
            <span>{closeLabel}</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{sidebar}</div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-emerald-100 px-4 sm:px-6 md:px-8 py-3 no-print">
          <form action="/search" method="get" className="flex items-center gap-2 max-w-xl">
            <input
              name="q"
              placeholder={searchPlaceholder || "Search..."}
              className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <button className="bg-emerald-800 hover:bg-emerald-900 text-white px-3 py-2 rounded-lg text-sm font-medium shrink-0">{searchLabel || "Search"}</button>
          </form>
        </div>
        <div className="p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
