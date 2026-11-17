import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { redirect } from "next/navigation";

export default async function FeesArrearsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  if (!session) return <p className="p-6">{ur ? "کوئی سیشن منتخب نہیں۔" : "No session selected."}</p>;

  const sStart = session.startDate ? new Date(session.startDate) : null;
  const sEnd = session.endDate ? new Date(session.endDate) : null;
  const months: { month: number; year: number; idx: number }[] = [];
  if (sStart && sEnd) {
    const startIdx = sStart.getFullYear() * 12 + sStart.getMonth();
    const endIdx = sEnd.getFullYear() * 12 + sEnd.getMonth();
    for (let idx = startIdx; idx <= endIdx; idx++) {
      months.push({ year: Math.floor(idx / 12), month: (idx % 12) + 1, idx });
    }
  } else {
    const now = new Date();
    const idx = now.getFullYear() * 12 + now.getMonth();
    months.push({ year: now.getFullYear(), month: now.getMonth() + 1, idx });
  }

  const [defaultAmountSettingSession, defaultAmountSettingGlobal, enrollsAllRaw, feesAll] = await Promise.all([
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: session.id }, select: { value: true } }),
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: null }, select: { value: true } }),
    prisma.studentEnrollment.findMany({
      where: { sessionId: session.id },
      select: { studentId: true, monthlyFee: true, feeExempt: true, student: { select: { admissionNo: true, nameEn: true, nameUr: true } } },
    }),
    prisma.feePayment.findMany({
      where: { sessionId: session.id },
      select: { studentId: true, month: true, year: true, amount: true, isPaid: true },
    }),
  ]);
  const defaultAmount = Number((defaultAmountSettingSession || defaultAmountSettingGlobal)?.value || 0);
  const enrolls = enrollsAllRaw
    .filter((en: any) => !(en as any).feeExempt)
    .sort((a: any, b: any) => {
      const na = parseInt(String(a.student?.admissionNo || "").replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(String(b.student?.admissionNo || "").replace(/\D/g, ""), 10) || 0;
      if (na !== nb) return na - nb;
      return String(a.student?.admissionNo || "").localeCompare(String(b.student?.admissionNo || ""));
    });
  const feeMap = new Map<string, any>();
  for (const f of feesAll as any[]) feeMap.set(`${f.studentId}:${f.year}:${f.month}`, f);

  const monthName = (m: number) => ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m] || String(m);

  const rows = enrolls.map((en: any) => {
    const items: { month: number; year: number; due: number }[] = [];
    for (const m of months) {
      const f = feeMap.get(`${en.studentId}:${m.year}:${m.month}`);
      if (f?.isPaid) continue;
      const studentFee = en.monthlyFee;
      const effectiveDefault = studentFee != null ? Number(studentFee) : defaultAmount;
      const due = f ? Number(f.amount || 0) : effectiveDefault;
      items.push({ month: m.month, year: m.year, due });
    }
    const total = items.reduce((s, i) => s + i.due, 0);
    return { en, items, total };
  }).filter(r => r.items.length > 0);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const totalPendingEntries = rows.reduce((s, r) => s + r.items.length, 0);

  return (
    <div className="bg-white p-4 md:p-6 max-w-6xl mx-auto print-area">
      <style>{`@media print { @page { size: A4; margin: 8mm; } .no-print { display:none !important; } }`}</style>
      <div className="no-print mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <a href="/fees" className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← {ur ? "فیس پر واپس" : "Back to Fees"}</a>
          <a href="/fees/session-report" className="text-sm text-teal-700 underline font-medium">{ur ? "سیشن رپورٹ" : "Session Report"}</a>
          <a href="/fees/defaulters" className="text-sm text-amber-700 underline font-medium">{ur ? "ماہانہ باقی فیس" : "Monthly Defaulters"}</a>
        </div>
        <a href="javascript:window.print()" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium">{ur ? "پرنٹ کریں" : "Print"}</a>
      </div>

      <div className="border border-amber-200 rounded-xl p-4 md:p-6">
        <div className="border-b border-amber-100 pb-4 mb-4">
          <h1 className="text-2xl font-extrabold text-amber-900">{ur ? "بقایا جات / Arrears Tracking" : "Arrears Tracking"}</h1>
          <p className="text-sm text-gray-600 mt-1">{ur ? "سیشن" : "Session"}: <b>{session.name}</b> · {ur ? "سیشن کے اندر تمام غیر ادا شدہ ماہانہ فیسیں" : "All unpaid monthly fees within the session"}</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <div className="border border-amber-100 rounded-lg p-3 bg-amber-50/40"><div className="text-xs text-gray-600">{ur ? "بقایا والے طلبہ" : "Students with Arrears"}</div><div className="text-2xl font-extrabold text-amber-900">{rows.length}</div></div>
          <div className="border border-red-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "غیر ادا شدہ اندراجات" : "Unpaid Entries"}</div><div className="text-2xl font-extrabold text-red-700">{totalPendingEntries}</div></div>
          <div className="border border-red-100 rounded-lg p-3 bg-red-50/30"><div className="text-xs text-gray-600">{ur ? "کل بقایا رقم" : "Total Arrears Amount"}</div><div className="text-2xl font-extrabold text-red-700">Rs {grandTotal}</div></div>
        </div>

        <div className="space-y-4">
          {rows.map(({ en, items, total }: any, i: number) => (
            <div key={en.studentId} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
                <div className="font-medium text-gray-900">{i + 1}. {en.student.admissionNo} — {en.student.nameEn} {en.student.nameUr ? <span className="font-urdu text-gray-600">/ {en.student.nameUr}</span> : null}</div>
                <div className="text-sm font-semibold text-red-700">{ur ? "کل بقایا" : "Total Arrears"}: Rs {total}</div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-t"><th className="p-2 text-left">{ur ? "مہینہ" : "Month"}</th><th className="p-2 text-right">{ur ? "واجب رقم" : "Due Amount"}</th><th className="p-2 text-center">{ur ? "حیثیت" : "Status"}</th></tr></thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={`${it.year}-${it.month}`} className="border-t">
                      <td className="p-2">{monthName(it.month)} {it.year} ({it.month}/{it.year})</td>
                      <td className="p-2 text-right font-medium">Rs {it.due}</td>
                      <td className="p-2 text-center"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">{ur ? "باقی" : "Unpaid"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {rows.length === 0 && <div className="p-6 text-center text-gray-500 border border-gray-200 rounded-lg">{ur ? "اس سیشن میں کوئی بقایا نہیں۔" : "No arrears in this session."}</div>}
        </div>
      </div>
    </div>
  );
}
