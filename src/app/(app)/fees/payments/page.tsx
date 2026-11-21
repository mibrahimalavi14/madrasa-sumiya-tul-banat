import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { formatDateDMY } from "@/lib/utils";

export default async function RecentFeePaymentsPage() {
  const user = await getAuthUser();
  if (user?.role !== "ADMIN" && user?.role !== "ACCOUNTANT") redirect("/dashboard");
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  if (!session) return <p className="p-6">{ur ? "کوئی فعال سیشن نہیں۔" : "No active session."}</p>;

  const payments = await prisma.feePayment.findMany({
    where: { sessionId: session.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true, month: true, year: true, amount: true, paidAmount: true, isPaid: true, isLate: true, updatedAt: true,
      student: { select: { admissionNo: true, nameEn: true, nameUr: true } },
    },
  });

  return (
    <div className="space-y-5 theme-fees">
      <div className="bg-gradient-to-r from-violet-700 to-purple-700 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">{ur ? "حالیہ فیس ادائیگیاں" : "Recent Fee Payments"}</h1>
        <p className="text-sm text-violet-100 mt-1">{ur ? "تازہ ترین فیس ریکارڈز اور رسیدیں" : "Latest fee records and receipts"}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-violet-100 p-5 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-violet-950"><tr>
            <th className="p-2 text-left">{ur ? "تاریخ" : "Date"}</th>
            <th className="p-2 text-left">{ur ? "طالب علم" : "Student"}</th>
            <th className="p-2 text-center">{ur ? "مہینہ/سال" : "Month/Year"}</th>
            <th className="p-2 text-center">{ur ? "واجب" : "Due"}</th>
            <th className="p-2 text-center">{ur ? "ادا شدہ" : "Paid"}</th>
            <th className="p-2 text-center">{ur ? "حالت" : "Status"}</th>
            <th className="p-2 text-center">{ur ? "رسید" : "Receipt"}</th>
          </tr></thead>
          <tbody>
            {payments.map((f) => {
              const due = Number(f.amount || 0);
              const paid = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? due : 0);
              const full = paid >= due && due > 0;
              const partial = paid > 0 && paid < due;
              const label = full ? (f.isLate ? (ur ? "تاخیر سے ادا" : "Late Paid") : (ur ? "ادا شدہ" : "Paid")) : partial ? (ur ? "جزوی" : "Partial") : (ur ? "باقی" : "Pending");
              const cls = full ? (f.isLate ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800") : partial ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
              return (
                <tr key={f.id} className="border-t">
                  <td className="p-2">{formatDateDMY(f.updatedAt)}</td>
                  <td className="p-2">{f.student.admissionNo} - {f.student.nameEn}</td>
                  <td className="p-2 text-center">{f.month}/{f.year}</td>
                  <td className="p-2 text-center">Rs {due}</td>
                  <td className="p-2 text-center">Rs {paid}</td>
                  <td className="p-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span></td>
                  <td className="p-2 text-center"><Link href={`/fees/receipt/${f.id}`} className="text-violet-700 underline">{ur ? "رسید" : "Receipt"}</Link></td>
                </tr>
              );
            })}
            {payments.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-gray-500">{ur ? "کوئی فیس ریکارڈ نہیں۔" : "No fee records."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}