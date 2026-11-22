import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthUser, destroySession } from "@/lib/auth";
import { getCurrentSession, VIEW_SESSION_COOKIE } from "@/lib/session";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import Logo from "@/components/Logo";
import LanguageToggle from "@/components/LanguageToggle";
import SidebarNav from "@/components/SidebarNav";
import AppShell from "@/components/AppShell";

async function logout() {
  "use server";
  await destroySession();
  redirect("/login");
}

async function exitSessionViewMode() {
  "use server";
  const jar = await cookies();
  jar.set(VIEW_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  redirect("/sessions");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, current, lang] = await Promise.all([getAuthUser(), getCurrentSession(), getLang()]);
  if (!user) redirect("/login");
  const tr = t[lang];
  const isAdmin = user.role === "ADMIN";
  const isAccountant = user.role === "ACCOUNTANT";
  const isStaff = isAdmin || isAccountant;
  const jar = await cookies();
  const viewSessionId = isAdmin ? (jar.get(VIEW_SESSION_COOKIE)?.value || "") : "";
  const isReadOnlyView = !!(isAdmin && viewSessionId && current && current.id === viewSessionId && current.status !== "ACTIVE");
  const sections = isStaff
    ? [
        {
          title: lang === "ur" ? "جائزہ" : "Overview",
          items: [
            ["/dashboard", tr.dashboard, "🏠"],
            ...(isAdmin ? [["/sessions", tr.sessions, "📅"] as [string, string, string]] : []),
          ] as [string, string, string][],
        },
        {
          title: lang === "ur" ? "تعلیم و امتحانات" : "Academics",
          items: [
            ["/students", tr.students, "👩‍🎓"],
            ["/students/attention", lang === "ur" ? "توجہ درکار طلبہ" : "Needs Attention", "⚠️"],
            ["/examination", tr.examination, "📝"],
            ["/results", tr.results, "📊"],
            ["/results?view=annual", lang === "ur" ? "سالانہ نتیجہ" : "Annual Result", "🏆"],
            ["/results/stage-performance", lang === "ur" ? "مرحلہ وار کارکردگی" : "Stage Performance", "📈"],
            ["/certificates", tr.certificates, "🎓"],
          ] as [string, string, string][],
        },
        {
          title: lang === "ur" ? (isAdmin ? "مالیات و نظام" : "مالیات") : (isAdmin ? "Finance & System" : "Finance"),
          items: [
            ["/fees", tr.fees, "💳"],
            ["/fees/payments", lang === "ur" ? "حالیہ ادائیگیاں" : "Recent Payments", "🧾"],
            ...(isAdmin ? [["/settings", tr.settings, "⚙️"] as [string, string, string]] : []),
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
  const sidebar = (
    <>
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

      {isStaff && (
        <form action="/search" method="get" className="mb-4">
          <label className="block text-[11px] uppercase tracking-wider text-emerald-300/80 font-semibold mb-1.5">{lang === "ur" ? "گلوبل تلاش" : "Global Search"}</label>
          <div className="flex gap-2">
            <input name="q" placeholder={lang === "ur" ? "طالبہ، رسید، امتحان..." : "Student, receipt, exam..."} className="w-full rounded-lg bg-white/10 border border-emerald-700/50 px-3 py-2 text-sm text-white placeholder:text-emerald-200/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40" />
            <button className="shrink-0 rounded-lg bg-amber-400/20 border border-amber-300/30 px-3 py-2 text-sm hover:bg-amber-400/30" aria-label={lang === "ur" ? "تلاش" : "Search"}>🔍</button>
          </div>
        </form>
      )}

      <SidebarNav sections={sections} />

      <form action={logout} className="mt-4 pt-3 border-t border-emerald-700/40">
        <button className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-50 rounded-xl px-3 py-2.5 text-sm font-medium transition">
          <span>⎋</span><span>{tr.logout}</span>
        </button>
      </form>
    </>
  );

  return (
    <AppShell
      sidebar={sidebar}
      dir={lang === "ur" ? "rtl" : "ltr"}
      menuLabel={lang === "ur" ? "مینو" : "Menu"}
      closeLabel={lang === "ur" ? "بند کریں" : "Close"}
      brandTitle="Madrasa Sumiya-tul-Banat"
      searchPlaceholder={lang === "ur" ? "طالبہ، رسید، امتحان، سرٹیفکیٹ تلاش کریں..." : "Search student, receipt, exam, certificate..."}
      searchLabel={lang === "ur" ? "تلاش" : "Search"}
    >
      {!current && isStaff && (
        <div className="mb-5 bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-xl shadow-sm">
          <b>{tr.noActiveSessionWarn}</b>{" "}
          {isAdmin ? (<>{tr.createSelectSession} <Link className="underline font-semibold" href="/sessions">{tr.sessions}</Link> {tr.beforeEnteringData}</>) : (lang === "ur" ? "براہ کرم ایڈمن سے فعال سیشن بنانے/منتخب کرنے کو کہیں۔" : "Please ask admin to create/select an active session.")}
        </div>
      )}
      {isReadOnlyView && (
        <div className="mb-5 bg-blue-50 border border-blue-300 text-blue-900 p-4 rounded-xl shadow-sm flex items-center justify-between gap-3 flex-wrap">
          <div>
            <b>{lang === "ur" ? "ریڈ اونلی ویو:" : "Read-only view:"}</b>{" "}
            {lang === "ur"
              ? `آپ ختم شدہ سیشن "${current?.name}" کا ڈیٹا دیکھ رہے ہیں۔ اس موڈ میں کوئی تبدیلی محفوظ نہیں ہوگی۔`
              : `You are viewing expired session "${current?.name}". Changes are disabled in this mode.`}
          </div>
          <form action={exitSessionViewMode}>
            <button className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">{lang === "ur" ? "ویو موڈ ختم کریں" : "Exit View Mode"}</button>
          </form>
        </div>
      )}
      {children}
    </AppShell>
  );
}
