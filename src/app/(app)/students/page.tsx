import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import SelectAllBulkCheckbox from "@/components/SelectAllBulkCheckbox";

async function carrySelectedStudentsAction(formData: FormData) {
  "use server";
  const user = await getAuthUser();
  if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const fromSessionId = String(formData.get("fromSessionId") || "");
  const toId = String(formData.get("toId") || "");
  const ids = formData.getAll("studentIds").map(String).filter(Boolean);
  if (!fromSessionId || !toId || fromSessionId === toId || ids.length === 0) return;
  const target = await prisma.session.findUnique({ where: { id: toId }, select: { status: true } });
  if (!target || target.status !== "ACTIVE") return;
  const enrolls = await prisma.studentEnrollment.findMany({ where: { sessionId: fromSessionId, studentId: { in: ids } }, select: { id: true, studentId: true } });
  let carried = 0;
  for (const e of enrolls) {
    await prisma.studentEnrollment.upsert({
      where: { studentId_sessionId: { studentId: e.studentId, sessionId: toId } },
      update: {},
      create: { studentId: e.studentId, sessionId: toId, carriedFromId: e.id, rollNo: null, rollLocked: false },
    });
    carried++;
  }
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "STUDENTS_CARRY_SELECTED", entityType: "Session", entityId: toId, details: JSON.stringify({ fromSessionId, toId, count: carried, studentIds: ids.slice(0, 50) }) });
  revalidatePath("/students");
  revalidatePath("/sessions");
}

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const tr = t[lang];
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const pageSize = 30;

  if (user?.role === "PARENT") {
    if (!user.parentStudentId) return <p>{tr.noLinkedStudent}</p>;
    redirect(`/students/${user.parentStudentId}`);
  }
  if (!session) return <div className="text-amber-800">{lang==="ur" ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select an active session first."}</div>;

  const where: any = { sessionId: session.id };
  if (q) {
    where.student = {
      OR: [
        { admissionNo: { contains: q, mode: "insensitive" } },
        { applicationNo: { contains: q, mode: "insensitive" } },
        { nameEn: { contains: q, mode: "insensitive" } },
        { nameUr: { contains: q, mode: "insensitive" } },
        { fatherName: { contains: q, mode: "insensitive" } },
        { motherName: { contains: q, mode: "insensitive" } },
        { admissionClass: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [total, enrollments, targetSessions] = await Promise.all([
    prisma.studentEnrollment.count({ where }),
    prisma.studentEnrollment.findMany({
      where,
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
      orderBy: [{ student: { admissionNo: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.session.findMany({ where: { status: "ACTIVE", id: { not: session.id } }, select: { id: true, name: true }, orderBy: { startDate: "desc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageEnrollments = page > totalPages && totalPages > 0 ? [] : enrollments;

  const mkHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/students?${s}` : "/students";
  };

  return (
    <div className="space-y-4 theme-students">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr.students}</h1>
          <p className="text-sm text-emerald-50 mt-1">{tr.session}: {session.name} · {lang==="ur" ? "کل" : "Total"}: {total}</p>
        </div>
        <div className="flex gap-2 no-print flex-wrap">
          <Link href="/students/new" className="bg-white text-emerald-800 px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-emerald-50">{tr.newAdmission}</Link>
          <Link href="/students/admission-form" className="bg-amber-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-amber-600">{tr.blankAdmissionForm}</Link>
          <Link href="/students/slips" className="bg-teal-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-teal-600">{lang==="ur" ? "امتحانی سلپس" : "Exam Slips"}</Link>
          <a href="/api/export/students" className="bg-emerald-900/40 border border-emerald-200/30 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-emerald-900/60">{lang==="ur" ? "CSV ایکسپورٹ" : "Export CSV"}</a>
        </div>
      </div>
      <form className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 flex gap-2 no-print flex-wrap items-center">
        <input name="q" defaultValue={q} placeholder={lang==="ur" ? "داخلہ نمبر / درخواست نمبر / نام سے تلاش کریں" : "Search by Admission No / Application No / Name"} className="border border-gray-200 rounded-xl px-4 py-2.5 w-full max-w-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
        <button className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium">{tr.search}</button>
        {q && <Link href="/students" className="text-sm text-emerald-700 underline">{lang==="ur" ? "صاف کریں" : "Clear"}</Link>}
      </form>

      {targetSessions.length > 0 && (
        <form id="bulk-carry-form" action={carrySelectedStudentsAction} className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 flex flex-wrap items-end gap-3 no-print">
          <input type="hidden" name="fromSessionId" value={session.id} />
          <div>
            <label className="block text-xs text-gray-600 mb-1">{lang==="ur" ? "منتخب طلبہ کو منتقل کریں (فعال سیشن میں)" : "Carry selected students to (ACTIVE session)"}</label>
            <select name="toId" required className="border border-emerald-200 rounded-xl px-3 py-2.5 min-w-[220px] text-sm">
              <option value="">{lang==="ur" ? "ہدف سیشن منتخب کریں" : "Select target session"}</option>
              {targetSessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm">{lang==="ur" ? "منتخب طلبہ منتقل کریں" : "Carry Selected"}</button>
          <p className="text-xs text-gray-500 w-full">{lang==="ur" ? "نیچے چیک باکس سے طلبہ منتخب کریں۔ صرف اسی صفحے پر منتخب طلبہ منتقل ہوں گے۔" : "Select students using checkboxes below. Only selected students on this page will be carried."}</p>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-emerald-50 text-emerald-900"><tr>{targetSessions.length > 0 && <th className="p-3 text-center w-10 no-print"><div className="flex flex-col items-center gap-1"><SelectAllBulkCheckbox formId="bulk-carry-form" name="studentIds" title={lang==="ur" ? "سب منتخب کریں" : "Select all"} /><span className="text-[10px] font-medium">{lang==="ur" ? "سب" : "All"}</span></div></th>}<th className="p-3 text-center w-14">{lang === "ur" ? "نمبر شمار" : "S.No"}</th><th className="p-3 text-left">{tr.admissionNo}</th><th className="p-3 text-left">{tr.applicationNo}</th><th className="p-3 text-left">{tr.name}</th><th className="p-3 text-left">{tr.fatherMother}</th><th className="p-3 text-left">{tr.class}</th><th className="p-3 text-center">{tr.rollNo}</th><th className="p-3 text-left">{tr.actions}</th></tr></thead>
          <tbody>
            {pageEnrollments.map((e, i) => (
              <tr key={e.id} className="border-t hover:bg-gray-50/70">
                {targetSessions.length > 0 && <td className="p-3 text-center no-print"><input type="checkbox" name="studentIds" value={e.student.id} form="bulk-carry-form" className="h-4 w-4 rounded border-emerald-300 text-emerald-700" /></td>}
                <td className="p-3 text-center text-gray-600 font-medium">{(safePage - 1) * pageSize + i + 1}</td>
                <td className="p-3 font-semibold text-gray-900">{e.student.admissionNo}</td>
                <td className="p-3">{e.student.applicationNo || "-"}</td>
                <td className="p-3">{e.student.nameEn} {e.student.nameUr && <span className="font-urdu text-gray-700">/ {e.student.nameUr}</span>}</td>
                <td className="p-3">{[e.student.fatherName, e.student.motherName].filter(Boolean).join(" / ") || "-"}</td>
                <td className="p-3">{e.student.admissionClass || "-"}</td>
                <td className="p-3 text-center">{e.rollNo || "-"}</td>
                <td className="p-3 whitespace-nowrap">
                  <div className="inline-flex flex-nowrap items-center gap-2">
                    <Link className="inline-flex px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100" href={`/students/${e.student.id}`}>{tr.profile}</Link>
                    <Link className="inline-flex px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 font-medium hover:bg-blue-100" href={`/students/${e.student.id}/edit`}>{tr.edit}</Link>
                    <Link className="inline-flex px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-medium hover:bg-amber-100" href={`/students/${e.student.id}/admission-form`}>{tr.print}</Link>
                  </div>
                </td>
              </tr>
            ))}
            {pageEnrollments.length===0 && <tr><td colSpan={targetSessions.length > 0 ? 9 : 8} className="p-6 text-center text-gray-500">{tr.noStudents}</td></tr>}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 bg-white rounded-2xl shadow-sm border border-emerald-100 p-3 text-sm flex-wrap">
          <div className="text-gray-600">{lang==="ur" ? `صفحہ ${safePage} از ${totalPages}` : `Page ${safePage} of ${totalPages}`}</div>
          <div className="flex items-center gap-2">
            <Link href={mkHref(Math.max(1, safePage - 1))} aria-disabled={safePage <= 1} className={`px-3 py-1.5 rounded-lg border ${safePage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}>{lang==="ur" ? "پچھلا" : "Prev"}</Link>
            <Link href={mkHref(Math.min(totalPages, safePage + 1))} aria-disabled={safePage >= totalPages} className={`px-3 py-1.5 rounded-lg border ${safePage >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}>{lang==="ur" ? "اگلا" : "Next"}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
