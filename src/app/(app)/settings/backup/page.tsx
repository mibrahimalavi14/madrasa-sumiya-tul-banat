import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";

export default async function BackupCenterPage() {
  const user = await getAuthUser();
  if (user?.role !== "ADMIN") redirect("/dashboard");
  const lang = await getLang();
  const ur = lang === "ur";

  const exports = [
    {
      href: "/api/export/students",
      title: ur ? "طلبہ کا ڈیٹا" : "Students Data",
      desc: ur ? "طلبہ، داخلہ، کلاس/سیشن معلومات کا CSV بیک اپ۔" : "CSV backup of students, admissions, class/session info.",
    },
    {
      href: "/api/export/fees",
      title: ur ? "فیس کا ڈیٹا" : "Fees Data",
      desc: ur ? "فیس ادائیگیوں، ماہ/سال، رسید/حیثیت کا CSV بیک اپ۔" : "CSV backup of fee payments, month/year, receipt/status.",
    },
    {
      href: "/api/export/results",
      title: ur ? "نتائج کا ڈیٹا" : "Results Data",
      desc: ur ? "امتحانی نتائج، نمبر، گریڈ، پوزیشن کا CSV بیک اپ۔" : "CSV backup of exam results, marks, grades, positions.",
    },
    {
      href: "/api/export/certificates",
      title: ur ? "سرٹیفکیٹس کا ڈیٹا" : "Certificates Data",
      desc: ur ? "جاری شدہ سرٹیفکیٹس کا CSV بیک اپ۔" : "CSV backup of issued certificates.",
    },
  ];

  return (
    <div className="space-y-6 theme-settings">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{ur ? "بیک اپ سینٹر" : "Backup Center"}</h1>
            <p className="text-sm text-emerald-50 mt-1">
              {ur
                ? "اہم ڈیٹا کے CSV بیک اپ ڈاؤن لوڈ کریں اور بحالی کی رہنمائی دیکھیں۔"
                : "Download CSV backups of important data and view restore guidance."}
            </p>
          </div>
          <Link href="/settings" className="text-sm bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-1.5 rounded-lg">
            {ur ? "سیٹنگز پر واپس" : "Back to Settings"}
          </Link>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm">
        <b>{ur ? "اہم احتیاط:" : "Important:"}</b>{" "}
        {ur
          ? "بیک اپ فائلیں محفوظ جگہ (کمپیوٹر/ڈرائیو) پر رکھیں۔ مکمل ڈیٹابیس بحالی (restore) کے لیے Supabase backups/PITR استعمال کریں۔ CSV فائلیں ڈیٹا کے ریکارڈ/حوالے اور دستی بحالی میں مدد کے لیے ہیں؛ خودکار طور پر پورا ڈیٹابیس overwrite نہیں کیا جاتا۔"
          : "Store backup files in a safe place (computer/drive). For full database restore, use Supabase backups/PITR. CSV files are for data records/reference and manual recovery help; this page does not automatically overwrite the full database."}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
        <h2 className="text-lg font-semibold text-emerald-900 mb-1">{ur ? "CSV بیک اپ ڈاؤن لوڈ کریں" : "Download CSV Backups"}</h2>
        <p className="text-sm text-gray-600 mb-4">
          {ur
            ? "نیچے ہر بٹن سے متعلقہ ڈیٹا کی CSV فائل ڈاؤن لوڈ ہوگی۔ باقاعدگی سے (مثلاً ہفتہ وار/ماہانہ) بیک اپ لیں۔"
            : "Use the buttons below to download CSV files for each data type. Take backups regularly (e.g., weekly/monthly)."}
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {exports.map((item) => (
            <div key={item.href} className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/20">
              <div className="font-semibold text-emerald-900">{item.title}</div>
              <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
              <a
                href={item.href}
                className="inline-flex mt-3 bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {ur ? "CSV ڈاؤن لوڈ کریں" : "Download CSV"}
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
          <h2 className="font-semibold mb-2 text-emerald-900">{ur ? "بیک اپ لینے کا آسان طریقہ" : "Simple Backup Routine"}</h2>
          <ol className="text-sm text-gray-700 space-y-2 list-decimal pl-5">
            <li>{ur ? "اوپر چاروں CSV فائلیں ڈاؤن لوڈ کریں (Students, Fees, Results, Certificates)." : "Download all four CSV files above (Students, Fees, Results, Certificates)."}</li>
            <li>{ur ? "فائلوں کو تاریخ والے فولڈر میں محفوظ کریں (مثال: Backup-21-11-2026)." : "Save them in a dated folder (example: Backup-21-11-2026)."}</li>
            <li>{ur ? "اس فولڈر کو محفوظ جگہ پر رکھیں (Google Drive / USB / دوسرا کمپیوٹر)." : "Store the folder in a safe place (Google Drive / USB / another computer)."}</li>
            <li>{ur ? "اہم تبدیلیوں کے بعد یا کم از کم ہفتہ وار بیک اپ دہرائیں۔" : "Repeat after important changes, or at least weekly."}</li>
          </ol>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
          <h2 className="font-semibold mb-2 text-emerald-900">{ur ? "ڈیٹا بحالی (Restore) کی رہنمائی" : "Restore Guidance"}</h2>
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              {ur
                ? "اگر کبھی ڈیٹا ضائع ہو جائے تو مکمل بحالی کے لیے Supabase کا backup/restore بہترین ذریعہ ہے۔"
                : "If data is ever lost, Supabase backup/restore is the best option for full recovery."}
            </p>
            <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-900 p-3 text-xs">
              <div className="font-semibold mb-1">{ur ? "Supabase میں کیا کریں:" : "What to do in Supabase:"}</div>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>{ur ? "Supabase Dashboard → Project → Database / Backups کھولیں۔" : "Open Supabase Dashboard → Project → Database / Backups."}</li>
                <li>{ur ? "Automated backups چیک کریں؛ اگر plan میں PITR ہو تو enable کریں۔" : "Check automated backups; enable PITR if available on your plan."}</li>
                <li>{ur ? "ڈیٹا ضائع ہونے کی صورت میں Supabase کے restore/PITR طریقہ کار سے بحالی کریں۔" : "If data is lost, restore using Supabase's backup/PITR recovery process."}</li>
                <li>{ur ? "بحالی کے بعد app میں لاگ ان کر کے اہم ریکارڈز چیک کریں۔" : "After restore, log in to the app and verify key records."}</li>
              </ul>
            </div>
            <p className="text-xs text-gray-600">
              {ur
                ? "CSV بیک اپس آپ کے ڈیٹا کا محفوظ حوالہ ہیں۔ مکمل خودکار CSV restore فیچر جان بوجھ کر شامل نہیں کیا گیا تاکہ غلط import سے موجودہ ڈیٹا متاثر نہ ہو۔"
                : "CSV backups are your safe data reference. An automatic full CSV restore feature is intentionally not included to avoid accidental data corruption from incorrect imports."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}