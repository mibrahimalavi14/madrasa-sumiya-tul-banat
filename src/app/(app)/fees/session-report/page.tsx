import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { redirect } from "next/navigation";

export default async function FeesSessionReportPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  if (!session) return <p className="p-6">{ur ? "کوئی سیشن منتخب نہیں۔" : "No session selected."}</p>;

  const sStart = session.startDate ? new Date(session.startDate) : null;
  const sEnd = session.endDate ? new Date(session.endDate) : null;
  const months: { month: number; year: number }[] = [];
  if (sStart && sEnd) {
    const startIdx = sStart.getFullYear() * 12 + sStart.getMonth();
    const endIdx = sEnd.getFullYear() * 12 + sEnd.getMonth();
    for (let idx = startIdx; idx <= endIdx; idx++) {
      months.push({ year: Math.floor(idx / 12), month: (idx % 12) + 1 });
    }
  } else {
    const now = new Date();
    months.push({ year: now.getFullYear(), month: now.getMonth() + 1 });
  }

  const [defaultAmountSettingSession, defaultAmountSettingGlobal, enrollsAllRaw, feesAll] = await Promise.all([
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: session.id }, select: { value: true } }),
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: null }, select: { value: true } }),
    prisma.studentEnrollment.findMany({
      where: { sessionId: session.id },
      select: { id: true, studentId: true, monthlyFee: true, feeExempt: true },
    }),
    prisma.feePayment.findMany({
      where: { sessionId: session.id },
      select: { studentId: true, month: true, year: true, amount: true, paidAmount: true, isPaid: true, isLate: true },
    }),
  ]);
  const defaultAmount = Number((defaultAmountSettingSession || defaultAmountSettingGlobal)?.value || 0);
  const enrolls = enrollsAllRaw.filter((en: any) => !(en as any).feeExempt);
  const feeMap = new Map<string, any>();
  for (const f of feesAll as any[]) feeMap.set(`${f.studentId}:${f.year}:${f.month}`, f);

  const monthRows = months.map(({ month, year }) => {
    let paidCount = 0, unpaidCount = 0, lateCount = 0, collected = 0, due = 0;
    for (const en of enrolls as any[]) {
      const f = feeMap.get(`${en.studentId}:${year}:${month}`);
      const studentFee = en.monthlyFee;
      const effectiveDefault = studentFee != null ? Number(studentFee) : defaultAmount;
      const dueAmt = f ? Number(f.amount || 0) : effectiveDefault;
      let paidAmt = f ? Number(f.paidAmount ?? 0) : 0;
      if (f?.isPaid && paidAmt <= 0) paidAmt = Number(f.amount || 0);
      const fullyPaid = !!f?.isPaid || (dueAmt > 0 && paidAmt >= dueAmt);
      collected += paidAmt;
      const balance = Math.max(0, dueAmt - paidAmt);
      due += balance;
      if (fullyPaid) {
        paidCount++;
        if (f?.isLate) lateCount++;
      } else {
        unpaidCount++;
      }
    }
    return { month, year, total: enrolls.length, paidCount, unpaidCount, lateCount, collected, due };
  });

  const totals = monthRows.reduce((acc, r) => ({
    paidCount: acc.paidCount + r.paidCount,
    unpaidCount: acc.unpaidCount + r.unpaidCount,
    lateCount: acc.lateCount + r.lateCount,
    collected: acc.collected + r.collected,
    due: acc.due + r.due,
  }), { paidCount: 0, unpaidCount: 0, lateCount: 0, collected: 0, due: 0 });

  const monthName = (m: number) => ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m] || String(m);

  return (
    <div className="bg-white p-4 md:p-6 max-w-6xl mx-auto print-area">
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } .no-print { display:none !important; } }`}</style>
      <div className="no-print mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <a href="/fees" className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← {ur ? "فیس پر واپس" : "Back to Fees"}</a>
          <a href="/fees/report" className="text-sm text-emerald-700 underline font-medium">{ur ? "ماہانہ رپورٹ" : "Monthly Report"}</a>
          <a href="/fees/defaulters" className="text-sm text-amber-700 underline font-medium">{ur ? "باقی فیس کی فہرست" : "Defaulters List"}</a>
        </div>
        <a href="javascript:window.print()" className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium">{ur ? "رپورٹ پرنٹ کریں" : "Print Report"}</a>
      </div>

      <div className="border border-emerald-200 rounded-xl p-4 md:p-6">
        <div className="border-b border-emerald-100 pb-4 mb-4">
          <h1 className="text-2xl font-extrabold text-emerald-900">{ur ? "سیشن/سالانہ فیس رپورٹ" : "Session / Yearly Fee Report"}</h1>
          <p className="text-sm text-gray-600 mt-1">{ur ? "سیشن" : "Session"}: <b>{session.name}</b> {sStart && sEnd ? <span>· {ur ? "مدت" : "Period"}: <b>{monthName(sStart.getMonth()+1)} {sStart.getFullYear()} - {monthName(sEnd.getMonth()+1)} {sEnd.getFullYear()}</b></span> : null}</p>
          <p className="text-xs text-gray-500 mt-1">{ur ? "نوٹ: واجب الادا (Due) میں پچھلے مہینوں کی غیر ادا شدہ فیسیں بھی ہر مہینے کے حساب سے شامل ہیں (سیشن کے اندر)۔" : "Note: Due amounts include unpaid fees per month within the session period."}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="border border-emerald-100 rounded-lg p-3 bg-emerald-50/40"><div className="text-xs text-gray-600">{ur ? "کل فیس والے طلبہ" : "Fee Students"}</div><div className="text-2xl font-extrabold text-emerald-900">{enrolls.length}</div></div>
          <div className="border border-emerald-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "کل وصولی (سیشن)" : "Total Collected (Session)"}</div><div className="text-xl font-extrabold text-emerald-800">Rs {totals.collected}</div><div className="text-xs text-gray-500">{ur ? "مکمل ادا شدہ اندراجات" : "Fully paid entries"}: {totals.paidCount}</div></div>
          <div className="border border-amber-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "کل واجب/باقی (سیشن)" : "Total Due/Pending (Session)"}</div><div className="text-xl font-extrabold text-amber-800">Rs {totals.due}</div><div className="text-xs text-gray-500">{ur ? "باقی/جزوی اندراجات" : "Pending/partial entries"}: {totals.unpaidCount}</div></div>
          <div className="border border-red-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "تاخیر سے ادائیگیاں" : "Late Payments"}</div><div className="text-2xl font-extrabold text-red-700">{totals.lateCount}</div></div>
        </div>

        <h2 className="font-semibold text-emerald-900 mb-2">{ur ? "مہینہ وار خلاصہ" : "Month-wise Summary"}</h2>
        <div className="overflow-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="p-2 text-left">{ur ? "مہینہ" : "Month"}</th>
              <th className="p-2 text-center">{ur ? "کل" : "Total"}</th>
              <th className="p-2 text-center">{ur ? "ادا شدہ" : "Paid"}</th>
              <th className="p-2 text-center">{ur ? "باقی" : "Pending"}</th>
              <th className="p-2 text-center">{ur ? "تاخیر" : "Late"}</th>
              <th className="p-2 text-right">{ur ? "وصولی (Rs)" : "Collected (Rs)"}</th>
              <th className="p-2 text-right">{ur ? "واجب (Rs)" : "Due (Rs)"}</th>
              <th className="p-2 text-center no-print">{ur ? "تفصیل" : "Details"}</th>
            </tr></thead>
            <tbody>
              {monthRows.map(r => (
                <tr key={`${r.year}-${r.month}`} className="border-t">
                  <td className="p-2 font-medium">{monthName(r.month)} {r.year} <span className="text-gray-500 text-xs">({r.month}/{r.year})</span></td>
                  <td className="p-2 text-center">{r.total}</td>
                  <td className="p-2 text-center text-emerald-700 font-medium">{r.paidCount}</td>
                  <td className="p-2 text-center text-amber-700 font-medium">{r.unpaidCount}</td>
                  <td className="p-2 text-center text-red-700">{r.lateCount}</td>
                  <td className="p-2 text-right font-semibold">Rs {r.collected}</td>
                  <td className="p-2 text-right font-semibold">Rs {r.due}</td>
                  <td className="p-2 text-center no-print"><a href={`/fees/report?month=${r.month}&year=${r.year}`} className="text-emerald-700 underline">{ur ? "ماہانہ" : "Monthly"}</a></td>
                </tr>
              ))}
              {monthRows.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-gray-500">{ur ? "کوئی ڈیٹا نہیں۔" : "No data."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
