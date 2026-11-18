import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { formatDateDMY } from "@/lib/utils";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import PrintButton from "@/components/PrintButton";

export default async function StudentExamSlipsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const session = await getCurrentSession();
  if (!session) return <p className="p-6">No session selected.</p>;

  const [enrolls, examsRaw] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: { sessionId: session.id },
      select: {
        rollNo: true,
        student: { select: { id: true, admissionNo: true, nameEn: true, nameUr: true, fatherName: true, admissionClass: true } },
      },
      orderBy: { student: { admissionNo: "asc" } },
    }),
    prisma.exam.findMany({ where: { sessionId: session.id }, select: { id: true, name: true, stage: true, examDate: true, hasWritten: true, hasOral: true } }),
  ]);
  const exams = [...examsRaw].sort((a, b) => ((a as any).stage ?? 99) - ((b as any).stage ?? 99) || (a.examDate?.getTime() || 0) - (b.examDate?.getTime() || 0));
  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  const examDisplayName = (e: any) => examNameUr[Number(e.stage)] ? `${e.name} / ${examNameUr[Number(e.stage)]}` : e.name;

  return (
    <div className="bg-gray-100 min-h-screen p-3 md:p-4 print-area">
      <style>{`@media print { @page { size: A4; margin: 8mm; } .no-print { display:none !important; } body { background: white !important; } .slip-card { break-inside: avoid; page-break-inside: avoid; } }`}</style>
      <div className="no-print max-w-5xl mx-auto mb-4 flex items-center justify-between gap-3 flex-wrap bg-white border border-gray-200 rounded-xl p-3">
        <Link href="/students" className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back to Students / واپس</Link>
        <div className="font-semibold text-gray-800">Student Exam Slips / طلبہ کے امتحانی سلپس — {session.name} ({enrolls.length})</div>
        <PrintButton label="Print All Slips / تمام سلپس پرنٹ کریں" className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      {enrolls.length === 0 ? (
        <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-600">No enrolled students found.</div>
      ) : (
        <div className="max-w-5xl mx-auto grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {enrolls.map((en) => {
            const s = en.student;
            return (
              <div key={s.id} className="slip-card bg-white border-2 border-emerald-700 rounded-xl p-4 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-700 via-teal-500 to-amber-500" />
                <div className="pt-1">
                  <div className="flex items-start justify-between gap-3 border-b border-emerald-200 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Logo size={40} />
                      <div>
                        <div className="text-sm font-extrabold text-emerald-900 leading-tight">Madrasa Sumiya-tul-Banat</div>
                        <div className="font-urdu text-sm text-emerald-800 leading-tight">مدرسہ سمیّة البنات</div>
                        <div className="text-[10px] text-gray-600">Student Exam Slip / طالب علم کا امتحانی سلپ</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500">Session / سیشن</div>
                      <div className="text-xs font-semibold text-gray-800">{session.name}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] text-gray-600">Student Name / طالب علم کا نام</div>
                        <div className="font-bold text-gray-900 text-sm">{s.nameEn} {s.nameUr ? <span className="font-urdu">/ {s.nameUr}</span> : null}</div>
                      </div>
                      <div className="text-center bg-white border border-emerald-300 rounded-lg px-3 py-1 min-w-[90px]">
                        <div className="text-[10px] text-gray-600">Roll No / رول نمبر</div>
                        <div className="text-xl font-extrabold text-emerald-900 leading-tight">{en.rollNo || "-"}</div>
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded p-2"><div className="text-[10px] text-gray-500">Admission No / داخلہ نمبر</div><div className="font-semibold">{s.admissionNo}</div></div>
                    <div className="border border-gray-200 rounded p-2"><div className="text-[10px] text-gray-500">Class / جماعت</div><div className="font-semibold">{s.admissionClass || "-"}</div></div>
                    <div className="col-span-2 border border-gray-200 rounded p-2"><div className="text-[10px] text-gray-500">Father Name / والد کا نام</div><div className="font-semibold">{s.fatherName || "-"}</div></div>
                  </div>

                  <div className="border border-emerald-200 rounded-lg p-2 mb-2">
                    <div className="text-[11px] font-semibold text-emerald-900 mb-1">Exam Schedule / امتحانی شیڈول</div>
                    {exams.length === 0 ? (
                      <div className="text-[10px] text-gray-500">Exam schedule will be announced. / امتحانی شیڈول کا اعلان کیا جائے گا۔</div>
                    ) : (
                      <ul className="text-[10px] space-y-0.5 text-gray-700">
                        {exams.map(ex => (
                          <li key={ex.id} className="flex items-start justify-between gap-2">
                            <span>• {examDisplayName(ex)} {ex.hasOral === false ? "(Written)" : (ex.hasWritten === false ? "(Oral)" : "")}</span>
                            <span className="whitespace-nowrap font-medium">{formatDateDMY(ex.examDate) || "-"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="text-[10px] text-gray-700 border border-dashed border-gray-300 rounded p-2">
                    <b>Note / ہدایات:</b> امتحان کے دن وقت پر آئیں، اپنا رول نمبر یاد رکھیں اور نظم و ضبط برقرار رکھیں۔ / Arrive on time, remember your roll number, and follow exam rules.
                  </div>
                  <div className="mt-2 text-[9px] text-gray-400 text-center">Cut here / کاٹنے کی جگہ — — — — — — — — — —</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
