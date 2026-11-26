import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { formatDateDMY } from "@/lib/utils";

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
      select: { studentId: true, percentage: true, grade: true, status: true, totalObtained: true, totalMarks: true, writtenObtained: true, writtenTotal: true, oralObtained: true, oralTotal: true, remarks: true, position: true, student: { select: { id: true, admissionNo: true, nameEn: true, nameUr: true } }, exam: { select: { stage: true } } },
    }),
  ]);

  const examNameUr: Record<number, string> = { 1: "ابتدائی تحریری امتحان", 2: "ششماہی امتحان", 3: "سہ ماہی امتحان", 4: "سالانہ امتحان" };
  const stages = [1, 2, 3].map((stage) => {
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
    const topHolders = rows
      .filter((r: any) => r.position != null)
      .sort((a: any, b: any) => Number(a.position) - Number(b.position))
      .slice(0, 3)
      .map((r: any) => ({ position: r.position, name: r.student?.nameEn || "-", admissionNo: r.student?.admissionNo || "-", percentage: r.percentage }));
    const studentCards = [...rows]
      .sort((a: any, b: any) => String(a.student?.admissionNo || "").localeCompare(String(b.student?.admissionNo || ""), undefined, { numeric: true }))
      .map((r: any) => ({
        studentId: r.studentId || r.student?.id,
        admissionNo: r.student?.admissionNo || "-",
        nameEn: r.student?.nameEn || "-",
        nameUr: r.student?.nameUr || "",
        percentage: r.percentage,
        grade: r.grade || "-",
        status: r.status || "-",
        position: r.position ?? null,
      }));
    return {
      stage,
      examId: exam?.id || null,
      name: ur ? (examNameUr[stage] || exam?.name || `Stage ${stage}`) : (exam?.name || `Stage ${stage}`),
      examDate: exam?.examDate,
      selected: exam?._count?.students ?? 0,
      saved: exam?._count?.results ?? total,
      total, pass, fail, absent, avg, writtenAvg, oralAvg, hasWritten: writtenRows.length > 0, hasOral: oralRows.length > 0,
      topHolders,
      studentCards,
    };
  });

  return (
    <div className="space-y-5 theme-results">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">{ur ? "مرحلہ وار امتحانی کارکردگی" : "Stage-wise Exam Performance"}</h1>
        <p className="text-sm text-blue-100 mt-1">{ur ? "پہلے تین امتحانی مراحل کی کارکردگی کا خلاصہ (سالانہ نتیجہ الگ سیکشن میں)" : "Performance summary for the first three stages (Annual Result is in its own section)"}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-blue-50 text-blue-950"><tr>
            <th className="p-2 text-center">{ur ? "مرحلہ" : "Stage"}</th>
            <th className="p-2 text-center">{ur ? "امتحان" : "Exam"}</th>
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
          <div key={s.stage} className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{ur ? "مرحلہ" : "Stage"} {s.stage}</div>
              <div className="text-[11px] text-gray-500">{formatDateDMY(s.examDate)}</div>
            </div>
            <div className={`font-semibold text-blue-950 mt-2 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>{s.name}</div>
            <div className="mt-3 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full" style={{ width: `${Math.min(100, s.avg)}%` }} /></div>
            <div className="flex justify-between text-xs text-gray-600 mt-2"><span>{ur ? "اوسط" : "Avg"}: {s.total ? s.avg.toFixed(1) : "-"}%</span><span>{ur ? "پاس" : "Pass"}: {s.total ? s.pass : 0}/{s.total}</span></div>
            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>{ur ? "تحریری" : "Written"}: {s.hasWritten ? s.writtenAvg.toFixed(1)+"%" : "-"}</span><span>{ur ? "زبانی" : "Oral"}: {s.hasOral ? s.oralAvg.toFixed(1)+"%" : "-"}</span></div>
            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>{ur ? "منتخب" : "Selected"}: {s.selected}</span><span className={s.absent ? "text-amber-700" : ""}>{ur ? "غ/رخصت" : "A/L"}: {s.absent}</span></div>
            <div className="mt-3 border-t border-blue-100 pt-3">
              <div className="text-xs font-semibold text-blue-900 mb-2">{ur ? "ٹاپ پوزیشن ہولڈرز" : "Top Position Holders"}</div>
              {s.topHolders.length > 0 ? (
                <ul className="space-y-1.5">
                  {s.topHolders.map((h: any) => (
                    <li key={h.position} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold mr-1">{h.position}</span>{h.admissionNo} - {h.name}</span>
                      <span className="text-gray-500 shrink-0">{Number(h.percentage || 0).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-gray-400">{ur ? "ابھی پوزیشن دستیاب نہیں" : "No positions yet"}</p>}
            </div>
            <Link href={s.examId ? `/results?examId=${s.examId}&locked=1` : "/results"} className="mt-3 inline-flex items-center justify-center w-full text-sm bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg font-medium">{ur ? "نتیجہ دیکھیں" : "View Result"}</Link>
          </div>
        ))}
      </div>

      {stages.map((s) => (
        <div key={`cards-${s.stage}`} className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-auto">
          <div className="px-4 py-3 border-b border-blue-100 flex items-center justify-between gap-2 flex-wrap">
            <h2 className={`font-semibold text-blue-950 ${ur ? "font-urdu" : ""}`} dir={ur ? "rtl" : "ltr"}>
              {ur ? `مرحلہ ${s.stage} — طلبہ رزلٹ کارڈز` : `Stage ${s.stage} — Student Result Cards`}
              <span className="text-sm font-normal text-gray-500 ml-2">({s.name})</span>
            </h2>
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">{s.studentCards.length}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-blue-950">
              <tr>
                <th className="p-2 text-center w-14">{ur ? "نمبر شمار" : "S.No"}</th>
                <th className="p-2 text-left">{ur ? "داخلہ نمبر" : "Admission No"}</th>
                <th className="p-2 text-left">{ur ? "نام" : "Name"}</th>
                <th className="p-2 text-center">{ur ? "فیصد" : "%"}</th>
                <th className="p-2 text-center">{ur ? "گریڈ" : "Grade"}</th>
                <th className="p-2 text-center">{ur ? "حیثیت" : "Status"}</th>
                <th className="p-2 text-center">{ur ? "پوزیشن" : "Position"}</th>
                <th className="p-2 text-center">{ur ? "رزلٹ کارڈ" : "Result Card"}</th>
              </tr>
            </thead>
            <tbody>
              {s.studentCards.map((st: any, i: number) => (
                <tr key={st.studentId} className="border-t hover:bg-gray-50/70">
                  <td className="p-2 text-center text-gray-600">{i + 1}</td>
                  <td className="p-2 font-medium">{st.admissionNo}</td>
                  <td className="p-2">{st.nameEn}{st.nameUr ? <span className="font-urdu text-gray-700"> / {st.nameUr}</span> : ""}</td>
                  <td className="p-2 text-center">{st.percentage != null ? Number(st.percentage).toFixed(2) : "-"}</td>
                  <td className="p-2 text-center font-semibold">{st.grade}</td>
                  <td className={`p-2 text-center font-medium ${st.status === "Pass" ? "text-emerald-700" : st.status === "Fail" ? "text-red-700" : ""}`}>{st.status}</td>
                  <td className="p-2 text-center">{st.position ?? "-"}</td>
                  <td className="p-2 text-center">
                    <Link className="inline-flex px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100 text-xs" href={`/results/stage-card/${st.studentId}/${s.stage}`}>
                      {ur ? "پرنٹ" : "Print"}
                    </Link>
                  </td>
                </tr>
              ))}
              {s.studentCards.length === 0 && <tr><td colSpan={8} className="p-5 text-center text-gray-500">{ur ? "اس مرحلے کا کوئی نتیجہ موجود نہیں" : "No results for this stage"}</td></tr>}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}