import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { formatDateDMY } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";
import Logo from "@/components/Logo";
import PrintButton from "@/components/PrintButton";

export default async function FeeReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const fee = await prisma.feePayment.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, admissionNo: true, nameEn: true, nameUr: true, fatherName: true } },
      session: { select: { id: true, name: true } },
    },
  });
  if (!fee) notFound();
  if (user.role === "PARENT" && user.parentStudentId !== fee.studentId) redirect("/dashboard");
  const paidAmount = Number((fee as any).paidAmount ?? 0) > 0 ? Number((fee as any).paidAmount ?? 0) : (fee.isPaid ? Number(fee.amount || 0) : 0);
  const dueAmount = Number(fee.amount || 0);
  const isFullyPaid = fee.isPaid || (dueAmount > 0 && paidAmount >= dueAmount);
  if (!isFullyPaid && paidAmount <= 0) notFound();

  const receiptNo = `RCP-${fee.id.slice(-8).toUpperCase()}`;
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[fee.month] || String(fee.month);
  const balance = Math.max(0, dueAmount - paidAmount);

  return (
    <div className="bg-white p-4 md:p-6 max-w-3xl mx-auto print-area">
      <style>{`@media print { @page { size: A4; margin: 10mm; } .no-print { display:none !important; } }`}</style>
      <div className="no-print mb-4 flex items-center gap-3 flex-wrap">
        <a href={`/fees?month=${fee.month}&year=${fee.year}`} className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back to Fees / واپس</a>
        <PrintButton label="Print Receipt / رسید پرنٹ کریں" className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      <div className="border-2 border-emerald-900 rounded-xl p-5 md:p-7 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-emerald-700 via-emerald-500 to-amber-500" />
        <div className="pt-2">
          <div className="flex items-start justify-between gap-4 flex-wrap border-b border-emerald-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0"><Logo size={64} /></div>
              <div>
                <div className="text-xl md:text-2xl font-extrabold text-emerald-900 leading-tight">Madrasa Sumiya-tul-Banat</div>
                <div className="font-urdu text-lg text-emerald-800">مدرسہ سمیّة البنات</div>
                <div className="text-xs text-gray-600 mt-1">Fee Receipt / فیس رسید</div>
              </div>
            </div>
            <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3 w-full min-w-0 sm:w-auto sm:min-w-[220px]">
              <div className="flex justify-between gap-4"><span className="text-gray-600">Receipt No / رسید نمبر</span><span className="font-bold text-emerald-900">{receiptNo}</span></div>
              <div className="flex justify-between gap-4 mt-1"><span className="text-gray-600">Date / تاریخ</span><span className="font-semibold">{formatDateDMY(fee.paidAt) || "-"}</span></div>
              <div className="flex justify-between gap-4 mt-1"><span className="text-gray-600">Session / سیشن</span><span className="font-semibold">{fee.session.name}</span></div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Student Name / طالب علم کا نام</div><div className="font-semibold text-gray-900 mt-0.5">{fee.student.nameEn} {fee.student.nameUr ? <span className="font-urdu">/ {fee.student.nameUr}</span> : null}</div></div>
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Admission No / داخلہ نمبر</div><div className="font-semibold text-gray-900 mt-0.5">{fee.student.admissionNo}</div></div>
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Father Name / والد کا نام</div><div className="font-semibold text-gray-900 mt-0.5">{fee.student.fatherName || "-"}</div></div>
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Fee Month / فیس کا مہینہ</div><div className="font-semibold text-gray-900 mt-0.5">{monthName} {fee.year} ({fee.month}/{fee.year})</div></div>
          </div>

          <div className="mt-4 border border-emerald-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="p-3 text-left">Description / تفصیل</th>
                  <th className="p-3 text-center">Status / حیثیت</th>
                  <th className="p-3 text-right">Amount / رقم</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3">Monthly Fee — {monthName} {fee.year} <span className="text-gray-500">({fee.session.name})</span></td>
                  <td className="p-3 text-center"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${balance > 0 ? "bg-amber-100 text-amber-800" : (fee.isLate ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}`}>{balance > 0 ? "Partial / جزوی" : (fee.isLate ? "Late / تاخیر" : "Paid / ادا شدہ")}</span></td>
                  <td className="p-3 text-right font-bold text-emerald-900">Rs {dueAmount}</td>
                </tr>
                {balance > 0 && (
                  <tr className="border-t">
                    <td className="p-3 text-gray-700">Amount Paid (Received so far) / موصولہ رقم</td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right font-semibold text-emerald-800">Rs {paidAmount}</td>
                  </tr>
                )}
                {balance > 0 && (
                  <tr className="border-t">
                    <td className="p-3 text-gray-700">Balance Due / بقایا</td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right font-semibold text-amber-800">Rs {balance}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-emerald-200 bg-emerald-50/50">
                  <td className="p-3 font-semibold" colSpan={2}>{balance > 0 ? "Total Received (So Far) / اب تک وصول شدہ" : "Total Received / کل وصول شدہ"}</td>
                  <td className="p-3 text-right font-extrabold text-lg text-emerald-900">Rs {paidAmount}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            <p><b>Note / نوٹ:</b> This is a computer-generated fee receipt for the above payment record. / یہ درج بالا ادائیگی کی کمپیوٹرائزڈ رسید ہے۔</p>
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
