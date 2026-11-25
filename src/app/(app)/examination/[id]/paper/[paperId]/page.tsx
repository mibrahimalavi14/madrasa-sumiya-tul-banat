import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getCurrentSession, hasSessionStarted } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { logAudit } from "@/lib/audit";

const SEC1_COUNT = 5;  // MCQs, 4 marks each = 20
const SEC2_COUNT = 5;  // Fill in blanks, 2 marks each = 10
const SEC3_COUNT = 5;  // Short Q/A, 4 marks each = 20

async function saveWrittenPaper(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE"); if (!hasSessionStarted(session)) throw new Error("SESSION_NOT_STARTED");
  const paperId = String(formData.get("paperId"));
  const examId = String(formData.get("examId"));
  const paper = await prisma.questionPaper.findUnique({ where: { id: paperId } });
  if (!paper || paper.examId !== examId || paper.type !== "WRITTEN") throw new Error("INVALID");

  const rows: { order: number; type: string; textUr: string; marks: number; optionsJson: string | null; answerSpace: number }[] = [];
  let order = 1;
  for (let i = 1; i <= SEC1_COUNT; i++) {
    const textUr = String(formData.get(`mcq_${i}_text`) || "").trim();
    const opts = [1,2,3,4].map(n => String(formData.get(`mcq_${i}_opt_${n}`) || "").trim());
    rows.push({ order: order++, type: "mcq", textUr, marks: 4, optionsJson: JSON.stringify(opts), answerSpace: 0 });
  }
  for (let i = 1; i <= SEC2_COUNT; i++) {
    const textUr = String(formData.get(`fill_${i}_text`) || "").trim();
    rows.push({ order: order++, type: "fill", textUr, marks: 2, optionsJson: null, answerSpace: 0 });
  }
  for (let i = 1; i <= SEC3_COUNT; i++) {
    const textUr = String(formData.get(`qa_${i}_text`) || "").trim();
    rows.push({ order: order++, type: "short", textUr, marks: 4, optionsJson: null, answerSpace: 2 });
  }

  await prisma.$transaction([
    prisma.question.deleteMany({ where: { paperId } }),
    prisma.question.createMany({ data: rows.map(r => ({ paperId, order: r.order, type: r.type, textUr: r.textUr, marks: r.marks, optionsJson: r.optionsJson, answerSpace: r.answerSpace })) }),
  ]);
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "EXAM_PAPER_SAVE", entityType: "QuestionPaper", entityId: paperId, details: JSON.stringify({ examId, paperId, type: "WRITTEN", questions: rows.length }) });
  revalidatePath(`/examination/${examId}/paper/${paperId}`);
  revalidatePath(`/examination/${examId}/paper/${paperId}/print`);
  redirect(`/examination/${examId}/paper/${paperId}?saved=1`);
}

async function addOralQuestion(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE"); if (!hasSessionStarted(session)) throw new Error("SESSION_NOT_STARTED");
  const paperId = String(formData.get("paperId"));
  const examId = String(formData.get("examId"));
  const count = await prisma.question.count({ where: { paperId } });
  const q = await prisma.question.create({ data: {
    paperId, order: count + 1,
    type: "short",
    textUr: String(formData.get("textUr")||""),
    marks: formData.get("marks") ? Number(formData.get("marks")) : null,
    answerSpace: 0,
  }});
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "EXAM_QUESTION_ADD", entityType: "QuestionPaper", entityId: paperId, details: JSON.stringify({ examId, paperId, questionId: q.id }) });
  revalidatePath(`/examination/${examId}/paper/${paperId}`);
}

async function deleteQuestion(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE"); if (!hasSessionStarted(session)) throw new Error("SESSION_NOT_STARTED");
  const id = String(formData.get("id")); const examId = String(formData.get("examId")); const paperId = String(formData.get("paperId"));
  await prisma.question.delete({ where: { id } });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "EXAM_QUESTION_DELETE", entityType: "QuestionPaper", entityId: paperId, details: JSON.stringify({ examId, paperId, questionId: id }) });
  revalidatePath(`/examination/${examId}/paper/${paperId}`);
}

function parseOptions(q: any): string[] {
  try { const a = JSON.parse(q.optionsJson || "[]"); return Array.isArray(a) ? [0,1,2,3].map(i => String(a[i] || "")) : ["","","",""]; } catch { return ["","","",""]; }
}

export default async function PaperEdit({ params, searchParams }: { params: Promise<{ id: string; paperId: string }>, searchParams?: Promise<{ saved?: string }> }) {
  const user = await getAuthUser(); if (user?.role !== "ADMIN") redirect("/dashboard");
  const { id, paperId } = await params;
  const sp = (await searchParams) || {};
  const paper = await prisma.questionPaper.findUnique({ where: { id: paperId }, include: { exam: { include: { session: true } }, questions: { orderBy: { order: "asc" } } } });
  if (!paper || paper.examId !== id) notFound();
  const isWritten = paper.type === "WRITTEN";

  if (isWritten) {
    const qs = paper.questions;
    const mcqs = qs.filter(q => q.type === "mcq");
    const fills = qs.filter(q => q.type === "fill");
    const qas = qs.filter(q => q.type === "short");
    const sec1 = Array.from({length: SEC1_COUNT}, (_,i)=> mcqs[i] || null);
    const sec2 = Array.from({length: SEC2_COUNT}, (_,i)=> fills[i] || null);
    const sec3 = Array.from({length: SEC3_COUNT}, (_,i)=> qas[i] || null);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-xl font-bold text-emerald-900 font-urdu" dir="rtl">{paper.title || "تحریری پرچہ"} - کوڈ {paper.paperCode}</h1>
          <div className="flex gap-3 text-sm"><Link className="bg-emerald-800 text-white px-4 py-2 rounded-lg" href={`/examination/${id}/paper/${paperId}/print`}>پرنٹ</Link><Link className="text-gray-700 underline self-center" href={`/examination/${id}`}>واپس</Link></div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-sm grid md:grid-cols-3 gap-2" dir="rtl">
          <div><b>امتحان:</b> {paper.exam.name}</div><div><b>سیشن:</b> {paper.exam.session.name}</div><div><b>کوڈ:</b> {paper.paperCode}</div>
          <div><b>مضمون:</b> <span className="font-urdu">{paper.mazhmoon}</span></div><div><b>جماعت:</b> <span className="font-urdu">{paper.className}</span></div><div><b>کل نمبر:</b> 50</div>
        </div>
        {sp.saved && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">پرچہ محفوظ ہو گیا۔</div>}
        <form action={saveWrittenPaper} className="space-y-4" dir="rtl">
          <input type="hidden" name="paperId" value={paper.id} /><input type="hidden" name="examId" value={id} />

          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-emerald-900 mb-1 font-urdu">سوال نمبر ۱: کثیر الانتخابی سوالات (MCQs) — کل نمبر: 20</h2>
            <p className="text-xs text-gray-600 mb-3 font-urdu">اس حصے میں 5 سوالات ہیں (سوال 1 تا 5)، ہر سوال کے 4 نمبر، ہر سوال کے 4 آپشن۔</p>
            <div className="space-y-4">
              {sec1.map((q, idx) => {
                const i = idx + 1; const opts = q ? parseOptions(q) : ["","","",""]; return (
                  <div key={i} className="border border-emerald-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium font-urdu">سوال {i} (4 نمبر)</label></div>
                    <textarea name={`mcq_${i}_text`} required defaultValue={q?.textUr || ""} className="w-full border rounded-lg px-3 py-2 font-urdu mb-2" rows={2} placeholder="سوال یہاں لکھیں"></textarea>
                    <div className="grid md:grid-cols-2 gap-2">
                      {opts.map((ov, oi) => (
                        <div key={oi}><label className="text-xs text-gray-600 font-urdu">آپشن {oi+1}</label><input name={`mcq_${i}_opt_${oi+1}`} required defaultValue={ov} className="w-full border rounded px-2 py-2 font-urdu" /></div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-emerald-900 mb-1 font-urdu">سوال نمبر ۲: خالی جگہ پر کریں — کل نمبر: 10</h2>
            <p className="text-xs text-gray-600 mb-3 font-urdu">اس حصے میں 5 سوالات ہیں (سوال 1 تا 5)، ہر سوال کے 2 نمبر۔</p>
            <div className="space-y-3">
              {sec2.map((q, idx) => { const i = idx + 1; return (
                <div key={i} className="border border-emerald-100 rounded-lg p-3">
                  <label className="text-sm font-medium font-urdu mb-1 block">سوال {i} (2 نمبر)</label>
                  <textarea name={`fill_${i}_text`} required defaultValue={q?.textUr || ""} className="w-full border rounded-lg px-3 py-2 font-urdu" rows={2} placeholder="خالی جگہ والا جملہ/سوال یہاں لکھیں"></textarea>
                </div>
              );})}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-emerald-900 mb-1 font-urdu">سوال نمبر ۳: سوال جواب — کل نمبر: 20</h2>
            <p className="text-xs text-gray-600 mb-3 font-urdu">اس حصے میں 5 سوالات ہیں (سوال 1 تا 5)، ہر سوال کے 4 نمبر (جواب کے لیے 2 لکیریں پرنٹ میں آئیں گی)۔</p>
            <div className="space-y-3">
              {sec3.map((q, idx) => { const i = idx + 1; return (
                <div key={i} className="border border-emerald-100 rounded-lg p-3">
                  <label className="text-sm font-medium font-urdu mb-1 block">سوال {i} (4 نمبر)</label>
                  <textarea name={`qa_${i}_text`} required defaultValue={q?.textUr || ""} className="w-full border rounded-lg px-3 py-2 font-urdu" rows={2} placeholder="سوال یہاں لکھیں"></textarea>
                </div>
              );})}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-emerald-800 hover:bg-emerald-900 text-white px-6 py-3 rounded-xl font-semibold">پرچہ محفوظ کریں</button>
            <Link className="text-emerald-800 underline" href={`/examination/${id}/paper/${paperId}/print`}>پرنٹ دیکھیں</Link>
          </div>
        </form>
      </div>
    );
  }

  // ORAL paper - keep simple Urdu-only
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h1 className="text-xl font-bold text-emerald-900 font-urdu" dir="rtl">{paper.title || "زبانی پرچہ"} - کوڈ {paper.paperCode}</h1><div className="space-x-3"><Link className="text-emerald-700 underline" href={`/examination/${id}/paper/${paperId}/print`}>پرنٹ</Link><Link className="text-gray-700 underline" href={`/examination/${id}`}>واپس</Link></div></div>
      <div className="bg-white rounded-xl shadow p-4 text-sm grid md:grid-cols-3 gap-2" dir="rtl">
        <div><b>امتحان:</b> {paper.exam.name}</div><div><b>سیشن:</b> {paper.exam.session.name}</div><div><b>کوڈ:</b> {paper.paperCode}</div>
        <div><b>مضمون:</b> <span className="font-urdu">{paper.mazhmoon}</span></div><div><b>جماعت:</b> <span className="font-urdu">{paper.className}</span></div>
      </div>
      <div className="bg-white rounded-xl shadow p-4" dir="rtl">
        <h2 className="font-semibold mb-2 font-urdu">سوال شامل کریں (زبانی)</h2>
        <form action={addOralQuestion} className="grid md:grid-cols-2 gap-3">
          <input type="hidden" name="paperId" value={paper.id} /><input type="hidden" name="examId" value={id} />
          <div><label className="text-sm font-urdu">نمبر</label><input name="marks" type="number" step="0.5" required className="w-full border rounded px-2 py-2"/></div>
          <div className="md:col-span-2"><label className="text-sm font-urdu">سوال (اردو)</label><textarea name="textUr" required className="w-full border rounded px-2 py-2 font-urdu" rows={2}></textarea></div>
          <div className="md:col-span-2"><button className="bg-emerald-800 text-white px-4 py-2 rounded">سوال شامل کریں</button></div>
        </form>
      </div>
      <div className="bg-white rounded-xl shadow p-4" dir="rtl">
        <h2 className="font-semibold mb-2 font-urdu">سوالات ({paper.questions.length})</h2>
        <ol className="space-y-3 list-decimal pr-5">
          {paper.questions.map(q => (
            <li key={q.id} className="border rounded p-3">
              <div className="flex justify-between gap-3"><div><span className="text-xs text-gray-500">[{q.marks ?? "-"} نمبر]</span><div className="font-urdu text-lg">{q.textUr}</div></div>
              <form action={deleteQuestion}><input type="hidden" name="id" value={q.id}/><input type="hidden" name="examId" value={id}/><input type="hidden" name="paperId" value={paper.id}/><button className="text-red-700 text-sm underline">حذف</button></form></div>
            </li>
          ))}
          {paper.questions.length===0 && <p className="text-gray-500 text-sm font-urdu">ابھی کوئی سوال شامل نہیں۔</p>}
        </ol>
      </div>
    </div>
  );
}
