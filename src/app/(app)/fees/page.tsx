import { prisma } from "@/lib/prisma";
import { getCurrentSession, hasSessionStarted, inSessionPeriod as sessionPeriodCheck } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { formatDateDMY, parseDateInput, toDateInputDMY } from "@/lib/utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import ExportCsvDetails from "@/components/ExportCsvDetails";
import ScrollToId from "@/components/ScrollToId";
import MonthYearFilter from "@/components/MonthYearFilter";
import DateInputDMY from "@/components/DateInputDMY";
import { logAudit } from "@/lib/audit";

async function upsertFee(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN" && user?.role !== "ACCOUNTANT") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE"); if (!hasSessionStarted(session)) throw new Error("SESSION_NOT_STARTED");
  const studentId = String(formData.get("studentId"));
  const month = Number(formData.get("month")); const year = Number(formData.get("year"));

  // New model: amount = due/fee amount for month, paidAmount = total received so far (supports partial)
  const dueRaw = formData.get("dueAmount") ?? formData.get("amount");
  const dueAmount = Math.max(0, Number(dueRaw || 0));
  let paidAmount = Math.max(0, Number(formData.get("paidAmount") ?? 0));
  const receiveNow = Math.max(0, Number(formData.get("receiveNow") ?? 0));
  if (receiveNow > 0) paidAmount = Math.max(paidAmount, Number(formData.get("existingPaidAmount") || 0) + receiveNow);
  // Backward compat: old "markPaid" checkbox means fully paid
  const markPaid = formData.get("markPaid") === "on";
  if (markPaid && paidAmount <= 0) paidAmount = dueAmount;
  if (paidAmount > dueAmount && dueAmount > 0 && markPaid) paidAmount = dueAmount; // cap if marked fully paid via checkbox intent
  // Allow over/advance within record as fully settled
  const isPaid = dueAmount > 0 ? paidAmount >= dueAmount : paidAmount > 0;

  const paidAtParsed = parseDateInput(formData.get("paidAt"));
  const paidAt = paidAtParsed ? paidAtParsed : (paidAmount > 0 ? new Date() : null);
  let isLate = false;
  if (paidAt) isLate = paidAt.getDate() > 7;

  const feeRow = await prisma.feePayment.upsert({
    where: { sessionId_studentId_month_year: { sessionId: session.id, studentId, month, year } },
    update: { amount: dueAmount, paidAmount, isPaid, paidAt: paidAmount > 0 ? paidAt : null, isLate: isPaid ? isLate : false },
    create: { sessionId: session.id, studentId, month, year, amount: dueAmount, paidAmount, isPaid, paidAt: paidAmount > 0 ? paidAt : null, isLate: isPaid ? isLate : false },
  });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "FEE_UPSERT", entityType: "FeePayment", entityId: feeRow.id, details: JSON.stringify({ studentId, month, year, dueAmount, paidAmount, isPaid, sessionId: session.id }) });
  revalidatePath("/fees");
  revalidatePath("/fees/report");
  revalidatePath("/fees/defaulters");
  revalidatePath("/fees/session-report");
  revalidatePath("/fees/arrears");
}

async function saveStudentFee(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN" && user?.role !== "ACCOUNTANT") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession(); if (!session || session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE"); if (!hasSessionStarted(session)) throw new Error("SESSION_NOT_STARTED");
  const studentId = String(formData.get("studentId"));
  const raw = String(formData.get("studentMonthlyFee") ?? "").trim();
  const monthlyFee = raw === "" ? null : Number(raw);
  const enr = await prisma.studentEnrollment.update({
    where: { studentId_sessionId: { studentId, sessionId: session.id } },
    data: { monthlyFee: Number.isFinite(monthlyFee as number) ? monthlyFee : null } as any,
  });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "FEE_STUDENT_MONTHLY_SET", entityType: "StudentEnrollment", entityId: enr.id, details: JSON.stringify({ studentId, sessionId: session.id, monthlyFee: (enr as any).monthlyFee ?? null }) });
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
      prisma.feePayment.findMany({ where: { studentId: user.parentStudentId }, include: { session: { select: { name: true } } }, orderBy: [{ year: "desc" }, { month: "desc" }] }),
      sessionNow ? prisma.studentEnrollment.findUnique({ where: { studentId_sessionId: { studentId: user.parentStudentId, sessionId: sessionNow.id } }, select: { feeExempt: true } }) : Promise.resolve(null),
    ]);
    if ((enrollment as any)?.feeExempt) {
      return <div className="space-y-4 theme-parent"><div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white rounded-2xl p-5 shadow-sm"><h1 className="text-2xl font-bold">{tr.fees}</h1></div><div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4">{lang === "ur" ? "اس طالب علم کی فیس معاف ہے۔" : "This student is fee exempt."}</div></div>;
    }
    return (
      <div className="space-y-4 theme-parent">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
          <h1 className="text-2xl font-bold">{tr.fees}</h1>
          <p className="text-sm text-teal-50 mt-1">{lang === "ur" ? "آپ کے بچے کی فیس کی تفصیلات، رسیدیں اور ادائیگی کی صورتحال" : "Fee details, receipts and payment status for your child"}</p>
        </div>
        <FeeTableRead fees={fees} tr={tr} lang={lang as any} parentView />
      </div>
    );
  }
  if (!session) return <p>{lang==="ur" ? "براہ کرم پہلے فعال سیشن بنائیں/منتخب کریں۔" : "Create/select active session first."}</p>;
  const sessionStarted = hasSessionStarted(session);
  const sp = await searchParams;
  const now = new Date();
  const q = sp.q?.trim() || "";

  // Session-bound month/year options (only months/years within this session)
  const sStart = session.startDate ? new Date(session.startDate) : null;
  const sEnd = session.endDate ? new Date(session.endDate) : null;
  const inSessionPeriod = (y: number, m: number) => sessionPeriodCheck(y, m, session);
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
  const monthOptionsByYear = Object.fromEntries(yearOptions.map(yy => [String(yy), Array.from({ length: 12 }, (_, i) => i + 1).filter(mm => inSessionPeriod(yy, mm))]));

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
      select: { id: true, studentId: true, amount: true, paidAmount: true, isPaid: true, isLate: true, paidAt: true },
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
  const getAmounts = (f: any, en: any) => {
    const due = f ? Number(f.amount || 0) : (Number((en as any).monthlyFee ?? defaultAmount) || 0);
    let paid = f ? Number(f.paidAmount ?? 0) : 0;
    if (f?.isPaid && paid <= 0) paid = Number(f.amount || 0); // compat old records
    return { due, paid, balance: Math.max(0, due - paid) };
  };
  const isFullyPaid = (en: any) => {
    const f = map.get(en.studentId) as any;
    if (!f) return false;
    const { due, paid } = getAmounts(f, en);
    return !!f.isPaid || (due > 0 && paid >= due);
  };
  const paidEnrolls = enrolls.filter((en: any) => isFullyPaid(en));
  const unpaidEnrolls = enrolls.filter((en: any) => !isFullyPaid(en));
  const paidTotalAmount = paidEnrolls.reduce((sum: number, en: any) => sum + getAmounts(map.get(en.studentId) as any, en).paid, 0);
  return (
    <div className="space-y-4 theme-fees">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-emerald-900">{tr.fees}</h1>
        <div className="text-sm text-gray-600 flex gap-3 flex-wrap">
          <span>{lang === "ur" ? `کل: ${enrolls.length}` : `Total: ${enrolls.length}`}</span>
          <span>{lang === "ur" ? `ادا شدہ: ${paidEnrolls.length}` : `Paid: ${paidEnrolls.length}`}</span>
          <span>{lang === "ur" ? `باقی: ${unpaidEnrolls.length}` : `Remaining: ${unpaidEnrolls.length}`}</span>
        </div>
      </div>
      {!sessionStarted && <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">{lang === "ur" ? "سیشن ابھی شروع نہیں ہوا۔ شروع ہونے کی تاریخ سے پہلے فیس کا اندراج/جمع نہیں ہو سکتا، صرف دیکھ سکتے ہیں۔" : "Session has not started yet. Fees cannot be entered/collected before the session start date; viewing is allowed."}</div>}
      <form className="bg-white rounded-xl shadow p-4 flex gap-4 items-end no-print flex-wrap border border-emerald-100/80">
        <MonthYearFilter
          yearOptions={yearOptions}
          monthOptionsByYear={monthOptionsByYear}
          defaultYear={year}
          defaultMonth={month}
          monthLabel={tr.month}
          yearLabel={tr.year}
          className="flex items-center gap-3 flex-wrap"
          selectClassName="border border-emerald-200/80 rounded-md px-2 py-1.5 text-sm h-9 bg-white"
          labelClassName="text-sm font-medium"
        />
        <div className="flex items-center !border-t-0 !mt-0 !pt-0">
          <input name="q" defaultValue={q} placeholder={lang === "ur" ? "داخلہ نمبر / نام تلاش کریں" : "Search Admission No / Name"} className="border border-emerald-200/80 rounded-md px-3 py-1.5 w-64 text-sm h-9"/>
        </div>
        <button type="submit" className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg">{tr.load}</button>
        {q && <Link href={`/fees?month=${month}&year=${year}`} className="text-sm text-emerald-700 underline">{lang === "ur" ? "صاف کریں" : "Clear"}</Link>}
        <span className="text-xs text-gray-600 w-full">{tr.feesNote} {lang === "ur" ? "ہر بچے کی ماہانہ فیس الگ سے سیٹ کی جا سکتی ہے۔" : "You can set a different monthly fee for each student."}</span>
      </form>
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Link href={`/fees/report?month=${month}&year=${year}`} className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium">{lang === "ur" ? "ماہانہ رپورٹ" : "Monthly Report"}</Link>
        <Link href="/fees/session-report" className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg text-sm font-medium">{lang === "ur" ? "سیشن رپورٹ" : "Session Report"}</Link>
        <Link href="/fees/arrears" className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg text-sm font-medium">{lang === "ur" ? "بقایا جات" : "Arrears"}</Link>
        <Link href={`/fees/defaulters?month=${month}&year=${year}`} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">{lang === "ur" ? "باقی فیس کی فہرست" : "Defaulters List"}</Link>
        <Link href={`/fees/vouchers?month=${month}&year=${year}`} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium">{lang === "ur" ? "واؤچرز پرنٹ (سب)" : "Bulk Vouchers"}</Link>
        <ExportCsvDetails className="relative" summaryClassName="list-none cursor-pointer bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium" label={lang === "ur" ? "CSV ایکسپورٹ ▾" : "Export CSV ▾"}>
          <div className="absolute right-0 mt-2 w-64 bg-white text-gray-800 border border-emerald-100 rounded-xl shadow-lg p-3 z-20">
            <form action="/api/export/fees" method="get" className="space-y-2 text-sm">
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="year" value={year} />
              <div className="font-semibold text-emerald-900">{lang==="ur" ? "کالم منتخب کریں" : "Select columns"}</div>
              <div className="grid grid-cols-2 gap-1">
                {[["admissionNo","Admission"],["name","Name"],["month","Month"],["year","Year"],["due","Due"],["paid","Paid"],["balance","Balance"],["status","Status"],["paidAt","Paid Date"]].map(([k,l]) => (
                  <label key={k} className="flex items-center gap-1"><input type="checkbox" name="columns" value={k} /> <span>{l}</span></label>
                ))}
              </div>
              <div className="flex gap-2 pt-1"><button className="bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs">{lang==="ur"?"ایکسپورٹ":"Export"}</button><a href={`/api/export/fees?month=${month}&year=${year}`} className="px-3 py-1.5 rounded-lg text-xs border">{lang==="ur"?"تمام":"All"}</a></div>
            </form>
          </div>
        </ExportCsvDetails>
      </div>
      {(sp.month || sp.year || q) ? <ScrollToId id="fee-list" /> : null}
      <div id="fee-list" className="bg-white rounded-2xl shadow-sm overflow-auto border border-emerald-100/80 scroll-mt-4">
        <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/40 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-emerald-900">{lang === "ur" ? "باقی / جزوی فیس (اس مہینے)" : "Pending / Partial Fees (This Month)"}</h2>
          <span className="text-sm text-gray-600">{lang === "ur" ? `تعداد: ${unpaidEnrolls.length}` : `Count: ${unpaidEnrolls.length}`}</span>
        </div>
        <table className="w-full text-sm"><thead><tr><th className="p-3 text-left">{tr.admission}</th><th className="p-3 text-left">{tr.name}</th><th className="p-3 text-left">{lang === "ur" ? "ماہانہ فیس (سیٹ)" : "Monthly Fee (Set)"}</th><th className="p-3 text-left">{lang === "ur" ? "واجب (Due)" : "Due"}</th><th className="p-3 text-left">{lang === "ur" ? "ادا شدہ (کل)" : "Paid (Total)"}</th><th className="p-3 text-left">{lang === "ur" ? "باقی" : "Balance"}</th><th className="p-3 text-left">{tr.paidDate}</th><th className="p-3 text-center">{tr.status}</th><th className="p-3 text-center">{tr.action}</th><th className="p-3 text-center">{lang === "ur" ? "واؤچر" : "Voucher"}</th></tr></thead>
        <tbody>
          {unpaidEnrolls.map(en => { 
            const f = map.get(en.studentId) as any; 
            const studentFee = (en as any).monthlyFee;
            const { due, paid, balance } = getAmounts(f, en);
            const isPartial = paid > 0 && balance > 0;
            const status = isPartial ? (lang === "ur" ? "جزوی" : "Partial") : tr.unpaid; 
            const formId = `fee-${en.studentId}`;
            const sFormId = `sfee-${en.studentId}`;
            return (
              <tr key={en.id} className={`align-middle ${isPartial ? "bg-amber-50/30" : ""}`}>
                <td className="p-3">
                  {en.student.admissionNo}
                  <form id={formId} action={upsertFee}>
                    <input type="hidden" name="studentId" value={en.studentId}/>
                    <input type="hidden" name="month" value={month}/>
                    <input type="hidden" name="year" value={year}/>
                    <input type="hidden" name="existingPaidAmount" value={paid}/>
                  </form>
                  <form id={sFormId} action={saveStudentFee}>
                    <input type="hidden" name="studentId" value={en.studentId}/>
                  </form>
                </td>
                <td className="p-3 font-medium">
                  <div>{en.student.nameEn}</div>
                  {isPartial && <div className="text-[11px] text-amber-700 mt-0.5">{lang === "ur" ? "جزوی ادائیگی موصول" : "Partial payment received"}</div>}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <input form={sFormId} name="studentMonthlyFee" type="number" step="1" defaultValue={studentFee ?? ""} placeholder={String(defaultAmount)} disabled={!sessionStarted} className="border border-emerald-200/80 rounded-lg px-3 py-2 w-24 disabled:bg-gray-50 disabled:text-gray-500" />
                    <button form={sFormId} disabled={!sessionStarted} className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed">{lang === "ur" ? "سیٹ" : "Set"}</button>
                  </div>
                </td>
                <td className="p-3">
                  <input form={formId} name="dueAmount" type="number" step="1" defaultValue={due} disabled={!sessionStarted} className="border border-emerald-200/80 rounded-lg px-3 py-2 w-24 disabled:bg-gray-50 disabled:text-gray-500" />
                </td>
                <td className="p-3">
                  <input form={formId} name="paidAmount" type="number" step="1" defaultValue={paid} disabled={!sessionStarted} className="border border-emerald-200/80 rounded-lg px-3 py-2 w-24 disabled:bg-gray-50 disabled:text-gray-500" />
                  <div className="text-[11px] text-gray-500 mt-1">{lang === "ur" ? "کل موصولہ" : "Total received"}</div>
                </td>
                <td className="p-3 font-semibold text-amber-700">Rs {balance}</td>
                <td className="p-3">
                  <DateInputDMY form={formId} name="paidAt" defaultValue={toDateInputDMY(f?.paidAt)} disabled={!sessionStarted} inputClassName="border border-emerald-200/80 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500" />
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${isPartial ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>{status}</span>
                </td>
                <td className="p-3 text-center">
                  <button form={formId} disabled={!sessionStarted} className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{tr.save}</button>
                </td>
                <td className="p-3 text-center">
                  <Link href={`/fees/voucher?studentId=${en.studentId}&month=${month}&year=${year}`} className="inline-flex px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 font-medium hover:bg-teal-100">{lang === "ur" ? "واؤچر" : "Voucher"}</Link>
                </td>
              </tr>
            );
          })}
          {unpaidEnrolls.length===0 && <tr><td colSpan={10} className="p-4 text-center text-gray-500">{lang==="ur" ? "اس مہینے کوئی فیس باقی نہیں۔" : "No pending fees for this month."}</td></tr>}
        </tbody></table>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-auto border border-emerald-100/80">
        <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/40 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-emerald-900">{lang === "ur" ? "مکمل جمع شدہ فیس (اس مہینے)" : "Fully Deposited Fees (This Month)"}</h2>
          <div className="text-sm text-gray-600 flex gap-3 flex-wrap">
            <span>{lang === "ur" ? `تعداد: ${paidEnrolls.length}` : `Count: ${paidEnrolls.length}`}</span>
            <span>{lang === "ur" ? `کل رقم: Rs ${paidTotalAmount}` : `Total Amount: Rs ${paidTotalAmount}`}</span>
          </div>
        </div>
        <table className="w-full text-sm"><thead><tr><th className="p-3 text-left">{tr.admission}</th><th className="p-3 text-left">{tr.name}</th><th className="p-3 text-left">{lang === "ur" ? "واجب" : "Due"}</th><th className="p-3 text-left">{lang === "ur" ? "جمع شدہ" : "Deposited"}</th><th className="p-3 text-left">{tr.paidDate}</th><th className="p-3 text-center">{tr.status}</th><th className="p-3 text-center">{lang === "ur" ? "رسید" : "Receipt"}</th><th className="p-3 text-center">{lang === "ur" ? "واؤچر" : "Voucher"}</th></tr></thead>
        <tbody>
          {paidEnrolls.map(en => { 
            const f = map.get(en.studentId) as any; 
            const { due, paid } = getAmounts(f, en);
            const status = f?.isLate ? tr.late : tr.paid; 
            return (
              <tr key={en.id} className="align-middle bg-emerald-50/20">
                <td className="p-3">{en.student.admissionNo}</td>
                <td className="p-3 font-medium">{en.student.nameEn}</td>
                <td className="p-3">Rs {due}</td>
                <td className="p-3 font-semibold">Rs {paid}</td>
                <td className="p-3">{formatDateDMY(f?.paidAt) || "-"}</td>
                <td className="p-3 text-center">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${f?.isLate ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{status} ✓ <span className="ml-1 opacity-80">{lang === "ur" ? "(مقفل)" : "(Locked)"}</span></span>
                </td>
                <td className="p-3 text-center">
                  {f?.id ? <Link href={`/fees/receipt/${f.id}`} className="inline-flex px-3 py-1.5 rounded-lg border border-emerald-200 bg-white text-emerald-800 font-medium hover:bg-emerald-50">{lang === "ur" ? "رسید" : "Receipt"}</Link> : "-"}
                </td>
                <td className="p-3 text-center">
                  <Link href={`/fees/voucher?studentId=${en.studentId}&month=${month}&year=${year}`} className="inline-flex px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 font-medium hover:bg-teal-100">{lang === "ur" ? "واؤچر" : "Voucher"}</Link>
                </td>
              </tr>
            );
          })}
          {paidEnrolls.length===0 && <tr><td colSpan={8} className="p-4 text-center text-gray-500">{lang==="ur" ? "ابھی اس مہینے کسی نے مکمل فیس جمع نہیں کروائی۔" : "No fully deposited fees yet for this month."}</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}

function FeeTableRead({ fees, tr, exempt = false, lang = "en", parentView = false }: { fees: any[]; tr: any; exempt?: boolean; lang?: "en" | "ur"; parentView?: boolean }) {
  const cols = parentView ? 7 : 5;
  return <div className="bg-white rounded-2xl shadow-sm border border-teal-100/80 overflow-auto">
    {exempt && <div className="px-4 pt-4"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{lang === "ur" ? "فیس معاف" : "Fee Exempt"}</span></div>}
    <table className="w-full text-sm">
      <thead><tr>
        {parentView && <th className="p-3 text-left">{lang === "ur" ? "سیشن" : "Session"}</th>}
        <th className="p-3 text-center">{tr.month}/{tr.year}</th>
        <th className="p-3 text-center">{lang === "ur" ? "واجب" : "Due"}</th>
        <th className="p-3 text-center">{lang === "ur" ? "ادا شدہ" : "Paid"}</th>
        <th className="p-3 text-center">{tr.status}</th>
        <th className="p-3 text-center">{tr.paidDate}</th>
        {parentView && <th className="p-3 text-center">{lang === "ur" ? "رسید" : "Receipt"}</th>}
      </tr></thead>
      <tbody>
        {fees.map((f: any) => {
          const paidAmt = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? Number(f.amount||0) : 0);
          const dueAmt = Number(f.amount||0);
          const balance = Math.max(0, dueAmt - paidAmt);
          const full = f.isPaid || (dueAmt>0 && paidAmt>=dueAmt);
          const partial = paidAmt>0 && paidAmt<dueAmt;
          const status = exempt ? (lang === "ur" ? "فیس معاف" : "Exempt") : (full ? (f.isLate?tr.late:`${tr.paid} ✓`) : (partial ? (lang === "ur" ? "جزوی" : "Partial") : tr.unpaid));
          const statusBadge = <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${full ? (f.isLate?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800") : (partial?"bg-amber-100 text-amber-800":"bg-red-100 text-red-800")}`}>{status}</span>;
          return (
            <tr key={f.id} className="border-t">
              {parentView && <td className="p-3">{f.session?.name || "-"}</td>}
              <td className="p-3 text-center">{f.month}/{f.year}</td>
              <td className="p-3 text-center">Rs {dueAmt}</td>
              <td className="p-3 text-center">Rs {paidAmt}{balance>0 ? <div className="text-[11px] text-amber-700">{lang === "ur" ? `باقی Rs ${balance}` : `Bal Rs ${balance}`}</div> : null}</td>
              <td className="p-3 text-center">{statusBadge}</td>
              <td className="p-3 text-center">{formatDateDMY(f.paidAt)}</td>
              {parentView && <td className="p-3 text-center">{f.id && full ? <Link href={`/fees/receipt/${f.id}`} className="inline-flex px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 font-medium hover:bg-teal-100">{lang === "ur" ? "رسید" : "Receipt"}</Link> : <span className="text-gray-400">-</span>}</td>}
            </tr>
          );
        })}
        {fees.length===0 && <tr><td colSpan={cols} className="p-4 text-center text-gray-500">{tr.noFeeRecords}</td></tr>}
      </tbody>
    </table>
  </div>;
}
