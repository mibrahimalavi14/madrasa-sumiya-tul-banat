import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "ACCOUNTANT")) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "NO_SESSION" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const colsParam = [...searchParams.getAll("columns"), ...(searchParams.get("columns") || "").split(",")].map(s => s.trim()).filter(Boolean);

  const [results, enrolls] = await Promise.all([
    prisma.result.findMany({
      where: { exam: { sessionId: session.id } },
      select: { studentId: true, totalObtained: true, totalMarks: true, percentage: true, grade: true, status: true, position: true, student: { select: { admissionNo: true, nameEn: true } }, exam: { select: { name: true, stage: true } } },
      orderBy: [{ exam: { stage: "asc" } }, { position: "asc" }],
    }),
    prisma.studentEnrollment.findMany({ where: { sessionId: session.id }, select: { studentId: true, rollNo: true } })
  ]);
  const rollMap = new Map(enrolls.map(e => [e.studentId, e.rollNo]));

  const allCols: { key: string; label: string; get: (r: any) => any }[] = [
    { key: "session", label: "Session", get: () => session.name },
    { key: "exam", label: "Exam", get: r => r.exam?.name },
    { key: "stage", label: "Stage", get: r => r.exam?.stage ?? "" },
    { key: "admissionNo", label: "Admission No", get: r => r.student?.admissionNo },
    { key: "rollNo", label: "Roll No", get: r => rollMap.get(r.studentId) ?? "" },
    { key: "name", label: "Name", get: r => r.student?.nameEn },
    { key: "obtained", label: "Obtained", get: r => r.totalObtained ?? "" },
    { key: "total", label: "Total", get: r => r.totalMarks ?? "" },
    { key: "percentage", label: "Percentage", get: r => r.percentage != null ? Number(r.percentage).toFixed(2) : "" },
    { key: "grade", label: "Grade", get: r => r.grade ?? "" },
    { key: "status", label: "Status", get: r => r.status ?? "" },
    { key: "position", label: "Position", get: r => r.position ?? "" },
  ];
  const cols = colsParam.length ? allCols.filter(c => colsParam.includes(c.key)) : allCols;
  const useCols = cols.length ? cols : allCols;
  const header = useCols.map(c => c.label);
  const rows = results.map((r: any) => useCols.map(c => c.get(r)));
  const csv = "\uFEFF" + [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="results-${session.name}.csv"`,
    },
  });
}
