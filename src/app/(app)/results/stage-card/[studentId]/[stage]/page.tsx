import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { gradeFromPercentage, calculatePositions } from "@/lib/grading";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import Link from "next/link";

export default async function StageResultCard({ params }: { params: Promise<{ studentId: string; stage: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const { studentId, stage: stageParam } = await params;
  const stage = parseInt(stageParam, 10);
  if (![1, 2, 3, 4].includes(stage)) notFound();
  if (user.role === "PARENT" && user.parentStudentId !== studentId) redirect("/dashboard");

  const session = await getCurrentSession();
  if (!session) notFound();

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true, admissionNo: true, applicationNo: true, nameEn: true, nameUr: true, fatherName: true, motherName: true, admissionClass: true,
      enrollments: { where: { sessionId: session.id }, select: { rollNo: true } },
    },
  });
  if (!student) notFound();

  const exam = await prisma.exam.findFirst({
    where: { sessionId: session.id, stage },
    select: { id: true, name: true, stage: true, stageLabel: true, examDate: true, hasOral: true, subject: true },
  });
  if (!exam) notFound();

  const [result, allResults] = await Promise.all([
    prisma.result.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId } },
      select: { writtenObtained: true, writtenTotal: true, oralObtained: true, oralTotal: true, totalObtained: true, totalMarks: true, percentage: true, grade: true, status: true, position: true },
    }),
    prisma.result.findMany({
      where: { examId: exam.id },
      select: { studentId: true, percentage: true },
    }),
  ]);

  const posMap = calculatePositions(allResults.map(r => ({ id: r.studentId, percentage: r.percentage })));
  const position = posMap.get(studentId) ?? result?.position ?? null;
  const pct = result?.percentage != null ? Number(result.percentage) : null;
  const g = pct != null ? gradeFromPercentage(pct) : null;
  const status = result ? (result.status || g?.status || (pct != null ? (pct >= 40 ? "Pass" : "Fail") : "-")) : "-";
  const enr = student.enrollments[0];

  return (
    <div className="bg-white p-3 md:p-6 max-w-4xl mx-auto print-area">
      <style>{`@media print{ @page{ size:A4; margin:10mm } }`}</style>
      <div className="no-print mb-3 flex items-center gap-3 flex-wrap">
        <Link href={`/results/annual-card/${studentId}`} className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back</Link>
        <PrintButton label="Print Stage Result Card / مرحلہ وار رزلٹ کارڈ پرنٹ کریں" />
      </div>
      <div className="border-2 border-emerald-900 rounded-lg p-4 md:p-6">
        <div className="text-center border-b border-emerald-900 pb-3 mb-4">
          <div className="text-2xl md:text-3xl font-extrabold text-emerald-900">Madrasa Sumiya-tul-Banat</div>
          <div className="text-xl font-urdu text-emerald-800 mt-1">مدرسہ سمیّة البنات</div>
          <div className="mt-2 inline-block bg-emerald-900 text-white px-4 py-1.5 rounded text-sm font-semibold">Stage Result Card / مرحلہ وار رزلٹ کارڈ</div>
          <div className="text-sm text-gray-600 mt-2">Session: <b>{session.name}</b></div>
        </div>

        <div className="grid md:grid-cols-2 gap-2 text-sm mb-4">
          <div className="border rounded p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-gray-200">Student Name / طالب علم کا نام</div><div className="font-semibold">{student.nameEn} {student.nameUr ? <span className="font-urdu">({student.nameUr})</span> : ""}</div></div>
          <div className="border rounded p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-gray-200">Roll No / رول نمبر</div><div className="font-semibold">{enr?.rollNo || "-"}</div></div>
          <div className="border rounded p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-gray-200">Admission No / داخلہ نمبر</div><div className="font-semibold">{student.admissionNo}</div></div>
          <div className="border rounded p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-gray-200">Father / Mother Name / والد یا والدہ کا نام</div><div className="font-semibold">{[student.fatherName, student.motherName].filter(Boolean).join(" / ") || "-"}</div></div>
          <div className="border rounded p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-gray-200">Class / جماعت</div><div className="font-semibold">{student.admissionClass || "-"}</div></div>
          <div className="border rounded p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-gray-200">Application No / درخواست نمبر</div><div className="font-semibold">{student.applicationNo || "-"}</div></div>
        </div>

        <div className="border border-emerald-200 bg-emerald-50 rounded p-3 mb-4 text-sm">
          <div className="font-semibold text-emerald-900">{exam.name} {exam.stageLabel ? <span className="font-urdu">({exam.stageLabel})</span> : ""}</div>
          <div className="text-gray-600 mt-1">Stage: <b>{exam.stage}</b>{exam.subject ? <> · Subject: <b>{exam.subject}</b></> : ""}{exam.examDate ? <> · Date: <b>{new Date(exam.examDate).toLocaleDateString("en-GB")}</b></> : ""}</div>
        </div>

        <div className="overflow-auto mb-4">
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-emerald-50">
              <tr>
                <th className="p-2 border text-center">Written / تحریری</th>
                <th className="p-2 border text-center">Oral / زبانی</th>
                <th className="p-2 border text-center">Obtained / حاصل کردہ</th>
                <th className="p-2 border text-center">Total / کل نمبر</th>
                <th className="p-2 border text-center">Percentage / فیصد</th>
                <th className="p-2 border text-center">Grade / گریڈ</th>
                <th className="p-2 border text-center">Status / حیثیت</th>
                <th className="p-2 border text-center">Position / پوزیشن</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border text-center">{result ? `${result.writtenObtained ?? 0}/${result.writtenTotal ?? 0}` : "-"}</td>
                <td className="p-2 border text-center">{result ? `${result.oralObtained ?? 0}/${result.oralTotal ?? 0}` : (exam.hasOral === false ? "N/A" : "-")}</td>
                <td className="p-2 border text-center">{result?.totalObtained ?? "-"}</td>
                <td className="p-2 border text-center">{result?.totalMarks ?? "-"}</td>
                <td className="p-2 border text-center font-medium">{pct != null ? `${pct.toFixed(2)}%` : "-"}</td>
                <td className="p-2 border text-center font-semibold">{result?.grade ?? g?.grade ?? "-"}</td>
                <td className={`p-2 border text-center font-semibold ${status === "Pass" ? "text-emerald-700" : status === "Fail" ? "text-red-700" : ""}`}>{status}</td>
                <td className="p-2 border text-center font-semibold">{position ?? "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {!result && <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">No result found for this stage yet. / اس مرحلے کا نتیجہ ابھی موجود نہیں۔</div>}

        <div className="grid grid-cols-3 gap-6 text-sm text-center mt-8">
          <div><div className="border-t border-black pt-1 mt-8">Class Teacher / استاد</div></div>
          <div><div className="border-t border-black pt-1 mt-8">Office Incharge / دفتر انچارج</div></div>
          <div><div className="border-t border-black pt-1 mt-8">Principal / مہتمم/مہتممہ</div></div>
        </div>
      </div>
    </div>
  );
}
