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
  const q = (searchParams.get("q") || "").trim();
  const typeFilter = searchParams.get("type");
  const colsParam = [...searchParams.getAll("columns"), ...(searchParams.get("columns") || "").split(",")].map(s => s.trim()).filter(Boolean);

  const where: any = { sessionId: session.id };
  if (typeFilter === "ANNUAL" || typeFilter === "NAZRA_COMPLETION") where.type = typeFilter;
  if (q) {
    where.OR = [
      { serialNo: { contains: q, mode: "insensitive" } },
      { student: { admissionNo: { contains: q, mode: "insensitive" } } },
      { student: { nameEn: { contains: q, mode: "insensitive" } } },
      { student: { nameUr: { contains: q, mode: "insensitive" } } },
    ];
  }

  const certs = await prisma.certificate.findMany({
    where,
    include: { student: { select: { admissionNo: true, nameEn: true, nameUr: true } }, session: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const allCols: { key: string; label: string; get: (c: any) => any }[] = [
    { key: "session", label: "Session", get: c => c.session?.name || session.name },
    { key: "serialNo", label: "Serial No", get: c => c.serialNo || "" },
    { key: "admissionNo", label: "Admission No", get: c => c.student?.admissionNo || "" },
    { key: "nameEn", label: "Name (EN)", get: c => c.student?.nameEn || "" },
    { key: "nameUr", label: "Name (UR)", get: c => c.student?.nameUr || "" },
    { key: "type", label: "Type", get: c => c.type === "ANNUAL" ? "Annual" : "Nazra Completion" },
    { key: "issueDate", label: "Issue Date", get: c => c.issueDate ? new Date(c.issueDate).toISOString().slice(0,10) : "" },
    { key: "details", label: "Details", get: c => c.details || "" },
  ];
  const cols = colsParam.length ? allCols.filter(c => colsParam.includes(c.key)) : allCols;
  const useCols = cols.length ? cols : allCols;
  const header = useCols.map(c => c.label);
  const rows = certs.map(c => useCols.map(col => col.get(c)));
  const csv = "\uFEFF" + [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="certificates-${session.name}.csv"`,
    },
  });
}
