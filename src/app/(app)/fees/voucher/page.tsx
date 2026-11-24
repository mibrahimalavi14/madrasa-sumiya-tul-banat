import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { formatDateDMY } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";
import Logo from "@/components/Logo";
import PrintButton from "@/components/PrintButton";

export default async function FeeVoucherPage({ searchParams }: { searchParams: Promise<{ studentId?: string; month?: string; year?: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const studentId = sp.studentId;
  const month = Number(sp.month);
  const year = Number(sp.year);
  if (!studentId || !Number.isFinite(month) || !Number.isFinite(year)) notFound();

  const session = await getCurrentSession();
  if (!session) return <p className="p-6">No session selected.</p>;

  if (user.role === "PARENT" && user.parentStudentId !== studentId) redirect("/dashboard");

  const [student, enrollment, fee, defaultAmountSettingSession, defaultAmountSettingGlobal] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true, admissionNo: true, nameEn: true, nameUr: true, fatherName: true, admissionClass: true } }),
    prisma.studentEnrollment.findUnique({ where: { studentId_sessionId: { studentId, sessionId: session.id } }, select: { monthlyFee: true, feeExempt: true } }),
    prisma.feePayment.findUnique({ where: { sessionId_studentId_month_year: { sessionId: session.id, studentId, month, year } }, select: { amount: true, paidAmount: true, isPaid: true, isLate: true, paidAt: true } }),
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: session.id }, select: { value: true } }),
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: null }, select: { value: true } }),
  ]);
  if (!student || !enrollment) notFound();

  const defaultAmount = Number((defaultAmountSettingSession || defaultAmountSettingGlobal)?.value || 0);
  const dueAmt = fee ? Number(fee.amount || 0) : (enrollment.monthlyFee != null ? Number(enrollment.monthlyFee) : defaultAmount);
  let paidAmt = fee ? Number(fee.paidAmount ?? 0) : 0;
  if (fee?.isPaid && paidAmt <= 0) paidAmt = Number(fee.amount || 0);
  const balance = Math.max(0, dueAmt - paidAmt);
  const fullyPaid = !!fee?.isPaid || (dueAmt > 0 && paidAmt >= dueAmt);
  const partial = paidAmt > 0 && paidAmt < dueAmt;
  const exempt = !!enrollment.feeExempt;
  const voucherNo = `VCH-${student.admissionNo}-${year}${String(month).padStart(2, "0")}`;
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[month] || String(month);
  const status = exempt ? "Exempt / معاف" : (fullyPaid ? "Paid / ادا شدہ" : (partial ? "Partial / جزوی" : "Unpaid / باقی"));

  return (
    <div className="bg-white p-4 md:p-6 max-w-3xl mx-auto print-area">
      <style>{`@media print { @page { size: A4; margin: 10mm; } .no-print { display:none !important; } }`}</style>
      <div className="no-print mb-4 flex items-center gap-3 flex-wrap">
        <a href={`/fees?month=${month}&year=${year}`} className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back to Fees / واپس</a>
        <PrintButton label="Print Voucher / واؤچر پرنٹ کریں" className="bg-teal-700 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      <div className="border-2 border-teal-800 rounded-xl p-5 md:p-7 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-teal-700 via-emerald-500 to-amber-500" />
        <div className="pt-2">
          <div className="flex items-start justify-between gap-4 flex-wrap border-b border-teal-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0"><Logo size={64} /></div>
              <div>
                <div className="text-xl md:text-2xl font-extrabold text-teal-900 leading-tight">Madrasa Sumiya-tul-Banat</div>
                <div className="font-urdu text-lg text-teal-800">مدرسہ سمیّة البنات</div>
                <div className="text-xs text-gray-600 mt-1">Fee Voucher / فیس واؤچر</div>
              </div>
            </div>
            <div className="text-sm bg-teal-50 border border-teal-200 rounded-lg p-3 w-full min-w-0 sm:w-auto sm:min-w-[220px]">
              <div className="flex justify-between gap-4"><span className="text-gray-600">Voucher No / واؤچر نمبر</span><span className="font-bold text-teal-900">{voucherNo}</span></div>
              <div className="flex justify-between gap-4 mt-1"><span className="text-gray-600">Session / سیشن</span><span className="font-semibold">{session.name}</span></div>
              <div className="flex justify-between gap-4 mt-1"><span className="text-gray-600">Month / مہینہ</span><span className="font-semibold">{monthName} {year}</span></div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Student Name / طالب علم کا نام</div><div className="font-semibold text-gray-900 mt-0.5">{student.nameEn} {student.nameUr ? <span className="font-urdu">/ {student.nameUr}</span> : null}</div></div>
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Admission No / داخلہ نمبر</div><div className="font-semibold text-gray-900 mt-0.5">{student.admissionNo}</div></div>
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Father Name / والد کا نام</div><div className="font-semibold text-gray-900 mt-0.5">{student.fatherName || "-"}</div></div>
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Class / جماعت</div><div className="font-semibold text-gray-900 mt-0.5">{student.admissionClass || "-"}</div></div>
          </div>

          <div className="mt-4 border border-teal-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-teal-50">
                <tr>
                  <th className="p-3 text-left">Description / تفصیل</th>
                  <th className="p-3 text-right">Amount / رقم</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3">Monthly Fee — {monthName} {year} <span className="text-gray-500">({session.name})</span></td>
                  <td className="p-3 text-right font-semibold">Rs {dueAmt}</td>
                </tr>
                {paidAmt > 0 && (
                  <tr className="border-t">
                    <td className="p-3 text-gray-700">Paid / Received So Far / موصولہ</td>
                    <td className="p-3 text-right font-semibold text-emerald-800">Rs {paidAmt}</td>
                  </tr>
                )}
                <tr className="border-t bg-teal-50/40">
                  <td className="p-3 font-semibold">{balance > 0 ? "Payable / Balance Due / واجب الادا" : "Balance / بقایا"}</td>
                  <td className="p-3 text-right font-extrabold text-lg text-teal-900">Rs {balance}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-sm flex flex-wrap gap-3 items-center justify-between">
            <div><b>Status / حیثیت:</b> <span className="font-medium">{status}</span></div>
            {fee?.paidAt && <div><b>Last Payment Date / آخری ادائیگی:</b> {formatDateDMY(fee.paidAt)}</div>}
          </div>

          <div className="mt-3 text-xs text-gray-600 border border-dashed border-gray-300 rounded-lg p-3">
            <p><b>Note / نوٹ:</b> براہِ کرم مقررہ وقت پر فیس جمع کروائیں۔ / Please deposit the fee on time.</p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
            <div className="text-center">
              <div className="border-t border-gray-700 pt-2 mt-8">Received By / وصول کنندہ</div>
              <div className="text-xs text-gray-500 mt-1">(Signature / دستخط)</div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-700 pt-2 mt-8">Office Stamp / دفتری مہر</div>
              <div className="text-xs text-gray-500 mt-1">(Stamp & Signature)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
