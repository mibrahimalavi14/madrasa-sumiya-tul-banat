"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Item = [string, string, string];
type Section = { title: string; items: Item[] };

export default function SidebarNav({ sections }: { sections: Section[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const fullPath = search ? `${pathname}?${search}` : pathname;
  const allHrefs = sections.flatMap(s => s.items.map(i => i[0]));
  return (
    <nav className="flex-1 space-y-4 mt-1 overflow-auto pr-1">
      {sections.map((section, idx) => (
        <div key={idx}>
          <div className="px-2 mb-1.5 flex items-center gap-2">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-600/50 to-transparent" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80 font-semibold whitespace-nowrap">{section.title}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-600/50 to-transparent" />
          </div>
          <div className="space-y-1.5">
            {section.items.map(([href, label, icon]) => {
              const [hrefPath, hrefQuery] = href.split("?");
              const querySpecificMatch = !hrefQuery && allHrefs.some((h) => {
                const [hp, hq] = h.split("?");
                return hq && hp === hrefPath && fullPath === h;
              });
              const exact = hrefQuery
                ? fullPath === href
                : pathname === hrefPath && !querySpecificMatch;
              const prefix = !hrefQuery && hrefPath !== "/dashboard" && pathname.startsWith(hrefPath + "/");
              const better = prefix && allHrefs.some((h) => {
                const [hp] = h.split("?");
                return h !== href && hp.startsWith(hrefPath + "/") && (pathname === hp || pathname.startsWith(hp + "/"));
              });
              const active = exact || (prefix && !better);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all border ${
                    active
                      ? "bg-gradient-to-r from-white/15 to-emerald-400/10 border-amber-300/40 text-white shadow-lg shadow-emerald-950/20"
                      : "border-transparent text-emerald-50/90 hover:bg-white/10 hover:border-emerald-700/50 hover:text-white"
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${active ? "bg-amber-400/20 ring-1 ring-amber-300/30" : "bg-white/5 group-hover:bg-white/10"}`}>{icon}</span>
                  <span className="font-medium leading-tight truncate">{label}</span>
                  {active && <span className="ml-auto h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]" />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
