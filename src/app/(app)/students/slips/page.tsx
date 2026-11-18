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
    <div className="bg-white min-h-screen p-4 md:p-6 print-area">
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } .no-print { display:none !important; } body { background: white !important; } table { font-size: 13px; } th, td { padding: 8px 10px !important; } }`}</style>
      <div className="no-print max-w-5xl mx-auto mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Link href="/students" className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back to Students / واپس</Link>
        <div className="text-sm text-gray-600">Class Display List / کلاس فہرست</div>
        <PrintButton label="Print List / فہرست پرنٹ کریں" className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      <div className="max-w-5xl mx-auto border-2 border-emerald-800 rounded-xl p-4 md:p-5">
        <div className="flex items-center justify-between gap-4 border-b-2 border-emerald-200 pb-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Logo size={56} />
            <div>
              <div className="text-xl md:text-2xl font-extrabold text-emerald-900 leading-tight">Madrasa Sumiya-tul-Banat</div>
              <div className="font-urdu text-lg text-emerald-800">مدرسہ سمیّة البنات</div>
              <div className="text-sm text-gray-700 mt-1 font-semibold">Student Roll Number List / طلبہ کی رول نمبر فہرست (کلاس میں لگانے کے لیے)</div>
            </div>
          </div>
          <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 min-w-[200px]">
            <div><span className="text-gray-600">Session / سیشن:</span> <span className="font-bold text-emerald-900">{session.name}</span></div>
            <div className="mt-1"><span className="text-gray-600">Total Students / کل طلبہ:</span> <span className="font-semibold">{sorted.length}</span></div>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm border border-emerald-200">
            <thead>
              <tr className="bg-emerald-800 text-white">
                <th className="p-3 text-center border border-emerald-900 w-16">#</th>
                <th className="p-3 text-center border border-emerald-900 w-28">Roll No<br /><span className="font-urdu text-xs font-normal">رول نمبر</span></th>
                <th className="p-3 text-left border border-emerald-900">Student Name<br /><span className="font-urdu text-xs font-normal">طالب علم کا نام</span></th>
                <th className="p-3 text-left border border-emerald-900">Class<br /><span className="font-urdu text-xs font-normal">جماعت</span></th>
                <th className="p-3 text-center border border-emerald-900 w-32">Admission No<br /><span className="font-urdu text-xs font-normal">داخلہ نمبر</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((en, idx) => (
                <tr key={en.student.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                  <td className="p-3 text-center border border-emerald-100 font-medium text-gray-700">{idx + 1}</td>
                  <td className="p-3 text-center border border-emerald-100 font-extrabold text-lg text-emerald-900">{en.rollNo || "-"}</td>
                  <td className="p-3 border border-emerald-100 font-semibold text-gray-900">
                    <div>{en.student.nameEn}</div>
                    {en.student.nameUr ? <div className="font-urdu text-gray-700 text-base leading-snug">{en.student.nameUr}</div> : null}
                  </td>
                  <td className="p-3 border border-emerald-100">{en.student.admissionClass || "-"}</td>
                  <td className="p-3 text-center border border-emerald-100">{en.student.admissionNo}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500 border border-emerald-100">No enrolled students found. / کوئی طالب علم نہیں ملا۔</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-gray-600 flex items-center justify-between gap-3 flex-wrap">
          <div>Note: Students can check their Name and Roll Number from this list. / نوٹ: طلبہ اس فہرست سے اپنا نام اور رول نمبر دیکھ سکتے ہیں۔</div>
          <div className="font-urdu" dir="rtl">مدرسہ سمیّة البنات</div>
        </div>
      </div>
    </div>
  );
}
