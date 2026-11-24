import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Logo from "@/components/Logo";
import PrintButton from "@/components/PrintButton";

export default async function StudentRollInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (user.role === "PARENT" && user.parentStudentId !== id) redirect("/dashboard");

  const session = await getCurrentSession();
  if (!session) return <p className="p-6">No session selected.</p>;

  const [student, enrollment] = await Promise.all([
    prisma.student.findUnique({ where: { id }, select: { id: true, admissionNo: true, nameEn: true, nameUr: true, fatherName: true, admissionClass: true } }),
    prisma.studentEnrollment.findUnique({ where: { studentId_sessionId: { studentId: id, sessionId: session.id } }, select: { rollNo: true } }),
  ]);
  if (!student || !enrollment) notFound();

  return (
    <div className="bg-white p-4 md:p-6 max-w-2xl mx-auto print-area">
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } .no-print { display:none !important; } }`}</style>
      <div className="no-print mb-4 flex items-center gap-3 flex-wrap">
        <Link href={`/students/${id}`} className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back to Profile / واپس</Link>
        <PrintButton label="Print / پرنٹ کریں" className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      <div className="border-2 border-emerald-800 rounded-xl p-5 md:p-6">
        <div className="flex items-center gap-3 border-b-2 border-emerald-200 pb-4 mb-4">
          <Logo size={56} />
          <div>
            <div className="text-xl font-extrabold text-emerald-900 leading-tight">Madrasa Sumiya-tul-Banat</div>
            <div className="font-urdu text-lg text-emerald-800">مدرسہ سمیّة البنات</div>
            <div className="text-sm text-gray-700 mt-1">Student Information / طالب علم کی معلومات</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 mb-4">
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs text-gray-600 mb-1">Student Name / طالب علم کا نام</div>
              <div className="text-xl font-bold text-gray-900">{student.nameEn}</div>
              {student.nameUr ? <div className="font-urdu text-xl text-gray-800 mt-0.5">{student.nameUr}</div> : null}
            </div>
            <div className="text-center bg-white border-2 border-emerald-500 rounded-xl px-6 py-3 w-full min-w-0 sm:w-auto sm:min-w-[140px]">
              <div className="text-xs text-gray-600">Roll No / رول نمبر</div>
              <div className="text-4xl font-extrabold text-emerald-900 leading-tight">{enrollment.rollNo || "-"}</div>
            </div>
          </div>
        </div>

        <table className="w-full text-sm border border-emerald-200 rounded-lg overflow-hidden">
          <tbody>
            <tr className="border-b border-emerald-100"><th className="p-3 text-left bg-emerald-50 w-1/3">Session / سیشن</th><td className="p-3 font-semibold">{session.name}</td></tr>
            <tr className="border-b border-emerald-100"><th className="p-3 text-left bg-emerald-50">Class / جماعت</th><td className="p-3">{student.admissionClass || "-"}</td></tr>
            <tr className="border-b border-emerald-100"><th className="p-3 text-left bg-emerald-50">Admission No / داخلہ نمبر</th><td className="p-3">{student.admissionNo}</td></tr>
            <tr><th className="p-3 text-left bg-emerald-50">Father Name / والد کا نام</th><td className="p-3">{student.fatherName || "-"}</td></tr>
          </tbody>
        </table>

        <p className="mt-4 text-xs text-gray-600 text-center">Please remember your Roll Number. / براہ کرم اپنا رول نمبر یاد رکھیں۔</p>
      </div>
    </div>
  );
}
