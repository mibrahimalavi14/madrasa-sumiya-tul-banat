import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser, destroySession } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import Logo from "@/components/Logo";
import LanguageToggle from "@/components/LanguageToggle";
import SidebarNav from "@/components/SidebarNav";

async function logout() {
  "use server";
  await destroySession();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, current, lang] = await Promise.all([getAuthUser(), getCurrentSession(), getLang()]);
  if (!user) redirect("/login");
  const tr = t[lang];
  const isAdmin = user.role === "ADMIN";
  const sections = isAdmin
    ? [
        {
          title: lang === "ur" ? "جائزہ" : "Overview",
          items: [
            ["/dashboard", tr.dashboard, "🏠"],
            ["/sessions", tr.sessions, "📅"],
          ] as [string, string, string][],
        },
        {
          title: lang === "ur" ? "تعلیم و امتحانات" : "Academics",
          items: [
            ["/students", tr.students, "👩‍🎓"],
            ["/examination", tr.examination, "📝"],
            ["/results", tr.results, "📊"],
            ["/certificates", tr.certificates, "🎓"],
          ] as [string, string, string][],
        },
        {
          title: lang === "ur" ? "مالیات و نظام" : "Finance & System",
          items: [
            ["/fees", tr.fees, "💳"],
            ["/settings", tr.settings, "⚙️"],
          ] as [string, string, string][],
        },
      ]
    : [
        {
          title: lang === "ur" ? "جائزہ" : "Overview",
          items: [
            ["/dashboard", tr.dashboard, "🏠"],
            ["/students", tr.myStudent, "👩‍🎓"],
          ] as [string, string, string][],
        },
        {
          title: lang === "ur" ? "ریکارڈ" : "Records",
          items: [
            ["/fees", tr.fees, "💳"],
            ["/results", tr.results, "📊"],
            ["/certificates", tr.certificates, "🎓"],
          ] as [string, string, string][],
        },
      ];
  return (
    <div className="min-h-screen flex bg-emerald-50/30" dir={lang === "ur" ? "rtl" : "ltr"}>
      <aside className="w-72 bg-gradient-to-b from-emerald-950 via-emerald-900 to-teal-950 text-white p-4 flex flex-col no-print shadow-2xl border-r border-emerald-800/40">
        <div className="mb-4 pb-4 border-b border-emerald-700/50">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-white/10">
            <div className="shrink-0 bg-white rounded-xl p-1 shadow-sm"><Logo size={42} /></div>
            <div className="min-w-0">
              <div className="font-bold text-[13px] leading-tight tracking-wide">Madrasa Sumiya-tul-Banat</div>
              <div className="font-urdu text-sm text-amber-200/90 mt-0.5">مدرسہ سمیّة البنات</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-emerald-300/80 font-semibold">{lang === "ur" ? "زبان" : "Language"}</span>
            <LanguageToggle lang={lang} />
          </div>
        </div>

        <div className="text-xs text-emerald-50 mb-4 bg-gradient-to-br from-emerald-800/60 to-teal-900/40 border border-emerald-600/40 rounded-2xl p-3 space-y-2 shadow-inner">
          <div className="flex items-center justify-between gap-2">
            <span className="text-emerald-300">{tr.user}</span>
            <span className="font-medium truncate max-w-[140px]">{user.name || user.username}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-emerald-300">Role</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-100 border border-amber-300/30 text-[10px] font-semibold">{user.role}</span>
          </div>
          <div className="pt-1 border-t border-emerald-700/40">
            <div className="text-emerald-300 mb-0.5">{tr.session}</div>
            <div className="font-medium text-[11px] leading-snug">{current ? `${current.name} • ${current.status}` : tr.noActiveSession}</div>
          </div>
        </div>

        <SidebarNav sections={sections} />

        <form action={logout} className="mt-4 pt-3 border-t border-emerald-700/40">
          <button className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-50 rounded-xl px-3 py-2.5 text-sm font-medium transition">
            <span>⎋</span><span>{tr.logout}</span>
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {!current && isAdmin && (
          <div className="mb-5 bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-xl shadow-sm">
            <b>{tr.noActiveSessionWarn}</b> {tr.createSelectSession} <Link className="underline font-semibold" href="/sessions">{tr.sessions}</Link> {tr.beforeEnteringData}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
