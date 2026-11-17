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
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "NO_SESSION" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: any = { sessionId: session.id };
  if (month) where.month = Number(month);
  if (year) where.year = Number(year);

  const [defaultAmountSettingSession, defaultAmountSettingGlobal, enrolls, fees] = await Promise.all([
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: session.id }, select: { value: true } }),
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: null }, select: { value: true } }),
    prisma.studentEnrollment.findMany({ where: { sessionId: session.id, feeExempt: false }, select: { studentId: true, monthlyFee: true, student: { select: { admissionNo: true, nameEn: true } } } }),
    prisma.feePayment.findMany({ where, select: { studentId: true, month: true, year: true, amount: true, paidAmount: true, isPaid: true, isLate: true, paidAt: true } }),
  ]);
  const defaultAmount = Number((defaultAmountSettingSession || defaultAmountSettingGlobal)?.value || 0);
  const feeMap = new Map(fees.map((f: any) => [`${f.studentId}:${f.year}:${f.month}`, f]));

  const rows: any[] = [];
  if (month && year) {
    const m = Number(month), y = Number(year);
    for (const en of enrolls as any[]) {
      const f = feeMap.get(`${en.studentId}:${y}:${m}`) as any;
      const dueAmt = f ? Number(f.amount || 0) : (en.monthlyFee != null ? Number(en.monthlyFee) : defaultAmount);
      let paidAmt = f ? Number(f.paidAmount ?? 0) : 0;
      if (f?.isPaid && paidAmt <= 0) paidAmt = Number(f.amount || 0);
      const balance = Math.max(0, dueAmt - paidAmt);
      const status = f?.isPaid || (dueAmt>0 && paidAmt>=dueAmt) ? (f?.isLate ? "Late" : "Paid") : (paidAmt>0 ? "Partial" : "Unpaid");
      rows.push([en.student.admissionNo, en.student.nameEn, session.name, m, y, dueAmt, paidAmt, balance, status, f?.paidAt ? new Date(f.paidAt).toISOString().slice(0,10) : ""]);
    }
  } else {
    // export all fee records in session
    for (const f of fees as any[]) {
      const en = (enrolls as any[]).find(e => e.studentId === f.studentId);
      const paidAmt = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? Number(f.amount || 0) : 0);
      const dueAmt = Number(f.amount || 0);
      const balance = Math.max(0, dueAmt - paidAmt);
      const status = f.isPaid || (dueAmt>0 && paidAmt>=dueAmt) ? (f.isLate ? "Late" : "Paid") : (paidAmt>0 ? "Partial" : "Unpaid");
      rows.push([en?.student?.admissionNo || "", en?.student?.nameEn || "", session.name, f.month, f.year, dueAmt, paidAmt, balance, status, f.paidAt ? new Date(f.paidAt).toISOString().slice(0,10) : ""]);
    }
  }

  const header = ["Admission No","Name","Session","Month","Year","Due","Paid","Balance","Status","Paid Date"];
  const csv = "\uFEFF" + [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  const suffix = month && year ? `-${year}-${month}` : "-all";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fees-${session.name}${suffix}.csv"`,
    },
  });
}
