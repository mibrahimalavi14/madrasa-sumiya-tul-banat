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
import ExportCsvDetails from "@/components/ExportCsvDetails";
import ScrollToHighlight from "@/components/ScrollToHighlight";

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

async function autoAssignRollNumbersAction(formData: FormData) {
  "use server";
  const user = await getAuthUser();
  if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const sessionId = String(formData.get("sessionId") || "");
  const session = await getCurrentSession();
  if (!session || session.id !== sessionId || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  const enrolls = await prisma.studentEnrollment.findMany({
    where: { sessionId },
    select: { id: true, rollNo: true, rollLocked: true, student: { select: { admissionNo: true } } },
  });
  const sorted = [...enrolls].sort((a, b) => {
    const na = parseInt(String(a.student?.admissionNo || "").replace(/\D/g, ""), 10) || 0;
    const nb = parseInt(String(b.student?.admissionNo || "").replace(/\D/g, ""), 10) || 0;
    if (na !== nb) return na - nb;
    return String(a.student?.admissionNo || "").localeCompare(String(b.student?.admissionNo || ""));
  });
  // Respect existing numeric roll numbers to avoid collisions; assign missing/unlocked sequentially.
  const used = new Set<number>();
  for (const e of sorted) {
    const n = parseInt(String(e.rollNo || "").trim(), 10);
    if (String(e.rollNo || "").trim() !== "" && Number.isFinite(n)) used.add(n);
  }
  let next = 1;
  const takeNext = () => { while (used.has(next)) next++; const v = next; used.add(v); next++; return v; };
  let assigned = 0;
  for (const e of sorted) {
    const hasRoll = String(e.rollNo || "").trim() !== "";
    if (e.rollLocked || hasRoll) continue;
    const n = takeNext();
    await prisma.studentEnrollment.update({ where: { id: e.id }, data: { rollNo: String(n) } });
    assigned++;
  }
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "STUDENTS_AUTO_ASSIGN_ROLLS", entityType: "Session", entityId: sessionId, details: JSON.stringify({ assigned, total: sorted.length }) });
  revalidatePath("/students");
}

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; highlight?: string }> }) {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const tr = t[lang];
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const highlight = sp.highlight?.trim() || "";
  const pageSize = 30;

  if (user?.role === "PARENT") {
    if (!user.parentStudentId) return <p>{tr.noLinkedStudent}</p>;
    redirect(`/students/${user.parentStudentId}`);
  }
  if (!session) return <div className="text-amber-800">{lang==="ur" ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select an active session first."}</div>;
  const canEditStudents = user?.role === "ADMIN";

  const where: any = {
    sessionId: session.id,
    student: {
      status: "ACTIVE",
      ...(q ? {
        OR: [
          { admissionNo: { contains: q, mode: "insensitive" } },
          { applicationNo: { contains: q, mode: "insensitive" } },
          { nameEn: { contains: q, mode: "insensitive" } },
          { nameUr: { contains: q, mode: "insensitive" } },
          { fatherName: { contains: q, mode: "insensitive" } },
          { motherName: { contains: q, mode: "insensitive" } },
          { admissionClass: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
  };

  const [total, allEnrollments, targetSessions] = await Promise.all([
    prisma.studentEnrollment.count({ where }),
    prisma.studentEnrollment.findMany({
      where,
      select: {
        id: true,
        rollNo: true,
        student: {
          select: {
            id: true, admissionNo: true, applicationNo: true, nameEn: true, nameUr: true,
            fatherName: true, motherName: true, admissionClass: true, status: true,
          },
        },
      },
      orderBy: [{ student: { admissionNo: "asc" } }],
    }),
    prisma.session.findMany({ where: { status: "ACTIVE", id: { not: session.id } }, select: { id: true, name: true }, orderBy: { startDate: "desc" } }),
  ]);

  const activeEnrollments = allEnrollments.filter(e => e.student.status === "ACTIVE");
  const registeredEnrollments = allEnrollments.filter(e => e.student.status === "REGISTERED");
  const leftEnrollments = allEnrollments.filter(e => e.student.status === "LEFT");
  const otherEnrollments = allEnrollments.filter(e => !["ACTIVE", "REGISTERED", "LEFT"].includes(String(e.student.status || "")));

  const mkHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/students?${s}` : "/students";
  };

  return (
    <div className="space-y-4 theme-students">
      <ScrollToHighlight />
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr.students}</h1>
          <p className="text-sm text-emerald-50 mt-1">{tr.session}: {session.name} · {lang==="ur" ? "کل" : "Total"}: {total}</p>
        </div>
        <div className="flex flex-col gap-2 no-print w-full sm:w-auto">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
            {canEditStudents && <Link href="/students/new" className="bg-white text-emerald-800 px-3 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-emerald-50 text-center sm:w-40 flex items-center justify-center">{tr.newAdmission}</Link>}
            <Link href="/students/admission-form" className="bg-amber-500 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-amber-600 text-center sm:w-40 flex items-center justify-center">{tr.blankAdmissionForm}</Link>
            <Link href="/students/slips" className="bg-teal-500 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-teal-600 text-center sm:w-40 flex items-center justify-center">{lang==="ur" ? "رول نمبر فہرست" : "Roll No List"}</Link>
          </div>
          <div className="flex justify-center w-full">
            <ExportCsvDetails
              className="relative sm:w-40"
              summaryClassName="list-none cursor-pointer bg-emerald-900/40 border border-emerald-200/30 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-emerald-900/60 text-center w-full flex items-center justify-center"
              label={lang==="ur" ? "CSV ایکسپورٹ" : "Export CSV"}
            >
              <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 mt-2 w-[min(18rem,calc(100vw-2rem))] bg-white text-gray-800 border border-emerald-100 rounded-xl shadow-lg p-3 z-20">
                <form action="/api/export/students" method="get" className="space-y-2 text-sm">
                  <div className="font-semibold text-emerald-900">{lang==="ur" ? "کالم منتخب کریں" : "Select columns"}</div>
                  <div className="grid grid-cols-2 gap-1 max-h-52 overflow-auto">
                    {[["admissionNo","Admission No"],["nameEn","Name EN"],["nameUr","Name UR"],["father","Father"],["class","Class"],["rollNo","Roll No"],["phone","Phone"],["status","Status"],["admissionDate","Admission Date"],["monthlyFee","Monthly Fee"]].map(([k,l]) => (
                      <label key={k} className="flex items-center gap-1"><input type="checkbox" name="columns" value={k} /> <span>{l}</span></label>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button className="bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs">{lang==="ur" ? "ایکسپورٹ" : "Export"}</button>
                    <a href="/api/export/students" className="px-3 py-1.5 rounded-lg text-xs border">{lang==="ur" ? "تمام" : "All"}</a>
                  </div>
                </form>
              </div>
            </ExportCsvDetails>
          </div>
        </div>
      </div>
      <form className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 no-print">
        <label className="block text-base font-bold text-emerald-900 mb-2">{lang==="ur" ? "تلاش" : "Search"}</label>
        <div className="flex gap-2 flex-wrap items-center">
          <input name="q" defaultValue={q} placeholder={lang==="ur" ? "داخلہ نمبر / نام تلاش کریں" : "Search by Admission No / Name"} className="border border-gray-200 rounded-xl px-4 py-2.5 w-full sm:flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          <button className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium">{tr.search}</button>
          {q && <Link href="/students" className="text-sm text-emerald-700 underline">{lang==="ur" ? "صاف کریں" : "Clear"}</Link>}
        </div>
      </form>

      {canEditStudents && targetSessions.length > 0 && (
        <form id="bulk-carry-form" action={carrySelectedStudentsAction} className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 flex flex-wrap items-end gap-3 no-print">
          <input type="hidden" name="fromSessionId" value={session.id} />
          <div>
            <label className="block text-xs text-gray-600 mb-1">{lang==="ur" ? "منتخب طلبہ کو منتقل کریں (فعال سیشن میں)" : "Carry selected students to (ACTIVE session)"}</label>
            <select name="toId" required className="border border-emerald-200 rounded-xl px-3 py-2.5 w-full min-w-0 sm:w-auto sm:min-w-[220px] text-sm">
              <option value="">{lang==="ur" ? "ہدف سیشن منتخب کریں" : "Select target session"}</option>
              {targetSessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm">{lang==="ur" ? "منتخب طلبہ منتقل کریں" : "Carry Selected"}</button>
          <p className="text-xs text-gray-500 w-full">{lang==="ur" ? "نیچے چیک باکس سے طلبہ منتخب کریں۔ صرف اسی صفحے پر منتخب طلبہ منتقل ہوں گے۔" : "Select students using checkboxes below. Only selected students on this page will be carried."}</p>
        </form>
      )}

      {canEditStudents && session.status === "ACTIVE" && (
        <form action={autoAssignRollNumbersAction} className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 flex flex-wrap items-center gap-3 no-print">
          <input type="hidden" name="sessionId" value={session.id} />
          <div className="text-sm text-gray-700">
            <div className="font-medium text-emerald-900">{lang==="ur" ? "رول نمبر مینجمنٹ" : "Roll Number Management"}</div>
            <div className="text-xs text-gray-500">{lang==="ur" ? "خالی/غیر مقفل رول نمبرز کو داخلہ نمبر کی ترتیب سے خودکار تفویض کریں (موجودہ مقفل/مقرر رول نمبرز محفوظ رہیں گے)۔" : "Auto-assign missing/unlocked roll numbers in admission number order (existing locked/assigned roll numbers remain unchanged)."}</div>
          </div>
          <button className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-medium text-sm">{lang==="ur" ? "خودکار رول نمبر لگائیں" : "Auto-Assign Roll Numbers"}</button>
        </form>
      )}

      {[
        { key: "ACTIVE", title: lang === "ur" ? "فعال طلبہ" : "Active Students", list: activeEnrollments, badge: "bg-emerald-100 text-emerald-800" },
      ].map(section => (
        <div key={section.key} className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-auto">
          <div className="px-4 py-3 border-b border-emerald-100 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-emerald-900">{section.title}</h2>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${section.badge}`}>{section.list.length}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-emerald-50 text-emerald-900"><tr>{canEditStudents && targetSessions.length > 0 && <th className="p-3 text-center w-10 no-print"><div className="flex flex-col items-center gap-1"><SelectAllBulkCheckbox formId="bulk-carry-form" name="studentIds" title={lang==="ur" ? "سب منتخب کریں" : "Select all"} /><span className="text-[10px] font-medium">{lang==="ur" ? "سب" : "All"}</span></div></th>}<th className="p-3 text-center w-14">{lang === "ur" ? "نمبر شمار" : "S.No"}</th><th className="p-3 text-left">{tr.admissionNo}</th><th className="p-3 text-left">{tr.applicationNo}</th><th className="p-3 text-left">{tr.name}</th><th className="p-3 text-left">{tr.fatherMother}</th><th className="p-3 text-left">{tr.class}</th><th className="p-3 text-center">{tr.rollNo}</th><th className="p-3 text-left">{tr.actions}</th></tr></thead>
            <tbody>
              {section.list.map((e, i) => (
                <tr key={e.id} id={`student-row-${e.student.id}`} data-highlight={highlight === e.student.id ? "true" : undefined} className="border-t hover:bg-gray-50/70">
                  {canEditStudents && targetSessions.length > 0 && <td className="p-3 text-center no-print"><input type="checkbox" name="studentIds" value={e.student.id} form="bulk-carry-form" className="h-4 w-4 rounded border-emerald-300 text-emerald-700" /></td>}
                  <td className="p-3 text-center text-gray-600 font-medium">{i + 1}</td>
                  <td className="p-3 font-semibold text-gray-900">{e.student.admissionNo}</td>
                  <td className="p-3">{e.student.applicationNo || "-"}</td>
                  <td className="p-3">{e.student.nameEn} {e.student.nameUr && <span className="font-urdu text-gray-700">/ {e.student.nameUr}</span>}</td>
                  <td className="p-3">{[e.student.fatherName, e.student.motherName].filter(Boolean).join(" / ") || "-"}</td>
                  <td className="p-3">{e.student.admissionClass || "-"}</td>
                  <td className="p-3 text-center">{e.rollNo || "-"}</td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="inline-flex flex-nowrap items-center gap-2">
                      <Link className="inline-flex px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100" href={`/students/${e.student.id}`}>{tr.profile}</Link>
                      {canEditStudents && <Link className="inline-flex px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 font-medium hover:bg-blue-100" href={`/students/${e.student.id}/edit`}>{tr.edit}</Link>}
                      <Link className="inline-flex px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-medium hover:bg-amber-100" href={`/students/${e.student.id}/admission-form`}>{tr.print}</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {section.list.length === 0 && <tr><td colSpan={canEditStudents && targetSessions.length > 0 ? 9 : 8} className="p-6 text-center text-gray-500">{lang==="ur" ? "کوئی طالب علم نہیں" : "No students"}</td></tr>}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
