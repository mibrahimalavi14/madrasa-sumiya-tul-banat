import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import Logo from "@/components/Logo";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  const tr = t[lang];
  const sp = await searchParams;

  if (user?.role === "PARENT") {
    const student = user.parentStudentId ? await prisma.student.findUnique({
      where: { id: user.parentStudentId },
      select: {
        nameEn: true, nameUr: true, admissionNo: true, registrationNo: true,
        results: { take: 5, orderBy: { createdAt: "desc" }, select: { id: true, percentage: true, grade: true, status: true, position: true } },
        feePayments: { take: 6, orderBy: { createdAt: "desc" }, select: { id: true, month: true, year: true, amount: true, paidAmount: true, isPaid: true, isLate: true } },
      }
    }) : null;
    return (
      <div className="space-y-5 theme-parent">
        <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-cyan-700 text-white rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{tr.parentDashboard}</h1>
          <p className="text-sm text-teal-50 mt-1">{ur ? "Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¯Ã›Å’Ã™â€  Ã™Â¾Ã™Ë†Ã˜Â±Ã™Â¹Ã™â€ž Ã¢â‚¬â€ Ã˜Â§Ã™Â¾Ã™â€ Ã›â€™ Ã˜Â¨Ãšâ€ Ã›â€™ ÃšÂ©Ã˜Â§ Ã˜ÂªÃ˜Â¹Ã™â€žÃ›Å’Ã™â€¦Ã›Å’ Ã™Ë† Ã™â€¦Ã˜Â§Ã™â€žÃ›Å’ Ã˜Â±Ã›Å’ÃšÂ©Ã˜Â§Ã˜Â±ÃšË† Ã˜Â¯Ã›Å’ÃšÂ©ÃšÂ¾Ã›Å’ÃšÂº" : "Parent portal Ã¢â‚¬â€ view your childÃ¢â‚¬â„¢s academic and fee records"}</p>
        </div>
        {!student ? <div className="bg-white rounded-2xl border border-amber-200 p-5 text-amber-900">{tr.noLinkedStudent}</div> : (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-5">
              <h2 className="font-semibold mb-3 text-teal-900">{tr.student}</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3 border-b border-gray-100 pb-2"><span className="text-gray-500">{ur ? "Ã™â€ Ã˜Â§Ã™â€¦" : "Name"}</span><span className="font-semibold text-gray-900">{student.nameEn} {student.nameUr && <span className="font-urdu">({student.nameUr})</span>}</span></div>
                <div className="flex justify-between gap-3 border-b border-gray-100 pb-2"><span className="text-gray-500">{tr.admissionNo}</span><span className="font-semibold">{student.admissionNo}</span></div>
                <div className="flex justify-between gap-3"><span className="text-gray-500">Reg</span><span className="font-semibold">{student.registrationNo || "-"}</span></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/students" className="text-sm bg-teal-700 hover:bg-teal-800 text-white px-3 py-2 rounded-lg">{ur ? "Ã™â€¦ÃšÂ©Ã™â€¦Ã™â€ž Ã™Â¾Ã˜Â±Ã™Ë†Ã™ÂÃ˜Â§Ã˜Â¦Ã™â€ž" : "Full Profile"}</Link>
                <Link href="/fees" className="text-sm border border-teal-200 text-teal-800 px-3 py-2 rounded-lg hover:bg-teal-50">{ur ? "Ã™ÂÃ›Å’Ã˜Â³ Ã˜ÂªÃ™ÂÃ˜ÂµÃ›Å’Ã™â€ž" : "Fees"}</Link>
                <Link href="/results" className="text-sm border border-teal-200 text-teal-800 px-3 py-2 rounded-lg hover:bg-teal-50">{ur ? "Ã™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬" : "Results"}</Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-5">
              <h2 className="font-semibold mb-3 text-teal-900">{tr.recentFees}</h2>
              {student.feePayments.length===0?<p className="text-sm text-gray-500">{tr.noRecords}</p>:<div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">{tr.month}/{tr.year}</th><th className="p-2 text-center">{ur ? "Ã˜Â§Ã˜Â¯Ã˜Â§/Ã™Ë†Ã˜Â§Ã˜Â¬Ã˜Â¨" : "Paid/Due"}</th><th className="p-2 text-center">{tr.status}</th></tr></thead><tbody>{student.feePayments.map((f: any)=>{ const paidAmt = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? Number(f.amount||0) : 0); const dueAmt = Number(f.amount||0); const full = f.isPaid || (dueAmt>0 && paidAmt>=dueAmt); const partial = paidAmt>0 && paidAmt<dueAmt; const label = full ? (f.isLate?tr.late:tr.paid) : (partial ? (lang === "ur" ? "Ã˜Â¬Ã˜Â²Ã™Ë†Ã›Å’" : "Partial") : tr.unpaid); return (<tr key={f.id} className="border-t"><td className="p-2">{f.month}/{f.year}</td><td className="p-2 text-center">Rs {paidAmt}/{dueAmt}</td><td className="p-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${full ? (f.isLate?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800") : (partial?"bg-amber-100 text-amber-800":"bg-red-100 text-red-800")}`}>{label}</span></td></tr>); })}</tbody></table></div>}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-5 md:col-span-2">
              <h2 className="font-semibold mb-3 text-teal-900">{tr.recentResults}</h2>
              {student.results.length===0?<p className="text-sm text-gray-500">{tr.noResults}</p>:<div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-center">%</th><th className="p-2 text-center">{ur ? "ÃšÂ¯Ã˜Â±Ã›Å’ÃšË†" : "Grade"}</th><th className="p-2 text-center">{ur ? "Ã˜Â­Ã›Å’Ã˜Â«Ã›Å’Ã˜Âª" : "Status"}</th><th className="p-2 text-center">{ur ? "Ã™Â¾Ã™Ë†Ã˜Â²Ã›Å’Ã˜Â´Ã™â€ " : "Position"}</th></tr></thead><tbody>{student.results.map(r=>(<tr key={r.id} className="border-t"><td className="p-2 text-center font-medium">{r.percentage?.toFixed(1)}%</td><td className="p-2 text-center font-semibold">{r.grade}</td><td className={`p-2 text-center ${r.status==="Pass"?"text-emerald-700":"text-red-700"}`}>{r.status}</td><td className="p-2 text-center">{r.position??"-"}</td></tr>))}</tbody></table></div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  const now = new Date();
  const actualM = now.getMonth() + 1;
  const actualY = now.getFullYear();
  const reqM = Number(sp.month);
  const reqY = Number(sp.year);
  let m = Number.isFinite(reqM) && reqM >= 1 && reqM <= 12 ? reqM : actualM;
  let y = Number.isFinite(reqY) && reqY >= 2000 && reqY <= 2100 ? reqY : actualY;

  let students = 0, activeStudents = 0, examsCount = 0, examsConducted = 0, feeGroups: any[] = [], resultsCount = 0, certsCount = 0;
  let recentEnrolls: any[] = [], recentExams: any[] = [], recentResults: any[] = [];
  let monthAgg: any = { _count: { _all: 0 } }, monthPaidAgg: any = { _count: { _all: 0 }, _sum: { amount: 0 } };
  let monthFeeRows: any[] = [];
  let enrollmentsForSummary: any[] = [];
  let recentAudit: any[] = [];
  let certsByType: any[] = [];
  let recentCerts: any[] = [];
  let monthFeeTrendRows: any[] = [];
  let trendMonths: Array<{ month: number; year: number; label: string }> = [];

  if (session) {
    const sStart = session.startDate ? new Date(session.startDate) : null;
    const sEnd = session.endDate ? new Date(session.endDate) : null;
    if (sStart && sEnd) {
      const startIdx = sStart.getFullYear() * 12 + sStart.getMonth();
      const endIdx = sEnd.getFullYear() * 12 + sEnd.getMonth();
      const nowIdx = y * 12 + (m - 1);
      if (nowIdx < startIdx) { y = sStart.getFullYear(); m = sStart.getMonth() + 1; }
      else if (nowIdx > endIdx) { y = sEnd.getFullYear(); m = sEnd.getMonth() + 1; }
    }

    const sid = session.id;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const shownIdx2 = y * 12 + (m - 1);
    if (sStart && sEnd) {
      const startIdx = sStart.getFullYear() * 12 + sStart.getMonth();
      const endIdx = sEnd.getFullYear() * 12 + sEnd.getMonth();
      for (let idx = startIdx; idx <= endIdx; idx++) {
        const tm = (idx % 12 + 12) % 12 + 1;
        const ty = Math.floor((idx - (tm - 1)) / 12);
        trendMonths.push({ month: tm, year: ty, label: `${tm}/${String(ty).slice(-2)}` });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const idx = shownIdx2 - i;
        const tm = (idx % 12 + 12) % 12 + 1;
        const ty = Math.floor((idx - (tm - 1)) / 12);
        trendMonths.push({ month: tm, year: ty, label: `${tm}/${String(ty).slice(-2)}` });
      }
    }
    const trendOr = trendMonths.map(t => ({ month: t.month, year: t.year }));

    [students, activeStudents, examsCount, examsConducted, resultsCount, certsCount] = await Promise.all([
      prisma.studentEnrollment.count({ where: { sessionId: sid } }),
      prisma.studentEnrollment.count({ where: { sessionId: sid, student: { status: "ACTIVE" } } }),
      prisma.exam.count({ where: { sessionId: sid } }),
      prisma.exam.count({ where: { sessionId: sid, results: { some: {} } } }),
      prisma.result.count({ where: { exam: { sessionId: sid } } }),
      prisma.certificate.count({ where: { sessionId: sid } }),
    ]);

    [monthFeeRows, feeGroups, monthAgg, recentEnrolls, recentExams, recentResults, enrollmentsForSummary, recentAudit, certsByType, recentCerts, monthFeeTrendRows] = await Promise.all([
      prisma.feePayment.findMany({ where: { sessionId: sid, month: m, year: y }, select: { studentId: true, amount: true, paidAmount: true, isPaid: true, isLate: true, updatedAt: true } }),
      prisma.feePayment.groupBy({ by: ["isPaid", "isLate"], where: { sessionId: sid }, _count: { _all: true } }),
      prisma.feePayment.aggregate({ where: { sessionId: sid, month: m, year: y }, _count: { _all: true } }),
      prisma.studentEnrollment.findMany({
        where: { sessionId: sid },
        select: { id: true, rollNo: true, student: { select: { id: true, admissionNo: true, nameEn: true, admissionClass: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.exam.findMany({
        where: { sessionId: sid },
        orderBy: [{ stage: "asc" }, { createdAt: "asc" }] as any,
        select: { id: true, name: true, stage: true, examDate: true, createdAt: true, _count: { select: { students: true, results: true, papers: true } } },
      }),
      prisma.result.findMany({
        where: { exam: { sessionId: sid } },
        select: { id: true, percentage: true, grade: true, status: true, student: { select: { admissionNo: true, nameEn: true } }, exam: { select: { name: true, stage: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.studentEnrollment.findMany({
        where: { sessionId: sid },
        select: { rollNo: true, student: { select: { id: true, status: true, admissionClass: true, fatherName: true, phone: true, nameEn: true, admissionNo: true } } },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, action: true, actorLabel: true, entityType: true, details: true, createdAt: true },
      }),
      prisma.certificate.groupBy({ by: ["type"], where: { sessionId: sid }, _count: { _all: true } }),
      prisma.certificate.findMany({
        where: { sessionId: sid },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, type: true, serialNo: true, issueDate: true, student: { select: { admissionNo: true, nameEn: true } } },
      }),
      prisma.feePayment.findMany({ where: { sessionId: sid, OR: trendOr }, select: { month: true, year: true, amount: true, paidAmount: true, isPaid: true } }),
    ]);

    monthPaidAgg = {
      _count: { _all: monthFeeRows.filter((f: any) => !!f.isPaid || (Number(f.amount||0)>0 && Number(f.paidAmount??0)>=Number(f.amount||0))).length },
      _sum: { amount: monthFeeRows.reduce((s: number, f: any) => s + (Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? Number(f.amount || 0) : 0)), 0) },
    } as any;
    // today's collection and trend kept in scope below via variables computed after this block? We'll compute outside from monthFeeRows/monthFeeTrendRows
    void todayStart; void tomorrowStart; void trendMonths;
  }

  const feesPaid = (feeGroups as any[]).filter(g => g.isPaid && !g.isLate).reduce((s, g) => s + g._count._all, 0);
  const feesUnpaid = (feeGroups as any[]).filter(g => !g.isPaid).reduce((s, g) => s + g._count._all, 0);
  const lateFees = (feeGroups as any[]).filter(g => g.isPaid && g.isLate).reduce((s, g) => s + g._count._all, 0);
  const monthPaid = (monthPaidAgg as any)._count._all;
  const monthTotal = (monthAgg as any)._count._all;
  const monthCollected = (monthPaidAgg as any)._sum.amount || 0;
  const monthDueTotal = monthFeeRows.reduce((s: number, f: any) => s + Number(f.amount || 0), 0);
  const monthPendingAmount = Math.max(0, monthDueTotal - monthCollected);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const todayCollection = monthFeeRows.reduce((s: number, f: any) => {
    const paid = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? Number(f.amount || 0) : 0);
    const u = f.updatedAt ? new Date(f.updatedAt) : null;
    return s + (paid > 0 && u && u >= todayStart && u < tomorrowStart ? paid : 0);
  }, 0);
  const monthPartialCount = monthFeeRows.filter((f: any) => {
    const due = Number(f.amount || 0); const paid = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? due : 0);
    return paid > 0 && paid < due;
  }).length;
  const monthPendingCount = monthFeeRows.filter((f: any) => {
    const due = Number(f.amount || 0); const paid = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? due : 0);
    return !(paid >= due && due > 0) && paid <= 0;
  }).length;
  const pendingExams = Math.max(0, examsCount - examsConducted);

  const actualIdx = actualY * 12 + (actualM - 1);
  const shownIdx = y * 12 + (m - 1);
  const feesMonthLabel = shownIdx === actualIdx
    ? (ur ? "Ã˜Â§Ã˜Â³ Ã™â€¦Ã˜Â§Ã›Â ÃšÂ©Ã›Å’ Ã™ÂÃ›Å’Ã˜Â³" : "This Month Fees")
    : shownIdx < actualIdx
      ? (ur ? "Ã™Â¾Ãšâ€ ÃšÂ¾Ã™â€žÃ›â€™ Ã™â€¦Ã›ÂÃ›Å’Ã™â€ Ã›â€™ ÃšÂ©Ã›Å’ Ã™ÂÃ›Å’Ã˜Â³" : "Last Month Fees")
      : (ur ? "Ã˜Â§ÃšÂ¯Ã™â€žÃ›â€™ Ã™â€¦Ã›ÂÃ›Å’Ã™â€ Ã›â€™ ÃšÂ©Ã›Å’ Ã™ÂÃ›Å’Ã˜Â³" : "Next Month Fees");

  const sessionStart = session?.startDate ? new Date(session.startDate) : null;
  const sessionEnd = session?.endDate ? new Date(session.endDate) : null;
  const nowMs = Date.now();
  const daysToSessionEnd = sessionEnd ? Math.ceil((sessionEnd.getTime() - nowMs) / (1000 * 60 * 60 * 24)) : null;
  const sessionTotalDays = sessionStart && sessionEnd ? Math.max(1, Math.ceil((sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60 * 24))) : null;
  const sessionHasStarted = sessionStart ? nowMs >= sessionStart.getTime() : true;
  const sessionHasEnded = sessionEnd ? nowMs > sessionEnd.getTime() : false;
  const sessionDaysPassed = sessionStart
    ? (!sessionHasStarted ? 0 : Math.min(sessionTotalDays ?? 0, Math.max(0, Math.ceil((nowMs - sessionStart.getTime()) / (1000 * 60 * 60 * 24)))))
    : null;
  const sessionDaysRemaining = sessionEnd
    ? (!sessionHasStarted ? (sessionTotalDays ?? Math.max(0, Math.ceil((sessionEnd.getTime() - (sessionStart?.getTime() ?? nowMs)) / (1000 * 60 * 60 * 24)))) : Math.max(0, Math.ceil((sessionEnd.getTime() - nowMs) / (1000 * 60 * 60 * 24))))
    : null;
  const sessionProgressPct = !sessionHasStarted ? 0 : (sessionTotalDays && sessionDaysPassed != null ? Math.min(100, Math.round((sessionDaysPassed / sessionTotalDays) * 100)) : 0);
  const sessionEndingSoon = sessionHasStarted && !sessionHasEnded && daysToSessionEnd != null && daysToSessionEnd >= 0 && daysToSessionEnd <= 30;

  const statusCounts = { ACTIVE: 0, LEFT: 0, REGISTERED: 0, OTHER: 0 } as Record<string, number>;
  const classCounts = new Map<string, number>();
  for (const e of enrollmentsForSummary) {
    const st = String(e.student?.status || "OTHER").toUpperCase();
    if (st in statusCounts) statusCounts[st] += 1; else statusCounts.OTHER += 1;
    const cls = String(e.student?.admissionClass || (ur ? "Ã˜ÂºÃ›Å’Ã˜Â± Ã™â€¦Ã˜ÂªÃ˜Â¹Ã›Å’Ã™â€ " : "Unassigned")).trim() || (ur ? "Ã˜ÂºÃ›Å’Ã˜Â± Ã™â€¦Ã˜ÂªÃ˜Â¹Ã›Å’Ã™â€ " : "Unassigned");
    classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
  }
  const classSummary = [...classCounts.entries()].map(([name, count]) => ({ name, count })).sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name)).slice(0, 8);

  const examNameUr: Record<number, string> = { 1: "Ã˜Â§Ã˜Â¨Ã˜ÂªÃ˜Â¯Ã˜Â§Ã˜Â¦Ã›Å’ Ã˜ÂªÃ˜Â­Ã˜Â±Ã›Å’Ã˜Â±Ã›Å’ Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ ", 2: "Ã˜Â´Ã˜Â´Ã™â€¦Ã˜Â§Ã›ÂÃ›Å’ Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ ", 3: "Ã˜Â³Ã›Â Ã™â€¦Ã˜Â§Ã›ÂÃ›Å’ Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ ", 4: "Ã˜Â³Ã˜Â§Ã™â€žÃ˜Â§Ã™â€ Ã›Â Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ " };
  const examDisplayName = (ex: any) => (ur && ex?.stage && examNameUr[Number(ex.stage)]) || ex?.name || "-";
  const examTracker = [...recentExams].sort((a:any,b:any)=>((a.stage??99)-(b.stage??99))).map((ex: any) => {
    const selected = ex._count?.students ?? 0;
    const saved = ex._count?.results ?? 0;
    const pending = saved <= 0;
    return { ...ex, selected, saved, pending };
  });

  const certTypeMap = new Map((certsByType as any[]).map((c: any) => [String(c.type), c._count?._all ?? 0]));
  const certAnnual = certTypeMap.get("ANNUAL") || 0;
  const certNazra = certTypeMap.get("NAZRA_COMPLETION") || 0;

  const missingRollStudents = enrollmentsForSummary.filter((e: any) => !e.rollNo).map((e: any) => e.student);
  const missingInfoStudents = enrollmentsForSummary.filter((e: any) => !e.student?.fatherName || !e.student?.admissionClass).map((e: any) => e.student);
  const pendingFeeStudentIds = new Set(monthFeeRows.filter((f: any) => {
    const due = Number(f.amount || 0); const paid = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? due : 0);
    return due > 0 && paid < due;
  }).map((f: any) => f.studentId));


  const cards = [
    [tr.activeSession, session ? session.name : tr.none, ur ? "Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯Ã›Â Ã˜ÂªÃ˜Â¹Ã™â€žÃ›Å’Ã™â€¦Ã›Å’ Ã˜Â³Ã˜Â§Ã™â€ž" : "Current academic year"],
    [tr.enrolledStudents, String(students), ur ? "Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯Ã›Â Ã˜Â³Ã›Å’Ã˜Â´Ã™â€  Ã™â€¦Ã›Å’ÃšÂº" : "In current session"],
    [ur ? "Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€ž Ã˜Â·Ã™â€žÃ˜Â¨Ã›Â" : "Active Students", String(activeStudents), ur ? "Ã˜Â¬Ã™â€  ÃšÂ©Ã˜Â§ Ã˜Â§Ã˜Â³Ã™Â¹Ã›Å’Ã™Â¹Ã˜Â³ Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€ž Ã›ÂÃ›â€™" : "Students with ACTIVE status"],
    [ur ? "Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ Ã›Å’ Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â­Ã™â€ž (Ã˜Â´Ã›Å’ÃšË†Ã™Ë†Ã™â€ž)" : "Exam Stages (Schedule)", String(examsCount), ur ? "Ã˜Â³Ã›Å’Ã˜Â´Ã™â€  ÃšÂ©Ã›â€™ Ã˜Â´Ã›Å’ÃšË†Ã™Ë†Ã™â€ž Ã˜Â´Ã˜Â¯Ã›Â/Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â­Ã™â€ž" : "Scheduled/existing stages in session"],
    [ur ? "Ã™â€žÃ›Å’Ã›â€™ ÃšÂ¯Ã˜Â¦Ã›â€™ Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª" : "Exams Conducted", String(examsConducted), ur ? "Ã˜Â¬Ã™â€  ÃšÂ©Ã›â€™ Ã™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬ Ã™â€¦Ã˜Â­Ã™ÂÃ™Ë†Ã˜Â¸ Ã›ÂÃ›Å’ÃšÂº" : "Exams with saved results"],
    [ur ? "Ã˜Â²Ã›Å’Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª" : "Pending Exams", String(pendingExams), ur ? "Ã˜Â¬Ã™â€  ÃšÂ©Ã›â€™ Ã™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬ Ã˜Â§Ã˜Â¨ÃšÂ¾Ã›Å’ Ã™â€¦Ã˜Â­Ã™ÂÃ™Ë†Ã˜Â¸ Ã™â€ Ã›ÂÃ›Å’ÃšÂº" : "Stages with no saved results yet"],
    [ur ? "Ã™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬ (Ã™â€¦Ã˜Â­Ã™ÂÃ™Ë†Ã˜Â¸)" : "Results (Saved)", String(resultsCount), ur ? "Ã™â€¦Ã˜Â­Ã™ÂÃ™Ë†Ã˜Â¸ Ã˜Â´Ã˜Â¯Ã›Â Ã™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬" : "Saved result entries"],
    [tr.certificates, String(certsCount), ur ? "Ã˜Â¬Ã˜Â§Ã˜Â±Ã›Å’ Ã˜Â´Ã˜Â¯Ã›Â Ã˜Â³Ã˜Â±Ã™Â¹Ã›Å’Ã™ÂÃšÂ©Ã›Å’Ã™Â¹Ã˜Â³" : "Issued certificates"],
    [tr.feesPaid, String(feesPaid), ur ? "Ã™Ë†Ã™â€šÃ˜Âª Ã™Â¾Ã˜Â± Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Â¦Ã›Å’ÃšÂ¯Ã›Å’Ã˜Â§ÃšÂº" : "On time payments"],
    [tr.feesUnpaid, String(feesUnpaid), ur ? "Ã˜Â¨Ã˜Â§Ã™â€šÃ›Å’ Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Â¦Ã›Å’ÃšÂ¯Ã›Å’Ã˜Â§ÃšÂº" : "Pending"],
    [tr.latePayments, String(lateFees), ur ? "7 Ã˜ÂªÃ˜Â§Ã˜Â±Ã›Å’Ã˜Â® ÃšÂ©Ã›â€™ Ã˜Â¨Ã˜Â¹Ã˜Â¯ Ã˜Â§Ã˜Â¯Ã˜Â§ Ã˜Â´Ã˜Â¯Ã›Â" : "Paid after 7th"],
  ];

  const latestExam = [...(recentExams as any[])].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const fmtRs = (n: number) => `Rs ${Number(n || 0).toLocaleString()}`;
  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-GB") : "-";

  return (
    <div className="space-y-6 theme-dashboard">
      {(sessionEndingSoon || pendingExams > 0 || (monthTotal - monthPaid) > 0) && (
        <div className="grid md:grid-cols-3 gap-3 no-print">
          {sessionEndingSoon && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 text-sm"><b>{ur ? "Ã˜ÂªÃ™â€ Ã˜Â¨Ã›Å’Ã›Â:" : "Alert:"}</b> {ur ? `Ã˜Â³Ã›Å’Ã˜Â´Ã™â€  ${daysToSessionEnd} Ã˜Â¯Ã™â€  Ã™â€¦Ã›Å’ÃšÂº Ã˜Â®Ã˜ÂªÃ™â€¦ Ã›ÂÃ™Ë† Ã˜Â±Ã›ÂÃ˜Â§ Ã›ÂÃ›â€™Ã›â€` : `Session ends in ${daysToSessionEnd} day(s).`}</div>
          )}
          {pendingExams > 0 && (
            <div className="bg-blue-50 border border-blue-300 text-blue-900 rounded-xl p-4 text-sm"><b>{ur ? "Ã›Å’Ã˜Â§Ã˜Â¯Ã˜Â¯Ã›ÂÃ˜Â§Ã™â€ Ã›Å’:" : "Reminder:"}</b> {ur ? `${pendingExams} Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ Ã›Å’ Ã™â€¦Ã˜Â±Ã˜Â­Ã™â€žÃ›Â/Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â­Ã™â€ž ÃšÂ©Ã›â€™ Ã™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬ Ã˜Â¨Ã˜Â§Ã™â€šÃ›Å’ Ã›ÂÃ›Å’ÃšÂºÃ›â€` : `${pendingExams} exam stage(s) have pending results.`}</div>
          )}
          {(monthTotal - monthPaid) > 0 && (
            <div className="bg-red-50 border border-red-300 text-red-900 rounded-xl p-4 text-sm"><b>{ur ? "Ã™ÂÃ›Å’Ã˜Â³:" : "Fees:"}</b> {ur ? `${monthTotal - monthPaid} Ã˜Â·Ã™â€žÃ˜Â¨Ã›Â ÃšÂ©Ã›Å’ Ã˜Â§Ã˜Â³ Ã™â€¦Ã›ÂÃ›Å’Ã™â€ Ã›â€™ ÃšÂ©Ã›Å’ Ã™ÂÃ›Å’Ã˜Â³ Ã˜Â¨Ã˜Â§Ã™â€šÃ›Å’ Ã›ÂÃ›â€™Ã›â€` : `${monthTotal - monthPaid} student(s) have pending fees for this month.`}</div>
          )}
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-amber-700 text-white p-6 md:p-8 shadow-xl">
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_40%)]" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0 hidden sm:block bg-white/10 rounded-2xl p-2"><Logo size={64} /></div>
            <div>
              <p className="text-emerald-100 text-sm">{tr.welcomeTo}</p>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Madrasa Sumiya-tul-Banat <span className="font-urdu text-amber-200">Ã™â€¦Ã˜Â¯Ã˜Â±Ã˜Â³Ã›Â Ã˜Â³Ã™â€¦Ã›Å’Ã™â€˜Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€ Ã˜Â§Ã˜Âª</span></h1>
              <p className="text-emerald-100 mt-2 text-sm md:text-base">{tr.adminOverview}</p>
              {session && <div className="mt-3 inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-sm">{tr.activeSession}: <b>{session.name}</b> ({session.status})</div>}
            </div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-4 min-w-[240px]">
            <div className="text-xs text-emerald-100 uppercase tracking-wider">{feesMonthLabel}</div>
            <div className="text-lg font-bold mt-1">{m}/{y}</div>
            <div className="text-sm mt-1">{ur ? "Ã˜Â§Ã˜Â¯Ã˜Â§ Ã˜Â´Ã˜Â¯Ã›Â" : "Paid"}: <b>{monthPaid}</b> / {monthTotal || 0}</div>
            <div className="text-sm">{ur ? "Ã™Ë†Ã˜ÂµÃ™Ë†Ã™â€žÃ›Å’" : "Collected"}: <b>{fmtRs(monthCollected)}</b></div>
            <div className="mt-3 h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-amber-300 rounded-full" style={{ width: `${monthTotal ? Math.round((monthPaid / monthTotal) * 100) : 0}%` }} />
            </div>
            <div className="text-xs text-emerald-100 mt-1">{monthTotal ? Math.round((monthPaid / monthTotal) * 100) : 0}% {ur ? "Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Â¦Ã›Å’ÃšÂ¯Ã›Å’" : "paid"}</div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([tt,v,d]) => (
          <div key={String(tt)} className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 hover:shadow-md transition">
            <div className="text-sm text-gray-500">{tt}</div>
            <div className="text-3xl font-extrabold text-emerald-900 mt-1">{v}</div>
            <div className="text-xs text-gray-400 mt-1">{d}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-semibold text-lg text-emerald-950">{ur ? "Ã™ÂÃ›Å’Ã˜Â³ Ã˜Â®Ã™â€žÃ˜Â§Ã˜ÂµÃ›Â (Ã™â€¦Ã˜Â²Ã›Å’Ã˜Â¯ Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­)" : "Fee Summary (Detailed)"}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <form className="flex items-center gap-2 flex-wrap">
                <label className="text-xs text-gray-500">{ur ? "Ã™â€¦Ã›ÂÃ›Å’Ã™â€ Ã›Â" : "Month"}</label>
                <input name="month" type="number" min={1} max={12} defaultValue={m} className="w-20 border rounded px-2 py-1 text-sm" />
                <label className="text-xs text-gray-500">{ur ? "Ã˜Â³Ã˜Â§Ã™â€ž" : "Year"}</label>
                <input name="year" type="number" min={2000} max={2100} defaultValue={y} className="w-24 border rounded px-2 py-1 text-sm" />
                <button className="bg-emerald-800 text-white px-3 py-1 rounded text-sm">{ur ? "Ã™ÂÃ™â€žÃ™Â¹Ã˜Â±" : "Filter"}</button>
              </form>
              <Link href="/fees" className="text-sm text-emerald-700 underline">{ur ? "Ã™ÂÃ›Å’Ã˜Â³ ÃšÂ©ÃšÂ¾Ã™Ë†Ã™â€žÃ›Å’ÃšÂº" : "Open Fees"}</Link>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-100 p-4 bg-emerald-50/30"><div className="text-xs text-gray-500">{ur ? "Ã˜Â§Ã˜Â³ Ã™â€¦Ã˜Â§Ã›Â ÃšÂ©Ã™â€ž Ã™Ë†Ã˜Â§Ã˜Â¬Ã˜Â¨" : "Total Due (Month)"}</div><div className="text-xl font-bold text-emerald-900">{fmtRs(monthDueTotal)}</div></div>
            <div className="rounded-xl border border-emerald-100 p-4 bg-emerald-50/30"><div className="text-xs text-gray-500">{ur ? "Ã˜Â§Ã˜Â³ Ã™â€¦Ã˜Â§Ã›Â Ã™Ë†Ã˜ÂµÃ™Ë†Ã™â€ž" : "Collected (Month)"}</div><div className="text-xl font-bold text-emerald-900">{fmtRs(monthCollected)}</div></div>
            <div className="rounded-xl border border-amber-100 p-4 bg-amber-50/30"><div className="text-xs text-gray-500">{ur ? "Ã˜Â§Ã˜Â³ Ã™â€¦Ã˜Â§Ã›Â Ã˜Â¨Ã˜Â§Ã™â€šÃ›Å’" : "Pending Amount (Month)"}</div><div className="text-xl font-bold text-amber-900">{fmtRs(monthPendingAmount)}</div></div>
            <div className="rounded-xl border border-blue-100 p-4 bg-blue-50/30"><div className="text-xs text-gray-500">{ur ? "Ã˜Â¢Ã˜Â¬ ÃšÂ©Ã›Å’ Ã™Ë†Ã˜ÂµÃ™Ë†Ã™â€žÃ›Å’" : "Today's Collection"}</div><div className="text-xl font-bold text-blue-900">{fmtRs(todayCollection)}</div></div>
            <div className="rounded-xl border border-orange-100 p-4 bg-orange-50/30"><div className="text-xs text-gray-500">{ur ? "Partial Ã˜Â·Ã™â€žÃ˜Â¨Ã›Â" : "Partial Students"}</div><div className="text-xl font-bold text-orange-900">{monthPartialCount}</div></div>
            <div className="rounded-xl border border-red-100 p-4 bg-red-50/30"><div className="text-xs text-gray-500">{ur ? "Pending Ã˜Â·Ã™â€žÃ˜Â¨Ã›Â" : "Pending Students"}</div><div className="text-xl font-bold text-red-900">{monthPendingCount}</div></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "Ã˜Â³Ã›Å’Ã˜Â´Ã™â€  Ã™Â¾Ã›Å’Ã˜Â´ Ã˜Â±Ã™ÂÃ˜Âª" : "Session Progress"}</h2>
          {session ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{ur ? "Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹" : "Start"}</span><span className="font-medium">{fmtDate(session.startDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{ur ? "Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜ÂªÃ˜Â§Ã™â€¦" : "End"}</span><span className="font-medium">{fmtDate(session.endDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{ur ? "ÃšÂ¯Ã˜Â²Ã˜Â±Ã›â€™ Ã˜Â¯Ã™â€ " : "Days Passed"}</span><span className="font-medium">{sessionDaysPassed ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{ur ? "Ã˜Â¨Ã˜Â§Ã™â€šÃ›Å’ Ã˜Â¯Ã™â€ " : "Days Remaining"}</span><span className="font-medium">{sessionDaysRemaining ?? "-"}</span></div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${sessionProgressPct}%` }} /></div>
              <div className="text-xs text-gray-500">{sessionProgressPct}% {ur ? "Ã™â€¦ÃšÂ©Ã™â€¦Ã™â€ž" : "complete"}{!sessionHasStarted ? <span className="ml-2 text-amber-700 font-medium">Ã¢â‚¬Â¢ {ur ? "Ã˜Â³Ã›Å’Ã˜Â´Ã™â€  Ã˜Â§Ã˜Â¨ÃšÂ¾Ã›Å’ Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹ Ã™â€ Ã›ÂÃ›Å’ÃšÂº Ã›ÂÃ™Ë†Ã˜Â§" : "Session not started yet"}</span> : null}</div>
            </div>
          ) : <p className="text-sm text-gray-500">{ur ? "ÃšÂ©Ã™Ë†Ã˜Â¦Ã›Å’ Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€ž Ã˜Â³Ã›Å’Ã˜Â´Ã™â€  Ã™â€ Ã›ÂÃ›Å’ÃšÂºÃ›â€" : "No active session."}</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 overflow-auto">
        <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-lg text-emerald-950">{ur ? "Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ Ã›Å’ Ã˜Â´Ã›Å’ÃšË†Ã™Ë†Ã™â€ž / Ã˜Â­Ã˜Â§Ã™â€žÃ˜Âª" : "Exam Schedule / Status"}</h2><Link href="/examination" className="text-sm text-emerald-700 underline">{ur ? "Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª" : "Exams"}</Link></div>
        <table className="w-full text-sm">
          <thead className="bg-emerald-50"><tr><th className="p-2 text-left">{ur ? "Ã™â€¦Ã˜Â±Ã˜Â­Ã™â€žÃ›Â" : "Stage"}</th><th className="p-2 text-left">{ur ? "Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ " : "Exam"}</th><th className="p-2 text-center">{ur ? "Ã˜ÂªÃ˜Â§Ã˜Â±Ã›Å’Ã˜Â®" : "Date"}</th><th className="p-2 text-center">{ur ? "Ã™â€¦Ã™â€ Ã˜ÂªÃ˜Â®Ã˜Â¨ Ã˜Â·Ã™â€žÃ˜Â¨Ã›Â" : "Selected"}</th><th className="p-2 text-center">{ur ? "Ã™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬ Ã™â€¦Ã˜Â­Ã™ÂÃ™Ë†Ã˜Â¸" : "Results Saved"}</th><th className="p-2 text-center">{ur ? "Ã˜Â­Ã˜Â§Ã™â€žÃ˜Âª" : "Status"}</th></tr></thead>
          <tbody>
            {examTracker.map((ex: any) => (
              <tr key={ex.id} className="border-t">
                <td className="p-2">{ex.stage ?? "-"}</td>
                <td className={`p-2 ${ur ? "font-urdu" : ""}`} dir={ur?"rtl":"ltr"}>{examDisplayName(ex)}</td>
                <td className="p-2 text-center">{fmtDate(ex.examDate)}</td>
                <td className="p-2 text-center">{ex.selected}</td>
                <td className="p-2 text-center">{ex.saved}</td>
                <td className="p-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ex.pending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{ex.pending ? (ur ? "Ã˜Â¨Ã˜Â§Ã™â€šÃ›Å’" : "Pending") : (ur ? "Ã™â€¦Ã˜Â­Ã™ÂÃ™Ë†Ã˜Â¸" : "Saved")}</span></td>
              </tr>
            ))}
            {examTracker.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">{ur ? "ÃšÂ©Ã™Ë†Ã˜Â¦Ã›Å’ Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€  Ã™â€ Ã›ÂÃ›Å’ÃšÂºÃ›â€" : "No exams."}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "ÃšÂ©Ã™â€žÃ˜Â§Ã˜Â³ / Ã˜Â­Ã›Å’Ã˜Â«Ã›Å’Ã˜Âª Ã™Ë†Ã˜Â§Ã˜Â± Ã˜Â·Ã™â€žÃ˜Â¨Ã›Â Ã˜Â®Ã™â€žÃ˜Â§Ã˜ÂµÃ›Â" : "Class / Status-wise Student Summary"}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {Object.entries(statusCounts).filter(([k])=>k!=="OTHER" || statusCounts.OTHER>0).map(([k,v]) => (
              <div key={k} className="rounded-lg border border-emerald-100 p-3 text-center"><div className="text-xs text-gray-500">{k}</div><div className="text-lg font-bold text-emerald-900">{v}</div></div>
            ))}
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm"><thead className="bg-emerald-50"><tr><th className="p-2 text-left">{ur ? "ÃšÂ©Ã™â€žÃ˜Â§Ã˜Â³" : "Class"}</th><th className="p-2 text-center">{ur ? "Ã˜ÂªÃ˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯" : "Count"}</th></tr></thead>
              <tbody>{classSummary.map(c => <tr key={c.name} className="border-t"><td className="p-2">{c.name}</td><td className="p-2 text-center font-medium">{c.count}</td></tr>)}{classSummary.length===0 && <tr><td colSpan={2} className="p-3 text-center text-gray-500">-</td></tr>}</tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-lg text-emerald-950">{ur ? "Ã˜Â³Ã˜Â±Ã™Â¹Ã›Å’Ã™ÂÃšÂ©Ã›Å’Ã™Â¹Ã˜Â³ Ã˜Â®Ã™â€žÃ˜Â§Ã˜ÂµÃ›Â" : "Certificates Summary"}</h2><Link href="/certificates" className="text-sm text-emerald-700 underline">{ur ? "Ã˜Â³Ã˜Â±Ã™Â¹Ã›Å’Ã™ÂÃšÂ©Ã›Å’Ã™Â¹Ã˜Â³" : "Certificates"}</Link></div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg border border-emerald-100 p-3 text-center"><div className="text-xs text-gray-500">{ur ? "ÃšÂ©Ã™â€ž" : "Total"}</div><div className="text-lg font-bold text-emerald-900">{certsCount}</div></div>
            <div className="rounded-lg border border-emerald-100 p-3 text-center"><div className="text-xs text-gray-500">Annual</div><div className="text-lg font-bold text-emerald-900">{certAnnual}</div></div>
            <div className="rounded-lg border border-emerald-100 p-3 text-center"><div className="text-xs text-gray-500">Nazra</div><div className="text-lg font-bold text-emerald-900">{certNazra}</div></div>
          </div>
          <ul className="divide-y text-sm">
            {recentCerts.map((c: any) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-2"><div><div className="font-medium">{c.student?.admissionNo} - {c.student?.nameEn}</div><div className="text-xs text-gray-500">{c.type}{c.serialNo ? ` Ã¢â‚¬Â¢ ${c.serialNo}` : ""}</div></div><div className="text-xs text-gray-500">{fmtDate(c.issueDate)}</div></li>
            ))}
            {recentCerts.length === 0 && <li className="py-2 text-gray-500">{ur ? "ÃšÂ©Ã™Ë†Ã˜Â¦Ã›Å’ Ã˜Â³Ã˜Â±Ã™Â¹Ã›Å’Ã™ÂÃšÂ©Ã›Å’Ã™Â¹ Ã˜Â¬Ã˜Â§Ã˜Â±Ã›Å’ Ã™â€ Ã›ÂÃ›Å’ÃšÂº Ã›ÂÃ™Ë†Ã˜Â§Ã›â€" : "No certificates issued."}</li>}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "Ã˜Â²Ã›Å’Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¡ ÃšÂ©Ã˜Â§Ã™â€¦ (Pending Tasks)" : "Pending Tasks Panel"}</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4"><div className="text-sm font-semibold text-amber-900">{ur ? "Ã™â€ Ã˜ÂªÃ˜Â§Ã˜Â¦Ã˜Â¬ Ã˜Â¨Ã˜Â§Ã™â€šÃ›Å’ Ã˜Â§Ã™â€¦Ã˜ÂªÃ˜Â­Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª" : "Exams with Pending Results"}</div><div className="text-2xl font-bold text-amber-900 mt-1">{examTracker.filter(e=>e.pending).length}</div><div className="text-xs text-amber-800 mt-1">{examTracker.filter(e=>e.pending).map(e=>examDisplayName(e)).slice(0,3).join(", ") || (ur?"ÃšÂ©Ã™Ë†Ã˜Â¦Ã›Å’ Ã™â€ Ã›ÂÃ›Å’ÃšÂº":"None")}</div></div>
          <div className="rounded-xl border border-red-100 bg-red-50/30 p-4"><div className="text-sm font-semibold text-red-900">{ur ? "Ã˜Â§Ã˜Â³ Ã™â€¦Ã˜Â§Ã›Â Ã™ÂÃ›Å’Ã˜Â³ Ã˜Â¨Ã˜Â§Ã™â€šÃ›Å’ Ã˜Â·Ã™â€žÃ˜Â¨Ã›Â" : "Students with Pending Fees (Month)"}</div><div className="text-2xl font-bold text-red-900 mt-1">{pendingFeeStudentIds.size}</div><Link href="/fees/defaulters" className="text-xs text-red-800 underline mt-1 inline-block">{ur ? "Defaulters Ã˜Â¯Ã›Å’ÃšÂ©ÃšÂ¾Ã›Å’ÃšÂº" : "View defaulters"}</Link></div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4"><div className="text-sm font-semibold text-blue-900">{ur ? "Ã˜Â±Ã™Ë†Ã™â€ž Ã™â€ Ã™â€¦Ã˜Â¨Ã˜Â± missing" : "Missing Roll No"}</div><div className="text-2xl font-bold text-blue-900 mt-1">{missingRollStudents.length}</div><div className="text-xs text-blue-800 mt-1">{missingRollStudents.slice(0,3).map((s:any)=>s.admissionNo).join(", ") || (ur?"ÃšÂ©Ã™Ë†Ã˜Â¦Ã›Å’ Ã™â€ Ã›ÂÃ›Å’ÃšÂº":"None")}</div></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4"><div className="text-sm font-semibold text-slate-900">{ur ? "Ã˜Â¨Ã™â€ Ã›Å’Ã˜Â§Ã˜Â¯Ã›Å’ Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª missing" : "Missing Essential Info"}</div><div className="text-2xl font-bold text-slate-900 mt-1">{missingInfoStudents.length}</div><div className="text-xs text-slate-700 mt-1">{ur ? "Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¯ ÃšÂ©Ã˜Â§ Ã™â€ Ã˜Â§Ã™â€¦/ÃšÂ©Ã™â€žÃ˜Â§Ã˜Â³ Ãšâ€ Ã›Å’ÃšÂ© ÃšÂ©Ã˜Â±Ã›Å’ÃšÂº" : "Check father name/class"}</div></div>
        </div>
      </div>

    </div>
  );
}
