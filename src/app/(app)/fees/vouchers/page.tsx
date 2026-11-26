import { prisma } from "@/lib/prisma";
import { getCurrentSession, inSessionPeriod } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Logo from "@/components/Logo";
import PrintButton from "@/components/PrintButton";
import Link from "next/link";

export default async function FeeVouchersBulkPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string; status?: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTANT") redirect("/dashboard");
  const session = await getCurrentSession();
  if (!session) return <p className="p-6">No session selected.</p>;
  const sp = await searchParams;
  const now = new Date();
  const month = Math.min(12, Math.max(1, Number(sp.month || (now.getMonth() + 1)) || (now.getMonth() + 1)));
  const year = Number(sp.year || now.getFullYear()) || now.getFullYear();
  const statusFilter = sp.status === "all" ? "all" : "pending"; // pending = unpaid/partial, all = all non-exempt

  if (!inSessionPeriod(year, month, session)) notFound();

  const [defaultAmountSettingSession, defaultAmountSettingGlobal, enrolls, fees] = await Promise.all([
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: session.id }, select: { value: true } }),
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: null }, select: { value: true } }),
    prisma.studentEnrollment.findMany({
      where: { sessionId: session.id, feeExempt: false },
      select: {
        studentId: true, monthlyFee: true,
        student: { select: { id: true, admissionNo: true, nameEn: true, nameUr: true, fatherName: true, admissionClass: true } },
      },
      orderBy: { student: { admissionNo: "asc" } },
    }),
    prisma.feePayment.findMany({ where: { sessionId: session.id, month, year }, select: { studentId: true, amount: true, paidAmount: true, isPaid: true, isLate: true, paidAt: true } }),
  ]);
  const defaultAmount = Number((defaultAmountSettingSession || defaultAmountSettingGlobal)?.value || 0);
  const feeMap = new Map(fees.map((f: any) => [f.studentId, f]));
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[month] || String(month);

  const items = (enrolls as any[]).map(en => {
    const f = feeMap.get(en.studentId) as any;
    const dueAmt = f ? Number(f.amount || 0) : (en.monthlyFee != null ? Number(en.monthlyFee) : defaultAmount);
    let paidAmt = f ? Number(f.paidAmount ?? 0) : 0;
    if (f?.isPaid && paidAmt <= 0) paidAmt = Number(f.amount || 0);
    const balance = Math.max(0, dueAmt - paidAmt);
    const fullyPaid = !!f?.isPaid || (dueAmt > 0 && paidAmt >= dueAmt);
    const partial = paidAmt > 0 && paidAmt < dueAmt;
    return { en, dueAmt, paidAmt, balance, fullyPaid, partial };
  }).filter(x => statusFilter === "all" ? true : !x.fullyPaid);

  return (
    <div className="bg-gray-100 min-h-screen p-3 md:p-4 print-area">
      <style>{`@media print { @page { size: A4; margin: 8mm; } .no-print { display:none !important; } body { background: white !important; } .voucher-sheet { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10px; } }`}</style>
      <div className="no-print max-w-5xl mx-auto mb-5 space-y-4">
        <div className="bg-gradient-to-r from-teal-800 to-emerald-700 text-white rounded-2xl shadow-sm p-5 md:p-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <Link href={`/fees?month=${month}&year=${year}`} className="inline-flex text-sm text-teal-50 hover:text-white font-medium">← Back to Fees / واپس</Link>
            <h1 className="text-2xl md:text-3xl font-bold">{statusFilter === "all" ? "All Fee Vouchers" : "Pending Fee Vouchers"}</h1>
            <p className="text-sm text-teal-50">{monthName} {year} · Session: {session.name}</p>
          </div>
          <PrintButton label="Print All Vouchers / سب واؤچر پرنٹ کریں" className="bg-white text-teal-900 hover:bg-teal-50 px-6 py-3.5 rounded-xl font-bold text-base shadow-sm border border-teal-100" />
        </div>
        <form className="bg-white border border-teal-100 rounded-2xl shadow-sm p-5 md:p-6 flex flex-wrap gap-5 items-end">
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="year" value={year} />
          <div className="w-full sm:w-auto sm:min-w-[320px]">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Show / دکھائیں</label>
            <select name="status" defaultValue={statusFilter} className="block w-full h-[52px] border border-gray-300 rounded-xl px-4 text-base bg-white focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400">
              <option value="pending">Pending / Unpaid & Partial</option>
              <option value="all">All (Non-exempt)</option>
            </select>
          </div>
          <button className="bg-teal-700 hover:bg-teal-800 text-white px-6 h-[52px] rounded-xl font-semibold text-base shadow-sm">Apply / لاگو کریں</button>
          <div className="text-gray-700 ml-auto bg-teal-50 border border-teal-100 rounded-xl px-5 py-3.5 text-base flex items-center min-h-[52px]">
            Total vouchers: <b className="text-teal-900 ml-1">{items.length}</b>
          </div>
        </form>
      </div>

      {items.length === 0 ? (
        <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-600 no-print">No vouchers to print for this selection.</div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-3">
          {items.map(({ en, dueAmt, paidAmt, balance, fullyPaid, partial }) => {
            const s = en.student;
            const voucherNo = `VCH-${s.admissionNo}-${year}${String(month).padStart(2, "0")}`;
            const status = fullyPaid ? "Paid / ادا شدہ" : (partial ? "Partial / جزوی" : "Unpaid / باقی");
            return (
              <div key={en.studentId} className="voucher-sheet bg-white border-2 border-teal-800 rounded-xl p-4 md:p-5 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-700 via-emerald-500 to-amber-500" />
                <div className="pt-1">
                  <div className="flex items-start justify-between gap-3 flex-wrap border-b border-teal-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="shrink-0"><Logo size={48} /></div>
                      <div>
                        <div className="text-lg font-extrabold text-teal-900 leading-tight">Madrasa Sumiya-tul-Banat <span className="font-urdu text-base text-teal-800">/ مدرسہ سمیّة البنات</span></div>
                        <div className="text-[11px] text-gray-600">Fee Voucher / فیس واؤچر · Session: {session.name}</div>
                      </div>
                    </div>
                    <div className="text-xs bg-teal-50 border border-teal-200 rounded-lg p-2 w-full min-w-0 sm:w-auto sm:min-w-[200px]">
                      <div className="flex justify-between gap-3"><span className="text-gray-600">Voucher No</span><span className="font-bold text-teal-900">{voucherNo}</span></div>
                      <div className="flex justify-between gap-3 mt-0.5"><span className="text-gray-600">Month</span><span className="font-semibold">{monthName} {year}</span></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                    <div className="border border-gray-200 rounded p-2"><div className="text-[10px] text-gray-500">Name / نام</div><div className="font-semibold text-gray-900">{s.nameEn} {s.nameUr ? <span className="font-urdu">/ {s.nameUr}</span> : null}</div></div>
                    <div className="border border-gray-200 rounded p-2"><div className="text-[10px] text-gray-500">Admission No</div><div className="font-semibold">{s.admissionNo}</div></div>
                    <div className="border border-gray-200 rounded p-2"><div className="text-[10px] text-gray-500">Father / والد</div><div className="font-semibold">{s.fatherName || "-"}</div></div>
                    <div className="border border-gray-200 rounded p-2"><div className="text-[10px] text-gray-500">Class / جماعت</div><div className="font-semibold">{s.admissionClass || "-"}</div></div>
                  </div>

                  <div className="mt-3 border border-teal-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-teal-50"><tr><th className="p-2 text-left">Description / تفصیل</th><th className="p-2 text-right">Amount</th></tr></thead>
                      <tbody>
                        <tr><td className="p-2">Monthly Fee — {monthName} {year}</td><td className="p-2 text-right font-semibold">Rs {dueAmt}</td></tr>
                        {paidAmt > 0 && <tr className="border-t"><td className="p-2 text-gray-700">Paid / موصولہ</td><td className="p-2 text-right font-semibold text-emerald-800">Rs {paidAmt}</td></tr>}
                        <tr className="border-t bg-teal-50/40"><td className="p-2 font-semibold">{balance > 0 ? "Payable / Balance Due / واجب الادا" : "Balance"}</td><td className="p-2 text-right font-extrabold text-teal-900">Rs {balance}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-[11px] flex flex-wrap gap-3 items-center justify-between">
                    <div><b>Status / حیثیت:</b> {status}</div>
                    <div className="text-gray-600">Please deposit fee on time. / مقررہ وقت پر فیس جمع کروائیں۔</div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-6 text-[11px] text-center">
                    <div><div className="border-t border-gray-600 pt-1 mt-4">Received By / وصول کنندہ</div></div>
                    <div><div className="border-t border-gray-600 pt-1 mt-4">Office Stamp / دفتری مہر</div></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
