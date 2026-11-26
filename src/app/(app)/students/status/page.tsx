import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getLang } from "@/lib/lang";

const STATUS_META: Record<string, { en: string; ur: string; badge: string }> = {
  ACTIVE: { en: "Active Students", ur: "فعال طلبہ", badge: "bg-emerald-100 text-emerald-800" },
  REGISTERED: { en: "Registered Students", ur: "رجسٹرڈ طلبہ", badge: "bg-blue-100 text-blue-800" },
  LEFT: { en: "Left Students", ur: "چھوڑنے والے طلبہ", badge: "bg-red-100 text-red-800" },
};

export default async function StudentsByStatusPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await getAuthUser();
  if (user?.role === "PARENT") redirect("/students");
  const session = await getCurrentSession();
  const lang = await getLang();
  const sp = await searchParams;
  const status = String(sp.status || "ACTIVE").toUpperCase();
  const safeStatus = STATUS_META[status] ? status : "ACTIVE";
  const meta = STATUS_META[safeStatus];
  const q = sp.q?.trim() || "";

  if (!session) return <div className="text-amber-800">{lang === "ur" ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select an active session first."}</div>;

  const where: any = { sessionId: session.id, student: { status: safeStatus } };
  if (q) {
    where.AND = [{
      student: {
        status: safeStatus,
        OR: [
          { admissionNo: { contains: q, mode: "insensitive" } },
          { applicationNo: { contains: q, mode: "insensitive" } },
          { nameEn: { contains: q, mode: "insensitive" } },
          { nameUr: { contains: q, mode: "insensitive" } },
          { fatherName: { contains: q, mode: "insensitive" } },
          { admissionClass: { contains: q, mode: "insensitive" } },
        ],
      },
    }];
    delete where.student;
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where,
    select: {
      id: true, rollNo: true,
      student: { select: { id: true, admissionNo: true, applicationNo: true, nameEn: true, nameUr: true, fatherName: true, motherName: true, admissionClass: true } },
    },
    orderBy: [{ student: { admissionNo: "asc" } }],
  });

  const title = lang === "ur" ? meta.ur : meta.en;

  return (
    <div className="space-y-4 theme-students">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-emerald-50 mt-1">{lang === "ur" ? "سیشن" : "Session"}: {session.name} · {lang === "ur" ? "کل" : "Total"}: {enrollments.length}</p>
        </div>
        <div className="flex gap-2 flex-wrap no-print">
          {(["ACTIVE","REGISTERED","LEFT"] as const).map(s => (
            <Link key={s} href={`/students/status?status=${s}`} className={`px-3 py-2 rounded-lg text-sm font-semibold border ${s===safeStatus ? "bg-white text-emerald-800 border-white" : "bg-emerald-900/30 text-white border-emerald-200/30 hover:bg-emerald-900/50"}`}>
              {lang === "ur" ? STATUS_META[s].ur : STATUS_META[s].en}
            </Link>
          ))}
        </div>
      </div>

      <form className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 no-print">
        <input type="hidden" name="status" value={safeStatus} />
        <label className="block text-base font-bold text-emerald-900 mb-2">{lang==="ur" ? "تلاش" : "Search"}</label>
        <div className="flex gap-2 flex-wrap items-center">
          <input name="q" defaultValue={q} placeholder={lang==="ur" ? "داخلہ نمبر / نام تلاش کریں" : "Search by Admission No / Name"} className="border border-gray-200 rounded-xl px-4 py-2.5 w-full sm:flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          <button className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium">{lang==="ur" ? "تلاش" : "Search"}</button>
          {q && <Link href={`/students/status?status=${safeStatus}`} className="text-sm text-emerald-700 underline">{lang==="ur" ? "صاف کریں" : "Clear"}</Link>}
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-auto">
        <div className="px-4 py-3 border-b border-emerald-100 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-emerald-900">{title}</h2>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${meta.badge}`}>{enrollments.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-emerald-50 text-emerald-900"><tr><th className="p-3 text-center w-14">{lang === "ur" ? "نمبر شمار" : "S.No"}</th><th className="p-3 text-left">{lang==="ur"?"داخلہ نمبر":"Admission No"}</th><th className="p-3 text-left">{lang==="ur"?"درخواست نمبر":"Application No"}</th><th className="p-3 text-left">{lang==="ur"?"نام":"Name"}</th><th className="p-3 text-left">{lang==="ur"?"والد/والدہ":"Father/Mother"}</th><th className="p-3 text-left">{lang==="ur"?"کلاس":"Class"}</th><th className="p-3 text-center">{lang==="ur"?"رول نمبر":"Roll No"}</th><th className="p-3 text-left">{lang==="ur"?"عمل":"Actions"}</th></tr></thead>
          <tbody>
            {enrollments.map((e, i) => (
              <tr key={e.id} className="border-t hover:bg-gray-50/70">
                <td className="p-3 text-center text-gray-600 font-medium">{i + 1}</td>
                <td className="p-3 font-semibold text-gray-900">{e.student.admissionNo}</td>
                <td className="p-3">{e.student.applicationNo || "-"}</td>
                <td className="p-3">{e.student.nameEn} {e.student.nameUr && <span className="font-urdu text-gray-700">/ {e.student.nameUr}</span>}</td>
                <td className="p-3">{[e.student.fatherName, e.student.motherName].filter(Boolean).join(" / ") || "-"}</td>
                <td className="p-3">{e.student.admissionClass || "-"}</td>
                <td className="p-3 text-center">{e.rollNo || "-"}</td>
                <td className="p-3 whitespace-nowrap"><Link className="inline-flex px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100" href={`/students/${e.student.id}`}>{lang==="ur"?"پروفائل":"Profile"}</Link></td>
              </tr>
            ))}
            {enrollments.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-gray-500">{lang==="ur" ? "کوئی طالب علم نہیں" : "No students"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
