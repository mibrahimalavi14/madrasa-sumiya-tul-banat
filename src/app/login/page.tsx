import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { loginAction } from "./actions";
import Logo from "@/components/Logo";
import LanguageToggle from "@/components/LanguageToggle";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");
  const lang = await getLang();
  const tr = t[lang];
  const ur = lang === "ur";
  const sp = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 md:p-8" dir={lang === "ur" ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-800 to-amber-700" />
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative w-full max-w-5xl bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-6 md:p-8 border border-white/40">
        <div className="flex justify-end mb-2"><LanguageToggle lang={lang} /></div>

        <div className="text-center mb-6 md:mb-8">
          <div className="mx-auto mb-3 flex justify-center"><Logo size={72} /></div>
          <div className="text-3xl font-extrabold text-emerald-950 tracking-tight">Madrasa Sumiya-tul-Banat</div>
          <div className="text-2xl font-urdu text-emerald-700 mt-1">مدرسہ سمیّة البنات</div>
          <p className="text-gray-500 mt-2 text-sm">{tr.portalLogin}</p>
        </div>

        {sp.error && (
          <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            {sp.error === "portal"
              ? (ur ? "براہ کرم درست پورٹل سے لاگ ان کریں (مینجمنٹ/والدین)۔" : "Please login from the correct portal (Management/Parent).")
              : tr.invalidLogin}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5 md:gap-6 items-stretch">
          <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5 md:p-6 shadow-sm">
            <div className="mb-4 pb-3 border-b border-emerald-200">
              <h2 className="text-xl font-bold text-emerald-900">{ur ? "مینجمنٹ لاگ ان" : "Management Login"}</h2>
              <p className="text-sm text-emerald-800/80 mt-1">{ur ? "ایڈمن / انتظامیہ کے لیے" : "For admin / management staff"}</p>
            </div>
            <form action={loginAction} className="space-y-4">
              <input type="hidden" name="portal" value="admin" />
              <div>
                <label className="block text-sm font-medium text-gray-700">{tr.usernameLabel}</label>
                <input
                  name="username"
                  required
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tr.passwordLabel}</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-white"
                  placeholder="••••••••"
                />
              </div>
              <button className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-900/20 transition">
                {ur ? "مینجمنٹ لاگ ان" : "Login as Management"}
              </button>
            </form>

          </section>

          <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5 md:p-6 shadow-sm">
            <div className="mb-4 pb-3 border-b border-amber-200">
              <h2 className="text-xl font-bold text-amber-900">{ur ? "والدین کا لاگ ان" : "Parent Login"}</h2>
              <p className="text-sm text-amber-800/80 mt-1">{ur ? "والدین / سرپرست کے لیے" : "For parents / guardians"}</p>
            </div>
            <form action={loginAction} className="space-y-4">
              <input type="hidden" name="portal" value="parent" />
              <div>
                <label className="block text-sm font-medium text-gray-700">{tr.usernameLabel}</label>
                <input
                  name="username"
                  required
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tr.passwordLabel}</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 bg-white"
                  placeholder="••••••••"
                />
              </div>
              <button className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold py-3 rounded-xl shadow-lg shadow-amber-900/20 transition">
                {ur ? "والدین لاگ ان" : "Login as Parent"}
              </button>
            </form>

          </section>
        </div>
      </div>
    </div>
  );
}
