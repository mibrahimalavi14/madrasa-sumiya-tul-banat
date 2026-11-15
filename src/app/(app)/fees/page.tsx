import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { formatDateDMY, parseDateInput, toDateInputDMY } from "@/lib/utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DateInputDMY from "@/components/DateInputDMY";

async function upsertFee(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  const studentId = String(formData.get("studentId"));
  const month = Number(formData.get("month")); const year = Number(formData.get("year"));
  const amount = Number(formData.get("amount")||0);
  const markPaid = formData.get("markPaid") === "on";
  const paidAtParsed = parseDateInput(formData.get("paidAt"));
  const paidAt = paidAtParsed ? paidAtParsed : (markPaid ? new Date() : null);
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
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  const studentId = String(formData.get("studentId"));
  const raw = String(formData.get("studentMonthlyFee") ?? "").trim();
  const monthlyFee = raw === "" ? null : Number(raw);
  await prisma.studentEnrollment.update({
    where: { studentId_sessionId: { studentId, sessionId: session.id } },
    data: { monthlyFee: Number.isFinite(monthlyFee as number) ? monthlyFee : null } as any,
  });
  revalidatePath("/fees");
}

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string; q?: string }> }) {
  const user = await getAuthUser();
  const session = await getCurrentSession();
  const lang = await getLang();
  const tr = t[lang];
  if (user?.role === "PARENT") {
    if (!user.parentStudentId) return <p>{tr.noLinkedStudent}</p>;
    const sessionNow = await getCurrentSession();
    const [fees, enrollment] = await Promise.all([
      prisma.feePayment.findMany({ where: { studentId: user.parentStudentId }, orderBy: [{ year: "desc" }, { month: "desc" }] }),
      sessionNow ? prisma.studentEnrollment.findUnique({ where: { studentId_sessionId: { studentId: user.parentStudentId, sessionId: sessionNow.id } }, select: { feeExempt: true } }) : Promise.resolve(null),
    ]);
    if ((enrollment as any)?.feeExempt) {
      return <div><h1 className="text-2xl font-bold text-emerald-900 mb-4">{tr.fees}</h1><div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4">{lang === "ur" ? "اس طالب علم کی فیس معاف ہے۔" : "This student is fee exempt."}</div></div>;
    }
    return <div><h1 className="text-2xl font-bold text-emerald-900 mb-4">{tr.fees}</h1><FeeTableRead fees={fees} tr={tr} lang={lang as any} /></div>;
  }
  if (!session) return <p>{lang==="ur" ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select active session first."}</p>;
  const sp = await searchParams;
  const now = new Date();
  const q = sp.q?.trim() || "";

  // Session-bound month/year options (only months/years within this session)
  const sStart = session.startDate ? new Date(session.startDate) : null;
  const sEnd = session.endDate ? new Date(session.endDate) : null;
  const inSessionPeriod = (y: number, m: number) => {
    if (!sStart || !sEnd) return true;
    const startIdx = sStart.getFullYear() * 12 + sStart.getMonth();
    const endIdx = sEnd.getFullYear() * 12 + sEnd.getMonth();
    const curIdx = y * 12 + (m - 1);
    return curIdx >= startIdx && curIdx <= endIdx;
  };
  const yearSet = new Set<number>();
  if (sStart && sEnd) {
    for (let y = sStart.getFullYear(); y <= sEnd.getFullYear(); y++) yearSet.add(y);
  } else {
    yearSet.add(now.getFullYear());
  }
  const yearOptions = [...yearSet].sort((a,b)=>a-b);

  let year = Number(sp.year || "");
  if (!Number.isFinite(year) || !yearOptions.includes(year)) {
    const nowY = now.getFullYear();
    year = yearOptions.includes(nowY) ? nowY : yearOptions[0];
  }
  let month = Number(sp.month || "");
  if (!Number.isFinite(month) || month < 1 || month > 12 || !inSessionPeriod(year, month)) {
    // default to session start month/year if available, else first valid in selected year
    if (sStart && inSessionPeriod(sStart.getFullYear(), sStart.getMonth() + 1)) {
      // but keep selected year if it has valid months? prefer session start
      const prefY = sStart.getFullYear();
      const prefM = sStart.getMonth() + 1;
      if (year === prefY) month = prefM;
      else {
        // find first valid month in selected year
        const found = Array.from({ length: 12 }, (_, i) => i + 1).find(m => inSessionPeriod(year, m));
        if (found) month = found;
        else { year = prefY; month = prefM; }
      }
    } else {
      const found = Array.from({ length: 12 }, (_, i) => i + 1).find(m => inSessionPeriod(year, m));
      month = found || (now.getMonth() + 1);
    }
  }
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1).filter(m => inSessionPeriod(year, m));

  const isInSessionRange = inSessionPeriod(year, month);
  const studentFilter = q ? { OR: [
    { admissionNo: { contains: q, mode: "insensitive" as const } },
    { nameEn: { contains: q, mode: "insensitive" as const } },
    { nameUr: { contains: q, mode: "insensitive" as const } },
  ] } : {};

  const [defaultAmountSettingSession, defaultAmountSettingGlobal, enrollsAllRaw, fees] = await Promise.all([
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: session.id }, select: { value: true } }),
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: null }, select: { value: true } }),
    isInSessionRange ? prisma.studentEnrollment.findMany({
      where: { sessionId: session.id, ...(q ? { student: studentFilter } : {}) },
      select: { id: true, studentId: true, monthlyFee: true, feeExempt: true, student: { select: { id: true, admissionNo: true, nameEn: true } } },
    }) : Promise.resolve([] as any[]),
    isInSessionRange ? prisma.feePayment.findMany({
      where: { sessionId: session.id, month, year },
      select: { studentId: true, amount: true, isPaid: true, isLate: true, paidAt: true },
    }) : Promise.resolve([] as any[]),
  ]);
  const defaultAmount = Number((defaultAmountSettingSession || defaultAmountSettingGlobal)?.value || 0);
  const enrolls = [...enrollsAllRaw]
    .filter((en: any) => !(en as any).feeExempt)
    .sort((a: any, b: any) => {
      const na = parseInt(String(a.student?.admissionNo || "").replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(String(b.student?.admissionNo || "").replace(/\D/g, ""), 10) || 0;
      if (na !== nb) return na - nb;
      return String(a.student?.admissionNo || "").localeCompare(String(b.student?.admissionNo || ""));
    });
  const map = new Map(fees.map((f: any)=>[f.studentId,f]));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-emerald-900">{tr.fees}</h1>
        <div className="text-sm text-gray-600">{lang === "ur" ? `کل: ${enrolls.length}` : `Total: ${enrolls.length}`}</div>
      </div>
      <form className="bg-white rounded-xl shadow p-4 flex gap-4 items-end no-print flex-wrap border border-emerald-100/80">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">{tr.month}</label>
          <select name="month" defaultValue={String(month)} className="border border-emerald-200/80 rounded-md px-2 py-1.5 w-16 text-sm h-9 bg-white">
            {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 !border-t-0 !mt-0 !pt-0">
          <label className="text-sm font-medium">{tr.year}</label>
          <select name="year" defaultValue={String(year)} className="border border-emerald-200/80 rounded-md px-2 py-1.5 w-20 text-sm h-9 bg-white">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center !border-t-0 !mt-0 !pt-0">
          <input name="q" defaultValue={q} placeholder={lang === "ur" ? "داخلہ نمبر / نام تلاش کریں" : "Search Admission No / Name"} className="border border-emerald-200/80 rounded-md px-3 py-1.5 w-64 text-sm h-9"/>
        </div>
        <button className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg">{tr.load}</button>
        {q && <a href={`/fees?month=${month}&year=${year}`} className="text-sm text-emerald-700 underline">{lang === "ur" ? "صاف کریں" : "Clear"}</a>}
        <span className="text-xs text-gray-600 w-full">{tr.feesNote} {lang === "ur" ? "ہر بچے کی ماہانہ فیس الگ سے سیٹ کی جا سکتی ہے۔" : "You can set a different monthly fee for each student."}</span>
      </form>
      <div className="bg-white rounded-2xl shadow-sm overflow-auto border border-emerald-100/80">
        <table className="w-full text-sm"><thead><tr><th className="p-3 text-left">{tr.admission}</th><th className="p-3 text-left">{tr.name}</th><th className="p-3 text-left">{lang === "ur" ? "طالب علم کی ماہانہ فیس" : "Student Monthly Fee"}</th><th className="p-3 text-left">{tr.amount}</th><th className="p-3 text-center">{tr.paid}</th><th className="p-3 text-left">{tr.paidDate}</th><th className="p-3 text-center">{tr.status}</th><th className="p-3 text-center">{tr.action}</th></tr></thead>
        <tbody>
          {enrolls.map(en => { 
            const f = map.get(en.studentId); 
            const exempt = !!(en as any).feeExempt;
            const studentFee = (en as any).monthlyFee;
            const effectiveDefault = exempt ? 0 : (studentFee != null ? Number(studentFee) : defaultAmount);
            const status = exempt ? (lang === "ur" ? "فیس معاف" : "Exempt") : (f?.isPaid ? (f.isLate?tr.late:tr.paid) : tr.unpaid); 
            const formId = `fee-${en.studentId}`;
            const sFormId = `sfee-${en.studentId}`;
            return (
              <tr key={en.id} className={`align-middle ${exempt ? "bg-amber-50/30" : ""}`}>
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
                <td className="p-3 font-medium">
                  <div>{en.student.nameEn}</div>
                  {exempt && <div className="text-[11px] text-amber-700 mt-0.5">{lang === "ur" ? "اس طالب علم سے فیس نہیں لی جاتی" : "No fee collected from this student"}</div>}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <input form={sFormId} name="studentMonthlyFee" type="number" step="1" defaultValue={exempt ? 0 : (studentFee ?? "")} placeholder={String(defaultAmount)} disabled={exempt} className="border border-emerald-200/80 rounded-lg px-3 py-2 w-28 disabled:bg-gray-100 disabled:text-gray-500" />
                    <button form={sFormId} disabled={exempt} className="bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-600 text-white px-3 py-2 rounded-lg text-xs">{lang === "ur" ? "سیٹ" : "Set"}</button>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{exempt ? (lang === "ur" ? "فیس معاف" : "Fee exempt") : (lang === "ur" ? "خالی = ڈیفالٹ فیس" : "Empty = default fee")}</div>
                </td>
                <td className="p-3">
                  <input form={formId} name="amount" type="number" step="1" defaultValue={f?.amount ?? effectiveDefault} disabled={exempt} className="border border-emerald-200/80 rounded-lg px-3 py-2 w-28 disabled:bg-gray-100 disabled:text-gray-500" />
                </td>
                <td className="p-3 text-center">
                  <label className={`inline-flex items-center gap-2 text-sm justify-center ${exempt ? "text-gray-400" : ""}`}>
                    <input form={formId} type="checkbox" name="markPaid" defaultChecked={exempt ? false : (f?.isPaid||false)} disabled={exempt}/> {tr.paid}
                  </label>
                </td>
                <td className="p-3">
                  <div className={exempt ? "opacity-50 pointer-events-none" : ""}>
                    <DateInputDMY form={formId} name="paidAt" defaultValue={toDateInputDMY(f?.paidAt)} inputClassName="border border-emerald-200/80 rounded-lg px-3 py-2" />
                  </div>
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${exempt ? "bg-amber-100 text-amber-800" : status===tr.paid?"bg-emerald-100 text-emerald-800":status===tr.late?"bg-amber-100 text-amber-800":"bg-red-100 text-red-800"}`}>{status}{!exempt && f?.isPaid?" ✓":""}</span>
                </td>
                <td className="p-3 text-center">
                  <button form={formId} className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2 rounded-lg">{tr.save}</button>
                </td>
              </tr>
            );
          })}
          {enrolls.length===0 && <tr><td colSpan={8} className="p-4 text-center text-gray-500">{lang==="ur" ? "فیس کے لیے کوئی طالب علم دستیاب نہیں (یا سب فیس معاف ہیں)" : "No students available for fees (or all are fee exempt)"}</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}

function FeeTableRead({ fees, tr, exempt = false, lang = "en" }: { fees: any[]; tr: any; exempt?: boolean; lang?: "en" | "ur" }) {
  return <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 overflow-auto">
    {exempt && <div className="px-4 pt-4"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{lang === "ur" ? "فیس معاف" : "Fee Exempt"}</span></div>}
    <table className="w-full text-sm"><thead><tr><th className="p-3">{tr.month}/{tr.year}</th><th className="p-3">{tr.amount}</th><th className="p-3">{tr.status}</th><th className="p-3">{tr.paidDate}</th></tr></thead><tbody>{fees.map(f=>(<tr key={f.id}><td className="p-3 text-center">{f.month}/{f.year}</td><td className="p-3 text-center">Rs {f.amount}</td><td className="p-3 text-center">{exempt ? (lang === "ur" ? "فیس معاف" : "Exempt") : (f.isPaid?(f.isLate?tr.late:`${tr.paid} ✓`):tr.unpaid)}</td><td className="p-3 text-center">{formatDateDMY(f.paidAt)}</td></tr>))}{fees.length===0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">{tr.noFeeRecords}</td></tr>}</tbody></table>
  </div>;
}
