import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { gradeFromPercentage, calculatePositions } from "@/lib/grading";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import Link from "next/link";

export default async function AnnualResultCard({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (user.role === "PARENT" && user.parentStudentId !== id) redirect("/dashboard");
  const session = await getCurrentSession();
  if (!session) notFound();
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      id: true, admissionNo: true, applicationNo: true, nameEn: true, nameUr: true, fatherName: true, motherName: true, admissionClass: true,
      enrollments: { where: { sessionId: session.id }, select: { rollNo: true, sessionId: true, session: { select: { name: true } } } },
    },
  });
  if (!student) notFound();
  const examsRaw = await prisma.exam.findMany({
    where: { sessionId: session.id },
    select: { id: true, name: true, stage: true, stageLabel: true, includedInAnnual: true, isDiagnostic: true, hasOral: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const exams = [...examsRaw].sort((a, b) => ((a as any).stage ?? 99) - ((b as any).stage ?? 99) || a.createdAt.getTime() - b.createdAt.getTime());
  const stageWeight: Record<number, number> = { 1: 20, 2: 20, 3: 20, 4: 40 };
  const included = exams.filter(e => {
    const st = e.stage as number | null | undefined;
    if (st && stageWeight[st]) return true;
    return e.includedInAnnual !== false && !e.isDiagnostic;
  });
  const includedIds = included.map(e => e.id);
  const examById = new Map(included.map(e => [e.id, e]));
  const [results, allResults] = await Promise.all([
    includedIds.length ? prisma.result.findMany({
      where: { studentId: id, examId: { in: includedIds } },
      select: { examId: true, writtenObtained: true, writtenTotal: true, oralObtained: true, oralTotal: true, totalObtained: true, totalMarks: true, percentage: true },
    }) : Promise.resolve([] as any[]),
    includedIds.length ? prisma.result.findMany({
      where: { examId: { in: includedIds } },
      select: { studentId: true, examId: true, totalObtained: true, totalMarks: true, percentage: true, exam: { select: { stage: true } } },
    }) : Promise.resolve([] as any[]),
  ]);
  const resMap = new Map(results.map((r: any) => [r.examId, r]));
  const byStudent = new Map<string, { stagePct: Record<number, number> }>();
  for (const r of allResults) {
    const cur = byStudent.get(r.studentId) || { stagePct: {} };
    const ex = examById.get(r.examId) || (r as any).exam;
    const st = (ex as any).stage as number | undefined;
    if (st) {
      const epct = r.percentage != null ? Number(r.percentage) : ((r.totalMarks ?? 0) > 0 ? ((r.totalObtained ?? 0) / (r.totalMarks ?? 1)) * 100 : 0);
      cur.stagePct[st] = epct;
    }
    byStudent.set(r.studentId, cur);
  }
  function weightedPct(stagePct: Record<number, number>) {
    let weighted = 0; let used = 0;
    for (const st of [1,2,3,4]) { const w = stageWeight[st]; if (stagePct[st] != null) { weighted += stagePct[st] * (w/100); used += w; } }
    return used > 0 ? (weighted / used) * 100 : 0;
  }
  const annualArr = [...byStudent.entries()].map(([sid, v]) => ({ id: sid, percentage: weightedPct(v.stagePct) }));
  const posMap = calculatePositions(annualArr.map(a => ({ id: a.id, percentage: a.percentage })));
  const mineStagePct = byStudent.get(id)?.stagePct || {};
  const pct = weightedPct(mineStagePct);
  const g = gradeFromPercentage(pct);
  const position = posMap.get(id) ?? null;
  const enr = student.enrollments[0];

  return (
    <div className="bg-white p-3 md:p-6 max-w-4xl mx-auto print-area">
      <style>{`@media print{ @page{ size:A4; margin:10mm } }`}</style>
      <div className="no-print mb-3 flex items-center gap-3 flex-wrap">
        <Link href="/results?view=annual" className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back</Link>
        <PrintButton label="Print Result Card / رزلٹ کارڈ پرنٹ کریں" />
      </div>
      <div className="border-2 border-emerald-900 rounded-lg p-4 md:p-6">
        <div className="text-center border-b border-emerald-900 pb-3 mb-4">
          <div className="text-2xl md:text-3xl font-extrabold text-emerald-900">Madrasa Sumiya-tul-Banat</div>
          <div className="text-xl font-urdu text-emerald-800 mt-1">مدرسہ سمیّة البنات</div>
          <div className="mt-2 inline-block bg-emerald-900 text-white px-4 py-1.5 rounded text-sm font-semibold">Annual Result Card / سالانہ رزلٹ کارڈ</div>
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

        <div className="overflow-auto mb-4">
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-emerald-50">
              <tr>
                <th className="p-2 border text-left">Exam / امتحان</th>
                <th className="p-2 border text-center">Written / تحریری</th>
                <th className="p-2 border text-center">Oral / زبانی</th>
                <th className="p-2 border text-center">Obtained / حاصل کردہ</th>
                <th className="p-2 border text-center">Total / کل نمبر</th>
                <th className="p-2 border text-center">Exam % / فیصد</th>
                <th className="p-2 border text-center">Weight / وزن</th>
                <th className="p-2 border text-center">Weighted / وزنی</th>
              </tr>
            </thead>
            <tbody>
              {included.map(ex => {
                const r = resMap.get(ex.id);
                const st = (ex as any).stage as number | undefined;
                const w = st ? (stageWeight[st] || 0) : 0;
                const epct = r?.percentage != null ? Number(r.percentage) : null;
                const wcon = epct != null ? (epct * (w/100)) : null;
                return (
                  <tr key={ex.id}>
                    <td className="p-2 border"><div className="font-medium">{ex.name}</div><div className="text-xs text-gray-500 font-urdu" dir="rtl">{(ex as any).stageLabel || ""}</div></td>
                    <td className="p-2 border text-center">{r ? `${r.writtenObtained ?? 0}/${r.writtenTotal ?? 0}` : "-"}</td>
                    <td className="p-2 border text-center">{r ? `${r.oralObtained ?? 0}/${r.oralTotal ?? 0}` : ((ex as any).hasOral === false ? "N/A" : "-")}</td>
                    <td className="p-2 border text-center">{r?.totalObtained ?? "-"}</td>
                    <td className="p-2 border text-center">{r?.totalMarks ?? "-"}</td>
                    <td className="p-2 border text-center">{epct != null ? epct.toFixed(2) : "-"}</td>
                    <td className="p-2 border text-center">{w ? `${w}%` : "-"}</td>
                    <td className="p-2 border text-center font-medium">{wcon != null ? wcon.toFixed(2) : "-"}</td>
                  </tr>
                );
              })}
              {included.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-gray-500 border">No included exams found.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="border border-emerald-200 bg-emerald-50 rounded p-3 text-center"><div className="text-xs text-gray-600 pb-1 mb-1 border-b border-emerald-200">Final % / حتمی فیصد</div><div className="text-xl font-bold text-emerald-900">{pct.toFixed(2)}%</div></div>
          <div className="border border-emerald-200 bg-emerald-50 rounded p-3 text-center"><div className="text-xs text-gray-600 pb-1 mb-1 border-b border-emerald-200">Grade / گریڈ</div><div className="text-xl font-bold text-emerald-900">{g.grade}</div></div>
          <div className="border border-emerald-200 bg-emerald-50 rounded p-3 text-center"><div className="text-xs text-gray-600 pb-1 mb-1 border-b border-emerald-200">Status / حیثیت</div><div className="text-xl font-bold text-emerald-900">{g.status}</div></div>
          <div className="border border-emerald-200 bg-emerald-50 rounded p-3 text-center"><div className="text-xs text-gray-600 pb-1 mb-1 border-b border-emerald-200">Position / پوزیشن</div><div className="text-xl font-bold text-emerald-900">{position ?? "-"}</div></div>
        </div>



        <div className="grid grid-cols-3 gap-6 text-sm text-center mt-8">
          <div><div className="border-t border-black pt-1 mt-8">Class Teacher / استاد</div></div>
          <div><div className="border-t border-black pt-1 mt-8">Office Incharge / دفتر انچارج</div></div>
          <div><div className="border-t border-black pt-1 mt-8">Principal / مہتمم/مہتممہ</div></div>
        </div>
      </div>
    </div>
  );
}
