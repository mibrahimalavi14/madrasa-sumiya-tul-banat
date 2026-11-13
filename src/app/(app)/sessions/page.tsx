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
  // Session must be exactly 1 year (not more, not less)
  const s = new Date(startDate); s.setHours(0,0,0,0);
  const e = new Date(endDate); e.setHours(0,0,0,0);
  const m = new Date(maxEnd); m.setHours(0,0,0,0);
  if (e.getTime() !== m.getTime()) { redirect("/sessions?error=duration"); }
  await autoExpireSessionsIfNeeded({ revalidate: true });
  const activeExists = await prisma.session.count({ where: { status: "ACTIVE" } });
  if (activeExists > 0) { redirect("/sessions?error=activeexists"); }
  const now = new Date();
  const endOf = new Date(endDate); endOf.setHours(23,59,59,999);
  const alreadyExpired = now.getTime() > endOf.getTime();
  // If exact 1-year session ending today/in future hasn't ended yet, it's active; if already past end, treat as expired (and creation of next will be allowed after expiry state)
  const status = alreadyExpired ? "EXPIRED" : "ACTIVE";
  const isCurrent = makeCurrent && !alreadyExpired;
  await prisma.$transaction(async (tx) => {
    if (isCurrent) await tx.session.updateMany({ data: { isCurrent: false } });
    await tx.session.create({ data: { name, startDate, endDate, status, isCurrent } });
  });
  revalidateTag("current-session", { expire: 0 });
  revalidatePath("/sessions"); revalidatePath("/dashboard");
}
async function setCurrentAction(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const id = String(formData.get("id"));
  await autoExpireSessionsIfNeeded({ revalidate: true });
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
  await autoExpireSessionsIfNeeded({ revalidate: true });
  const sessions = await prisma.session.findMany({
    select: { id: true, name: true, status: true, isCurrent: true, startDate: true, endDate: true },
    orderBy: { createdAt: "desc" },
  });
  const hasActiveSession = sessions.some(s => s.status === "ACTIVE");
  const canCreateSession = !hasActiveSession;
  const errorMsg = sp.error === "duration"
    ? (lang === "ur" ? "سیشن کی مدت بالکل ایک سال ہونی چاہیے (ایک دن کم یا زیادہ نہیں ہو سکتی)۔" : "Session duration must be exactly 1 year (not one day less or more).")
    : sp.error === "required"
    ? (lang === "ur" ? "سیشن کا نام، شروع اور اختتامی تاریخ درج کریں۔" : "Please enter session name, start date and end date.")
    : sp.error === "dates"
    ? (lang === "ur" ? "اختتامی تاریخ شروع کی تاریخ کے بعد ہونی چاہیے۔" : "End date must be after start date.")
    : sp.error === "expiredset"
    ? (lang === "ur" ? "ختم شدہ (Expired) سیشن کو current نہیں بنایا جا سکتا۔" : "An expired session cannot be set as current.")
    : sp.error === "activeexists"
    ? (lang === "ur" ? "ایک فعال سیشن موجود ہے۔ نیا سیشن سال ختم/expire ہونے کے بعد ہی بنایا جا سکتا ہے۔" : "An active session already exists. You can create the next session only after the current year/session ends.")
    : "";
  return (
    <div>
      <h1 className="text-2xl font-bold text-emerald-900 mb-4">{tr.sessions}</h1>
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">{tr.createNewSession}</h2>
        {errorMsg && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{errorMsg}</div>}
        {canCreateSession ? (
          <form action={createSessionAction} className="grid md:grid-cols-4 gap-3 items-end">
            <div><label className="text-sm">{tr.sessionName}</label><input name="name" required className="w-full border rounded px-2 py-2"/></div>
            <div><label className="text-sm">{tr.startDate}</label><DateInputDMY name="startDate" required inputClassName="border rounded px-2 py-2" /></div>
            <div><label className="text-sm">{tr.endDate}</label><DateInputDMY name="endDate" required inputClassName="border rounded px-2 py-2" /></div>
            <div className="flex items-center gap-2"><input id="mc" name="makeCurrent" type="checkbox" defaultChecked/><label htmlFor="mc" className="text-sm">{tr.setAsCurrentActive}</label></div>
            <div className="md:col-span-4 space-y-1">
              <button className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2 rounded">{tr.createSession}</button>
              <p className="text-xs text-gray-500">{lang === "ur" ? "سیشن کی مدت بالکل 1 سال ہونی چاہیے۔ سال ختم/expire ہونے کے بعد ہی اگلا سیشن بنایا جا سکے گا۔" : "Session duration must be exactly 1 year. Next session can be created only after the current session ends/expires."}</p>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 p-4 text-sm">
            {lang === "ur"
              ? "ایک فعال سیشن موجود ہے، اس لیے نیا سیشن بنانے کا آپشن بند ہے۔ موجودہ سیشن کی مدت پوری ہونے/خودکار طور پر ختم ہونے کے بعد اگلا سیشن بنانے کا آپشن ظاہر ہوگا۔"
              : "An active session exists, so session creation is currently closed. The option to create the next session will appear after the current session ends/expires."}
          </div>
        )}
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
                      s.isCurrent ? (
                        <span className="inline-flex items-center justify-center min-w-[120px] px-3 py-2 rounded-lg text-sm font-medium border border-blue-300 bg-blue-100 text-blue-800 shadow-sm">
                          ✓ {lang === "ur" ? "موجودہ سیشن" : "Current"}
                        </span>
                      ) : (
                        <form action={setCurrentAction}>
                          <input type="hidden" name="id" value={s.id}/>
                          <button className="inline-flex items-center justify-center min-w-[120px] px-3 py-2 rounded-lg text-sm font-medium border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 transition">
                            {tr.setCurrent}
                          </button>
                        </form>
                      )
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
