import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import Logo from "@/components/Logo";

export default async function Dashboard() {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  const tr = t[lang];

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
          <p className="text-sm text-teal-50 mt-1">{ur ? "والدین پورٹل — اپنے بچے کا تعلیمی و مالی ریکارڈ دیکھیں" : "Parent portal — view your child’s academic and fee records"}</p>
        </div>
        {!student ? <div className="bg-white rounded-2xl border border-amber-200 p-5 text-amber-900">{tr.noLinkedStudent}</div> : (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-5">
              <h2 className="font-semibold mb-3 text-teal-900">{tr.student}</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3 border-b border-gray-100 pb-2"><span className="text-gray-500">{ur ? "نام" : "Name"}</span><span className="font-semibold text-gray-900">{student.nameEn} {student.nameUr && <span className="font-urdu">({student.nameUr})</span>}</span></div>
                <div className="flex justify-between gap-3 border-b border-gray-100 pb-2"><span className="text-gray-500">{tr.admissionNo}</span><span className="font-semibold">{student.admissionNo}</span></div>
                <div className="flex justify-between gap-3"><span className="text-gray-500">Reg</span><span className="font-semibold">{student.registrationNo || "-"}</span></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/students" className="text-sm bg-teal-700 hover:bg-teal-800 text-white px-3 py-2 rounded-lg">{ur ? "مکمل پروفائل" : "Full Profile"}</Link>
                <Link href="/fees" className="text-sm border border-teal-200 text-teal-800 px-3 py-2 rounded-lg hover:bg-teal-50">{ur ? "فیس تفصیل" : "Fees"}</Link>
                <Link href="/results" className="text-sm border border-teal-200 text-teal-800 px-3 py-2 rounded-lg hover:bg-teal-50">{ur ? "نتائج" : "Results"}</Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-5">
              <h2 className="font-semibold mb-3 text-teal-900">{tr.recentFees}</h2>
              {student.feePayments.length===0?<p className="text-sm text-gray-500">{tr.noRecords}</p>:<div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">{tr.month}/{tr.year}</th><th className="p-2 text-center">{ur ? "ادا/واجب" : "Paid/Due"}</th><th className="p-2 text-center">{tr.status}</th></tr></thead><tbody>{student.feePayments.map((f: any)=>{ const paidAmt = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? Number(f.amount||0) : 0); const dueAmt = Number(f.amount||0); const full = f.isPaid || (dueAmt>0 && paidAmt>=dueAmt); const partial = paidAmt>0 && paidAmt<dueAmt; const label = full ? (f.isLate?tr.late:tr.paid) : (partial ? (lang === "ur" ? "جزوی" : "Partial") : tr.unpaid); return (<tr key={f.id} className="border-t"><td className="p-2">{f.month}/{f.year}</td><td className="p-2 text-center">Rs {paidAmt}/{dueAmt}</td><td className="p-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${full ? (f.isLate?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800") : (partial?"bg-amber-100 text-amber-800":"bg-red-100 text-red-800")}`}>{label}</span></td></tr>); })}</tbody></table></div>}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-5 md:col-span-2">
              <h2 className="font-semibold mb-3 text-teal-900">{tr.recentResults}</h2>
              {student.results.length===0?<p className="text-sm text-gray-500">{tr.noResults}</p>:<div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-center">%</th><th className="p-2 text-center">{ur ? "گریڈ" : "Grade"}</th><th className="p-2 text-center">{ur ? "حیثیت" : "Status"}</th><th className="p-2 text-center">{ur ? "پوزیشن" : "Position"}</th></tr></thead><tbody>{student.results.map(r=>(<tr key={r.id} className="border-t"><td className="p-2 text-center font-medium">{r.percentage?.toFixed(1)}%</td><td className="p-2 text-center font-semibold">{r.grade}</td><td className={`p-2 text-center ${r.status==="Pass"?"text-emerald-700":"text-red-700"}`}>{r.status}</td><td className="p-2 text-center">{r.position??"-"}</td></tr>))}</tbody></table></div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  const now = new Date();
  const actualM = now.getMonth() + 1;
  const actualY = now.getFullYear();
  let m = actualM;
  let y = actualY;

  let students = 0, activeStudents = 0, examsCount = 0, examsConducted = 0, feeGroups: any[] = [], resultsCount = 0, certsCount = 0;
  let recentEnrolls: any[] = [], recentExams: any[] = [], recentResults: any[] = [];
  let monthAgg: any = { _count: { _all: 0 } }, monthPaidAgg: any = { _count: { _all: 0 }, _sum: { amount: 0 } };
  let monthFeeRows: any[] = [];
  let enrollmentsForSummary: any[] = [];
  let recentAudit: any[] = [];
  let certsByType: any[] = [];
  let recentCerts: any[] = [];
  let monthFeeTrendRows: any[] = [];

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
    const trendMonths: Array<{ month: number; year: number; label: string }> = [];
    for (let i = 5; i >= 0; i--) {
      const idx = shownIdx2 - i;
      const tm = (idx % 12 + 12) % 12 + 1;
      const ty = Math.floor((idx - (tm - 1)) / 12);
      trendMonths.push({ month: tm, year: ty, label: `${tm}/${String(ty).slice(-2)}` });
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
    ? (ur ? "اس ماہ کی فیس" : "This Month Fees")
    : shownIdx < actualIdx
      ? (ur ? "پچھلے مہینے کی فیس" : "Last Month Fees")
      : (ur ? "اگلے مہینے کی فیس" : "Next Month Fees");

  const sessionStart = session?.startDate ? new Date(session.startDate) : null;
  const sessionEnd = session?.endDate ? new Date(session.endDate) : null;
  const daysToSessionEnd = sessionEnd ? Math.ceil((sessionEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const sessionTotalDays = sessionStart && sessionEnd ? Math.max(1, Math.ceil((sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60 * 24))) : null;
  const sessionDaysPassed = sessionStart ? Math.min(sessionTotalDays ?? 0, Math.max(0, Math.ceil((Date.now() - sessionStart.getTime()) / (1000 * 60 * 60 * 24)))) : null;
  const sessionDaysRemaining = sessionEnd ? Math.max(0, Math.ceil((sessionEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  const sessionProgressPct = sessionTotalDays && sessionDaysPassed != null ? Math.min(100, Math.round((sessionDaysPassed / sessionTotalDays) * 100)) : 0;
  const sessionEndingSoon = daysToSessionEnd != null && daysToSessionEnd >= 0 && daysToSessionEnd <= 30;

  const statusCounts = { ACTIVE: 0, LEFT: 0, REGISTERED: 0, OTHER: 0 } as Record<string, number>;
  const classCounts = new Map<string, number>();
  for (const e of enrollmentsForSummary) {
    const st = String(e.student?.status || "OTHER").toUpperCase();
    if (st in statusCounts) statusCounts[st] += 1; else statusCounts.OTHER += 1;
    const cls = String(e.student?.admissionClass || (ur ? "غیر متعین" : "Unassigned")).trim() || (ur ? "غیر متعین" : "Unassigned");
    classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
  }
  const classSummary = [...classCounts.entries()].map(([name, count]) => ({ name, count })).sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name)).slice(0, 8);

  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
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

  const trendMonths: Array<{ month: number; year: number; label: string }> = [];
  for (let i = 5; i >= 0; i--) {
    const idx = shownIdx - i;
    const tm = (idx % 12 + 12) % 12 + 1;
    const ty = Math.floor((idx - (tm - 1)) / 12);
    trendMonths.push({ month: tm, year: ty, label: `${tm}/${String(ty).slice(-2)}` });
  }
  const feeTrend = trendMonths.map(t => {
    const rows = monthFeeTrendRows.filter((r: any) => r.month === t.month && r.year === t.year);
    const collected = rows.reduce((s: number, f: any) => s + (Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? Number(f.amount || 0) : 0)), 0);
    return { ...t, collected };
  });
  const feeTrendMax = Math.max(1, ...feeTrend.map(f => f.collected));
  const passFail = {
    pass: recentResults.filter((r: any) => String(r.status).toLowerCase() === "pass").length,
    fail: recentResults.filter((r: any) => String(r.status).toLowerCase() === "fail").length,
  };
  const maxClassCount = Math.max(1, ...classSummary.map(c => c.count));

  const cards = [
    [tr.activeSession, session ? session.name : tr.none, ur ? "موجودہ تعلیمی سال" : "Current academic year"],
    [tr.enrolledStudents, String(students), ur ? "موجودہ سیشن میں" : "In current session"],
    [ur ? "فعال طلبہ" : "Active Students", String(activeStudents), ur ? "جن کا اسٹیٹس فعال ہے" : "Students with ACTIVE status"],
    [ur ? "امتحانی مراحل (شیڈول)" : "Exam Stages (Schedule)", String(examsCount), ur ? "سیشن کے شیڈول شدہ/موجود مراحل" : "Scheduled/existing stages in session"],
    [ur ? "لیے گئے امتحانات" : "Exams Conducted", String(examsConducted), ur ? "جن کے نتائج محفوظ ہیں" : "Exams with saved results"],
    [ur ? "زیر التواء امتحانات" : "Pending Exams", String(pendingExams), ur ? "جن کے نتائج ابھی محفوظ نہیں" : "Stages with no saved results yet"],
    [ur ? "نتائج (محفوظ)" : "Results (Saved)", String(resultsCount), ur ? "محفوظ شدہ نتائج" : "Saved result entries"],
    [tr.certificates, String(certsCount), ur ? "جاری شدہ سرٹیفکیٹس" : "Issued certificates"],
    [tr.feesPaid, String(feesPaid), ur ? "وقت پر ادائیگیاں" : "On time payments"],
    [tr.feesUnpaid, String(feesUnpaid), ur ? "باقی ادائیگیاں" : "Pending"],
    [tr.latePayments, String(lateFees), ur ? "7 تاریخ کے بعد ادا شدہ" : "Paid after 7th"],
  ];

  const latestExam = [...(recentExams as any[])].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const latestExamHref = latestExam ? `/results?examId=${latestExam.id}` : "/examination";
  const latestExamLabel = latestExam ? (ur ? `تازہ ترین امتحانی مرحلہ: ${examDisplayName(latestExam)}` : `Latest Exam Stage: ${examDisplayName(latestExam)}`) : (ur ? "امتحانات" : "Examinations");
  const quickLinks = [
    ["/students/new", ur ? "نیا داخلہ" : "New Admission", "from-emerald-600 to-emerald-700"],
    ["/students", ur ? "طلبہ کی فہرست" : "Students List", "from-teal-600 to-teal-700"],
    ["/examination", ur ? "امتحانات" : "Examinations", "from-blue-600 to-blue-700"],
    [latestExamHref, latestExamLabel, "from-amber-500 to-amber-600"],
    ["/fees", ur ? "فیس" : "Fees", "from-violet-600 to-violet-700"],
    ["/certificates", ur ? "سرٹیفکیٹس" : "Certificates", "from-rose-600 to-rose-700"],
  ] as const;

  const fmtRs = (n: number) => `Rs ${Number(n || 0).toLocaleString()}`;
  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-GB") : "-";

  return (
    <div className="space-y-6 theme-dashboard">
      {(sessionEndingSoon || pendingExams > 0 || (monthTotal - monthPaid) > 0) && (
        <div className="grid md:grid-cols-3 gap-3 no-print">
          {sessionEndingSoon && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 text-sm"><b>{ur ? "تنبیہ:" : "Alert:"}</b> {ur ? `سیشن ${daysToSessionEnd} دن میں ختم ہو رہا ہے۔` : `Session ends in ${daysToSessionEnd} day(s).`}</div>
          )}
          {pendingExams > 0 && (
            <div className="bg-blue-50 border border-blue-300 text-blue-900 rounded-xl p-4 text-sm"><b>{ur ? "یاددہانی:" : "Reminder:"}</b> {ur ? `${pendingExams} امتحانی مرحلہ/مراحل کے نتائج باقی ہیں۔` : `${pendingExams} exam stage(s) have pending results.`}</div>
          )}
          {(monthTotal - monthPaid) > 0 && (
            <div className="bg-red-50 border border-red-300 text-red-900 rounded-xl p-4 text-sm"><b>{ur ? "فیس:" : "Fees:"}</b> {ur ? `${monthTotal - monthPaid} طلبہ کی اس مہینے کی فیس باقی ہے۔` : `${monthTotal - monthPaid} student(s) have pending fees for this month.`}</div>
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
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Madrasa Sumiya-tul-Banat <span className="font-urdu text-amber-200">مدرسہ سمیّة البنات</span></h1>
              <p className="text-emerald-100 mt-2 text-sm md:text-base">{tr.adminOverview}</p>
              {session && <div className="mt-3 inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-sm">{tr.activeSession}: <b>{session.name}</b> ({session.status})</div>}
            </div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-4 min-w-[240px]">
            <div className="text-xs text-emerald-100 uppercase tracking-wider">{feesMonthLabel}</div>
            <div className="text-lg font-bold mt-1">{m}/{y}</div>
            <div className="text-sm mt-1">{ur ? "ادا شدہ" : "Paid"}: <b>{monthPaid}</b> / {monthTotal || 0}</div>
            <div className="text-sm">{ur ? "وصولی" : "Collected"}: <b>{fmtRs(monthCollected)}</b></div>
            <div className="mt-3 h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-amber-300 rounded-full" style={{ width: `${monthTotal ? Math.round((monthPaid / monthTotal) * 100) : 0}%` }} />
            </div>
            <div className="text-xs text-emerald-100 mt-1">{monthTotal ? Math.round((monthPaid / monthTotal) * 100) : 0}% {ur ? "ادائیگی" : "paid"}</div>
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
          <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-lg text-emerald-950">{ur ? "فیس خلاصہ (مزید واضح)" : "Fee Summary (Detailed)"}</h2><Link href="/fees" className="text-sm text-emerald-700 underline">{ur ? "فیس کھولیں" : "Open Fees"}</Link></div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-100 p-4 bg-emerald-50/30"><div className="text-xs text-gray-500">{ur ? "اس ماہ کل واجب" : "Total Due (Month)"}</div><div className="text-xl font-bold text-emerald-900">{fmtRs(monthDueTotal)}</div></div>
            <div className="rounded-xl border border-emerald-100 p-4 bg-emerald-50/30"><div className="text-xs text-gray-500">{ur ? "اس ماہ وصول" : "Collected (Month)"}</div><div className="text-xl font-bold text-emerald-900">{fmtRs(monthCollected)}</div></div>
            <div className="rounded-xl border border-amber-100 p-4 bg-amber-50/30"><div className="text-xs text-gray-500">{ur ? "اس ماہ باقی" : "Pending Amount (Month)"}</div><div className="text-xl font-bold text-amber-900">{fmtRs(monthPendingAmount)}</div></div>
            <div className="rounded-xl border border-blue-100 p-4 bg-blue-50/30"><div className="text-xs text-gray-500">{ur ? "آج کی وصولی" : "Today's Collection"}</div><div className="text-xl font-bold text-blue-900">{fmtRs(todayCollection)}</div></div>
            <div className="rounded-xl border border-orange-100 p-4 bg-orange-50/30"><div className="text-xs text-gray-500">{ur ? "Partial طلبہ" : "Partial Students"}</div><div className="text-xl font-bold text-orange-900">{monthPartialCount}</div></div>
            <div className="rounded-xl border border-red-100 p-4 bg-red-50/30"><div className="text-xs text-gray-500">{ur ? "Pending طلبہ" : "Pending Students"}</div><div className="text-xl font-bold text-red-900">{monthPendingCount}</div></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "سیشن پیش رفت" : "Session Progress"}</h2>
          {session ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{ur ? "شروع" : "Start"}</span><span className="font-medium">{fmtDate(session.startDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{ur ? "اختتام" : "End"}</span><span className="font-medium">{fmtDate(session.endDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{ur ? "گزرے دن" : "Days Passed"}</span><span className="font-medium">{sessionDaysPassed ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{ur ? "باقی دن" : "Days Remaining"}</span><span className="font-medium">{sessionDaysRemaining ?? "-"}</span></div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${sessionProgressPct}%` }} /></div>
              <div className="text-xs text-gray-500">{sessionProgressPct}% {ur ? "مکمل" : "complete"}</div>
            </div>
          ) : <p className="text-sm text-gray-500">{ur ? "کوئی فعال سیشن نہیں۔" : "No active session."}</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 overflow-auto">
        <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-lg text-emerald-950">{ur ? "امتحانی شیڈول / حالت" : "Exam Schedule / Status"}</h2><Link href="/examination" className="text-sm text-emerald-700 underline">{ur ? "امتحانات" : "Exams"}</Link></div>
        <table className="w-full text-sm">
          <thead className="bg-emerald-50"><tr><th className="p-2 text-left">{ur ? "مرحلہ" : "Stage"}</th><th className="p-2 text-left">{ur ? "امتحان" : "Exam"}</th><th className="p-2 text-center">{ur ? "تاریخ" : "Date"}</th><th className="p-2 text-center">{ur ? "منتخب طلبہ" : "Selected"}</th><th className="p-2 text-center">{ur ? "نتائج محفوظ" : "Results Saved"}</th><th className="p-2 text-center">{ur ? "حالت" : "Status"}</th></tr></thead>
          <tbody>
            {examTracker.map((ex: any) => (
              <tr key={ex.id} className="border-t">
                <td className="p-2">{ex.stage ?? "-"}</td>
                <td className={`p-2 ${ur ? "font-urdu" : ""}`} dir={ur?"rtl":"ltr"}>{examDisplayName(ex)}</td>
                <td className="p-2 text-center">{fmtDate(ex.examDate)}</td>
                <td className="p-2 text-center">{ex.selected}</td>
                <td className="p-2 text-center">{ex.saved}</td>
                <td className="p-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ex.pending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{ex.pending ? (ur ? "باقی" : "Pending") : (ur ? "محفوظ" : "Saved")}</span></td>
              </tr>
            ))}
            {examTracker.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">{ur ? "کوئی امتحان نہیں۔" : "No exams."}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "کلاس / حیثیت وار طلبہ خلاصہ" : "Class / Status-wise Student Summary"}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {Object.entries(statusCounts).filter(([k])=>k!=="OTHER" || statusCounts.OTHER>0).map(([k,v]) => (
              <div key={k} className="rounded-lg border border-emerald-100 p-3 text-center"><div className="text-xs text-gray-500">{k}</div><div className="text-lg font-bold text-emerald-900">{v}</div></div>
            ))}
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm"><thead className="bg-emerald-50"><tr><th className="p-2 text-left">{ur ? "کلاس" : "Class"}</th><th className="p-2 text-center">{ur ? "تعداد" : "Count"}</th></tr></thead>
              <tbody>{classSummary.map(c => <tr key={c.name} className="border-t"><td className="p-2">{c.name}</td><td className="p-2 text-center font-medium">{c.count}</td></tr>)}{classSummary.length===0 && <tr><td colSpan={2} className="p-3 text-center text-gray-500">-</td></tr>}</tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-lg text-emerald-950">{ur ? "سرٹیفکیٹس خلاصہ" : "Certificates Summary"}</h2><Link href="/certificates" className="text-sm text-emerald-700 underline">{ur ? "سرٹیفکیٹس" : "Certificates"}</Link></div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg border border-emerald-100 p-3 text-center"><div className="text-xs text-gray-500">{ur ? "کل" : "Total"}</div><div className="text-lg font-bold text-emerald-900">{certsCount}</div></div>
            <div className="rounded-lg border border-emerald-100 p-3 text-center"><div className="text-xs text-gray-500">Annual</div><div className="text-lg font-bold text-emerald-900">{certAnnual}</div></div>
            <div className="rounded-lg border border-emerald-100 p-3 text-center"><div className="text-xs text-gray-500">Nazra</div><div className="text-lg font-bold text-emerald-900">{certNazra}</div></div>
          </div>
          <ul className="divide-y text-sm">
            {recentCerts.map((c: any) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-2"><div><div className="font-medium">{c.student?.admissionNo} - {c.student?.nameEn}</div><div className="text-xs text-gray-500">{c.type}{c.serialNo ? ` • ${c.serialNo}` : ""}</div></div><div className="text-xs text-gray-500">{fmtDate(c.issueDate)}</div></li>
            ))}
            {recentCerts.length === 0 && <li className="py-2 text-gray-500">{ur ? "کوئی سرٹیفکیٹ جاری نہیں ہوا۔" : "No certificates issued."}</li>}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "زیر التواء کام (Pending Tasks)" : "Pending Tasks Panel"}</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4"><div className="text-sm font-semibold text-amber-900">{ur ? "نتائج باقی امتحانات" : "Exams with Pending Results"}</div><div className="text-2xl font-bold text-amber-900 mt-1">{examTracker.filter(e=>e.pending).length}</div><div className="text-xs text-amber-800 mt-1">{examTracker.filter(e=>e.pending).map(e=>examDisplayName(e)).slice(0,3).join(", ") || (ur?"کوئی نہیں":"None")}</div></div>
          <div className="rounded-xl border border-red-100 bg-red-50/30 p-4"><div className="text-sm font-semibold text-red-900">{ur ? "اس ماہ فیس باقی طلبہ" : "Students with Pending Fees (Month)"}</div><div className="text-2xl font-bold text-red-900 mt-1">{pendingFeeStudentIds.size}</div><Link href="/fees/defaulters" className="text-xs text-red-800 underline mt-1 inline-block">{ur ? "Defaulters دیکھیں" : "View defaulters"}</Link></div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4"><div className="text-sm font-semibold text-blue-900">{ur ? "رول نمبر missing" : "Missing Roll No"}</div><div className="text-2xl font-bold text-blue-900 mt-1">{missingRollStudents.length}</div><div className="text-xs text-blue-800 mt-1">{missingRollStudents.slice(0,3).map((s:any)=>s.admissionNo).join(", ") || (ur?"کوئی نہیں":"None")}</div></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4"><div className="text-sm font-semibold text-slate-900">{ur ? "بنیادی معلومات missing" : "Missing Essential Info"}</div><div className="text-2xl font-bold text-slate-900 mt-1">{missingInfoStudents.length}</div><div className="text-xs text-slate-700 mt-1">{ur ? "والد کا نام/کلاس چیک کریں" : "Check father name/class"}</div></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "ماہ وار فیس وصولی" : "Monthly Fee Collection"}</h2>
          <div className="space-y-2">
            {feeTrend.map(f => (
              <div key={f.label} className="text-sm">
                <div className="flex justify-between mb-1"><span>{f.label}</span><span className="text-gray-600">{fmtRs(f.collected)}</span></div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.round((f.collected / feeTrendMax) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "پاس / فیل خلاصہ (حالیہ نتائج)" : "Pass / Fail (Recent Results)"}</h2>
          <div className="space-y-3">
            {(["pass","fail"] as const).map(k => {
              const val = passFail[k]; const max = Math.max(1, passFail.pass, passFail.fail);
              return <div key={k}><div className="flex justify-between text-sm mb-1"><span>{k === "pass" ? (ur?"کامیاب":"Pass") : (ur?"ناکام":"Fail")}</span><span>{val}</span></div><div className="h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${k==="pass"?"bg-emerald-600":"bg-red-500"}`} style={{ width: `${Math.round((val/max)*100)}%` }} /></div></div>;
            })}
            <p className="text-xs text-gray-500">{ur ? "یہ خلاصہ حالیہ محفوظ نتائج کے نمونے پر مبنی ہے۔" : "Based on recent saved results sample."}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "کلاس وار طلبہ (چارٹ)" : "Class-wise Students (Chart)"}</h2>
          <div className="space-y-2">
            {classSummary.slice(0,6).map(c => (
              <div key={c.name} className="text-sm"><div className="flex justify-between mb-1"><span className="truncate pr-2">{c.name}</span><span>{c.count}</span></div><div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-600 rounded-full" style={{ width: `${Math.round((c.count/maxClassCount)*100)}%` }} /></div></div>
            ))}
            {classSummary.length === 0 && <p className="text-sm text-gray-500">-</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-lg text-emerald-950">{ur ? "حالیہ سرگرمی (Audit)" : "Recent Activity (Audit)"}</h2><Link href="/settings/audit" className="text-sm text-emerald-700 underline">{ur ? "آڈٹ لاگ" : "Audit Log"}</Link></div>
          {user?.role !== "ADMIN" ? <p className="text-sm text-gray-500">{ur ? "تفصیلی آڈٹ لاگ صرف ایڈمن کے لیے ہے۔" : "Detailed audit log is Admin-only."}</p> : (
            <ul className="divide-y text-sm">
              {recentAudit.map((a: any) => (
                <li key={a.id} className="py-2.5"><div className="font-medium text-gray-900">{a.action}</div><div className="text-xs text-gray-500">{a.actorLabel || "-"}{a.entityType ? ` • ${a.entityType}` : ""} • {fmtDate(a.createdAt)}</div></li>
              ))}
              {recentAudit.length === 0 && <li className="py-2 text-gray-500">{ur ? "کوئی سرگرمی نہیں۔" : "No recent activity."}</li>}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-lg text-emerald-950 mb-3">{ur ? "فوری روابط" : "Quick Links"}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {quickLinks.map(([href, label, grad]) => (
              <Link key={href} href={href} className={`rounded-xl p-4 text-white font-medium bg-gradient-to-r ${grad} hover:opacity-95 shadow-sm transition`}>
                {label} →
              </Link>
            ))}
            <Link href="/settings/backup" className="rounded-xl p-4 text-white font-medium bg-gradient-to-r from-slate-600 to-slate-700 hover:opacity-95 shadow-sm transition">{ur ? "بیک اپ سینٹر" : "Backup Center"} →</Link>
            <Link href="/settings/audit" className="rounded-xl p-4 text-white font-medium bg-gradient-to-r from-gray-600 to-gray-700 hover:opacity-95 shadow-sm transition">{ur ? "آڈٹ لاگ" : "Audit Log"} →</Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg text-emerald-950">{ur ? "حالیہ داخلے / طلبہ" : "Recent Admissions / Students"}</h2>
            <Link href="/students" className="text-sm text-emerald-700 underline">{ur ? "سب دیکھیں" : "View all"}</Link>
          </div>
          {recentEnrolls.length === 0 ? <p className="text-sm text-gray-500">{ur ? "کوئی ریکارڈ نہیں۔" : "No records."}</p> : (
            <ul className="divide-y">
              {recentEnrolls.map((e: any) => (
                <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">{e.student.admissionNo} - {e.student.nameEn}</div>
                    <div className="text-xs text-gray-500">{e.student.admissionClass || "-"} {e.rollNo ? `• Roll: ${e.rollNo}` : ""}</div>
                  </div>
                  <Link href={`/students/${e.student.id}`} className="text-sm text-emerald-700 underline">{ur ? "پروفائل" : "Profile"}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg text-emerald-950">{ur ? "حالیہ محفوظ نتائج" : "Recent Saved Results"}</h2>
            <Link href="/results" className="text-sm text-emerald-700 underline">{ur ? "سب دیکھیں" : "View all"}</Link>
          </div>
          {recentResults.length === 0 ? <p className="text-sm text-gray-500">{ur ? "ابھی کوئی نتیجہ محفوظ نہیں۔" : "No results saved yet."}</p> : (
            <table className="w-full text-sm">
              <thead className="bg-emerald-50"><tr><th className="p-2 text-left">{ur ? "طالب علم" : "Student"}</th><th className="p-2 text-left">{ur ? "امتحان" : "Exam"}</th><th className="p-2 text-center">%</th><th className="p-2 text-center">{ur ? "گریڈ" : "Grade"}</th><th className="p-2 text-center">{ur ? "حیثیت" : "Status"}</th></tr></thead>
              <tbody>
                {recentResults.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.student?.admissionNo} - {r.student?.nameEn}</td>
                    <td className={`p-2 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>{examDisplayName(r.exam)}</td>
                    <td className="p-2 text-center">{r.percentage != null ? Number(r.percentage).toFixed(2) : "-"}</td>
                    <td className="p-2 text-center font-semibold">{r.grade || "-"}</td>
                    <td className={`p-2 text-center ${r.status === "Pass" ? "text-emerald-700" : "text-red-700"}`}>{r.status || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
