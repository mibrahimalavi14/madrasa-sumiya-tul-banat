import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { formatDateDMY } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";
import Logo from "@/components/Logo";
import PrintButton from "@/components/PrintButton";

export default async function StudentExamSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (user.role === "PARENT" && user.parentStudentId !== id) redirect("/dashboard");

  const session = await getCurrentSession();
  if (!session) return <p className="p-6">No session selected.</p>;

  const [student, enrollment, examsRaw] = await Promise.all([
    prisma.student.findUnique({ where: { id }, select: { id: true, admissionNo: true, nameEn: true, nameUr: true, fatherName: true, admissionClass: true } }),
    prisma.studentEnrollment.findUnique({ where: { studentId_sessionId: { studentId: id, sessionId: session.id } }, select: { rollNo: true } }),
    prisma.exam.findMany({ where: { sessionId: session.id }, select: { id: true, name: true, stage: true, examDate: true, hasWritten: true, hasOral: true } }),
  ]);
  if (!student || !enrollment) notFound();

  const exams = [...examsRaw].sort((a, b) => ((a as any).stage ?? 99) - ((b as any).stage ?? 99) || (a.examDate?.getTime() || 0) - (b.examDate?.getTime() || 0));
  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  const examDisplayName = (e: any) => examNameUr[Number(e.stage)] ? `${e.name} / ${examNameUr[Number(e.stage)]}` : e.name;

  return (
    <div className="bg-white p-4 md:p-6 max-w-3xl mx-auto print-area">
      <style>{`@media print { @page { size: A4; margin: 10mm; } .no-print { display:none !important; } }`}</style>
      <div className="no-print mb-4 flex items-center gap-3 flex-wrap">
        <Link href={`/students/${id}`} className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back to Profile / واپس</Link>
        <PrintButton label="Print Slip / سلپ پرنٹ کریں" className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      <div className="border-2 border-emerald-700 rounded-xl p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-emerald-700 via-teal-500 to-amber-500" />
        <div className="pt-2">
          <div className="flex items-start justify-between gap-4 border-b border-emerald-200 pb-3 mb-3">
            <div className="flex items-center gap-3">
              <Logo size={56} />
              <div>
                <div className="text-xl font-extrabold text-emerald-900 leading-tight">Madrasa Sumiya-tul-Banat</div>
                <div className="font-urdu text-lg text-emerald-800">مدرسہ سمیّة البنات</div>
                <div className="text-xs text-gray-600 mt-1">Student Exam Slip / طالب علم کا امتحانی سلپ (کلاس میں لگانے کے لیے)</div>
              </div>
            </div>
            <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3 min-w-[180px]">
              <div className="text-xs text-gray-600">Session / سیشن</div>
              <div className="font-bold text-emerald-900">{session.name}</div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
            <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs text-gray-600">Student Name / طالب علم کا نام</div>
                <div className="font-bold text-gray-900 text-lg">{student.nameEn} {student.nameUr ? <span className="font-urdu">/ {student.nameUr}</span> : null}</div>
              </div>
              <div className="text-center bg-white border-2 border-emerald-400 rounded-xl px-5 py-2">
                <div className="text-xs text-gray-600">Roll No / رول نمبر</div>
                <div className="text-3xl font-extrabold text-emerald-900 leading-tight">{enrollment.rollNo || "-"}</div>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Admission No / داخلہ نمبر</div><div className="font-semibold">{student.admissionNo}</div></div>
            <div className="border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Class / جماعت</div><div className="font-semibold">{student.admissionClass || "-"}</div></div>
            <div className="sm:col-span-2 border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Father Name / والد کا نام</div><div className="font-semibold">{student.fatherName || "-"}</div></div>
          </div>

          <div className="border border-emerald-200 rounded-lg p-3 mb-3">
            <h2 className="font-semibold text-emerald-900 mb-2">Exam Schedule & Details / امتحانی شیڈول اور تفصیلات</h2>
            {exams.length === 0 ? (
              <p className="text-sm text-gray-500">Exam schedule will be announced. / امتحانی شیڈول کا اعلان کیا جائے گا۔</p>
            ) : (
              <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Exam / امتحان</th><th className="p-2 text-center">Type / قسم</th><th className="p-2 text-center">Date / تاریخ</th></tr></thead><tbody>
                {exams.map(ex => (
                  <tr key={ex.id} className="border-t"><td className="p-2">{examDisplayName(ex)}</td><td className="p-2 text-center">{ex.hasWritten !== false && ex.hasOral !== false ? "Written + Oral / تحریری + زبانی" : ex.hasOral === false ? "Written / تحریری" : "Oral / زبانی"}</td><td className="p-2 text-center">{formatDateDMY(ex.examDate) || "-"}</td></tr>
                ))}
              </tbody></table></div>
            )}
          </div>

          <div className="text-sm text-gray-700 border border-dashed border-gray-300 rounded-lg p-3 space-y-1">
            <p><b>Instructions / ہدایات:</b></p>
            <p>• امتحان کے دن مقررہ وقت پر حاضر ہوں اور اپنا رول نمبر یاد رکھیں۔ / Arrive on time on exam day and remember your roll number.</p>
            <p>• ضروری سامان (قلم، پنسل وغیرہ) ساتھ لائیں اور امتحانی نظم و ضبط کی پابندی کریں۔ / Bring required stationery and follow exam discipline.</p>
            <p>• کسی بھی تفصیل/تبدیلی کے لیے مدرسہ انتظامیہ سے رابطہ کریں۔ / Contact madrasa administration for any details or updates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
