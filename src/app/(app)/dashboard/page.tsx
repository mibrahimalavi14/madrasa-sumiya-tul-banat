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
        feePayments: { take: 6, orderBy: { createdAt: "desc" }, select: { id: true, month: true, year: true, amount: true, isPaid: true, isLate: true } },
      }
    }) : null;
    return (
      <div>
        <h1 className="text-2xl font-bold text-emerald-900 mb-4">{tr.parentDashboard}</h1>
        {!student ? <p>{tr.noLinkedStudent}</p> : (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow p-4"><h2 className="font-semibold mb-2">{tr.student}</h2><div>{student.nameEn} {student.nameUr && <span className="font-urdu">({student.nameUr})</span>}</div><div>{tr.admissionNo}: {student.admissionNo}</div><div>Reg: {student.registrationNo}</div></div>
            <div className="bg-white rounded-xl shadow p-4"><h2 className="font-semibold mb-2">{tr.recentFees}</h2>{student.feePayments.length===0?<p className="text-sm text-gray-500">{tr.noRecords}</p>:<ul className="text-sm space-y-1">{student.feePayments.map(f=>(<li key={f.id}>{f.month}/{f.year} - Rs {f.amount} - {f.isPaid ? (f.isLate?tr.late:tr.paid) : tr.unpaid}</li>))}</ul>}</div>
            <div className="bg-white rounded-xl shadow p-4 md:col-span-2"><h2 className="font-semibold mb-2">{tr.recentResults}</h2>{student.results.length===0?<p className="text-sm text-gray-500">{tr.noResults}</p>:<ul className="text-sm space-y-1">{student.results.map(r=>(<li key={r.id}>{r.percentage?.toFixed(1)}% - {r.grade} - {r.status} {r.position?`(Pos ${r.position})`:""}</li>))}</ul>}</div>
          </div>
        )}
      </div>
    );
  }

  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();

  let students = 0, examsCount = 0, examsConducted = 0, feeGroups: any[] = [], resultsCount = 0, certsCount = 0;
  let recentEnrolls: any[] = [], recentExams: any[] = [], recentResults: any[] = [];
  let monthAgg: any = { _count: { _all: 0 } }, monthPaidAgg: any = { _count: { _all: 0 }, _sum: { amount: 0 } };

  if (session) {
    const sid = session.id;
    // Batched queries to avoid connection-pool exhaustion on serverless/pgbouncer
    [students, examsCount, examsConducted, resultsCount, certsCount] = await Promise.all([
      prisma.studentEnrollment.count({ where: { sessionId: sid } }),
      prisma.exam.count({ where: { sessionId: sid } }),
      prisma.exam.count({ where: { sessionId: sid, results: { some: {} } } }),
      prisma.result.count({ where: { exam: { sessionId: sid } } }),
      prisma.certificate.count({ where: { sessionId: sid } }),
    ]);
    [feeGroups, monthAgg, monthPaidAgg] = await Promise.all([
      prisma.feePayment.groupBy({ by: ["isPaid", "isLate"], where: { sessionId: sid }, _count: { _all: true } }),
      prisma.feePayment.aggregate({ where: { sessionId: sid, month: m, year: y }, _count: { _all: true } }),
      prisma.feePayment.aggregate({ where: { sessionId: sid, month: m, year: y, isPaid: true }, _count: { _all: true }, _sum: { amount: true } }),
    ]);
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

  const cards = [
    [tr.activeSession, session ? session.name : tr.none, ur ? "موجودہ تعلیمی سال" : "Current academic year"],
    [tr.enrolledStudents, String(students), ur ? "موجودہ سیشن میں" : "In current session"],
    [ur ? "امتحانی مراحل (شیڈول)" : "Exam Stages (Schedule)", String(examsCount), ur ? "سیشن کے شیڈول شدہ/موجود مراحل" : "Scheduled/existing stages in session"],
    [ur ? "لیے گئے امتحانات" : "Exams Conducted", String(examsConducted), ur ? "جن کے نتائج محفوظ ہیں (اس سیشن میں)" : "Exams with saved results (in this session)"],
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
    <div className="space-y-6">
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
          <div className="bg-white/10 border border-white/20 rounded-2xl p-4 min-w-[220px]">
            <div className="text-xs text-emerald-100 uppercase tracking-wider">{ur ? "اس ماہ کی فیس" : "This Month Fees"}</div>
            <div className="text-lg font-bold mt-1">{m}/{y}</div>
            <div className="text-sm mt-1">{ur ? "ادا شدہ" : "Paid"}: <b>{monthPaid}</b> / {monthTotal || 0}</div>
            <div className="text-sm">{ur ? "وصولی" : "Collected"}: <b>Rs {monthCollected}</b></div>
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
