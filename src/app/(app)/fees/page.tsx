import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function upsertFee(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session) throw new Error("NO_SESSION");
  const studentId = String(formData.get("studentId"));
  const month = Number(formData.get("month")); const year = Number(formData.get("year"));
  const amount = Number(formData.get("amount")||0);
  const markPaid = formData.get("markPaid") === "on";
  const paidAtStr = String(formData.get("paidAt")||"");
  const paidAt = paidAtStr ? new Date(paidAtStr) : (markPaid ? new Date() : null);
  let isLate = false;
  if (paidAt) isLate = paidAt.getDate() > 7;
  await prisma.feePayment.upsert({
    where: { sessionId_studentId_month_year: { sessionId: session.id, studentId, month, year } },
    update: { amount, isPaid: markPaid, paidAt: markPaid ? paidAt : null, isLate: markPaid ? isLate : false },
    create: { sessionId: session.id, studentId, month, year, amount, isPaid: markPaid, paidAt: markPaid ? paidAt : null, isLate: markPaid ? isLate : false },
  });
  revalidatePath("/fees");
}

async function saveStudentFee(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session) throw new Error("NO_SESSION");
  const studentId = String(formData.get("studentId"));
  const raw = String(formData.get("studentMonthlyFee") ?? "").trim();
  const monthlyFee = raw === "" ? null : Number(raw);
  await prisma.studentEnrollment.update({
    where: { studentId_sessionId: { studentId, sessionId: session.id } },
    data: { monthlyFee: Number.isFinite(monthlyFee as number) ? monthlyFee : null } as any,
  });
  revalidatePath("/fees");
}

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const tr = t[lang];
  if (user?.role === "PARENT") {
    if (!user.parentStudentId) return <p>{tr.noLinkedStudent}</p>;
    const fees = await prisma.feePayment.findMany({ where: { studentId: user.parentStudentId }, orderBy: [{ year: "desc" }, { month: "desc" }] });
    return <div><h1 className="text-2xl font-bold text-emerald-900 mb-4">{tr.fees}</h1><FeeTableRead fees={fees} tr={tr} /></div>;
  }
  if (!session) return <p>{lang==="ur" ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select active session first."}</p>;
  const sp = await searchParams;
  const now = new Date();
  const month = Number(sp.month || (now.getMonth()+1)); const year = Number(sp.year || now.getFullYear());
  const defaultAmountSetting = await prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: session.id } }) || await prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: null } });
  const defaultAmount = Number(defaultAmountSetting?.value || 0);
  const enrolls = await prisma.studentEnrollment.findMany({ where: { sessionId: session.id }, include: { student: true }, orderBy: { student: { nameEn: "asc" } } });
  const fees = await prisma.feePayment.findMany({ where: { sessionId: session.id, month, year } });
  const map = new Map(fees.map(f=>[f.studentId,f]));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-emerald-900">{tr.fees}</h1>
      <form className="bg-white rounded-xl shadow p-4 flex gap-5 items-center no-print flex-wrap border border-emerald-100/80">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">{tr.month}</label>
          <input name="month" type="number" min={1} max={12} defaultValue={month} className="border border-emerald-200/80 rounded-lg px-3 py-2 w-24"/>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">{tr.year}</label>
          <input name="year" type="number" defaultValue={year} className="border border-emerald-200/80 rounded-lg px-3 py-2 w-28"/>
        </div>
        <button className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg">{tr.load}</button>
        <span className="text-xs text-gray-600">{tr.feesNote} {lang === "ur" ? "ہر بچے کی ماہانہ فیس الگ سے سیٹ کی جا سکتی ہے۔" : "You can set a different monthly fee for each student."}</span>
      </form>
      <div className="bg-white rounded-2xl shadow-sm overflow-auto border border-emerald-100/80">
        <table className="w-full text-sm"><thead><tr><th className="p-3 text-left">{tr.admission}</th><th className="p-3 text-left">{tr.name}</th><th className="p-3 text-left">{lang === "ur" ? "طالب علم کی ماہانہ فیس" : "Student Monthly Fee"}</th><th className="p-3 text-left">{tr.amount}</th><th className="p-3 text-center">{tr.paid}</th><th className="p-3 text-left">{tr.paidDate}</th><th className="p-3 text-center">{tr.status}</th><th className="p-3 text-center">{tr.action}</th></tr></thead>
        <tbody>
          {enrolls.map(en => { 
            const f = map.get(en.studentId); 
            const studentFee = (en as any).monthlyFee;
            const effectiveDefault = (studentFee != null ? Number(studentFee) : defaultAmount);
            const status = f?.isPaid ? (f.isLate?tr.late:tr.paid) : tr.unpaid; 
            const formId = `fee-${en.studentId}`;
            const sFormId = `sfee-${en.studentId}`;
            return (
              <tr key={en.id} className="align-middle">
                <td className="p-3">
                  {en.student.admissionNo}
                  <form id={formId} action={upsertFee}>
                    <input type="hidden" name="studentId" value={en.studentId}/>
                    <input type="hidden" name="month" value={month}/>
                    <input type="hidden" name="year" value={year}/>
                  </form>
                  <form id={sFormId} action={saveStudentFee}>
                    <input type="hidden" name="studentId" value={en.studentId}/>
                  </form>
                </td>
                <td className="p-3 font-medium">{en.student.nameEn}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <input form={sFormId} name="studentMonthlyFee" type="number" step="1" defaultValue={studentFee ?? ""} placeholder={String(defaultAmount)} className="border border-emerald-200/80 rounded-lg px-3 py-2 w-28" />
                    <button form={sFormId} className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-xs">{lang === "ur" ? "سیٹ" : "Set"}</button>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{lang === "ur" ? "خالی = ڈیفالٹ فیس" : "Empty = default fee"}</div>
                </td>
                <td className="p-3">
                  <input form={formId} name="amount" type="number" step="1" defaultValue={f?.amount ?? effectiveDefault} className="border border-emerald-200/80 rounded-lg px-3 py-2 w-28" />
                </td>
                <td className="p-3 text-center">
                  <label className="inline-flex items-center gap-2 text-sm justify-center">
                    <input form={formId} type="checkbox" name="markPaid" defaultChecked={f?.isPaid||false}/> {tr.paid}
                  </label>
                </td>
                <td className="p-3">
                  <input form={formId} name="paidAt" type="date" defaultValue={f?.paidAt ? f.paidAt.toISOString().slice(0,10) : ""} className="border border-emerald-200/80 rounded-lg px-3 py-2"/>
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${status===tr.paid?"bg-emerald-100 text-emerald-800":status===tr.late?"bg-amber-100 text-amber-800":"bg-red-100 text-red-800"}`}>{status}{f?.isPaid?" ✓":""}</span>
                </td>
                <td className="p-3 text-center">
                  <button form={formId} className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2 rounded-lg">{tr.save}</button>
                </td>
              </tr>
            );
          })}
          {enrolls.length===0 && <tr><td colSpan={8} className="p-4 text-center text-gray-500">{tr.noEnrolledStudents}</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}

function FeeTableRead({ fees, tr }: { fees: any[]; tr: any }) {
  return <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-3">{tr.month}/{tr.year}</th><th className="p-3">{tr.amount}</th><th className="p-3">{tr.status}</th><th className="p-3">{tr.paidDate}</th></tr></thead><tbody>{fees.map(f=>(<tr key={f.id}><td className="p-3 text-center">{f.month}/{f.year}</td><td className="p-3 text-center">Rs {f.amount}</td><td className="p-3 text-center">{f.isPaid?(f.isLate?tr.late:`${tr.paid} ✓`):tr.unpaid}</td><td className="p-3 text-center">{f.paidAt?.toISOString().slice(0,10)||"-"}</td></tr>))}{fees.length===0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">{tr.noFeeRecords}</td></tr>}</tbody></table></div>;
}
