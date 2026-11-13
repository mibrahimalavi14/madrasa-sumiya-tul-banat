import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import PrintButton from "@/components/PrintButton";

function parseOptions(q: any): string[] {
  try { const a = JSON.parse(q.optionsJson || "[]"); return Array.isArray(a) ? [0,1,2,3].map(i => String(a[i] || "")) : ["","","",""]; } catch { return ["","","",""]; }
}

const examNameUrByStage: Record<number, string> = {
  1: "ابتدائی تحریری امتحان",
  2: "ششماہی امتحان",
  3: "سہ ماہی امتحان",
  4: "سالانہ امتحان",
};

export default async function PaperPrint({ params, searchParams }: { params: Promise<{ id: string; paperId: string }>, searchParams: Promise<{ studentId?: string }> }) {
  const { id, paperId } = await params;
  const sp = await searchParams;
  const paper = await prisma.questionPaper.findUnique({ where: { id: paperId }, include: { exam: { include: { session: true, students: { include: { student: true } } } }, questions: { orderBy: { order: "asc" } } } });
  if (!paper || paper.examId !== id) notFound();
  const enrolls = await prisma.studentEnrollment.findMany({ where: { sessionId: paper.exam.sessionId } });
  const rollMap = new Map(enrolls.map(e=>[e.studentId, e.rollNo]));
  const students = paper.exam.students.map(es => ({ ...es.student, rollNo: rollMap.get(es.studentId) || "" }));
  const selectedStudent = sp.studentId ? students.find(s=>s.id===sp.studentId) : (students[0] || null);
  const isWritten = paper.type === "WRITTEN";
  const examNameUr = examNameUrByStage[Number((paper.exam as any).stage)] || (paper.exam as any).stageLabel || paper.exam.name;

  const mcqs = paper.questions.filter(q => q.type === "mcq");
  const fills = paper.questions.filter(q => q.type === "fill");
  const qas = paper.questions.filter(q => q.type === "short");

  const renderWritten = (stu?: {nameEn:string;nameUr:string|null;admissionNo:string;rollNo:string|null}) => (
    <div className="paper-sheet print-area" dir="rtl">
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          .no-print { display: none !important; }
        }
        .paper-sheet { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; }
      `}</style>
      <div className="border-2 border-black p-3">
        <div className="border-b-2 border-black pb-2 mb-2 flex items-center justify-center gap-3 text-center">
          <Logo size={52} className="shrink-0" />
          <div className="w-full">
            <div className="text-2xl font-bold leading-tight">مدرسہ سمیّة البنات</div>
            <div className="text-lg font-semibold mt-1 flex items-center justify-between gap-4">
              <span>تحریری پرچہ — کوڈ نمبر: {paper.paperCode}</span>
              <span>حاصل کردہ نمبر: ________</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[16px] mb-2 font-urdu leading-7">
          <div><b>امتحان:</b> {examNameUr}</div>
          <div><b>سیشن:</b> {paper.exam.session.name}</div>
          <div><b>جماعت:</b> {paper.className}</div>
          <div><b>مضمون:</b> {paper.mazhmoon}</div>
          <div><b>تاریخ:</b> {paper.exam.examDate?.toISOString().slice(0,10) || "________"}</div>
          <div><b>رول نمبر:</b> {stu?.rollNo || "________"}</div>
          <div className="col-span-2"><b>طالب علم کا نام:</b> {stu ? (stu.nameUr || stu.nameEn) : "________________________"}</div>
        </div>

        <div className="space-y-2.5 text-[17px] leading-8 font-urdu">
          <section>
            <div className="font-bold border-b border-black pb-1 mb-1 text-[18px]">سوال نمبر ۱: درست جواب پر (✓) کا نشان لگائیں۔ <span className="font-normal">(کل نمبر: 20) — ہر سوال کے 4 نمبر</span></div>
            <ol className="list-decimal list-inside pr-1 space-y-1.5" style={{ listStyleType: "decimal" }}>
              {mcqs.map((q) => {
                const opts = parseOptions(q);
                const labels = ["الف", "ب", "ج", "د"];
                return (
                  <li key={q.id} className="leading-8">
                    <span className="inline-flex w-[calc(100%-1.7em)] justify-between gap-2 align-top"><span>{q.textUr || "________________"}</span><span className="whitespace-nowrap">({q.marks ?? 4})</span></span>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-0.5 pr-6 text-[16px]">
                      {opts.map((o, i) => (<div key={i}>({labels[i]}) {o || "________"}</div>))}
                    </div>
                  </li>
                );
              })}
              {mcqs.length===0 && <li>کوئی سوال شامل نہیں۔</li>}
            </ol>
          </section>

          <section>
            <div className="font-bold border-b border-black pb-1 mb-1 text-[18px]">سوال نمبر ۲: خالی جگہ پر کریں۔ <span className="font-normal">(کل نمبر: 10) — ہر سوال کے 2 نمبر</span></div>
            <ol className="list-decimal list-inside pr-1 space-y-1" style={{ listStyleType: "decimal" }}>
              {fills.map(q => (
                <li key={q.id} className="leading-8">
                  <span className="inline-flex w-[calc(100%-1.7em)] justify-between gap-2 align-top"><span>{q.textUr || "________________"}</span><span className="whitespace-nowrap">({q.marks ?? 2})</span></span>
                </li>
              ))}
              {fills.length===0 && <li>کوئی سوال شامل نہیں۔</li>}
            </ol>
          </section>

          <section>
            <div className="font-bold border-b border-black pb-1 mb-1 text-[18px]">سوال نمبر ۳: سوالات کے جواب تحریر کریں۔ <span className="font-normal">(کل نمبر: 20) — ہر سوال کے 4 نمبر</span></div>
            <ol className="list-decimal list-inside pr-1 space-y-1.5" style={{ listStyleType: "decimal" }}>
              {qas.map(q => (
                <li key={q.id} className="leading-8">
                  <span className="inline-flex w-[calc(100%-1.7em)] justify-between gap-2 align-top"><span>{q.textUr || "________________"}</span><span className="whitespace-nowrap">({q.marks ?? 4})</span></span>
                  <div className="mt-1 space-y-4 pr-6" dir="rtl">
                    {Array.from({length: q.answerSpace || 2}).map((_,i)=>(<div key={i} className="border-b border-gray-600 h-6"></div>))}
                  </div>
                </li>
              ))}
              {qas.length===0 && <li>کوئی سوال شامل نہیں۔</li>}
            </ol>
          </section>
        </div>


      </div>
    </div>
  );

  const renderOral = (stu?: {nameEn:string;nameUr:string|null;admissionNo:string;rollNo:string|null}) => (
    <div className="print-area" dir="rtl">
      <style>{`@media print { @page { size: A4; margin: 10mm; } .no-print { display: none !important; } }`}</style>
      <div className="border-2 border-black p-4">
        <div className="border-b-2 border-black pb-2 mb-3 flex items-center justify-center gap-3 text-center">
          <Logo size={52} className="shrink-0" />
          <div>
            <div className="text-2xl font-bold">مدرسہ سمیّة البنات</div>
            <div className="text-lg font-semibold mt-1">زبانی پرچہ (استاد کے لیے) — کوڈ نمبر {paper.paperCode}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[15px] mb-3 font-urdu leading-7">
          <div><b>امتحان:</b> {examNameUr}</div><div><b>سیشن:</b> {paper.exam.session.name}</div>
          <div><b>جماعت:</b> {paper.className}</div><div><b>مضمون:</b> {paper.mazhmoon}</div>
          <div><b>تاریخ:</b> {paper.exam.examDate?.toISOString().slice(0,10) || "________"}</div><div></div>
          <div><b>طالب علم کا نام:</b> {stu ? (stu.nameUr || stu.nameEn) : "________________________"}</div>
          <div><b>رول نمبر:</b> {stu?.rollNo || "________"}</div>
        </div>
        <ol className="space-y-3 list-decimal pr-6 font-urdu text-[16px] leading-8">
          {paper.questions.map(q => (
            <li key={q.id} className="leading-8">
              <div className="flex justify-between items-start gap-2"><span>{q.textUr}</span>{q.marks ? <span>[{q.marks}]</span> : null}</div>
              <div className="mt-1 text-[15px]">نمبر/تبصرہ: ____________</div>
            </li>
          ))}
          {paper.questions.length===0 && <li>کوئی سوال شامل نہیں۔</li>}
        </ol>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-4 max-w-4xl mx-auto">
      <div className="no-print mb-4 flex gap-2 items-center flex-wrap">
        <Link href={`/examination/${id}/paper/${paperId}`} className="text-sm text-emerald-800 hover:text-emerald-900 font-medium border border-emerald-200 bg-emerald-50 px-3 py-2 rounded">← واپس</Link>
        <PrintButton />
        <span className="text-xs text-gray-500 font-urdu">پرنٹ میں دونوں طرف (duplex) ایک ہی صفحہ استعمال کریں۔</span>
      </div>
      {selectedStudent ? (isWritten ? renderWritten(selectedStudent) : renderOral(selectedStudent)) : (
        <div className="border border-dashed rounded-xl p-6 text-center text-gray-600 font-urdu">پرنٹ کے لیے پہلے امتحان میں طلبہ منتخب کریں۔</div>
      )}
    </div>
  );
}
