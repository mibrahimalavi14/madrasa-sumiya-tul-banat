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

  const enrolls = await prisma.studentEnrollment.findMany({
    where: { sessionId: session.id },
    select: {
      rollNo: true, monthlyFee: true, feeExempt: true,
      student: { select: { admissionNo: true, applicationNo: true, nameEn: true, nameUr: true, fatherName: true, motherName: true, admissionClass: true, gender: true, dob: true, age: true, phone: true, address: true, status: true, admissionDate: true } }
    },
    orderBy: { student: { admissionNo: "asc" } }
  });

  const allCols: { key: string; label: string; get: (e: any) => any }[] = [
    { key: "admissionNo", label: "Admission No", get: e => e.student.admissionNo },
    { key: "applicationNo", label: "Application No", get: e => e.student.applicationNo },
    { key: "nameEn", label: "Name (EN)", get: e => e.student.nameEn },
    { key: "nameUr", label: "Name (UR)", get: e => e.student.nameUr },
    { key: "father", label: "Father", get: e => e.student.fatherName },
    { key: "mother", label: "Mother", get: e => e.student.motherName },
    { key: "class", label: "Class", get: e => e.student.admissionClass },
    { key: "gender", label: "Gender", get: e => e.student.gender },
    { key: "dob", label: "DOB", get: e => e.student.dob ? new Date(e.student.dob).toISOString().slice(0,10) : "" },
    { key: "age", label: "Age", get: e => e.student.age },
    { key: "phone", label: "Phone", get: e => e.student.phone },
    { key: "address", label: "Address", get: e => e.student.address },
    { key: "status", label: "Status", get: e => e.student.status },
    { key: "rollNo", label: "Roll No", get: e => e.rollNo },
    { key: "monthlyFee", label: "Monthly Fee", get: e => e.monthlyFee ?? "" },
    { key: "feeExempt", label: "Fee Exempt", get: e => e.feeExempt ? "Yes" : "No" },
    { key: "admissionDate", label: "Admission Date", get: e => e.student.admissionDate ? new Date(e.student.admissionDate).toISOString().slice(0,10) : "" },
    { key: "session", label: "Session", get: () => session.name },
  ];
  const cols = colsParam.length ? allCols.filter(c => colsParam.includes(c.key)) : allCols;
  const useCols = cols.length ? cols : allCols;
  const header = useCols.map(c => c.label);
  const rows = enrolls.map(e => useCols.map(c => c.get(e)));
  const csv = "\uFEFF" + [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${session.name}.csv"`,
    },
  });
}
