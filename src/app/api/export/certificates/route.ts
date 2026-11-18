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

  const header = ["Session", "Serial No", "Admission No", "Name (EN)", "Name (UR)", "Type", "Issue Date", "Details"];
  const rows = certs.map(c => [
    c.session?.name || session.name,
    c.serialNo || "",
    c.student?.admissionNo || "",
    c.student?.nameEn || "",
    c.student?.nameUr || "",
    c.type === "ANNUAL" ? "Annual" : "Nazra Completion",
    c.issueDate ? new Date(c.issueDate).toISOString().slice(0,10) : "",
    c.details || "",
  ]);
  const csv = "\uFEFF" + [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="certificates-${session.name}.csv"`,
    },
  });
}
