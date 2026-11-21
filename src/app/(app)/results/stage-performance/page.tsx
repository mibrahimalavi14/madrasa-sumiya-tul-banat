import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";

export default async function StagePerformancePage() {
  const user = await getAuthUser();
  if (user?.role !== "ADMIN" && user?.role !== "ACCOUNTANT") redirect("/dashboard");
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  if (!session) return <p className="p-6">{ur ? "کوئی فعال سیشن نہیں۔" : "No active session."}</p>;

  const [exams, results] = await Promise.all([
    prisma.exam.findMany({
      where: { sessionId: session.id },
      select: { id: true, name: true, stage: true, examDate: true, _count: { select: { students: true, results: true } } },
      orderBy: [{ stage: "asc" }, { createdAt: "asc" }] as any,
    }),
    prisma.result.findMany({
      where: { exam: { sessionId: session.id } },
      select: { percentage: true, status: true, totalObtained: true, totalMarks: true, writtenObtained: true, writtenTotal: true, oralObtained: true, oralTotal: true, remarks: true, exam: { select: { stage: true } } },
    }),
  ]);

  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  const stages = [1, 2, 3, 4].map((stage) => {
    const exam = exams.find((e: any) => Number(e.stage) === stage);
    const rows = results.filter((r: any) => Number(r.exam?.stage) === stage);
    const total = rows.length;
    const pass = rows.filter((r: any) => String(r.status).toLowerCase() === "pass").length;
    const fail = total - pass;
    const absent = rows.filter((r: any) => r.remarks === "ABSENT" || r.remarks === "LEAVE").length;
    const avg = total ? rows.reduce((s: number, r: any) => s + Number(r.percentage || 0), 0) / total : 0;
    const writtenRows = rows.filter((r: any) => Number(r.writtenTotal || 0) > 0);
    const oralRows = rows.filter((r: any) => Number(r.oralTotal || 0) > 0);
    const writtenAvg = writtenRows.length ? writtenRows.reduce((s: number, r: any) => s + ((Number(r.writtenObtained || 0) / Number(r.writtenTotal || 1)) * 100), 0) / writtenRows.length : 0;
    const oralAvg = oralRows.length ? oralRows.reduce((s: number, r: any) => s + ((Number(r.oralObtained || 0) / Number(r.oralTotal || 1)) * 100), 0) / oralRows.length : 0;
    return {
      stage,
      examId: exam?.id || null,
      name: ur ? (examNameUr[stage] || exam?.name || `Stage ${stage}`) : (exam?.name || `Stage ${stage}`),
      examDate: exam?.examDate,
      selected: exam?._count?.students ?? 0,
      saved: exam?._count?.results ?? total,
      total, pass, fail, absent, avg, writtenAvg, oralAvg, hasWritten: writtenRows.length > 0, hasOral: oralRows.length > 0,
    };
  });

  return (
    <div className="space-y-5 theme-results">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">{ur ? "مرحلہ وار امتحانی کارکردگی" : "Stage-wise Exam Performance"}</h1>
        <p className="text-sm text-blue-100 mt-1">{ur ? "چاروں امتحانی مراحل کی کارکردگی کا خلاصہ" : "Performance summary across all four exam stages"}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-blue-50 text-blue-950"><tr>
            <th className="p-2 text-center">{ur ? "مرحلہ" : "Stage"}</th>
            <th className="p-2 text-left">{ur ? "امتحان" : "Exam"}</th>
            <th className="p-2 text-center">{ur ? "منتخب" : "Selected"}</th>
            <th className="p-2 text-center">{ur ? "نتائج" : "Results"}</th>
            <th className="p-2 text-center">{ur ? "اوسط %" : "Avg %"}</th>
            <th className="p-2 text-center">{ur ? "تحریری اوسط" : "Written Avg"}</th>
            <th className="p-2 text-center">{ur ? "زبانی اوسط" : "Oral Avg"}</th>
            <th className="p-2 text-center">{ur ? "پاس" : "Pass"}</th>
            <th className="p-2 text-center">{ur ? "فیل" : "Fail"}</th>
            <th className="p-2 text-center">{ur ? "غیر حاضر/رخصت" : "Absent/Leave"}</th>
          </tr></thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.stage} className="border-t">
                <td className="p-2 text-center font-semibold">{s.stage}</td>
                <td className={`p-2 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>{s.name}</td>
                <td className="p-2 text-center">{s.selected}</td>
                <td className="p-2 text-center">{s.total}</td>
                <td className="p-2 text-center font-medium">{s.total ? s.avg.toFixed(2) : "-"}</td>
                <td className="p-2 text-center">{s.hasWritten ? s.writtenAvg.toFixed(1) + "%" : "-"}</td>
                <td className="p-2 text-center">{s.hasOral ? s.oralAvg.toFixed(1) + "%" : "-"}</td>
                <td className="p-2 text-center text-emerald-700 font-medium">{s.total ? s.pass : "-"}</td>
                <td className="p-2 text-center text-red-700 font-medium">{s.total ? s.fail : "-"}</td>
                <td className="p-2 text-center text-amber-700 font-medium">{s.total ? s.absent : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stages.map((s) => (
          <div key={s.stage} className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4">
            <div className="text-xs text-gray-500">{ur ? "مرحلہ" : "Stage"} {s.stage}</div>
            <div className={`font-semibold text-blue-900 mt-1 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>{s.name}</div>
            <div className="mt-3 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, s.avg)}%` }} /></div>
            <div className="flex justify-between text-xs text-gray-600 mt-2"><span>{ur ? "اوسط" : "Avg"}: {s.total ? s.avg.toFixed(1) : "-"}%</span><span>{ur ? "پاس" : "Pass"}: {s.total ? s.pass : 0}/{s.total}</span></div>
            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>{ur ? "تحریری" : "Written"}: {s.hasWritten ? s.writtenAvg.toFixed(1)+"%" : "-"}</span><span>{ur ? "زبانی" : "Oral"}: {s.hasOral ? s.oralAvg.toFixed(1)+"%" : "-"}</span></div>
            {s.absent > 0 && <div className="text-xs text-amber-700 mt-1">{ur ? "غیر حاضر/رخصت" : "Absent/Leave"}: {s.absent}</div>}
            <Link href={s.examId ? `/results?examId=${s.examId}&locked=1` : "/results"} className="text-xs text-blue-700 underline mt-2 inline-block">{ur ? "تفصیلی نتائج" : "Detailed Results"}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}