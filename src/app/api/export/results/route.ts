import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "ACCOUNTANT")) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "NO_SESSION" }, { status: 400 });

  const [results, enrolls] = await Promise.all([
    prisma.result.findMany({
      where: { exam: { sessionId: session.id } },
      select: { studentId: true, totalObtained: true, totalMarks: true, percentage: true, grade: true, status: true, position: true, student: { select: { admissionNo: true, nameEn: true } }, exam: { select: { name: true, stage: true } } },
      orderBy: [{ exam: { stage: "asc" } }, { position: "asc" }],
    }),
    prisma.studentEnrollment.findMany({ where: { sessionId: session.id }, select: { studentId: true, rollNo: true } })
  ]);
  const rollMap = new Map(enrolls.map(e => [e.studentId, e.rollNo]));

  const header = ["Session","Exam","Stage","Admission No","Roll No","Name","Obtained","Total","Percentage","Grade","Status","Position"];
  const rows = results.map((r: any) => [
    session.name, r.exam?.name, r.exam?.stage ?? "", r.student?.admissionNo, rollMap.get(r.studentId) ?? "", r.student?.nameEn,
    r.totalObtained ?? "", r.totalMarks ?? "", r.percentage != null ? Number(r.percentage).toFixed(2) : "", r.grade ?? "", r.status ?? "", r.position ?? ""
  ]);
  const csv = "\uFEFF" + [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="results-${session.name}.csv"`,
    },
  });
}
