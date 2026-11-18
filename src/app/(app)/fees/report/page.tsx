import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { formatDateDMY } from "@/lib/utils";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";

export default async function FeesReportPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTANT") redirect("/dashboard");
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  if (!session) return <p className="p-6">{ur ? "کوئی سیشن منتخب نہیں۔" : "No session selected."}</p>;

  const sp = await searchParams;
  const now = new Date();
  const sStart = session.startDate ? new Date(session.startDate) : null;
  const sEnd = session.endDate ? new Date(session.endDate) : null;
  const inSessionPeriod = (y: number, m: number) => {
    if (!sStart || !sEnd) return true;
    const startIdx = sStart.getFullYear() * 12 + sStart.getMonth();
    const endIdx = sEnd.getFullYear() * 12 + sEnd.getMonth();
    const curIdx = y * 12 + (m - 1);
    return curIdx >= startIdx && curIdx <= endIdx;
  };

  const yearSet = new Set<number>();
  if (sStart && sEnd) { for (let y = sStart.getFullYear(); y <= sEnd.getFullYear(); y++) yearSet.add(y); }
  else yearSet.add(now.getFullYear());
  const yearOptions = [...yearSet].sort((a,b)=>a-b);

  let year = Number(sp.year || "");
  if (!Number.isFinite(year) || !yearOptions.includes(year)) {
    const nowY = now.getFullYear();
    year = yearOptions.includes(nowY) ? nowY : yearOptions[0];
  }
  let month = Number(sp.month || "");
  if (!Number.isFinite(month) || month < 1 || month > 12 || !inSessionPeriod(year, month)) {
    if (sStart && inSessionPeriod(sStart.getFullYear(), sStart.getMonth() + 1)) {
      const prefY = sStart.getFullYear(); const prefM = sStart.getMonth() + 1;
      if (year === prefY) month = prefM; else {
        const found = Array.from({ length: 12 }, (_, i) => i + 1).find(m => inSessionPeriod(year, m));
        if (found) month = found; else { year = prefY; month = prefM; }
      }
    } else {
      const found = Array.from({ length: 12 }, (_, i) => i + 1).find(m => inSessionPeriod(year, m));
      month = found || (now.getMonth() + 1);
    }
  }
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1).filter(m => inSessionPeriod(year, m));
  const valid = inSessionPeriod(year, month);

  const [defaultAmountSettingSession, defaultAmountSettingGlobal, enrollsAllRaw, fees] = await Promise.all([
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: session.id }, select: { value: true } }),
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: null }, select: { value: true } }),
    valid ? prisma.studentEnrollment.findMany({
      where: { sessionId: session.id },
      select: { id: true, studentId: true, monthlyFee: true, feeExempt: true, student: { select: { id: true, admissionNo: true, nameEn: true } } },
    }) : Promise.resolve([] as any[]),
    valid ? prisma.feePayment.findMany({
      where: { sessionId: session.id, month, year },
      select: { id: true, studentId: true, amount: true, paidAmount: true, isPaid: true, isLate: true, paidAt: true },
    }) : Promise.resolve([] as any[]),
  ]);
  const defaultAmount = Number((defaultAmountSettingSession || defaultAmountSettingGlobal)?.value || 0);
  const enrolls = [...enrollsAllRaw]
    .filter((en: any) => !(en as any).feeExempt)
    .sort((a: any, b: any) => {
      const na = parseInt(String(a.student?.admissionNo || "").replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(String(b.student?.admissionNo || "").replace(/\D/g, ""), 10) || 0;
      if (na !== nb) return na - nb;
      return String(a.student?.admissionNo || "").localeCompare(String(b.student?.admissionNo || ""));
    });
  const map = new Map(fees.map((f: any) => [f.studentId, f]));

  const rows = enrolls.map((en: any) => {
    const f = map.get(en.studentId) as any;
    const studentFee = (en as any).monthlyFee;
    const effectiveDefault = studentFee != null ? Number(studentFee) : defaultAmount;
    const dueAmt = f ? Number(f.amount || 0) : effectiveDefault;
    let paidAmt = f ? Number(f.paidAmount ?? 0) : 0;
    if (f?.isPaid && paidAmt <= 0) paidAmt = Number(f.amount || 0); // compat
    const fullyPaid = !!f?.isPaid || (dueAmt > 0 && paidAmt >= dueAmt);
    const partial = paidAmt > 0 && paidAmt < dueAmt;
    const balance = Math.max(0, dueAmt - paidAmt);
    const late = !!(fullyPaid && f?.isLate);
    return { en, f, dueAmt, paidAmt, balance, paid: fullyPaid, partial, late };
  });
  const paidRows = rows.filter(r => r.paid);
  const unpaidRows = rows.filter(r => !r.paid); // includes partial
  const lateRows = rows.filter(r => r.late);
  const totalCollected = rows.reduce((s, r) => s + r.paidAmt, 0);
  const totalDue = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="bg-white p-4 md:p-6 max-w-5xl mx-auto print-area">
      <style>{`@media print { @page { size: A4; margin: 10mm; } .no-print { display:none !important; } }`}</style>
      <div className="no-print mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <a href={`/fees?month=${month}&year=${year}`} className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← {ur ? "فیس پر واپس" : "Back to Fees"}</a>
          <a href={`/fees/defaulters?month=${month}&year=${year}`} className="text-sm text-amber-700 underline font-medium">{ur ? "باقی فیس کی فہرست" : "Defaulters List"}</a>
        </div>
        <PrintButton label={ur ? "رپورٹ پرنٹ کریں" : "Print Report"} className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      <div className="border border-emerald-200 rounded-xl p-4 md:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-emerald-100 pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-emerald-900">{ur ? "ماہانہ فیس رپورٹ" : "Monthly Fee Report"}</h1>
            <p className="text-sm text-gray-600 mt-1">{ur ? "سیشن" : "Session"}: <b>{session.name}</b> · {ur ? "مہینہ/سال" : "Month/Year"}: <b>{month}/{year}</b></p>
          </div>
          <form className="no-print flex items-end gap-2 flex-wrap">
            <div>
              <label className="block text-xs text-gray-600 mb-1">{ur ? "مہینہ" : "Month"}</label>
              <select name="month" defaultValue={String(month)} className="border rounded px-2 py-1.5 text-sm">{monthOptions.map(m => <option key={m} value={m}>{m}</option>)}</select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">{ur ? "سال" : "Year"}</label>
              <select name="year" defaultValue={String(year)} className="border rounded px-2 py-1.5 text-sm">{yearOptions.map(y => <option key={y} value={y}>{y}</option>)}</select>
            </div>
            <button className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm">{ur ? "لوڈ" : "Load"}</button>
          </form>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="border border-emerald-100 rounded-lg p-3 bg-emerald-50/40"><div className="text-xs text-gray-600">{ur ? "کل طلبہ (فیس والے)" : "Total Students (Fee)"}</div><div className="text-2xl font-extrabold text-emerald-900">{rows.length}</div></div>
          <div className="border border-emerald-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "مکمل ادا شدہ / وصولی" : "Fully Paid / Collected"}</div><div className="text-xl font-extrabold text-emerald-800">{paidRows.length} <span className="text-sm font-semibold">(Rs {totalCollected})</span></div></div>
          <div className="border border-amber-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "باقی/جزوی (واجب)" : "Pending/Partial (Due)"}</div><div className="text-xl font-extrabold text-amber-800">{unpaidRows.length} <span className="text-sm font-semibold">(Rs {totalDue})</span></div></div>
          <div className="border border-red-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "تاخیر سے ادائیگی" : "Late Payments"}</div><div className="text-2xl font-extrabold text-red-700">{lateRows.length}</div></div>
        </div>

        <h2 className="font-semibold text-emerald-900 mb-2">{ur ? "طالب علم وار خلاصہ" : "Student-wise Summary"}</h2>
        <div className="overflow-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="p-2 text-left">{ur ? "داخلہ نمبر" : "Admission"}</th><th className="p-2 text-left">{ur ? "نام" : "Name"}</th><th className="p-2 text-right">{ur ? "واجب" : "Due"}</th><th className="p-2 text-right">{ur ? "ادا شدہ" : "Paid"}</th><th className="p-2 text-right">{ur ? "باقی" : "Balance"}</th><th className="p-2 text-center">{ur ? "حیثیت" : "Status"}</th><th className="p-2 text-center">{ur ? "ادائیگی کی تاریخ" : "Paid Date"}</th></tr></thead>
            <tbody>
              {rows.map(({ en, f, dueAmt, paidAmt, balance, paid, partial, late }) => (
                <tr key={en.id} className="border-t">
                  <td className="p-2">{en.student.admissionNo}</td>
                  <td className="p-2">{en.student.nameEn}</td>
                  <td className="p-2 text-right">Rs {dueAmt}</td>
                  <td className="p-2 text-right font-medium">Rs {paidAmt}</td>
                  <td className="p-2 text-right font-medium">{balance > 0 ? `Rs ${balance}` : "-"}</td>
                  <td className="p-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${paid ? (late ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800") : (partial ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")}`}>
                      {paid ? (late ? (ur ? "تاخیر" : "Late") : (ur ? "ادا شدہ" : "Paid")) : (partial ? (ur ? "جزوی" : "Partial") : (ur ? "باقی" : "Unpaid"))}
                    </span>
                  </td>
                  <td className="p-2 text-center">{formatDateDMY(f?.paidAt) || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-gray-500">{ur ? "اس مہینے کے لیے کوئی ریکارڈ نہیں۔" : "No records for this month."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
