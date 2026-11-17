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
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "NO_SESSION" }, { status: 400 });

  const enrolls = await prisma.studentEnrollment.findMany({
    where: { sessionId: session.id },
    select: {
      rollNo: true, monthlyFee: true, feeExempt: true,
      student: { select: { admissionNo: true, applicationNo: true, nameEn: true, nameUr: true, fatherName: true, motherName: true, admissionClass: true, gender: true, dob: true, age: true, phone: true, address: true, status: true, admissionDate: true } }
    },
    orderBy: { student: { admissionNo: "asc" } }
  });

  const header = ["Admission No","Application No","Name (EN)","Name (UR)","Father","Mother","Class","Gender","DOB","Age","Phone","Address","Status","Roll No","Monthly Fee","Fee Exempt","Admission Date","Session"];
  const rows = enrolls.map(e => [
    e.student.admissionNo, e.student.applicationNo, e.student.nameEn, e.student.nameUr, e.student.fatherName, e.student.motherName,
    e.student.admissionClass, e.student.gender, e.student.dob ? new Date(e.student.dob).toISOString().slice(0,10) : "", e.student.age,
    e.student.phone, e.student.address, e.student.status, e.rollNo, e.monthlyFee ?? "", e.feeExempt ? "Yes" : "No",
    e.student.admissionDate ? new Date(e.student.admissionDate).toISOString().slice(0,10) : "", session.name
  ]);
  const csv = "\uFEFF" + [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${session.name}.csv"`,
    },
  });
}
