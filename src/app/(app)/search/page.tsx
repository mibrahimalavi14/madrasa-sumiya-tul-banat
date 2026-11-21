import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";
import { getLang } from "@/lib/lang";
import { formatDateDMY } from "@/lib/utils";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTANT") redirect("/dashboard");
  const lang = await getLang();
  const ur = lang === "ur";
  const session = await getCurrentSession();
  const q = (await searchParams).q?.trim() || "";
  if (!q) {
    return (
      <div className="space-y-4 theme-dashboard">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6">
          <h1 className="text-2xl font-bold text-emerald-900">{ur ? "گلوبل تلاش" : "Global Search"}</h1>
          <p className="text-sm text-gray-600 mt-2">{ur ? "اوپر سرچ بار میں طالبہ، رسید، امتحان یا سرٹیفکیٹ تلاش کریں۔" : "Use the top search bar to find students, receipts, exams, or certificates."}</p>
        </div>
      </div>
    );
  }

  const receiptIdPart = q.toUpperCase().startsWith("RCP-") ? q.slice(4).trim().toLowerCase() : "";
  const [students, exams, certs, fees] = await Promise.all([
    prisma.student.findMany({
      where: {
        OR: [
          { admissionNo: { contains: q, mode: "insensitive" } },
          { nameEn: { contains: q, mode: "insensitive" } },
          { nameUr: { contains: q, mode: "insensitive" } },
          { fatherName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { applicationNo: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, admissionNo: true, nameEn: true, nameUr: true, fatherName: true, status: true, admissionClass: true },
      take: 10,
      orderBy: { admissionNo: "asc" },
    }),
    session ? prisma.exam.findMany({
      where: { sessionId: session.id, OR: [{ name: { contains: q, mode: "insensitive" } }, { stageLabel: { contains: q, mode: "insensitive" } }] },
      select: { id: true, name: true, stage: true, examDate: true },
      take: 10,
      orderBy: [{ stage: "asc" }],
    }) : Promise.resolve([] as any[]),
    session ? prisma.certificate.findMany({
      where: {
        sessionId: session.id,
        OR: [
          { serialNo: { contains: q, mode: "insensitive" } },
          { student: { admissionNo: { contains: q, mode: "insensitive" } } },
          { student: { nameEn: { contains: q, mode: "insensitive" } } },
          { student: { nameUr: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, serialNo: true, type: true, issueDate: true, student: { select: { admissionNo: true, nameEn: true } } },
      take: 10,
      orderBy: { createdAt: "desc" },
    }) : Promise.resolve([] as any[]),
    session ? prisma.feePayment.findMany({
      where: {
        sessionId: session.id,
        OR: [
          ...(receiptIdPart ? [{ id: { contains: receiptIdPart, mode: "insensitive" as const } }] : []),
          { student: { admissionNo: { contains: q, mode: "insensitive" } } },
          { student: { nameEn: { contains: q, mode: "insensitive" } } },
          { student: { nameUr: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, month: true, year: true, amount: true, paidAmount: true, isPaid: true, isLate: true, student: { select: { admissionNo: true, nameEn: true } } },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }) : Promise.resolve([] as any[]),
  ]);

  const total = students.length + exams.length + certs.length + fees.length;
  return (
    <div className="space-y-5 theme-dashboard">
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h1 className="text-2xl font-bold text-emerald-900">{ur ? "تلاش کے نتائج" : "Search Results"}</h1>
        <p className="text-sm text-gray-600 mt-1">{ur ? `تلاش: "${q}" — ${total} نتیجہ` : `Query: "${q}" — ${total} result(s)`}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-emerald-900 mb-3">{ur ? "طلبہ" : "Students"} ({students.length})</h2>
          <ul className="divide-y text-sm">
            {students.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-2">
                <div><div className="font-medium">{s.admissionNo} - {s.nameEn}</div><div className="text-xs text-gray-500">{s.fatherName || "-"} • {s.admissionClass || "-"} • {s.status}</div></div>
                <Link href={`/students/${s.id}`} className="text-emerald-700 underline shrink-0">{ur ? "کھولیں" : "Open"}</Link>
              </li>
            ))}
            {students.length === 0 && <li className="py-2 text-gray-500">{ur ? "کوئی طالب علم نہیں ملا۔" : "No students found."}</li>}
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-emerald-900 mb-3">{ur ? "فیس / رسیدیں" : "Fees / Receipts"} ({fees.length})</h2>
          <ul className="divide-y text-sm">
            {fees.map((f: any) => {
              const due = Number(f.amount || 0); const paid = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? due : 0);
              const rcp = `RCP-${String(f.id).slice(-8).toUpperCase()}`;
              return (
                <li key={f.id} className="py-2 flex items-center justify-between gap-2">
                  <div><div className="font-medium">{f.student?.admissionNo} - {f.student?.nameEn}</div><div className="text-xs text-gray-500">{rcp} • {f.month}/{f.year} • Rs {paid}/{due}</div></div>
                  <Link href={`/fees/receipt/${f.id}`} className="text-emerald-700 underline shrink-0">{ur ? "رسید" : "Receipt"}</Link>
                </li>
              );
            })}
            {fees.length === 0 && <li className="py-2 text-gray-500">{ur ? "کوئی فیس ریکارڈ نہیں ملا۔" : "No fee records found."}</li>}
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-emerald-900 mb-3">{ur ? "امتحانات" : "Exams"} ({exams.length})</h2>
          <ul className="divide-y text-sm">
            {exams.map((e: any) => (
              <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                <div><div className="font-medium">{e.name}</div><div className="text-xs text-gray-500">{ur ? "مرحلہ" : "Stage"} {e.stage ?? "-"} • {formatDateDMY(e.examDate)}</div></div>
                <Link href={`/examination/${e.id}`} className="text-emerald-700 underline shrink-0">{ur ? "کھولیں" : "Open"}</Link>
              </li>
            ))}
            {exams.length === 0 && <li className="py-2 text-gray-500">{ur ? "کوئی امتحان نہیں ملا۔" : "No exams found."}</li>}
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-emerald-900 mb-3">{ur ? "سرٹیفکیٹس" : "Certificates"} ({certs.length})</h2>
          <ul className="divide-y text-sm">
            {certs.map((c: any) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-2">
                <div><div className="font-medium">{c.student?.admissionNo} - {c.student?.nameEn}</div><div className="text-xs text-gray-500">{c.serialNo || "-"} • {c.type} • {formatDateDMY(c.issueDate)}</div></div>
                <Link href={`/certificates/${c.id}/print`} className="text-emerald-700 underline shrink-0">{ur ? "پرنٹ" : "Print"}</Link>
              </li>
            ))}
            {certs.length === 0 && <li className="py-2 text-gray-500">{ur ? "کوئی سرٹیفکیٹ نہیں ملا۔" : "No certificates found."}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}