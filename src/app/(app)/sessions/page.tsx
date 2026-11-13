import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { formatDateDMY, parseDateInput } from "@/lib/utils";
import { autoExpireSessionsIfNeeded } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import DateInputDMY from "@/components/DateInputDMY";

async function createSessionAction(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const name = String(formData.get("name")||"").trim();
  const startDate = parseDateInput(formData.get("startDate"));
  const endDate = parseDateInput(formData.get("endDate"));
  const makeCurrent = formData.get("makeCurrent") === "on";
  if (!name || !startDate || !endDate) { redirect("/sessions?error=required"); }
  if (endDate.getTime() <= startDate.getTime()) { redirect("/sessions?error=dates"); }
  const maxEnd = new Date(startDate);
  maxEnd.setFullYear(maxEnd.getFullYear() + 1);
  if (endDate.getTime() > maxEnd.getTime()) { redirect("/sessions?error=duration"); }
  const alreadyExpired = Date.now() > new Date(endDate).setHours(23,59,59,999);
  const status = alreadyExpired ? "EXPIRED" : "ACTIVE";
  const isCurrent = makeCurrent && !alreadyExpired;
  await prisma.$transaction(async (tx) => {
    if (makeCurrent) await tx.session.updateMany({ data: { isCurrent: false } });
    await tx.session.create({ data: { name, startDate, endDate, status, isCurrent } });
  });
  revalidateTag("current-session", { expire: 0 });
  revalidatePath("/sessions"); revalidatePath("/dashboard");
}
async function setCurrentAction(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const id = String(formData.get("id"));
  await autoExpireSessionsIfNeeded();
  const target = await prisma.session.findUnique({ where: { id }, select: { id: true, status: true, endDate: true } });
  if (!target) redirect("/sessions");
  if (target.status !== "ACTIVE") redirect("/sessions?error=expiredset");
  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({ data: { isCurrent: false } });
    await tx.session.update({ where: { id }, data: { isCurrent: true } });
  });
  revalidateTag("current-session", { expire: 0 });
  revalidatePath("/sessions"); revalidatePath("/dashboard");
}
async function carryStudentsAction(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const fromId = String(formData.get("fromId"));
  const toId = String(formData.get("toId"));
  if (!fromId || !toId || fromId===toId) return;
  const enrolls = await prisma.studentEnrollment.findMany({ where: { sessionId: fromId } });
  for (const e of enrolls) {
    await prisma.studentEnrollment.upsert({
      where: { studentId_sessionId: { studentId: e.studentId, sessionId: toId } },
      update: {},
      create: { studentId: e.studentId, sessionId: toId, carriedFromId: e.id, rollNo: null, rollLocked: false },
    });
  }
  revalidatePath("/sessions"); revalidatePath("/students");
}

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getAuthUser();
  if (user?.role !== "ADMIN") redirect("/dashboard");
  const lang = await getLang();
  const tr = t[lang];
  const sp = await searchParams;
  await autoExpireSessionsIfNeeded();
  const sessions = await prisma.session.findMany({ orderBy: { createdAt: "desc" } });
  const errorMsg = sp.error === "duration"
    ? (lang === "ur" ? "سیشن کی مدت ایک سال سے زیادہ نہیں ہو سکتی۔ تاریخیں درست کریں۔" : "Session duration cannot be more than 1 year. Please correct the dates.")
    : sp.error === "required"
    ? (lang === "ur" ? "سیشن کا نام، شروع اور اختتامی تاریخ درج کریں۔" : "Please enter session name, start date and end date.")
    : sp.error === "dates"
    ? (lang === "ur" ? "اختتامی تاریخ شروع کی تاریخ کے بعد ہونی چاہیے۔" : "End date must be after start date.")
    : sp.error === "expiredset"
    ? (lang === "ur" ? "ختم شدہ (Expired) سیشن کو current نہیں بنایا جا سکتا۔" : "An expired session cannot be set as current.")
    : "";
  return (
    <div>
      <h1 className="text-2xl font-bold text-emerald-900 mb-4">{tr.sessions}</h1>
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">{tr.createNewSession}</h2>
        {errorMsg && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{errorMsg}</div>}
        <form action={createSessionAction} className="grid md:grid-cols-4 gap-3 items-end">
          <div><label className="text-sm">{tr.sessionName}</label><input name="name" required className="w-full border rounded px-2 py-2"/></div>
          <div><label className="text-sm">{tr.startDate}</label><DateInputDMY name="startDate" required inputClassName="border rounded px-2 py-2" /></div>
          <div><label className="text-sm">{tr.endDate}</label><DateInputDMY name="endDate" required inputClassName="border rounded px-2 py-2" /></div>
          <div className="flex items-center gap-2"><input id="mc" name="makeCurrent" type="checkbox" defaultChecked/><label htmlFor="mc" className="text-sm">{tr.setAsCurrentActive}</label></div>
          <div className="md:col-span-4"><button className="bg-emerald-800 text-white px-4 py-2 rounded">{tr.createSession}</button></div>
        </form>
      </div>
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">{tr.carryStudents}</h2>
        <form action={carryStudentsAction} className="grid md:grid-cols-3 gap-3 items-end">
          <div><label className="text-sm">{tr.fromSession}</label><select name="fromId" className="w-full border rounded px-2 py-2">{sessions.map(s=><option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}</select></div>
          <div><label className="text-sm">{tr.toSession}</label><select name="toId" className="w-full border rounded px-2 py-2">{sessions.map(s=><option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}</select></div>
          <div><button className="bg-amber-700 text-white px-4 py-2 rounded">{tr.carryStudentsBtn}</button></div>
        </form>
        <p className="text-xs text-gray-500 mt-2">{tr.carryNote}</p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-emerald-50 text-emerald-900">
            <tr>
              <th className="p-3 text-left">{tr.name}</th>
              <th className="p-3 text-center">{tr.status}</th>
              <th className="p-3 text-center">{tr.current}</th>
              <th className="p-3 text-center">{tr.dates}</th>
              <th className="p-3 text-center">{tr.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} className="border-t hover:bg-gray-50/60 align-middle">
                <td className="p-3 font-semibold text-gray-900">{s.name}</td>
                <td className="p-3 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : s.status === "EXPIRED" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${s.isCurrent ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {s.isCurrent ? tr.yes : tr.no}
                  </span>
                </td>
                <td className="p-3 text-center text-gray-700">{formatDateDMY(s.startDate)} <span className="text-gray-400">to</span> {formatDateDMY(s.endDate)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {s.status === "ACTIVE" ? (
                      <form action={setCurrentAction}>
                        <input type="hidden" name="id" value={s.id}/>
                        <button
                          className={`inline-flex items-center justify-center min-w-[120px] px-3 py-2 rounded-lg text-sm font-medium border transition ${s.isCurrent ? "bg-blue-700 text-white border-blue-700 shadow-sm" : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"}`}
                        >
                          {s.isCurrent ? `✓ ${tr.setCurrent}` : tr.setCurrent}
                        </button>
                      </form>
                    ) : (
                      <span className="inline-flex items-center justify-center min-w-[120px] px-3 py-2 rounded-lg text-sm font-medium border border-amber-200 bg-amber-50 text-amber-800">
                        {lang === "ur" ? "خودکار طور پر ختم" : "Auto Expired"}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length===0 && <tr><td className="p-6 text-center text-gray-500" colSpan={5}>{tr.noSessions}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
