import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { formatDateDMY } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") redirect("/dashboard");
  const lang = await getLang();
  const ur = lang === "ur";
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const pageSize = 50;
  const q = sp.q?.trim() || "";

  const where: any = {};
  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { actorLabel: { contains: q, mode: "insensitive" } },
      { entityType: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
      { details: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageLogs = page > totalPages && totalPages > 0 ? [] : logs;
  const mkHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/settings/audit?${s}` : "/settings/audit";
  };

  return (
    <div className="space-y-4 theme-settings">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{ur ? "آڈٹ / سرگرمی لاگ" : "Audit / Activity Log"}</h1>
          <p className="text-sm text-slate-200 mt-1">{ur ? "اہم تبدیلیوں اور کارروائیوں کا ریکارڈ" : "Record of key actions and changes"} · {ur ? "کل" : "Total"}: {total}</p>
        </div>
        <Link href="/settings" className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl text-sm font-medium">{ur ? "← سیٹنگز" : "← Settings"}</Link>
      </div>

      <form className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex gap-2 flex-wrap items-end no-print">
        <div>
          <label className="text-xs text-gray-600 block mb-1">{ur ? "تلاش" : "Search"}</label>
          <input name="q" defaultValue={q} placeholder={ur ? "ایکشن / صارف / تفصیل..." : "Action / user / details..."} className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full min-w-0 sm:w-auto sm:min-w-[260px]" />
        </div>
        <button className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">{ur ? "تلاش" : "Search"}</button>
        {q && <Link href="/settings/audit" className="text-sm text-slate-700 underline">{ur ? "صاف کریں" : "Clear"}</Link>}
      </form>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto">
        <table className="w-full text-sm">
          <thead><tr>
            <th className="p-3 text-left">{ur ? "وقت" : "Time"}</th>
            <th className="p-3 text-left">{ur ? "صارف" : "Actor"}</th>
            <th className="p-3 text-left">{ur ? "ایکشن" : "Action"}</th>
            <th className="p-3 text-left">{ur ? "اینٹیٹی" : "Entity"}</th>
            <th className="p-3 text-left">{ur ? "تفصیل" : "Details"}</th>
          </tr></thead>
          <tbody>
            {pageLogs.map(log => (
              <tr key={log.id} className="border-t align-top">
                <td className="p-3 whitespace-nowrap text-gray-700">{formatDateDMY(log.createdAt)} <span className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleTimeString()}</span></td>
                <td className="p-3">{log.actorLabel || log.actorUserId || "-"}</td>
                <td className="p-3"><span className="inline-flex px-2 py-1 rounded-md bg-slate-100 text-slate-800 text-xs font-semibold">{log.action}</span></td>
                <td className="p-3 text-xs text-gray-700">{log.entityType || "-"}{log.entityId ? <div className="text-[11px] text-gray-500 break-all">{log.entityId}</div> : null}</td>
                <td className="p-3 text-xs text-gray-700 max-w-[420px]"><div className="whitespace-pre-wrap break-words">{log.details || "-"}</div></td>
              </tr>
            ))}
            {pageLogs.length === 0 && <tr><td colSpan={5} className="p-5 text-center text-gray-500">{ur ? "کوئی لاگ موجود نہیں۔" : "No audit logs yet."}</td></tr>}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-3 text-sm flex-wrap">
          <div className="text-gray-600">{ur ? `صفحہ ${safePage} از ${totalPages}` : `Page ${safePage} of ${totalPages}`}</div>
          <div className="flex items-center gap-2">
            <Link href={mkHref(Math.max(1, safePage - 1))} aria-disabled={safePage <= 1} className={`px-3 py-1.5 rounded-lg border ${safePage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}>{ur ? "پچھلا" : "Prev"}</Link>
            <Link href={mkHref(Math.min(totalPages, safePage + 1))} aria-disabled={safePage >= totalPages} className={`px-3 py-1.5 rounded-lg border ${safePage >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}>{ur ? "اگلا" : "Next"}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
