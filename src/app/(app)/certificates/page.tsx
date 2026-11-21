import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { formatDateDMY } from "@/lib/utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { logAudit } from "@/lib/audit";

async function createCert(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  const studentId = String(formData.get("studentId"));
  const type = String(formData.get("type")) as "ANNUAL" | "NAZRA_COMPLETION";
  const count = await prisma.certificate.count();
  const serialNo = `MSB-CERT-${String(count+1).padStart(4,'0')}`;
  const cert = await prisma.certificate.create({ data: { sessionId: session.id, studentId, type, serialNo, details: String(formData.get("details")||"")||null } });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "CERTIFICATE_ISSUE", entityType: "Certificate", entityId: cert.id, details: JSON.stringify({ studentId, type, serialNo, sessionId: session.id }) });
  revalidatePath("/certificates");
}

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; type?: string }> }) {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const tr = t[lang];
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const pageSize = 30;
  const q = sp.q?.trim() || "";
  const typeFilter = sp.type === "ANNUAL" || sp.type === "NAZRA_COMPLETION" ? sp.type : "";

  if (user?.role === "PARENT") {
    if (!user.parentStudentId) return <p>{tr.noLinkedStudent}</p>;
    const certs = await prisma.certificate.findMany({ where: { studentId: user.parentStudentId }, include: { student: true, session: true }, orderBy: { createdAt: "desc" } });
    return (
      <div className="space-y-4 theme-parent">
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl p-5 shadow-sm">
          <h1 className="text-2xl font-bold">{tr.certificates}</h1>
          <p className="text-sm text-amber-50 mt-1">{lang === "ur" ? "آپ کے بچے کے جاری شدہ سرٹیفکیٹس" : "Issued certificates for your child"}</p>
        </div>
        <CertList certs={certs} lang={lang} tr={tr} />
      </div>
    );
  }
  if (!session) return <p>{lang==="ur" ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select active session first."}</p>;
  const canEditCertificates = user?.role === "ADMIN";

  const where: any = { sessionId: session.id };
  if (typeFilter) where.type = typeFilter;
  if (q) {
    where.OR = [
      { serialNo: { contains: q, mode: "insensitive" } },
      { student: { admissionNo: { contains: q, mode: "insensitive" } } },
      { student: { nameEn: { contains: q, mode: "insensitive" } } },
      { student: { nameUr: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, enrolls, certs] = await Promise.all([
    prisma.certificate.count({ where }),
    prisma.studentEnrollment.findMany({ where: { sessionId: session.id }, select: { studentId: true, student: { select: { admissionNo: true, nameEn: true } } }, orderBy: { student: { nameEn: "asc" } } }),
    prisma.certificate.findMany({ where, include: { student: true, session: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageCerts = page > totalPages && totalPages > 0 ? [] : certs;
  const mkHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (typeFilter) params.set("type", typeFilter);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/certificates?${s}` : "/certificates";
  };
  const exportHref = `/api/export/certificates${q || typeFilter ? `?${new URLSearchParams({ ...(q?{q}:{}), ...(typeFilter?{type:typeFilter}:{}) }).toString()}` : ""}`;

  return (
    <div className="space-y-4 theme-certs">
      <div className="bg-gradient-to-r from-amber-700 to-orange-600 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{tr.certificates}</h1>
          <p className="text-sm text-amber-50 mt-1">{session.name} · {lang==="ur" ? `کل: ${total}` : `Total: ${total}`}</p>
        </div>
        <details className="relative no-print">
          <summary className="list-none cursor-pointer bg-white/15 hover:bg-white/25 border border-white/30 text-white px-4 py-2.5 rounded-xl font-semibold text-sm">{lang==="ur" ? "CSV ایکسپورٹ ▾" : "Export CSV ▾"}</summary>
          <div className="absolute right-0 mt-2 w-64 bg-white text-gray-800 border border-amber-100 rounded-xl shadow-lg p-3 z-20">
            <form action="/api/export/certificates" method="get" className="space-y-2 text-sm">
              {q && <input type="hidden" name="q" value={q} />}
              {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
              <div className="font-semibold text-amber-900">{lang==="ur"?"کالم منتخب کریں":"Select columns"}</div>
              <div className="grid grid-cols-2 gap-1">{[["serialNo","Serial"],["admissionNo","Admission"],["nameEn","Name EN"],["type","Type"],["issueDate","Issue Date"],["session","Session"]].map(([k,l])=><label key={k} className="flex items-center gap-1"><input type="checkbox" name="columns" value={k} defaultChecked /><span>{l}</span></label>)}</div>
              <div className="flex gap-2 pt-1"><button className="bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs">{lang==="ur"?"ایکسپورٹ":"Export"}</button><a href={exportHref} className="px-3 py-1.5 rounded-lg text-xs border">{lang==="ur"?"تمام":"All"}</a></div>
            </form>
          </div>
        </details>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4 space-y-4">
        {canEditCertificates ? (
          <div>
            <h2 className="font-semibold mb-2">{tr.issueCertificate}</h2>
            <p className="text-xs text-gray-500 mb-2">{lang==="ur" ? "سالانہ امتحان پر سالانہ سرٹیفکیٹ اور ناظرہ مکمل ہونے پر ناظرہ تکمیل سرٹیفکیٹ جاری کریں۔" : "Issue annual certificates on annual examination and Nazra completion certificates when completed."}</p>
            <form action={createCert} className="grid md:grid-cols-4 gap-3 items-end">
              <div><label className="text-sm">{tr.student}</label><select name="studentId" className="w-full border rounded-lg px-3 py-2.5">{enrolls.map(e=><option key={e.studentId} value={e.studentId}>{e.student.admissionNo} - {e.student.nameEn}</option>)}</select></div>
              <div><label className="text-sm">{tr.type}</label><select name="type" className="w-full border rounded-lg px-3 py-2.5"><option value="ANNUAL">{tr.annual}</option><option value="NAZRA_COMPLETION">{tr.nazraCompletion}</option></select></div>
              <div><label className="text-sm">{tr.detailsOptional}</label><input name="details" className="w-full border rounded-lg px-3 py-2.5"/></div>
              <div><button className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2.5 rounded-lg font-medium">{tr.issue}</button></div>
            </form>
          </div>
        ) : (
          <div className="text-sm text-blue-900 bg-blue-50 border border-blue-200 rounded-lg p-3">{lang==="ur" ? "سرٹیفکیٹ جاری کرنے کی اجازت صرف ایڈمن کو ہے۔ آپ سرٹیفکیٹس دیکھ/تلاش/پرنٹ/ایکسپورٹ کر سکتے ہیں۔" : "Issuing certificates is Admin-only. You can view, search, print, and export certificates."}</div>
        )}

        <form className={`flex gap-2 flex-wrap items-end ${canEditCertificates ? "border-t border-amber-100 pt-4" : ""} no-print`}>
          <div><label className="text-xs text-gray-600 block mb-1">{lang==="ur" ? "تلاش" : "Search"}</label><input name="q" defaultValue={q} placeholder={lang==="ur" ? "سیریل / داخلہ نمبر / نام" : "Serial / Admission / Name"} className="border border-amber-200 rounded-lg px-3 py-2 text-sm min-w-[220px]" /></div>
          <div><label className="text-xs text-gray-600 block mb-1">{tr.type}</label><select name="type" defaultValue={typeFilter} className="border border-amber-200 rounded-lg px-3 py-2 text-sm"><option value="">{lang==="ur" ? "تمام" : "All"}</option><option value="ANNUAL">{tr.annual}</option><option value="NAZRA_COMPLETION">{tr.nazraCompletion}</option></select></div>
          <button className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm">{tr.search}</button>
          {(q || typeFilter) && <Link href="/certificates" className="text-sm text-amber-800 underline">{lang==="ur" ? "صاف کریں" : "Clear"}</Link>}
        </form>
      </div>

      <CertList certs={pageCerts} lang={lang} tr={tr} />
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 bg-white rounded-xl shadow-sm border border-amber-100 p-3 text-sm flex-wrap">
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
  return <div className="bg-white rounded-2xl shadow-sm border border-amber-100/70 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">{tr.serial}</th><th className="p-3 text-left">{tr.student}</th><th className="p-3 text-center">{tr.type}</th><th className="p-3 text-center">{tr.session}</th><th className="p-3 text-center">{tr.date}</th><th className="p-3 text-center">{tr.action}</th></tr></thead><tbody>{certs.map(c=>(<tr key={c.id} className="border-t"><td className="p-3 font-medium">{c.serialNo||"-"}</td><td className="p-3">{c.student.admissionNo} - {c.student.nameEn}</td><td className="p-3 text-center"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${c.type==="ANNUAL"?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{c.type==="ANNUAL"?tr.annual:tr.nazraCompletion}</span></td><td className="p-3 text-center">{c.session.name}</td><td className="p-3 text-center">{formatDateDMY(c.issueDate)}</td><td className="p-3 text-center"><Link className="inline-flex px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-medium hover:bg-amber-100" href={`/certificates/${c.id}/print`}>{tr.print}</Link></td></tr>))}{certs.length===0 && <tr><td colSpan={6} className="p-5 text-center text-gray-500">{tr.noCertificates}</td></tr>}</tbody></table></div>;
}
