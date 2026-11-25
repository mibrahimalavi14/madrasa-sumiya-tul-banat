import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { formatDateDMY } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";


export default async function ExamDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(); if (user?.role !== "ADMIN" && user?.role !== "ACCOUNTANT") redirect("/dashboard");
  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    select: {
      id: true, name: true, subject: true, examDate: true, sessionId: true, stage: true, stageLabel: true, monthLabel: true, hasWritten: true, hasOral: true,
      session: { select: { name: true } },
      students: { select: { studentId: true } },
      papers: { select: { id: true, type: true, paperCode: true, title: true }, orderBy: [{ type: "asc" }, { paperCode: "asc" }] },
    },
  });
  if (!exam) notFound();
  const enrollmentsRaw = await prisma.studentEnrollment.findMany({
    where: { sessionId: exam.sessionId },
    select: { id: true, studentId: true, rollNo: true, student: { select: { admissionNo: true, nameEn: true } } },
  });
  const enrollments = [...enrollmentsRaw].sort((a, b) => {
    const na = parseInt((a.student.admissionNo || "").replace(/\D/g, "")) || 0;
    const nb = parseInt((b.student.admissionNo || "").replace(/\D/g, "")) || 0;
    if (na !== nb) return na - nb;
    return (a.student.admissionNo || "").localeCompare(b.student.admissionNo || "");
  });
  const selected = new Set(exam.students.map(s=>s.studentId));
  const written = exam.papers.filter(p=>p.type==="WRITTEN");
  const oral = exam.papers.filter(p=>p.type==="ORAL");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900">{exam.name}{exam.stage ? ` (${exam.stage===4?40:20}%)` : ""}</h1>
          {exam.stageLabel && <p className="text-sm text-gray-600 mt-0.5 font-urdu" dir="rtl">{(() => { const m: Record<number,string>={1:"3rd Month",2:"6th Month",3:"9th Month",4:"12th Month"}; const ml = exam.stage ? m[Number(exam.stage)] : exam.monthLabel; return ml ? `${ml} — ` : ""; })()}{exam.stageLabel}{exam.stage ? ` (Annual Weight: ${exam.stage===4?40:20}%)` : ""}</p>}
        </div>
        <Link href="/examination" className="text-emerald-700 underline">← Back</Link>
      </div>
      <div className="bg-white rounded-xl shadow p-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
        <div>
          <div className="text-gray-500 text-xs mb-1">Subject</div>
          <div className="font-medium text-gray-900">{exam.subject || "-"}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">Date</div>
          <div className="font-medium text-gray-900">{formatDateDMY(exam.examDate)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">Type</div>
          <div className="font-medium text-gray-900">{exam.hasWritten !== false ? "Written" : ""}{exam.hasWritten !== false && exam.hasOral !== false ? " + " : ""}{exam.hasOral !== false ? "Oral" : ""}{exam.stage ? ` | Annual Weight: ${exam.stage===4?40:20}%` : ""}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">Session</div>
          <div className="font-medium text-gray-900">{exam.session.name}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-2">Selected Students</h2>
        <p className="text-sm text-gray-600 mb-3">صرف وہی طلبہ دکھائے گئے ہیں جو اس امتحان کے لیے منتخب کیے گئے ہیں۔</p>
        <div className="overflow-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-center">Roll No</th>
                <th className="p-2 text-left">Student Name</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.filter(en => selected.has(en.studentId)).map(en => (
                <tr key={en.id} className="border-t">
                  <td className="p-2 text-center font-semibold text-emerald-900">{en.rollNo || "-"}</td>
                  <td className="p-2">{en.student.nameEn}</td>
                </tr>
              ))}
              {exam.students.length === 0 && <tr><td colSpan={2} className="p-3 text-center text-gray-500">No students selected for this exam yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">Tehreeri (Written) Papers - 01,02,03</h2>
          <p className="text-xs text-gray-500 mb-2">Mazmoon: Basic Islamic Studies | Class: Nazra Quran & Basic Islamic Studies</p>
          {written.length === 0 ? <p className="text-sm text-gray-500">No written papers in this exam.</p> : (
            <ul className="space-y-2">{written.map(p => (<li key={p.id} className="flex items-center justify-between border rounded p-2"><span>Code {p.paperCode} - {p.title||"Written"}</span><span className="space-x-2 text-sm"><Link className="text-blue-700 underline" href={`/examination/${exam.id}/paper/${p.id}`}>Edit/Questions</Link><Link className="text-emerald-700 underline" href={`/examination/${exam.id}/paper/${p.id}/print`}>Print</Link></span></li>))}</ul>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">Oral Papers - 01,02,03</h2>
          <p className="text-xs text-gray-500 mb-2">Mazmoon: Nazra Quran & Basic Islamic Studies | Questions only (teacher reminder)</p>
          {oral.length === 0 ? <p className="text-sm text-gray-500">No oral papers in this exam.</p> : (
            <ul className="space-y-2">{oral.map(p => (<li key={p.id} className="flex items-center justify-between border rounded p-2"><span>Code {p.paperCode} - {p.title||"Oral"}</span><span className="space-x-2 text-sm"><Link className="text-blue-700 underline" href={`/examination/${exam.id}/paper/${p.id}`}>Edit Questions</Link><Link className="text-emerald-700 underline" href={`/examination/${exam.id}/paper/${p.id}/print`}>Print (Teacher)</Link><span className="text-gray-500">زبانی نمبر Results میں درج کریں / Enter oral marks in Results</span></span></li>))}</ul>
          )}
        </div>
      </div>
    </div>
  );
}
