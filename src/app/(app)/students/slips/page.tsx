import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import PrintButton from "@/components/PrintButton";

export default async function StudentRollListPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const session = await getCurrentSession();
  if (!session) return <p className="p-6">No session selected.</p>;

  const enrolls = await prisma.studentEnrollment.findMany({
    where: { sessionId: session.id },
    select: {
      rollNo: true,
      student: { select: { id: true, admissionNo: true, nameEn: true, nameUr: true, fatherName: true, admissionClass: true } },
    },
  });

  const sorted = [...enrolls].sort((a, b) => {
    const ra = parseInt(String(a.rollNo || "").replace(/\D/g, ""), 10);
    const rb = parseInt(String(b.rollNo || "").replace(/\D/g, ""), 10);
    const ha = String(a.rollNo || "").trim() !== "" && Number.isFinite(ra);
    const hb = String(b.rollNo || "").trim() !== "" && Number.isFinite(rb);
    if (ha && hb && ra !== rb) return ra - rb;
    if (ha !== hb) return ha ? -1 : 1;
    if (ha && hb && ra === rb) return String(a.rollNo || "").localeCompare(String(b.rollNo || ""));
    const na = parseInt(String(a.student.admissionNo || "").replace(/\D/g, ""), 10) || 0;
    const nb = parseInt(String(b.student.admissionNo || "").replace(/\D/g, ""), 10) || 0;
    if (na !== nb) return na - nb;
    return String(a.student.admissionNo || "").localeCompare(String(b.student.admissionNo || ""));
  });

  return (
    <div className="bg-white min-h-screen p-2 md:p-4 print-area">
      <style>{`@media print { @page { size: A4 portrait; margin: 6mm; } .no-print { display:none !important; } body { background: white !important; } .roll-list-wrap { border-width: 1.5px !important; padding: 6px !important; } .roll-list-header { padding-bottom: 4px !important; margin-bottom: 6px !important; } .roll-list-table { font-size: 10.5px !important; } .roll-list-table th, .roll-list-table td { padding: 2px 5px !important; line-height: 1.2 !important; } .roll-list-note { margin-top: 4px !important; font-size: 9px !important; } }`}</style>
      <div className="no-print max-w-5xl mx-auto mb-3 flex items-center justify-between gap-3 flex-wrap">
        <Link href="/students" className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back to Students / واپس</Link>
        <div className="text-sm text-gray-600">Class Display List / کلاس فہرست</div>
        <PrintButton label="Print List / فہرست پرنٹ کریں" className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      <div className="roll-list-wrap max-w-5xl mx-auto border-2 border-emerald-800 rounded-lg p-3 md:p-4">
        <div className="roll-list-header flex items-center justify-between gap-3 border-b-2 border-emerald-200 pb-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="shrink-0 print:scale-90 origin-left"><Logo size={44} /></div>
            <div>
              <div className="text-lg md:text-xl font-extrabold text-emerald-900 leading-tight">Madrasa Sumiya-tul-Banat <span className="font-urdu text-base md:text-lg text-emerald-800 font-bold">/ مدرسہ سمیّة البنات</span></div>
              <div className="text-xs md:text-sm text-gray-700 font-semibold">Student Roll Number List / طلبہ کی رول نمبر فہرست (کلاس میں لگانے کے لیے)</div>
            </div>
          </div>
          <div className="text-xs bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            <div><span className="text-gray-600">Session / سیشن:</span> <span className="font-bold text-emerald-900">{session.name}</span> <span className="text-gray-500">|</span> <span className="text-gray-600">Total / کل:</span> <span className="font-semibold">{sorted.length}</span></div>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="roll-list-table w-full text-[12px] border border-emerald-200">
            <thead>
              <tr className="bg-emerald-800 text-white">
                <th className="py-1.5 px-2 text-center border border-emerald-900 w-10">#</th>
                <th className="py-1.5 px-2 text-center border border-emerald-900 w-20">Roll No<br /><span className="font-urdu text-[10px] font-normal">رول نمبر</span></th>
                <th className="py-1.5 px-2 text-left border border-emerald-900">Student Name / <span className="font-urdu text-[10px] font-normal">نام</span></th>
                <th className="py-1.5 px-2 text-left border border-emerald-900 w-28">Class / <span className="font-urdu text-[10px] font-normal">جماعت</span></th>
                <th className="py-1.5 px-2 text-center border border-emerald-900 w-28">Admission No<br /><span className="font-urdu text-[10px] font-normal">داخلہ نمبر</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((en, idx) => (
                <tr key={en.student.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/20"}>
                  <td className="py-1 px-2 text-center border border-emerald-100 text-gray-700">{idx + 1}</td>
                  <td className="py-1 px-2 text-center border border-emerald-100 font-extrabold text-[15px] text-emerald-900 leading-none">{en.rollNo || "-"}</td>
                  <td className="py-1 px-2 border border-emerald-100 text-gray-900">
                    <span className="font-semibold">{en.student.nameEn}</span>
                    {en.student.nameUr ? <span className="font-urdu text-gray-700"> / {en.student.nameUr}</span> : null}
                  </td>
                  <td className="py-1 px-2 border border-emerald-100">{en.student.admissionClass || "-"}</td>
                  <td className="py-1 px-2 text-center border border-emerald-100">{en.student.admissionNo}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-500 border border-emerald-100">No enrolled students found. / کوئی طالب علم نہیں ملا۔</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="roll-list-note mt-2 text-[10px] text-gray-600 flex items-center justify-between gap-3 flex-wrap">
          <div>Students can check their Name & Roll No. / طلبہ اپنا نام اور رول نمبر دیکھ سکتے ہیں۔</div>
          <div className="font-urdu" dir="rtl">مدرسہ سمیّة البنات</div>
        </div>
      </div>
    </div>
  );
}
