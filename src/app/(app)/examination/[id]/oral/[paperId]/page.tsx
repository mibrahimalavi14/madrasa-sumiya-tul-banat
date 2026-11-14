import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { gradeFromPercentage, calculatePositions } from "@/lib/grading";

async function saveOralMark(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const examId = String(formData.get("examId")); const paperId = String(formData.get("paperId")); const studentId = String(formData.get("studentId"));
  const obtained = Number(formData.get("obtained")||0); const total = Number(formData.get("total")||100);
  const remarks = String(formData.get("remarks")||"") || null;
  await prisma.oralMark.upsert({
    where: { examId_paperId_studentId: { examId, paperId, studentId } },
    update: { obtained, total, remarks },
    create: { examId, paperId, studentId, obtained, total, remarks },
  });
  // auto-generate/update result for this student in this exam (oral component; if written exists combine)
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (exam) {
    const oralMarks = await prisma.oralMark.findMany({ where: { examId, studentId }, select: { obtained: true, total: true } });
    const oralObt = oralMarks.reduce((a,m)=>a+m.obtained,0);
    const oralTot = oralMarks.reduce((a,m)=>a+m.total,0) || 100;
    const existing = await prisma.result.findUnique({ where: { examId_studentId: { examId, studentId } }, select: { writtenObtained: true, writtenTotal: true } });
    const writtenObt = existing?.writtenObtained ?? 0;
    const writtenTot = existing?.writtenTotal ?? 0;
    const hasWritten = writtenTot > 0;
    const totalObt = (hasWritten ? writtenObt : 0) + oralObt;
    const totalMarks = (hasWritten ? writtenTot : 0) + oralTot;
    const pct = totalMarks > 0 ? (totalObt / totalMarks) * 100 : 0;
    const g = gradeFromPercentage(pct);
    await prisma.result.upsert({
      where: { examId_studentId: { examId, studentId } },
      update: { oralObtained: oralObt, oralTotal: oralTot, totalObtained: totalObt, totalMarks, percentage: pct, grade: g.grade, status: g.status },
      create: { examId, studentId, oralObtained: oralObt, oralTotal: oralTot, totalObtained: totalObt, totalMarks, percentage: pct, grade: g.grade, status: g.status },
    });
    // recalc positions for exam (top 3, >=70%) - update only changed
    const results = await prisma.result.findMany({ where: { examId }, select: { id: true, percentage: true, position: true } });
    const posMap = calculatePositions(results.map(r=>({id:r.id, percentage:r.percentage})));
    const updates = results
      .map(r => ({ id: r.id, position: posMap.get(r.id) ?? null }))
      .filter(u => (results.find(r => r.id === u.id)?.position ?? null) !== u.position);
    if (updates.length) {
      await prisma.$transaction(updates.map(u => prisma.result.update({ where: { id: u.id }, data: { position: u.position } })));
    }
  }
  revalidatePath(`/examination/${examId}/oral/${paperId}`); revalidatePath(`/results`);
}

export default async function OralConduct({ params }: { params: Promise<{ id: string; paperId: string }> }) {
  const user = await getAuthUser(); if (user?.role !== "ADMIN") redirect("/dashboard");
  const { id, paperId } = await params;
  const paper = await prisma.questionPaper.findUnique({ where: { id: paperId }, include: { exam: { include: { session: true, students: { include: { student: true } } } }, questions: { orderBy: { order: "asc" } }, oralMarks: true } });
  if (!paper || paper.examId !== id || paper.type !== "ORAL") notFound();
  const enrolls = await prisma.studentEnrollment.findMany({ where: { sessionId: paper.exam.sessionId } });
  const rollMap = new Map(enrolls.map(e=>[e.studentId, e.rollNo]));
  const selected = paper.exam.students.map(es => ({ ...es.student, rollNo: rollMap.get(es.studentId) || null }));
  const markMap = new Map(paper.oralMarks.map(m=>[m.studentId, m]));
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h1 className="text-xl font-bold text-emerald-900">Oral Exam Conduct - {paper.exam.name} (Code {paper.paperCode})</h1><Link href={`/examination/${id}`} className="text-emerald-700 underline">Back</Link></div>
      <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm">Select students are shown below. Ask questions (from this oral paper) and enter marks here; result is generated/updated automatically. سوالات پوچھ کر یہی نمبر درج کریں، نتیجہ خود بن جائے گا۔</div>
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-2">Questions (Teacher Reminder) / سوالات</h2>
        <ol className="list-decimal pl-6 space-y-1 font-urdu text-lg" dir="rtl">
          {paper.questions.map(q => <li key={q.id}>{q.textUr} {q.marks?`(${q.marks})`:""}</li>)}
          {paper.questions.length===0 && <li className="font-sans text-sm text-gray-500" dir="ltr">No questions added. <Link className="underline text-blue-700" href={`/examination/${id}/paper/${paperId}`}>Add questions</Link></li>}
        </ol>
      </div>
      <div className="bg-white rounded-xl shadow p-4 overflow-auto">
        <h2 className="font-semibold mb-2">Selected Students - Enter Marks</h2>
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2">Roll</th><th className="p-2">Admission</th><th className="p-2">Name</th><th className="p-2">Obtained</th><th className="p-2">Total</th><th className="p-2">Remarks</th><th className="p-2">Action</th></tr></thead>
        <tbody>
          {selected.map(s => { const m = markMap.get(s.id); return (
            <tr key={s.id} className="border-t">
              <td className="p-2 text-center">{s.rollNo||"-"}</td><td className="p-2">{s.admissionNo}</td><td className="p-2">{s.nameEn} <span className="font-urdu">{s.nameUr||""}</span></td>
              <td className="p-2" colSpan={4}>
                <form action={saveOralMark} className="flex gap-2 items-center flex-wrap">
                  <input type="hidden" name="examId" value={id}/><input type="hidden" name="paperId" value={paperId}/><input type="hidden" name="studentId" value={s.id}/>
                  <input name="obtained" type="number" step="0.5" defaultValue={m?.obtained ?? ""} className="border rounded px-2 py-1 w-24" placeholder="Obtained" required/>
                  <input name="total" type="number" step="0.5" defaultValue={m?.total ?? 100} className="border rounded px-2 py-1 w-24" placeholder="Total"/>
                  <input name="remarks" defaultValue={m?.remarks ?? ""} className="border rounded px-2 py-1 w-40" placeholder="Remarks"/>
                  <button className="bg-emerald-800 text-white px-3 py-1 rounded">Save & Generate Result</button>
                  {m && <span className="text-emerald-700 text-xs">Saved</span>}
                </form>
              </td>
            </tr>
          );})}
          {selected.length===0 && <tr><td colSpan={7} className="p-3 text-center text-gray-500">No students selected for this exam. Go back and select students.</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}
