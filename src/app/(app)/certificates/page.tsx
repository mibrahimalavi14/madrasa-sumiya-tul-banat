import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { formatDateDMY } from "@/lib/utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

async function createCert(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  const studentId = String(formData.get("studentId"));
  const type = String(formData.get("type")) as "ANNUAL" | "NAZRA_COMPLETION";
  const count = await prisma.certificate.count();
  const serialNo = `MSB-CERT-${String(count+1).padStart(4,'0')}`;
  await prisma.certificate.create({ data: { sessionId: session.id, studentId, type, serialNo, details: String(formData.get("details")||"")||null } });
  revalidatePath("/certificates");
}

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const tr = t[lang];
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const pageSize = 30;

  if (user?.role === "PARENT") {
    if (!user.parentStudentId) return <p>{tr.noLinkedStudent}</p>;
    const certs = await prisma.certificate.findMany({ where: { studentId: user.parentStudentId }, include: { student: true, session: true }, orderBy: { createdAt: "desc" } });
    return <div><h1 className="text-2xl font-bold text-emerald-900 mb-4">{tr.certificates}</h1><CertList certs={certs} lang={lang} tr={tr} /></div>;
  }
  if (!session) return <p>{lang==="ur" ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select active session first."}</p>;

  const where = { sessionId: session.id };
  const [total, enrolls, certs] = await Promise.all([
    prisma.certificate.count({ where }),
    prisma.studentEnrollment.findMany({ where: { sessionId: session.id }, select: { studentId: true, student: { select: { admissionNo: true, nameEn: true } } }, orderBy: { student: { nameEn: "asc" } } }),
    prisma.certificate.findMany({ where, include: { student: true, session: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageCerts = page > totalPages && totalPages > 0 ? [] : certs;
  const mkHref = (p: number) => p > 1 ? `/certificates?page=${p}` : "/certificates";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h1 className="text-2xl font-bold text-emerald-900">{tr.certificates}</h1>
        <div className="text-sm text-gray-600">{lang==="ur" ? `کل: ${total}` : `Total: ${total}`}</div>
      </div>
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-semibold mb-2">{tr.issueCertificate}</h2>
        <p className="text-xs text-gray-500 mb-2">{lang==="ur" ? "سالانہ امتحان پر سالانہ سرٹیفکیٹ اور ناظرہ مکمل ہونے پر ناظرہ تکمیل سرٹیفکیٹ جاری کریں۔" : "Issue annual certificates on annual examination and Nazra completion certificates when completed."}</p>
        <form action={createCert} className="grid md:grid-cols-4 gap-3 items-end">
          <div><label className="text-sm">{tr.student}</label><select name="studentId" className="w-full border rounded px-2 py-2">{enrolls.map(e=><option key={e.studentId} value={e.studentId}>{e.student.admissionNo} - {e.student.nameEn}</option>)}</select></div>
          <div><label className="text-sm">{tr.type}</label><select name="type" className="w-full border rounded px-2 py-2"><option value="ANNUAL">{tr.annual}</option><option value="NAZRA_COMPLETION">{tr.nazraCompletion}</option></select></div>
          <div><label className="text-sm">{tr.detailsOptional}</label><input name="details" className="w-full border rounded px-2 py-2"/></div>
          <div><button className="bg-emerald-800 text-white px-4 py-2 rounded">{tr.issue}</button></div>
        </form>
      </div>
      <CertList certs={pageCerts} lang={lang} tr={tr} />
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 bg-white rounded-xl shadow border border-emerald-100 p-3 text-sm flex-wrap mt-4">
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

function CertList({ certs, lang, tr }: { certs: any[]; lang: "en"|"ur"; tr: any }) {
  return <div className="bg-white rounded-xl shadow overflow-auto"><table className="w-full text-sm"><thead className="bg-emerald-50"><tr><th className="p-2">{tr.serial}</th><th className="p-2">{tr.student}</th><th className="p-2">{tr.type}</th><th className="p-2">{tr.session}</th><th className="p-2">{tr.date}</th><th className="p-2">{tr.action}</th></tr></thead><tbody>{certs.map(c=>(<tr key={c.id} className="border-t"><td className="p-2">{c.serialNo||"-"}</td><td className="p-2">{c.student.admissionNo} - {c.student.nameEn}</td><td className="p-2">{c.type==="ANNUAL"?tr.annual:tr.nazraCompletion}</td><td className="p-2">{c.session.name}</td><td className="p-2">{formatDateDMY(c.issueDate)}</td><td className="p-2"><Link className="text-emerald-700 underline" href={`/certificates/${c.id}/print`}>{tr.print}</Link></td></tr>))}{certs.length===0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">{tr.noCertificates}</td></tr>}</tbody></table></div>;
}
