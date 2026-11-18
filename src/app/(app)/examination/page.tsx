import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { formatDateDMY, parseDateInput } from "@/lib/utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DateInputDMY from "@/components/DateInputDMY";
import { logAudit } from "@/lib/audit";

const STAGES = [
  { stage: 1, name: "Initial Written Examination", month: "1st Month", desc: "Written exam only (MCQs, short questions, fill in the blanks, true/false, etc.). Nazra Quran not included. Separate result, 20% of annual.", written: true, oral: false, diagnostic: false, included: true, weight: 20 },
  { stage: 2, name: "Six-Monthly Examination", month: "4th Month", desc: "Written exam only (same types as initial). Nazra Quran not included. Separate result, 20% of annual.", written: true, oral: false, diagnostic: false, included: true, weight: 20 },
  { stage: 3, name: "Quarterly Examination", month: "8th Month", desc: "Two parts: Written + Oral (Nazra Quran, Islamic knowledge, etc.). Combined result, 20% of annual.", written: true, oral: true, diagnostic: false, included: true, weight: 20 },
  { stage: 4, name: "Annual Examination", month: "12th Month", desc: "Two parts: Written + Oral. Combined result, 40% of annual. Top 3 positions receive certificates.", written: true, oral: true, diagnostic: false, included: true, weight: 40 },
] as const;

async function createExam(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("NO_SESSION");
  const stageNo = Number(formData.get("stage") || 0);
  const preset = STAGES.find(s => s.stage === stageNo);
  const name = String(formData.get("name") || "").trim();
  const examDate = parseDateInput(formData.get("examDate"));
  if (!preset || !name || !examDate) return;
  const existing = await prisma.exam.findFirst({ where: { sessionId: session.id, stage: preset.stage }, select: { id: true } });
  if (existing) redirect(`/examination/${existing.id}`);
  const hasWritten = preset.written;
  const hasOral = preset.oral;
  const exam = await prisma.exam.create({ data: {
    name, examDate, sessionId: session.id, subject: "Nazra Quran & Basic Islamic Studies",
    stage: preset.stage, stageLabel: preset.name, monthLabel: preset.month,
    isDiagnostic: preset.diagnostic, hasWritten, hasOral, includedInAnnual: preset.included,
  }});
  for (const code of ["01","02","03"]) {
    if (hasWritten) await prisma.questionPaper.create({ data: { examId: exam.id, type: "WRITTEN", paperCode: code, mazhmoon: "بنیادی اسلامیات", className: "ناظرہ قرآن و بنیادی اسلامیات", title: `تحریری پرچہ ${code}` } });
    if (hasOral) await prisma.questionPaper.create({ data: { examId: exam.id, type: "ORAL", paperCode: code, mazhmoon: "ناظرہ قرآن و بنیادی اسلامیات", className: "ناظرہ قرآن و بنیادی اسلامیات", title: `زبانی پرچہ ${code}` } });
  }
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "EXAM_CREATE", entityType: "Exam", entityId: exam.id, details: JSON.stringify({ sessionId: session.id, stage: preset.stage, name, examDate: examDate.toISOString() }) });
  revalidatePath("/examination");
  redirect(`/examination/${exam.id}`);
}

async function selectStudentsForExam(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  const examId = String(formData.get("examId"));
  const ids = formData.getAll("studentIds").map(String);
  await prisma.examStudent.deleteMany({ where: { examId } });
  if (ids.length) await prisma.examStudent.createMany({ data: ids.map(studentId => ({ examId, studentId })) });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "EXAM_SELECT_STUDENTS", entityType: "Exam", entityId: examId, details: JSON.stringify({ examId, sessionId: session.id, count: ids.length }) });
  revalidatePath("/examination");
  revalidatePath(`/examination/${examId}`);
}

export default async function ExaminationPage() {
  const user = await getAuthUser(); if (user?.role !== "ADMIN") redirect("/dashboard");
  const lang = await getLang();
  const ur = lang === "ur";
  const session = await getCurrentSession();
  if (!session) return <p>{ur ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select an active session first."}</p>;

  const existingStages = await prisma.exam.findMany({
    where: { sessionId: session.id, stage: { in: STAGES.map(s => s.stage) } },
    select: { stage: true },
  });
  const have = new Set(existingStages.map(e => e.stage));
  const missing = STAGES.filter(s => !have.has(s.stage));
  if (missing.length && session.status === "ACTIVE") {
    await prisma.$transaction(async (tx) => {
      for (const preset of missing) {
        const exam = await tx.exam.create({ data: {
          name: preset.name, sessionId: session.id, subject: "Nazra Quran & Basic Islamic Studies",
          stage: preset.stage, stageLabel: preset.name, monthLabel: preset.month,
          isDiagnostic: preset.diagnostic, hasWritten: preset.written, hasOral: preset.oral, includedInAnnual: preset.included,
        }});
        const papers: any[] = [];
        for (const code of ["01","02","03"]) {
          if (preset.written) papers.push({ examId: exam.id, type: "WRITTEN", paperCode: code, mazhmoon: "بنیادی اسلامیات", className: "ناظرہ قرآن و بنیادی اسلامیات", title: `تحریری پرچہ ${code}` });
          if (preset.oral) papers.push({ examId: exam.id, type: "ORAL", paperCode: code, mazhmoon: "ناظرہ قرآن و بنیادی اسلامیات", className: "ناظرہ قرآن و بنیادی اسلامیات", title: `زبانی پرچہ ${code}` });
        }
        if (papers.length) await tx.questionPaper.createMany({ data: papers });
      }
    });
  }

  const [examsRaw, enrollmentsRaw] = await Promise.all([
    prisma.exam.findMany({
      where: { sessionId: session.id },
      include: { _count: { select: { students: true, papers: true, results: true } }, students: { select: { studentId: true } } },
    }),
    prisma.studentEnrollment.findMany({
      where: { sessionId: session.id },
      select: { id: true, studentId: true, student: { select: { admissionNo: true, nameEn: true } } },
    }),
  ]);
  const exams = [...examsRaw].sort((a, b) => ((a as any).stage ?? 99) - ((b as any).stage ?? 99) || b.createdAt.getTime() - a.createdAt.getTime());
  const enrollments = [...enrollmentsRaw].sort((a, b) => {
    const na = parseInt((a.student.admissionNo || "").replace(/\D/g, "")) || 0;
    const nb = parseInt((b.student.admissionNo || "").replace(/\D/g, "")) || 0;
    if (na !== nb) return na - nb;
    return (a.student.admissionNo || "").localeCompare(b.student.admissionNo || "");
  });
  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  const monthUr: Record<number, string> = { 1: "پہلا مہینہ", 2: "چوتھا مہینہ", 3: "آٹھواں مہینہ", 4: "بارہواں مہینہ" };
  const examDisplayName = (e: any) => (ur && e?.stage && examNameUr[Number(e.stage)]) || e?.name || "-";
  const examDisplayMonth = (e: any) => (ur && e?.stage && monthUr[Number(e.stage)]) || e?.monthLabel || "-";
  const examDisplayStageLabel = (e: any) => (ur && e?.stage && examNameUr[Number(e.stage)]) || e?.stageLabel || (e?.stage ? `Stage ${e.stage}` : "-");
  return (
    <div className="space-y-5 theme-exams">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">{ur ? "امتحانات" : "Examination"}</h1>
        <p className="text-sm text-emerald-50 mt-1">{ur ? `سیشن: ${session.name} — سالانہ امتحانی کیلنڈر اور چاروں امتحانات کا ریکارڈ` : `Session: ${session.name} — Annual exam calendar and records of all four exams`}</p>
      </div>



      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="text-lg font-semibold text-emerald-900 mb-1">{ur ? "سالانہ امتحانی کیلنڈر" : "Annual Exam Calendar"}</h2>
        <p className="text-sm text-gray-600 mb-4">{ur ? "چار مراحل: ہر امتحان کا الگ ریکارڈ، نمبر، خودکار فیصد و گریڈ، اور وزنی سالانہ مجموعی نتیجہ۔" : "Four stages: separate record, marks, auto percentage & grade for each exam, and weighted annual combined result."}</p>
        <div className="grid md:grid-cols-2 gap-3">
          {STAGES.map(s => (
            <div key={s.stage} className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/30">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-semibold text-emerald-900">{s.stage}</div>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{s.stage===1?1:s.stage===2?4:s.stage===3?8:12}</span>
              </div>
              <p className={`text-sm text-gray-700 leading-6 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>{ur ? (s.stage===1?"صرف تحریری امتحان (MCQs، مختصر سوالات، خالی جگہیں، درست/غلط وغیرہ)۔ قرآن مجید ناظرہ شامل نہیں۔ الگ نتیجہ، سالانہ میں 20%۔":s.stage===2?"صرف تحریری امتحان (ابتدائی جیسی اقسام)۔ قرآن مجید ناظرہ شامل نہیں۔ الگ نتیجہ، سالانہ میں 20%۔":s.stage===3?"دو حصے: تحریری + زبانی (ناظرہ قرآن، اسلامی معلومات وغیرہ)۔ مشترکہ نتیجہ، سالانہ میں 20%۔":"دو حصے: تحریری + زبانی۔ مشترکہ نتیجہ، سالانہ میں 40%۔ پہلی تا تیسری پوزیشن پر سرٹیفکیٹ۔") : s.desc}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {s.written && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{ur ? "تحریری" : "Written"}</span>}
                {s.oral && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-100">{ur ? "زبانی" : "Oral"}</span>}
                <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">{ur ? "سالانہ وزن" : "Annual Weight"}: {s.weight}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold mb-2">{ur ? "ہر بڑے امتحان کے حصے" : "Parts of Each Major Exam"}</h2>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="border rounded-xl p-3"><div className="font-semibold text-emerald-900 mb-1">{ur ? "تحریری امتحان" : "Written Exam"}</div><ul className={`list-disc ${ur ? "pr-5" : "pl-5"} text-gray-700 space-y-0.5 ${ur ? "font-urdu" : ""}`} dir={ur?"rtl":"ltr"}>{ur ? (<><li>MCQs</li><li>خالی جگہیں</li><li>درست / غلط</li><li>مختصر سوالات</li><li>تفصیلی سوالات</li></>) : (<><li>MCQs</li><li>Fill in the blanks</li><li>True / False</li><li>Short questions</li><li>Descriptive questions</li></>)}</ul></div>
          <div className="border rounded-xl p-3"><div className="font-semibold text-emerald-900 mb-1">{ur ? "زبانی امتحان" : "Oral Exam"}</div><ul className={`list-disc ${ur ? "pr-5" : "pl-5"} text-gray-700 space-y-0.5 ${ur ? "font-urdu" : ""}`} dir={ur?"rtl":"ltr"}>{ur ? (<><li>ناظرہ قرآن</li><li>کلمے</li><li>مسنون دعائیں</li><li>نماز اور وضو</li><li>بنیادی اسلامی معلومات</li></>) : (<><li>Nazra Quran</li><li>Kalimas</li><li>Masnoon Duas</li><li>Namaz and Wuzu</li><li>Basic Islamic knowledge</li></>)}</ul></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="text-lg font-semibold text-emerald-900 mb-1">{ur ? "ہر امتحان کے لیے طلبہ منتخب کریں (امتحان سے پہلے)" : "Select Students for Each Exam (Before Opening Exam)"}</h2>
        <p className="text-sm text-gray-600 mb-4">{ur ? "یہ مرحلہ باہر/پہلے کریں: ہر امتحان کے لیے طلبہ منتخب کر کے محفوظ کریں، پھر امتحان کھولیں۔" : "Do this step outside/first: select and save students for each exam, then open the exam."}</p>
        <div className="space-y-4">
          {exams.map(e => {
            const selectedSet = new Set(((e as any).students || []).map((s: any) => s.studentId));
            return (
              <div key={e.id} className="border border-emerald-100 rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <div className="font-semibold text-emerald-900">{examDisplayName(e)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{ur ? "مرحلہ" : "Stage"} {(e as any).stage ?? "-"} — {ur ? "مہینہ" : "Month"} {(e as any).stage===1?"First":(e as any).stage===2?"Fourth":(e as any).stage===3?"Eighth":(e as any).stage===4?"Twelfth":"-"}</div>
                  </div>
                </div>
                <form action={selectStudentsForExam}>
                  <input type="hidden" name="examId" value={e.id} />
                  <div className="grid md:grid-cols-3 gap-2 max-h-56 overflow-auto border rounded-lg p-3 mb-3">
                    {enrollments.map(en => (
                      <label key={en.id} className="text-sm flex items-center gap-2">
                        <input type="checkbox" name="studentIds" value={en.studentId} defaultChecked={selectedSet.has(en.studentId)} />
                        <span>{en.student.admissionNo} - {en.student.nameEn}</span>
                      </label>
                    ))}
                    {enrollments.length === 0 && <div className="text-sm text-gray-500">{ur ? "کوئی طالب علم enrolled نہیں ہے۔" : "No enrolled students."}</div>}
                  </div>
                  <button className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2 rounded-lg">{ur ? "منتخب طلبہ محفوظ کریں" : "Save Selected Students"}</button>
                </form>
              </div>
            );
          })}
          {exams.length === 0 && <div className="text-sm text-gray-500">{ur ? "کوئی امتحان موجود نہیں۔" : "No exams available."}</div>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold mb-2">{ur ? "امتحان بنائیں (مرحلہ وار)" : "Create Exam (by Stage)"}</h2>
        <form action={createExam} className="grid md:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">{ur ? "مرحلہ" : "Stage"}</label>
            <select name="stage" required defaultValue="" className="w-full border rounded-lg px-3 py-2.5">
              <option value="" disabled>{ur ? "مرحلہ منتخب کریں" : "Select stage"}</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">{ur ? "مہینہ" : "Month"}</label>
            <select name="month" defaultValue="" className="w-full border rounded-lg px-3 py-2.5">
              <option value="" disabled>{ur ? "مہینہ منتخب کریں" : "Select month"}</option>
              <option value="1">First</option>
              <option value="4">Fourth</option>
              <option value="8">Eighth</option>
              <option value="12">Twelfth</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">{ur ? "امتحان کا نام" : "Exam Name"}</label>
            <select name="name" required defaultValue="" className="w-full border rounded-lg px-3 py-2.5">
              <option value="" disabled>{ur ? "امتحان کا نام منتخب کریں" : "Select exam name"}</option>
              {STAGES.map(s=><option key={s.name} value={s.name}>{ur ? examNameUr[s.stage] : s.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">{ur ? "امتحان کی تاریخ" : "Exam Date"}</label>
            <DateInputDMY name="examDate" required inputClassName="border rounded-lg px-3 py-2.5" />
          </div>
          <div>
            <button className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2.5 rounded-lg font-medium w-full">{ur ? "امتحان بنائیں" : "Create Exam"}</button>
          </div>
        </form>
        <p className="text-xs text-gray-500 mt-2">{ur ? "تاریخ منتخب کیے بغیر امتحان نہیں بنے گا۔ مرحلہ منتخب کریں (مہینہ اسی کے مطابق ہوگا)۔ مرحلہ 1 اور 2 میں صرف تحریری پرچے بنیں گے، مرحلہ 3 اور 4 میں تحریری اور زبانی پرچے بنیں گے۔" : "Exam will not be created without selecting a date. Select stage (month follows the stage). Stages 1 and 2 create written papers only; stages 3 and 4 create written and oral papers."}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-auto">
        <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-emerald-900">{ur ? "چاروں امتحانات کا الگ ریکارڈ" : "Records of All Four Exams"}</h2>
          <Link href="/results?view=annual" className="text-sm bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg">{ur ? "سالانہ مجموعی نتیجہ / پوزیشن ہولڈرز" : "Annual Combined Result / Position Holders"}</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-emerald-50 text-emerald-900"><tr><th className="p-3 text-left">{ur ? "امتحان / جماعت" : "Exam / Class"}</th><th className="p-3 text-center">{ur ? "مرحلہ" : "Stage"}</th><th className="p-3 text-center">{ur ? "مہینہ" : "Month"}</th><th className="p-3 text-center">{ur ? "قسم" : "Type"}</th><th className="p-3 text-center">{ur ? "تاریخ" : "Date"}</th><th className="p-3 text-center">{ur ? "طلبہ" : "Students"}</th><th className="p-3 text-center">{ur ? "پرچے" : "Papers"}</th><th className="p-3 text-center">{ur ? "نتائج" : "Results"}</th><th className="p-3 text-center">{ur ? "سالانہ وزن" : "Annual Weight"}</th><th className="p-3 text-center">{ur ? "عمل" : "Actions"}</th></tr></thead>
          <tbody>
            {exams.map(e => (
              <tr key={e.id} className="border-t hover:bg-gray-50/60">
                <td className="p-3">
                  <div className={`font-medium text-emerald-900 ${ur ? "font-urdu" : ""}`} dir={ur?"rtl":"ltr"}>{examDisplayName(e)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{e.subject || "Nazra Quran & Basic Islamic Studies"}</div>
                </td>
                <td className="p-3 text-center font-medium text-gray-800">{(e as any).stage ?? "-"}</td>
                <td className="p-3 text-center text-gray-700">{(e as any).stage===1?"First":(e as any).stage===2?"Fourth":(e as any).stage===3?"Eighth":(e as any).stage===4?"Twelfth":"-"}</td>
                <td className="p-3 text-center text-xs">{(e as any).hasWritten !== false ? (ur ? "تحریری" : "Written") : ""}{(e as any).hasWritten !== false && (e as any).hasOral !== false ? " + " : ""}{(e as any).hasOral !== false ? (ur ? "زبانی" : "Oral") : ""}</td>
                <td className="p-3 text-center">{formatDateDMY(e.examDate)}</td>
                <td className="p-3 text-center">{e._count.students}</td>
                <td className="p-3 text-center">{e._count.papers}</td>
                <td className="p-3 text-center">{e._count.results}</td>
                <td className="p-3 text-center">{(e as any).includedInAnnual !== false ? <span className="text-emerald-700">{(e as any).stage===4 ? "40%" : (e as any).stage ? "20%" : "20%"}</span> : "-"}</td>
                <td className="p-3 text-center"><Link className="text-emerald-700 underline font-medium" href={`/examination/${e.id}`}>{ur ? "کھولیں" : "Open"}</Link></td>
              </tr>
            ))}
            {exams.length===0 && <tr><td colSpan={10} className="p-6 text-center text-gray-500">{ur ? "ابھی کوئی امتحان نہیں۔ اوپر کیلنڈر مراحل سے بنائیں۔" : "No exams yet. Create from calendar stages above."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
