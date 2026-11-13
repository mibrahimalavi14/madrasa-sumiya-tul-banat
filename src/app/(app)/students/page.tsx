import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const tr = t[lang];
  const q = (await searchParams).q?.trim() || "";
  if (user?.role === "PARENT") {
    if (!user.parentStudentId) return <p>{tr.noLinkedStudent}</p>;
    redirect(`/students/${user.parentStudentId}`);
  }
  if (!session) return <div className="text-amber-800">{lang==="ur" ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select an active session first."}</div>;
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { sessionId: session.id },
    select: {
      id: true,
      rollNo: true,
      student: {
        select: {
          id: true, admissionNo: true, applicationNo: true, nameEn: true, nameUr: true,
          fatherName: true, motherName: true, admissionClass: true,
        },
      },
    },
  });
  const ql = q.toLowerCase();
  const sorted = [...enrollments].sort((a, b) => {
    const na = parseInt((a.student.admissionNo || "").replace(/\D/g, "")) || 0;
    const nb = parseInt((b.student.admissionNo || "").replace(/\D/g, "")) || 0;
    if (na !== nb) return na - nb;
    return (a.student.admissionNo || "").localeCompare(b.student.admissionNo || "");
  });
  const filtered = q
    ? sorted.filter(e => {
        const s = e.student;
        return [s.admissionNo, s.applicationNo, s.nameEn, s.nameUr, s.fatherName, s.motherName, s.admissionClass]
          .some(v => (v || "").toLowerCase().includes(ql));
      })
    : sorted;
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr.students}</h1>
          <p className="text-sm text-emerald-50 mt-1">{tr.session}: {session.name}</p>
        </div>
        <div className="flex gap-2 no-print flex-wrap">
          <Link href="/students/new" className="bg-white text-emerald-800 px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-emerald-50">{tr.newAdmission}</Link>
          <Link href="/students/admission-form" className="bg-amber-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-amber-600">{tr.blankAdmissionForm}</Link>
        </div>
      </div>
      <form className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 flex gap-2 no-print">
        <input name="q" defaultValue={q} placeholder={lang==="ur" ? "داخلہ نمبر / درخواست نمبر / نام سے تلاش کریں" : "Search by Admission No / Application No / Name"} className="border border-gray-200 rounded-xl px-4 py-2.5 w-full max-w-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
        <button className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium">{tr.search}</button>
      </form>
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-emerald-50 text-emerald-900"><tr><th className="p-3 text-left">{tr.admissionNo}</th><th className="p-3 text-left">{tr.applicationNo}</th><th className="p-3 text-left">{tr.name}</th><th className="p-3 text-left">{tr.fatherMother}</th><th className="p-3 text-left">{tr.class}</th><th className="p-3 text-center">{tr.rollNo}</th><th className="p-3 text-left">{tr.actions}</th></tr></thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-t hover:bg-gray-50/70">
                <td className="p-3 font-semibold text-gray-900">{e.student.admissionNo}</td>
                <td className="p-3">{e.student.applicationNo || "-"}</td>
                <td className="p-3">{e.student.nameEn} {e.student.nameUr && <span className="font-urdu text-gray-700">/ {e.student.nameUr}</span>}</td>
                <td className="p-3">{[e.student.fatherName, e.student.motherName].filter(Boolean).join(" / ") || "-"}</td>
                <td className="p-3">{e.student.admissionClass || "-"}</td>
                <td className="p-3 text-center">{e.rollNo || "-"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Link className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100" href={`/students/${e.student.id}`}>{tr.profile}</Link>
                    <Link className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 font-medium hover:bg-blue-100" href={`/students/${e.student.id}/edit`}>{tr.edit}</Link>
                    <Link className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-medium hover:bg-amber-100" href={`/students/${e.student.id}/admission-form`}>{tr.print}</Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={7} className="p-6 text-center text-gray-500">{tr.noStudents}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
