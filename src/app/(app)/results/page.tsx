import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { gradeFromPercentage, calculatePositions } from "@/lib/grading";
import { logAudit } from "@/lib/audit";

async function saveWritten(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN" && user?.role !== "ACCOUNTANT") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  const examId = String(formData.get("examId")); const studentId = String(formData.get("studentId"));
  const writtenObtained = Number(formData.get("writtenObtained")||0); const writtenTotal = Number(formData.get("writtenTotal")||0);
  const existing = await prisma.result.findUnique({ where: { examId_studentId: { examId, studentId } } });
  const oralObt = existing?.oralObtained ?? 0; const oralTot = existing?.oralTotal ?? 0;
  const totalObt = writtenObtained + oralObt; const totalMarks = writtenTotal + oralTot;
  const pct = totalMarks > 0 ? (totalObt/totalMarks)*100 : 0; const g = gradeFromPercentage(pct);
  const saved = await prisma.result.upsert({
    where: { examId_studentId: { examId, studentId } },
    update: { writtenObtained, writtenTotal, oralObtained: oralObt, oralTotal: oralTot, totalObtained: totalObt, totalMarks, percentage: pct, grade: g.grade, status: g.status },
    create: { examId, studentId, writtenObtained, writtenTotal, oralObtained: oralObt, oralTotal: oralTot, totalObtained: totalObt, totalMarks, percentage: pct, grade: g.grade, status: g.status },
  });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "RESULT_SAVE_WRITTEN", entityType: "Result", entityId: saved.id, details: JSON.stringify({ examId, studentId, writtenObtained, writtenTotal, totalObtained: totalObt, totalMarks, percentage: Number(pct.toFixed(2)), grade: g.grade, status: g.status, sessionId: session.id }) });
  const results = await prisma.result.findMany({ where: { examId }, select: { id: true, percentage: true, position: true } });
  const posMap = calculatePositions(results.map(r=>({id:r.id, percentage:r.percentage})));
  const updates = results
    .map(r => ({ id: r.id, position: posMap.get(r.id) ?? null }))
    .filter(u => {
      const cur = results.find(r => r.id === u.id)?.position ?? null;
      return cur !== u.position;
    });
  if (updates.length) {
    await prisma.$transaction(updates.map(u => prisma.result.update({ where: { id: u.id }, data: { position: u.position } })));
  }
  revalidatePath("/results");
}

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ examId?: string; view?: string; q?: string }> }) {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  const sp = await searchParams;
  if (user?.role === "PARENT") {
    if (!user.parentStudentId) return <p>{ur ? "کوئی منسلک طالب علم نہیں۔" : "No linked student."}</p>;
    const [results, enrolls] = await Promise.all([
      prisma.result.findMany({ where: { studentId: user.parentStudentId }, include: { exam: { select: { name: true, stage: true, sessionId: true } }, student: { select: { nameEn: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.studentEnrollment.findMany({ where: { studentId: user.parentStudentId }, select: { sessionId: true, rollNo: true } }),
    ]);
    const rollBySession = new Map(enrolls.map(e => [e.sessionId, e.rollNo]));
    const resultsWithRoll = results.map(r => ({ ...r, rollNo: (r.exam as any)?.sessionId ? rollBySession.get((r.exam as any).sessionId) : null }));
    return (
      <div className="space-y-4 theme-parent">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-2xl p-5 shadow-sm">
          <h1 className="text-2xl font-bold">{ur ? "میرے نتائج" : "My Results"}</h1>
          <p className="text-sm text-blue-100 mt-1">{ur ? "آپ کے بچے کے امتحانی نتائج" : "Exam results for your child"}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-auto"><ResultsTable results={resultsWithRoll} ur={ur} /></div>
      </div>
    );
  }
  if (!session) return <p>{ur ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select active session first."}</p>;
  const examsRaw = await prisma.exam.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } });
  const exams = [...examsRaw].sort((a, b) => ((a as any).stage ?? 99) - ((b as any).stage ?? 99) || a.createdAt.getTime() - b.createdAt.getTime());
  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  const examDisplayName = (e: any) => (ur && e?.stage && examNameUr[Number(e.stage)]) || e?.name || "-";
  const view = sp.view === "annual" ? "annual" : "exam";

  const q = sp.q?.trim() || "";
  if (view === "annual") {
    const stageWeight: Record<number, number> = { 1: 20, 2: 20, 3: 20, 4: 40 };
    const annualExams = exams.filter(e => {
      const st = (e as any).stage as number | null | undefined;
      if (st && stageWeight[st]) return true;
      return (e as any).includedInAnnual !== false && !(e as any).isDiagnostic;
    });
    const examById = new Map(annualExams.map(e => [e.id, e]));
    const enrollments = await prisma.studentEnrollment.findMany({ where: { sessionId: session.id }, select: { studentId: true, rollNo: true } });
    const rollMap = new Map(enrollments.map(e => [e.studentId, e.rollNo]));
    const allResults = annualExams.length ? await prisma.result.findMany({
      where: { examId: { in: annualExams.map(e=>e.id) } },
      select: { studentId: true, examId: true, totalObtained: true, totalMarks: true, percentage: true, student: { select: { id: true, nameEn: true } }, exam: { select: { stage: true } } },
    }) : [];
    const byStudent = new Map<string, { student: any; stagePct: Record<number, number>; stageMarks: Record<number, {o:number;t:number}> }>();
    for (const r of allResults) {
      const cur = byStudent.get(r.studentId) || { student: r.student, stagePct: {}, stageMarks: {} };
      const ex = examById.get(r.examId) || (r as any).exam;
      const st = (ex as any).stage as number | undefined;
      if (st) {
        const pct = r.percentage != null ? Number(r.percentage) : ((r.totalMarks ?? 0) > 0 ? ((r.totalObtained ?? 0) / (r.totalMarks ?? 1)) * 100 : 0);
        cur.stagePct[st] = pct; // latest/only per stage expected
        cur.stageMarks[st] = { o: r.totalObtained ?? 0, t: r.totalMarks ?? 0 };
      }
      byStudent.set(r.studentId, cur);
    }
    const annual = [...byStudent.values()].map(v => {
      let weighted = 0;
      let usedWeight = 0;
      let obtained = 0;
      let total = 0;
      for (const st of [1,2,3,4]) {
        const w = stageWeight[st];
        if (v.stagePct[st] != null) {
          weighted += v.stagePct[st] * (w / 100);
          usedWeight += w;
          obtained += v.stageMarks[st]?.o ?? 0;
          total += v.stageMarks[st]?.t ?? 0;
        }
      }
      const pct = usedWeight > 0 ? (weighted / usedWeight) * 100 : 0; // normalize if some stages missing
      const g = gradeFromPercentage(pct);
      return { id: v.student.id, student: v.student, rollNo: rollMap.get(v.student.id) || null, totalObtained: obtained, totalMarks: total, percentage: pct, grade: g.grade, status: g.status, stagePct: v.stagePct };
    });
    const posMap = calculatePositions(annual.map(a=>({id:a.id, percentage:a.percentage})));
    const annualWithPosAll = annual.map(a => ({ ...a, position: posMap.get(a.id) ?? null })).sort((a,b)=> (a.position ?? 999) - (b.position ?? 999) || (b.percentage - a.percentage));
    const holders = annualWithPosAll.filter(a => a.position != null);
    const ql = q.toLowerCase();
    const annualWithPos = q ? annualWithPosAll.filter(a => [a.student?.nameEn, a.rollNo].some(v => (v || "").toLowerCase().includes(ql))) : annualWithPosAll;
    return (
      <div className="space-y-5 theme-results">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-emerald-900">{ur ? "سالانہ مجموعی نتیجہ" : "Annual Results"}</h1>
          <div className="flex gap-2 flex-wrap"><Link href="/results" className="text-sm border px-3 py-1.5 rounded-lg">{ur ? "امتحان وار نتائج" : "Exam-wise Results"}</Link><Link href="/results/annual-report" className="text-sm bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg">{ur ? "سالانہ رپورٹ پرنٹ" : "Print Annual Report"}</Link><a href="/api/export/results" className="text-sm bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg">{ur ? "CSV ایکسپورٹ" : "Export CSV"}</a><Link href="/examination" className="text-sm border px-3 py-1.5 rounded-lg">{ur ? "امتحانات" : "Exams"}</Link></div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900 space-y-1">
          <div className="font-semibold">{ur ? "سالانہ مجموعی نتیجہ" : "Annual Combined Result"}</div>
          <div className={`text-emerald-800 ${ur ? "font-urdu" : ""}`} dir={ur?"rtl":"ltr"}>{ur ? "شامل امتحانات" : "Included exams"}: {annualExams.map(e=>examDisplayName(e)).join(ur ? "، " : ", ") || (ur ? "کوئی امتحان شامل نہیں" : "No exams included")}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold mb-3">{ur ? "پوزیشن ہولڈرز کی فہرست (پہلی 3)" : "Position Holders List (Top 3)"}</h2>
          {holders.length === 0 ? <p className="text-sm text-gray-500">{ur ? "ابھی کوئی پوزیشن ہولڈر نہیں۔" : "No position holders yet."}</p> : (
            <div className="grid md:grid-cols-3 gap-4">
              {holders.map(h => (
                <div key={h.id} className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-2">
                  <div className="text-center font-bold text-amber-900 text-lg border-b border-amber-200 pb-2">{ur ? "پوزیشن" : "Position"}: {h.position}</div>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="border border-amber-100 bg-white rounded-lg p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-amber-100">{ur ? "رول نمبر" : "Roll No"}</div><div className="font-semibold">{h.rollNo || "-"}</div></div>
                    <div className="border border-amber-100 bg-white rounded-lg p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-amber-100">{ur ? "طالب علم کا نام" : "Student Name"}</div><div className="font-semibold">{h.student.nameEn}</div></div>
                    <div className="border border-amber-100 bg-white rounded-lg p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-amber-100">{ur ? "حاصل کردہ نمبر" : "Obtained Marks"}</div><div className="font-semibold">{h.totalObtained}</div></div>
                    <div className="border border-amber-100 bg-white rounded-lg p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-amber-100">{ur ? "کل نمبر" : "Total Marks"}</div><div className="font-semibold">{h.totalMarks}</div></div>
                    <div className="border border-amber-100 bg-white rounded-lg p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-amber-100">{ur ? "فیصد" : "Percentage"}</div><div className="font-semibold">{h.percentage.toFixed(2)}</div></div>
                    <div className="border border-amber-100 bg-white rounded-lg p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-amber-100">{ur ? "گریڈ" : "Grade"}</div><div className="font-semibold">{h.grade}</div></div>
                    <div className="border border-amber-100 bg-white rounded-lg p-2"><div className="text-xs text-gray-500 pb-1 mb-1 border-b border-amber-100">{ur ? "حیثیت" : "Status"}</div><div className="font-semibold text-emerald-700">{h.status}</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 overflow-auto">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-semibold">{ur ? "سالانہ مجموعی نتیجہ - تمام طلبہ" : "Annual Combined Result - All Students"}</h2>
            <form className="flex items-center gap-2">
              <input type="hidden" name="view" value="annual" />
              <input name="q" defaultValue={q} placeholder={ur ? "نام / رول نمبر تلاش کریں" : "Search name / roll no"} className="border rounded-lg px-3 py-1.5 text-sm" />
              <button className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded-lg">{ur ? "تلاش" : "Search"}</button>
              {q && <Link href="/results?view=annual" className="text-sm text-emerald-700 underline">{ur ? "صاف کریں" : "Clear"}</Link>}
            </form>
          </div>
          <table className="w-full text-sm"><thead className="bg-emerald-50"><tr><th className="p-2">{ur ? "پوزیشن" : "Position"}</th><th className="p-2">{ur ? "رول نمبر" : "Roll No"}</th><th className="p-2">{ur ? "طالب علم کا نام" : "Student Name"}</th><th className="p-2">{ur ? "امتحان 1" : "Exam 1"}</th><th className="p-2">{ur ? "امتحان 2" : "Exam 2"}</th><th className="p-2">{ur ? "امتحان 3" : "Exam 3"}</th><th className="p-2">{ur ? "امتحان 4" : "Exam 4"}</th><th className="p-2">{ur ? "حاصل کردہ نمبر" : "Obtained Marks"}</th><th className="p-2">{ur ? "کل نمبر" : "Total Marks"}</th><th className="p-2">{ur ? "فیصد" : "Percentage"}</th><th className="p-2">{ur ? "گریڈ" : "Grade"}</th><th className="p-2">{ur ? "حیثیت" : "Status"}</th><th className="p-2">{ur ? "رزلٹ کارڈ" : "Result Card"}</th></tr></thead>
          <tbody>
            {annualWithPos.map(a => (
              <tr key={a.id} className="border-t"><td className="p-2 text-center">{a.position ?? "-"}</td><td className="p-2 text-center">{a.rollNo || "-"}</td><td className="p-2">{a.student.nameEn}</td><td className="p-2 text-center">{a.stagePct?.[1] != null ? a.stagePct[1].toFixed(1) : "-"}</td><td className="p-2 text-center">{a.stagePct?.[2] != null ? a.stagePct[2].toFixed(1) : "-"}</td><td className="p-2 text-center">{a.stagePct?.[3] != null ? a.stagePct[3].toFixed(1) : "-"}</td><td className="p-2 text-center">{a.stagePct?.[4] != null ? a.stagePct[4].toFixed(1) : "-"}</td><td className="p-2 text-center">{a.totalObtained}</td><td className="p-2 text-center">{a.totalMarks}</td><td className="p-2 text-center font-medium">{a.percentage.toFixed(2)}</td><td className="p-2 text-center font-semibold">{a.grade}</td><td className={`p-2 text-center ${a.status==="Pass"?"text-emerald-700":"text-red-700"}`}>{a.status}</td><td className="p-2 text-center"><Link className="text-emerald-700 underline" href={`/results/annual-card/${a.student.id}`}>{ur ? "پرنٹ" : "Print"}</Link></td></tr>
            ))}
            {annualWithPos.length===0 && <tr><td colSpan={13} className="p-4 text-center text-gray-500">{ur ? "ابھی سالانہ نتائج نہیں۔ شامل امتحانات کے نتائج محفوظ کریں۔" : "No annual results yet. Save exam results for included exams."}</td></tr>}
          </tbody></table>
        </div>
      </div>
    );
  }

  const examId = sp.examId || exams[0]?.id;
  const exam = examId ? await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, name: true, stage: true, sessionId: true, students: { select: { studentId: true, student: { select: { id: true, nameEn: true } } } } },
  }) : null;
  const [results, enrolls] = examId ? await Promise.all([
    prisma.result.findMany({ where: { examId }, select: { id: true, studentId: true, writtenObtained: true, writtenTotal: true, oralObtained: true, oralTotal: true, totalObtained: true, totalMarks: true, percentage: true, grade: true, status: true, position: true, student: { select: { nameEn: true } }, exam: { select: { name: true, stage: true } } }, orderBy: [{ position: "asc" }, { percentage: "desc" }] }),
    exam ? prisma.studentEnrollment.findMany({ where: { sessionId: exam.sessionId }, select: { studentId: true, rollNo: true } }) : Promise.resolve([] as any[]),
  ]) : [[], [] as any[]];
  const rollMap = new Map(enrolls.map(e=>[e.studentId,e.rollNo]));
  const resMap = new Map(results.map(r=>[r.studentId,r]));
  return (
    <div className="space-y-4 theme-results">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-emerald-900">{ur ? "نتائج (محفوظ شدہ)" : "Results (All Saved)"}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link href="/results?view=annual" className="text-sm bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg">{ur ? "سالانہ مجموعی نتیجہ / پوزیشن ہولڈرز" : "Annual Combined Result / Position Holders"}</Link>
          <a href="/api/export/results" className="text-sm bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg">{ur ? "CSV ایکسپورٹ" : "Export CSV"}</a>
        </div>
      </div>
      <form className="bg-white rounded-xl shadow-sm border border-emerald-100 p-4 flex gap-3 items-end flex-wrap">
        <div className="flex flex-col gap-1.5">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg w-fit">
            <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
            {ur ? "امتحان منتخب کریں" : "Select Exam"}
          </label>
          <select
            name="examId"
            defaultValue={examId}
            className="min-w-[280px] border border-emerald-200 rounded-lg px-3 py-2.5 bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
          >
            {exams.map(e => <option key={e.id} value={e.id}>{examDisplayName(e)}</option>)}
          </select>
        </div>
        <button className="bg-emerald-800 hover:bg-emerald-900 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm">
          {ur ? "نتیجہ دیکھیں" : "View Result"}
        </button>
      </form>
      {exam && <>
        <div className="flex items-center justify-end no-print">
          <Link href={`/results/exam-report?examId=${exam.id}`} className="text-sm bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg font-medium">{ur ? "امتحان رپورٹ (میرٹ/پاس فیل) پرنٹ" : "Print Exam Report (Merit/Pass-Fail)"}</Link>
        </div>
        <div className="bg-white rounded-xl shadow p-4 overflow-auto">
          <h2 className="font-semibold">{ur ? "تحریری نمبر درج کریں اور نتیجہ محفوظ کریں" : "Enter Written Marks & Save Results"}</h2>
          <p className="text-xs text-gray-500 mt-1 mb-3">{ur ? "ہر طالب علم کے تحریری نمبر درج کریں؛ زبانی نمبر زبانی امتحان سے آتے ہیں۔ مجموعی نتیجہ، گریڈ، پاس/فیل اور پوزیشنیں خودکار محفوظ ہوں گی۔" : "Enter written marks per student; oral marks come from Oral Conduct. Combined result, grade, pass/fail and positions are calculated and saved."}</p>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-center">{ur ? "رول نمبر" : "Roll No"}</th>
                <th className="p-2 text-left">{ur ? "طالب علم کا نام" : "Student Name"}</th>
                <th className="p-2 text-center">{ur ? "تحریری حاصل کردہ" : "Written Obtained"}</th>
                <th className="p-2 text-center">{ur ? "تحریری کل" : "Written Total"}</th>
                <th className="p-2 text-center">{ur ? "عمل" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {exam.students.map(es => {
                const r = resMap.get(es.studentId);
                const formId = `wm-${exam.id}-${es.studentId}`;
                return (
                  <tr key={es.studentId} className="border-t align-middle">
                    <td className="p-2 text-center">
                      <form id={formId} action={saveWritten}>
                        <input type="hidden" name="examId" value={exam.id} />
                        <input type="hidden" name="studentId" value={es.studentId} />
                      </form>
                      {rollMap.get(es.studentId) || "-"}
                    </td>
                    <td className="p-2 text-left">{es.student.nameEn}</td>
                    <td className="p-2 text-center">
                      <input form={formId} name="writtenObtained" type="number" step="0.5" defaultValue={r?.writtenObtained ?? ""} className="border rounded px-2 py-1.5 w-24 text-center" placeholder={ur ? "حاصل" : "Obt"} />
                    </td>
                    <td className="p-2 text-center">
                      <input form={formId} name="writtenTotal" type="number" step="0.5" defaultValue={r?.writtenTotal ?? ""} className="border rounded px-2 py-1.5 w-24 text-center" placeholder={ur ? "کل" : "Total"} />
                    </td>
                    <td className="p-2 text-center">
                      <button form={formId} className="bg-emerald-800 text-white px-3 py-1.5 rounded">{ur ? "محفوظ کریں" : "Save"}</button>
                    </td>
                  </tr>
                );
              })}
              {exam.students.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">{ur ? "پہلے اس امتحان کے لیے طلبہ منتخب کریں۔" : "Select students for this exam first."}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl shadow p-4 overflow-auto">
          <h2 className={`font-semibold mt-0 mb-2 ${ur ? "font-urdu" : ""}`} dir={ur?"rtl":"ltr"}>{ur ? "تمام محفوظ نتائج" : "All Saved Results"} - {examDisplayName(exam)}</h2>
          <ResultsTable results={results} ur={ur} rollMap={Object.fromEntries(rollMap)} />
        </div>
      </>}
    </div>
  );
}

function ResultsTable({ results, ur = false, rollMap }: { results: any[]; ur?: boolean; rollMap?: Record<string, string | null> }) {
  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  return (
    <table className="w-full text-sm">
      <thead className="bg-emerald-50">
        <tr>
          <th className="p-2">{ur ? "پوزیشن" : "Position"}</th>
          <th className="p-2">{ur ? "رول نمبر" : "Roll No"}</th>
          <th className="p-2">{ur ? "طالب علم کا نام" : "Student Name"}</th>
          <th className="p-2">{ur ? "امتحان" : "Exam"}</th>
          <th className="p-2">{ur ? "تحریری" : "Written"}</th>
          <th className="p-2">{ur ? "زبانی" : "Oral"}</th>
          <th className="p-2">{ur ? "کل" : "Total"}</th>
          <th className="p-2">%</th>
          <th className="p-2">{ur ? "گریڈ" : "Grade"}</th>
          <th className="p-2">{ur ? "حیثیت" : "Status"}</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r: any) => {
          const rollNo = r.rollNo ?? rollMap?.[r.studentId] ?? "-";
          return (
            <tr key={r.id} className="border-t">
              <td className="p-2 text-center font-semibold">{r.position ?? "-"}</td>
              <td className="p-2 text-center">{rollNo || "-"}</td>
              <td className="p-2">{r.student?.nameEn}</td>
              <td className={`p-2 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>{(ur && r.exam?.stage && examNameUr[Number(r.exam.stage)]) || r.exam?.name}</td>
              <td className="p-2 text-center">{r.writtenObtained ?? "-"}/{r.writtenTotal ?? "-"}</td>
              <td className="p-2 text-center">{r.oralObtained ?? "-"}/{r.oralTotal ?? "-"}</td>
              <td className="p-2 text-center">{r.totalObtained ?? "-"}/{r.totalMarks ?? "-"}</td>
              <td className="p-2 text-center">{r.percentage != null ? Number(r.percentage).toFixed(2) : "-"}</td>
              <td className="p-2 text-center font-semibold">{r.grade || "-"}</td>
              <td className={`p-2 text-center ${r.status === "Pass" ? "text-emerald-700" : "text-red-700"}`}>{r.status || "-"}</td>
            </tr>
          );
        })}
        {results.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-gray-500">{ur ? "ابھی کوئی نتیجہ محفوظ نہیں۔" : "No results saved yet."}</td></tr>}
      </tbody>
    </table>
  );
}
