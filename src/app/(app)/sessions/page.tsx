import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";

async function createSessionAction(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const name = String(formData.get("name")||"").trim();
  const startDate = formData.get("startDate") ? new Date(String(formData.get("startDate"))) : null;
  const endDate = formData.get("endDate") ? new Date(String(formData.get("endDate"))) : null;
  const makeCurrent = formData.get("makeCurrent") === "on";
  if (!name) return;
  await prisma.$transaction(async (tx) => {
    if (makeCurrent) await tx.session.updateMany({ data: { isCurrent: false } });
    await tx.session.create({ data: { name, startDate, endDate, status: "ACTIVE", isCurrent: makeCurrent } });
  });
  revalidateTag("current-session", { expire: 0 });
  revalidatePath("/sessions"); revalidatePath("/dashboard");
}
async function setCurrentAction(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const id = String(formData.get("id"));
  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({ data: { isCurrent: false } });
    await tx.session.update({ where: { id }, data: { isCurrent: true } });
  });
  revalidateTag("current-session", { expire: 0 });
  revalidatePath("/sessions"); revalidatePath("/dashboard");
}
async function expireAction(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const id = String(formData.get("id"));
  await prisma.session.update({ where: { id }, data: { status: "EXPIRED", isCurrent: false } });
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

export default async function SessionsPage() {
  const user = await getAuthUser();
  if (user?.role !== "ADMIN") redirect("/dashboard");
  const lang = await getLang();
  const tr = t[lang];
  const sessions = await prisma.session.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <h1 className="text-2xl font-bold text-emerald-900 mb-4">{tr.sessions}</h1>
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">{tr.createNewSession}</h2>
        <form action={createSessionAction} className="grid md:grid-cols-4 gap-3 items-end">
          <div><label className="text-sm">{tr.sessionName}</label><input name="name" required className="w-full border rounded px-2 py-2"/></div>
          <div><label className="text-sm">{tr.startDate}</label><input name="startDate" type="date" className="w-full border rounded px-2 py-2"/></div>
          <div><label className="text-sm">{tr.endDate}</label><input name="endDate" type="date" className="w-full border rounded px-2 py-2"/></div>
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
      <div className="bg-white rounded-xl shadow overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-emerald-50"><tr><th className="p-2 text-left">{tr.name}</th><th className="p-2">{tr.status}</th><th className="p-2">{tr.current}</th><th className="p-2">{tr.dates}</th><th className="p-2">{tr.actions}</th></tr></thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-2 font-medium">{s.name}</td>
                <td className="p-2 text-center">{s.status}</td>
                <td className="p-2 text-center">{s.isCurrent ? tr.yes : tr.no}</td>
                <td className="p-2 text-center">{s.startDate?.toISOString().slice(0,10) || "-"} to {s.endDate?.toISOString().slice(0,10) || "-"}</td>
                <td className="p-2 text-center space-x-2">
                  <form action={setCurrentAction} className="inline"><input type="hidden" name="id" value={s.id}/><button className="text-emerald-700 underline">{tr.setCurrent}</button></form>
                  {s.status === "ACTIVE" && <form action={expireAction} className="inline"><input type="hidden" name="id" value={s.id}/><button className="text-red-700 underline">{tr.expire}</button></form>}
                </td>
              </tr>
            ))}
            {sessions.length===0 && <tr><td className="p-4 text-center text-gray-500" colSpan={5}>{tr.noSessions}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
