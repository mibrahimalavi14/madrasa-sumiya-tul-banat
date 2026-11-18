import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { gradeFromPercentage, calculatePositions } from "@/lib/grading";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";

export default async function AnnualResultsReportPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  if (!session) return <p className="p-6">{ur ? "کوئی سیشن منتخب نہیں۔" : "No session selected."}</p>;

  const examsRaw = await prisma.exam.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } });
  const exams = [...examsRaw].sort((a, b) => ((a as any).stage ?? 99) - ((b as any).stage ?? 99) || a.createdAt.getTime() - b.createdAt.getTime());
  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  const examDisplayName = (e: any) => (ur && e?.stage && examNameUr[Number(e.stage)]) || e?.name || "-";

  const stageWeight: Record<number, number> = { 1: 20, 2: 20, 3: 20, 4: 40 };
  const annualExams = exams.filter(e => {
    const st = (e as any).stage as number | null | undefined;
    if (st && stageWeight[st]) return true;
    return (e as any).includedInAnnual !== false && !(e as any).isDiagnostic;
  });
  const examById = new Map(annualExams.map(e => [e.id, e]));
  const [enrollments, allResults] = await Promise.all([
    prisma.studentEnrollment.findMany({ where: { sessionId: session.id }, select: { studentId: true, rollNo: true } }),
    annualExams.length ? prisma.result.findMany({
      where: { examId: { in: annualExams.map(e=>e.id) } },
      select: { studentId: true, examId: true, totalObtained: true, totalMarks: true, percentage: true, student: { select: { id: true, nameEn: true, nameUr: true, admissionNo: true, admissionClass: true } }, exam: { select: { stage: true } } },
    }) : Promise.resolve([] as any[]),
  ]);
  const rollMap = new Map(enrollments.map(e => [e.studentId, e.rollNo]));
  const byStudent = new Map<string, { student: any; stagePct: Record<number, number>; stageMarks: Record<number, {o:number;t:number}> }>();
  for (const r of allResults as any[]) {
    const cur = byStudent.get(r.studentId) || { student: r.student, stagePct: {}, stageMarks: {} };
    const ex = examById.get(r.examId) || r.exam;
    const st = (ex as any)?.stage as number | undefined;
    if (st) {
      const pct = r.percentage != null ? Number(r.percentage) : ((r.totalMarks ?? 0) > 0 ? ((r.totalObtained ?? 0) / (r.totalMarks ?? 1)) * 100 : 0);
      cur.stagePct[st] = pct;
      cur.stageMarks[st] = { o: r.totalObtained ?? 0, t: r.totalMarks ?? 0 };
    }
    byStudent.set(r.studentId, cur);
  }
  const annual = [...byStudent.values()].map(v => {
    let weighted = 0; let usedWeight = 0; let obtained = 0; let total = 0;
    for (const st of [1,2,3,4]) {
      const w = stageWeight[st];
      if (v.stagePct[st] != null) {
        weighted += v.stagePct[st] * (w / 100);
        usedWeight += w;
        obtained += v.stageMarks[st]?.o ?? 0;
        total += v.stageMarks[st]?.t ?? 0;
      }
    }
    const pct = usedWeight > 0 ? (weighted / usedWeight) * 100 : 0;
    const g = gradeFromPercentage(pct);
    return { id: v.student.id, student: v.student, className: v.student.admissionClass || "-", rollNo: rollMap.get(v.student.id) || null, totalObtained: obtained, totalMarks: total, percentage: pct, grade: g.grade, status: g.status, stagePct: v.stagePct };
  });
  const posMap = calculatePositions(annual.map(a=>({id:a.id, percentage:a.percentage})));
  const annualWithPos = annual.map(a => ({ ...a, position: posMap.get(a.id) ?? null })).sort((a,b)=> (a.position ?? 999) - (b.position ?? 999) || (b.percentage - a.percentage));

  const totalStudents = annualWithPos.length;
  const passed = annualWithPos.filter(a => a.status === "Pass").length;
  const failed = annualWithPos.filter(a => a.status === "Fail").length;
  const avg = totalStudents ? annualWithPos.reduce((s,a)=>s + a.percentage, 0) / totalStudents : 0;
  const holders = annualWithPos.filter(a => a.position != null);

  const classMap = new Map<string, { className: string; total: number; passed: number; failed: number; sumPct: number }>();
  for (const a of annualWithPos) {
    const key = (a.className || "-").trim() || "-";
    const cur = classMap.get(key) || { className: key, total: 0, passed: 0, failed: 0, sumPct: 0 };
    cur.total += 1;
    if (a.status === "Pass") cur.passed += 1; else cur.failed += 1;
    cur.sumPct += a.percentage;
    classMap.set(key, cur);
  }
  const classSummary = [...classMap.values()].map(c => ({ ...c, avg: c.total ? c.sumPct / c.total : 0 })).sort((a,b)=>a.className.localeCompare(b.className));

  return (
    <div className="bg-white p-4 md:p-6 max-w-6xl mx-auto print-area">
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } .no-print { display:none !important; } }`}</style>
      <div className="no-print mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Link href="/results?view=annual" className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← {ur ? "سالانہ نتائج پر واپس" : "Back to Annual Results"}</Link>
        <PrintButton label={ur ? "سالانہ رپورٹ پرنٹ کریں" : "Print Annual Report"} className="bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium" />
      </div>

      <div className="border border-emerald-200 rounded-xl p-4 md:p-6">
        <div className="border-b border-emerald-100 pb-4 mb-4">
          <h1 className="text-2xl font-extrabold text-emerald-900">{ur ? "سالانہ مجموعی نتیجہ رپورٹ (میرٹ / پاس فیل)" : "Annual Combined Result Report (Merit / Pass-Fail)"}</h1>
          <p className="text-sm text-gray-700 mt-1">{ur ? "سیشن" : "Session"}: <b>{session.name}</b></p>
          <p className={`text-xs text-gray-600 mt-1 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>{ur ? "شامل امتحانات" : "Included exams"}: {annualExams.map(e=>examDisplayName(e)).join(ur ? "، " : ", ") || (ur ? "کوئی نہیں" : "None")}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <div className="border border-emerald-100 rounded-lg p-3 bg-emerald-50/40"><div className="text-xs text-gray-600">{ur ? "کل طلبہ" : "Total Students"}</div><div className="text-2xl font-extrabold text-emerald-900">{totalStudents}</div></div>
          <div className="border border-emerald-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "کامیاب (Pass)" : "Passed"}</div><div className="text-2xl font-extrabold text-emerald-800">{passed}</div></div>
          <div className="border border-red-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "ناکام (Fail)" : "Failed"}</div><div className="text-2xl font-extrabold text-red-700">{failed}</div></div>
          <div className="border border-blue-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "اوسط فیصد" : "Average %"}</div><div className="text-2xl font-extrabold text-blue-800">{avg.toFixed(2)}%</div></div>
          <div className="border border-amber-100 rounded-lg p-3"><div className="text-xs text-gray-600">{ur ? "پوزیشن ہولڈرز" : "Position Holders"}</div><div className="text-2xl font-extrabold text-amber-800">{holders.length}</div></div>
        </div>

        {holders.length > 0 && (
          <div className="mb-5">
            <h2 className="font-semibold text-emerald-900 mb-2">{ur ? "پوزیشن ہولڈرز" : "Position Holders"}</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {holders.map(h => (
                <div key={h.id} className="border border-amber-200 bg-amber-50/40 rounded-lg p-3 text-sm">
                  <div className="font-bold text-amber-900">{ur ? "پوزیشن" : "Position"}: {h.position}</div>
                  <div className="mt-1 font-medium">{h.student.nameEn} {h.student.nameUr ? <span className="font-urdu text-gray-700">/ {h.student.nameUr}</span> : null}</div>
                  <div className="text-xs text-gray-600 mt-1">{ur ? "کلاس" : "Class"}: {h.className || "-"} · {ur ? "رول" : "Roll"}: {h.rollNo || "-"} · {h.percentage.toFixed(2)}% · {h.grade}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {classSummary.length > 0 && (
          <div className="mb-5">
            <h2 className="font-semibold text-emerald-900 mb-2">{ur ? "کلاس وار خلاصہ (پاس/فیل)" : "Class-wise Summary (Pass/Fail)"}</h2>
            <div className="overflow-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-emerald-50"><tr>
                  <th className="p-2 text-left">{ur ? "کلاس" : "Class"}</th>
                  <th className="p-2 text-center">{ur ? "کل" : "Total"}</th>
                  <th className="p-2 text-center">{ur ? "کامیاب" : "Pass"}</th>
                  <th className="p-2 text-center">{ur ? "ناکام" : "Fail"}</th>
                  <th className="p-2 text-center">{ur ? "اوسط %" : "Avg %"}</th>
                </tr></thead>
                <tbody>
                  {classSummary.map(c => (
                    <tr key={c.className} className="border-t">
                      <td className="p-2 font-medium">{c.className || "-"}</td>
                      <td className="p-2 text-center">{c.total}</td>
                      <td className="p-2 text-center text-emerald-700 font-medium">{c.passed}</td>
                      <td className="p-2 text-center text-red-700 font-medium">{c.failed}</td>
                      <td className="p-2 text-center">{c.avg.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <h2 className="font-semibold text-emerald-900 mb-2">{ur ? "میرٹ لسٹ / تمام طلبہ" : "Merit List / All Students"}</h2>
        <div className="overflow-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50"><tr>
              <th className="p-2 text-center">{ur ? "پوزیشن" : "Pos"}</th>
              <th className="p-2 text-center">{ur ? "رول نمبر" : "Roll No"}</th>
              <th className="p-2 text-left">{ur ? "داخلہ نمبر" : "Admission"}</th>
              <th className="p-2 text-left">{ur ? "نام" : "Name"}</th>
              <th className="p-2 text-left">{ur ? "کلاس" : "Class"}</th>
              <th className="p-2 text-center">{ur ? "امتحان 1" : "Exam 1"}</th>
              <th className="p-2 text-center">{ur ? "امتحان 2" : "Exam 2"}</th>
              <th className="p-2 text-center">{ur ? "امتحان 3" : "Exam 3"}</th>
              <th className="p-2 text-center">{ur ? "امتحان 4" : "Exam 4"}</th>
              <th className="p-2 text-center">{ur ? "حاصل/کل" : "Obt/Total"}</th>
              <th className="p-2 text-center">%</th>
              <th className="p-2 text-center">{ur ? "گریڈ" : "Grade"}</th>
              <th className="p-2 text-center">{ur ? "حیثیت" : "Status"}</th>
            </tr></thead>
            <tbody>
              {annualWithPos.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="p-2 text-center font-semibold">{a.position ?? "-"}</td>
                  <td className="p-2 text-center">{a.rollNo || "-"}</td>
                  <td className="p-2">{a.student.admissionNo || "-"}</td>
                  <td className="p-2">{a.student.nameEn} {a.student.nameUr ? <span className="font-urdu text-gray-600">/ {a.student.nameUr}</span> : null}</td>
                  <td className="p-2">{a.className || "-"}</td>
                  <td className="p-2 text-center">{a.stagePct?.[1] != null ? a.stagePct[1].toFixed(1) : "-"}</td>
                  <td className="p-2 text-center">{a.stagePct?.[2] != null ? a.stagePct[2].toFixed(1) : "-"}</td>
                  <td className="p-2 text-center">{a.stagePct?.[3] != null ? a.stagePct[3].toFixed(1) : "-"}</td>
                  <td className="p-2 text-center">{a.stagePct?.[4] != null ? a.stagePct[4].toFixed(1) : "-"}</td>
                  <td className="p-2 text-center">{a.totalObtained}/{a.totalMarks}</td>
                  <td className="p-2 text-center font-medium">{a.percentage.toFixed(2)}</td>
                  <td className="p-2 text-center font-semibold">{a.grade}</td>
                  <td className={`p-2 text-center font-medium ${a.status === "Pass" ? "text-emerald-700" : "text-red-700"}`}>{a.status}</td>
                </tr>
              ))}
              {annualWithPos.length === 0 && <tr><td colSpan={13} className="p-4 text-center text-gray-500">{ur ? "ابھی سالانہ نتائج نہیں۔" : "No annual results yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
