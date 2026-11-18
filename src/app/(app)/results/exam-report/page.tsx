import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";

export default async function ExamResultReportPage({ searchParams }: { searchParams: Promise<{ examId?: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTANT") redirect("/dashboard");
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  if (!session) return <p className="p-6">{ur ? "کوئی سیشن منتخب نہیں۔" : "No session selected."}</p>;
  const sp = await searchParams;
  const examId = sp.examId;
  if (!examId) redirect("/results");

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, name: true, stage: true, sessionId: true, subject: true }
  });
  if (!exam || exam.sessionId !== session.id) redirect("/results");

  const [results, enrolls] = await Promise.all([
    prisma.result.findMany({
      where: { examId },
      select: { id: true, studentId: true, writtenObtained: true, writtenTotal: true, oralObtained: true, oralTotal: true, totalObtained: true, totalMarks: true, percentage: true, grade: true, status: true, position: true, student: { select: { admissionNo: true, nameEn: true, nameUr: true } } },
      orderBy: [{ position: "asc" }, { percentage: "desc" }],
    }),
    prisma.studentEnrollment.findMany({ where: { sessionId: session.id }, select: { studentId: true, rollNo: true } }),
  ]);
  const rollMap = new Map(enrolls.map(e => [e.studentId, e.rollNo]));
  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  const examDisplayName = (ur && exam.stage && examNameUr[Number(exam.stage)]) || exam.name;

  const total = results.length;
  const passed = results.filter((r: any) => r.status === "Pass").length;
  const failed = results.filter((r: any) => r.status === "Fail").length;
  const avg = total ? (results.reduce((s: number, r: any) => s + Number(r.percentage || 0), 0) / total) : 0;

  return (
    <div className="bg-white p-4 md:p-6 max-w-6xl mx-auto print-area">
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } .no-print { display:none !important; } }`}</style>
      <div className="no-print mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/results?examId=${exam.id}`} className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← {ur ? "نتائج پر واپس" : "Back to Results"}</Link>
        <PrintButton label={ur ? "رپورٹ پرنٹ کریں" : "Print Report"} className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      <div className="border border-emerald-200 rounded-xl p-4 md:p-6">
        <div className="border-b border-emerald-100 pb-4 mb-4">
          <h1 className="text-2xl font-extrabold text-emerald-900">{ur ? "امتحانی نتیجہ رپورٹ (میرٹ / پاس فیل)" : "Exam Result Report (Merit / Pass-Fail)"}</h1>
          <p className={`text-sm text-gray-700 mt-1 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>{ur ? "امتحان" : "Exam"}: <b>{examDisplayName}</b> · {ur ? "سیشن" : "Session"}: <b>{session.name}</b></p>
          {exam.subject && <p className="text-xs text-gray-500 mt-1">{ur ? "مضمون" : "Subject"}: {exam.subject}</p>}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="border border-emerald-100 rounded-lg p-3 bg-emerald-50/40"><div className="text-xs text-gray-600">{ur ? "کل طلبہ (نتائج)" : "Total Students (Results)"}</div><div className="text-2xl font-extrabold text-emerald-900">{total}</div></div>
          <div className="border border-emerald-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "کامیاب (Pass)" : "Passed"}</div><div className="text-2xl font-extrabold text-emerald-800">{passed}</div></div>
          <div className="border border-red-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "ناکام (Fail)" : "Failed"}</div><div className="text-2xl font-extrabold text-red-700">{failed}</div></div>
          <div className="border border-blue-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "اوسط فیصد" : "Average %"}</div><div className="text-2xl font-extrabold text-blue-800">{avg.toFixed(2)}%</div></div>
        </div>

        <h2 className="font-semibold text-emerald-900 mb-2">{ur ? "میرٹ لسٹ / تفصیلی نتائج" : "Merit List / Detailed Results"}</h2>
        <div className="overflow-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50"><tr>
              <th className="p-2 text-center">{ur ? "پوزیشن" : "Pos"}</th>
              <th className="p-2 text-center">{ur ? "رول نمبر" : "Roll No"}</th>
              <th className="p-2 text-left">{ur ? "داخلہ نمبر" : "Admission"}</th>
              <th className="p-2 text-left">{ur ? "نام" : "Name"}</th>
              <th className="p-2 text-center">{ur ? "تحریری" : "Written"}</th>
              <th className="p-2 text-center">{ur ? "زبانی" : "Oral"}</th>
              <th className="p-2 text-center">{ur ? "کل" : "Total"}</th>
              <th className="p-2 text-center">%</th>
              <th className="p-2 text-center">{ur ? "گریڈ" : "Grade"}</th>
              <th className="p-2 text-center">{ur ? "حیثیت" : "Status"}</th>
            </tr></thead>
            <tbody>
              {results.map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 text-center font-semibold">{r.position ?? "-"}</td>
                  <td className="p-2 text-center">{rollMap.get(r.studentId) || "-"}</td>
                  <td className="p-2">{r.student?.admissionNo || "-"}</td>
                  <td className="p-2">{r.student?.nameEn} {r.student?.nameUr ? <span className="font-urdu text-gray-600">/ {r.student.nameUr}</span> : null}</td>
                  <td className="p-2 text-center">{r.writtenObtained ?? "-"}/{r.writtenTotal ?? "-"}</td>
                  <td className="p-2 text-center">{r.oralObtained ?? "-"}/{r.oralTotal ?? "-"}</td>
                  <td className="p-2 text-center">{r.totalObtained ?? "-"}/{r.totalMarks ?? "-"}</td>
                  <td className="p-2 text-center">{r.percentage != null ? Number(r.percentage).toFixed(2) : "-"}</td>
                  <td className="p-2 text-center font-semibold">{r.grade || "-"}</td>
                  <td className={`p-2 text-center font-medium ${r.status === "Pass" ? "text-emerald-700" : "text-red-700"}`}>{r.status || "-"}</td>
                </tr>
              ))}
              {results.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-gray-500">{ur ? "اس امتحان کے کوئی نتائج محفوظ نہیں۔" : "No saved results for this exam."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
