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

  if (session) {
    // Clamp dashboard fee summary month to session period (fees start from session start)
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
    // Batched queries to avoid connection-pool exhaustion on serverless/pgbouncer
    [students, activeStudents, examsCount, examsConducted, resultsCount, certsCount] = await Promise.all([
      prisma.studentEnrollment.count({ where: { sessionId: sid } }),
      prisma.studentEnrollment.count({ where: { sessionId: sid, student: { status: "ACTIVE" } } }),
      prisma.exam.count({ where: { sessionId: sid } }),
      prisma.exam.count({ where: { sessionId: sid, results: { some: {} } } }),
      prisma.result.count({ where: { exam: { sessionId: sid } } }),
      prisma.certificate.count({ where: { sessionId: sid } }),
    ]);
    const monthFeeRows = await prisma.feePayment.findMany({ where: { sessionId: sid, month: m, year: y }, select: { amount: true, paidAmount: true, isPaid: true } });
    [feeGroups, monthAgg] = await Promise.all([
      prisma.feePayment.groupBy({ by: ["isPaid", "isLate"], where: { sessionId: sid }, _count: { _all: true } }),
      prisma.feePayment.aggregate({ where: { sessionId: sid, month: m, year: y }, _count: { _all: true } }),
    ]);
    monthPaidAgg = {
      _count: { _all: monthFeeRows.filter((f: any) => !!f.isPaid || (Number(f.amount||0)>0 && Number(f.paidAmount??0)>=Number(f.amount||0))).length },
      _sum: { amount: monthFeeRows.reduce((s: number, f: any) => s + (Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? Number(f.amount || 0) : 0)), 0) },
    } as any;
    [recentEnrolls, recentExams, recentResults] = await Promise.all([
      prisma.studentEnrollment.findMany({
        where: { sessionId: sid },
        select: { id: true, rollNo: true, student: { select: { id: true, admissionNo: true, nameEn: true, admissionClass: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.exam.findMany({
        where: { sessionId: sid },
        orderBy: [{ stage: "asc" }, { createdAt: "desc" }] as any,
        select: { id: true, name: true, stage: true, createdAt: true, _count: { select: { students: true, papers: true, results: true } } },
        take: 6,
      }),
      prisma.result.findMany({
        where: { exam: { sessionId: sid } },
        select: { id: true, percentage: true, grade: true, status: true, student: { select: { admissionNo: true, nameEn: true } }, exam: { select: { name: true, stage: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);
  }

  const feesPaid = (feeGroups as any[]).filter(g => g.isPaid && !g.isLate).reduce((s, g) => s + g._count._all, 0);
  const feesUnpaid = (feeGroups as any[]).filter(g => !g.isPaid).reduce((s, g) => s + g._count._all, 0);
  const lateFees = (feeGroups as any[]).filter(g => g.isPaid && g.isLate).reduce((s, g) => s + g._count._all, 0);
  const monthPaid = (monthPaidAgg as any)._count._all;
  const monthTotal = (monthAgg as any)._count._all;
  const monthCollected = (monthPaidAgg as any)._sum.amount || 0;
  const pendingExams = Math.max(0, examsCount - examsConducted);

  const actualIdx = actualY * 12 + (actualM - 1);
  const shownIdx = y * 12 + (m - 1);
  const feesMonthLabel = shownIdx === actualIdx
    ? (ur ? "اس ماہ کی فیس" : "This Month Fees")
    : shownIdx < actualIdx
      ? (ur ? "پچھلے مہینے کی فیس" : "Last Month Fees")
      : (ur ? "اگلے مہینے کی فیس" : "Next Month Fees");

  const sessionEnd = session?.endDate ? new Date(session.endDate) : null;
  const daysToSessionEnd = sessionEnd ? Math.ceil((sessionEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const sessionEndingSoon = daysToSessionEnd != null && daysToSessionEnd >= 0 && daysToSessionEnd <= 30;

  const cards = [
    [tr.activeSession, session ? session.name : tr.none, ur ? "موجودہ تعلیمی سال" : "Current academic year"],
    [tr.enrolledStudents, String(students), ur ? "موجودہ سیشن میں" : "In current session"],
    [ur ? "فعال طلبہ" : "Active Students", String(activeStudents), ur ? "جن کا اسٹیٹس فعال ہے" : "Students with ACTIVE status"],
    [ur ? "امتحانی مراحل (شیڈول)" : "Exam Stages (Schedule)", String(examsCount), ur ? "سیشن کے شیڈول شدہ/موجود مراحل" : "Scheduled/existing stages in session"],
    [ur ? "لیے گئے امتحانات" : "Exams Conducted", String(examsConducted), ur ? "جن کے نتائج محفوظ ہیں (اس سیشن میں)" : "Exams with saved results (in this session)"],
    [ur ? "زیر التواء امتحانات" : "Pending Exams", String(pendingExams), ur ? "جن کے نتائج ابھی محفوظ نہیں" : "Stages with no saved results yet"],
    [ur ? "نتائج (محفوظ)" : "Results (Saved)", String(resultsCount), ur ? "محفوظ شدہ نتائج" : "Saved result entries"],
    [tr.certificates, String(certsCount), ur ? "جاری شدہ سرٹیفکیٹس" : "Issued certificates"],
    [tr.feesPaid, String(feesPaid), ur ? "وقت پر ادائیگیاں" : "On time payments"],
    [tr.feesUnpaid, String(feesUnpaid), ur ? "باقی ادائیگیاں" : "Pending"],
    [tr.latePayments, String(lateFees), ur ? "7 تاریخ کے بعد ادا شدہ" : "Paid after 7th"],
  ];

  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  const examDisplayName = (ex: any) => (ur && ex?.stage && examNameUr[Number(ex.stage)]) || ex?.name || "-";
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
            <div className="text-sm">{ur ? "وصولی" : "Collected"}: <b>Rs {monthCollected}</b></div>
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

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold text-lg mb-3 text-emerald-950">{ur ? "فوری روابط" : "Quick Links"}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map(([href, label, grad]) => (
            <Link key={href} href={href} className={`rounded-xl p-4 text-white font-medium bg-gradient-to-r ${grad} hover:opacity-95 shadow-sm transition`}>
              {label} →
            </Link>
          ))}
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

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg text-emerald-950">{ur ? "امتحانی مراحل کا خلاصہ" : "Exam Stages Overview"}</h2>
            <Link href="/examination" className="text-sm text-emerald-700 underline">{ur ? "سب دیکھیں" : "View all"}</Link>
          </div>
          {recentExams.length === 0 ? <p className="text-sm text-gray-500">{ur ? "کوئی امتحانی مرحلہ موجود نہیں۔" : "No exam stages."}</p> : (
            <ul className="divide-y">
              {[...recentExams].sort((a:any,b:any)=>((a.stage??99)-(b.stage??99))).map((ex: any) => (
                <li key={ex.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className={`font-medium text-gray-900 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>{examDisplayName(ex)}</div>
                    <div className="text-xs text-gray-500">{ur ? "طلبہ" : "Students"}: {ex._count.students} • {ur ? "پرچے" : "Papers"}: {ex._count.papers} • {ur ? "نتائج" : "Results"}: {ex._count.results}</div>
                  </div>
                  <Link href={`/examination/${ex.id}`} className="text-sm text-emerald-700 underline">{ur ? "کھولیں" : "Open"}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
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
  );
}
