import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser, hashPassword } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { formatDateDMY } from "@/lib/utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { logAudit } from "@/lib/audit";

async function saveFee(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const session = await getCurrentSession();
  const amount = String(formData.get("monthlyFee")||"0");
  await prisma.setting.upsert({ where: { sessionId_key: { sessionId: session?.id || null as any, key: "monthlyFee" } }, update: { value: amount }, create: { sessionId: session?.id || null, key: "monthlyFee", value: amount } }).catch(async ()=>{
    const ex = await prisma.setting.findFirst({ where: { sessionId: session?.id||null, key: "monthlyFee" } });
    if (ex) await prisma.setting.update({ where: { id: ex.id }, data: { value: amount } });
    else await prisma.setting.create({ data: { sessionId: session?.id||null, key: "monthlyFee", value: amount } });
  });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "SETTINGS_MONTHLY_FEE_SET", entityType: "Setting", details: JSON.stringify({ sessionId: session?.id || null, amount }) });
  revalidatePath("/settings"); revalidatePath("/fees");
}
async function changePassword(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (!user) throw new Error("UNAUTHORIZED");
  const pw = String(formData.get("password")||"");
  if (pw.length < 4) return;
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(pw) } });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "USER_PASSWORD_CHANGE", entityType: "User", entityId: user.id });
  revalidatePath("/settings");
}
async function createParent(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const username = String(formData.get("username")||"").trim();
  const password = String(formData.get("password")||"");
  const parentStudentId = String(formData.get("parentStudentId")||"") || null;
  if (!username || !password) return;
  const created = await prisma.user.create({ data: { username, passwordHash: await hashPassword(password), role: "PARENT", name: String(formData.get("name")||"")||null, parentStudentId } });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "PARENT_USER_CREATE", entityType: "User", entityId: created.id, details: JSON.stringify({ username, parentStudentId }) });
  revalidatePath("/settings");
}

async function createAccountant(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const username = String(formData.get("username")||"").trim();
  const password = String(formData.get("password")||"");
  const name = String(formData.get("name")||"").trim() || null;
  if (!username || !password) return;
  const created = await prisma.user.create({ data: { username, passwordHash: await hashPassword(password), role: "ACCOUNTANT", name, parentStudentId: null } });
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "ACCOUNTANT_USER_CREATE", entityType: "User", entityId: created.id, details: JSON.stringify({ username }) });
  revalidatePath("/settings");
}

export default async function SettingsPage() {
  const user = await getAuthUser(); if (user?.role !== "ADMIN") redirect("/dashboard");
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  const tr = t[lang];

  const [feeSetting, students, parents, accountants, sessionsCount, totalStudents, examsCount, resultsCount, certsCount, usersCount] = await Promise.all([
    prisma.setting.findFirst({ where: { key: "monthlyFee", sessionId: session?.id || null } }),
    session ? prisma.studentEnrollment.findMany({ where: { sessionId: session.id }, select: { studentId: true, student: { select: { admissionNo: true, nameEn: true } } }, orderBy: { student: { admissionNo: "asc" } } }) : Promise.resolve([] as any[]),
    prisma.user.findMany({ where: { role: "PARENT" }, select: { id: true, username: true, name: true, parentStudent: { select: { admissionNo: true, nameEn: true } } } }),
    prisma.user.findMany({ where: { role: "ACCOUNTANT" }, select: { id: true, username: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.session.count(),
    prisma.student.count(),
    session ? prisma.exam.count({ where: { sessionId: session.id } }) : Promise.resolve(0),
    session ? prisma.result.count({ where: { exam: { sessionId: session.id } } }) : Promise.resolve(0),
    session ? prisma.certificate.count({ where: { sessionId: session.id } }) : Promise.resolve(0),
    prisma.user.count(),
  ]);

  return (
    <div className="space-y-6 theme-settings">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">{tr.settings}</h1>
        <p className="text-sm text-emerald-50 mt-1">{ur ? "سسٹم، سیشن، فیس، اکاؤنٹس اور تعلیمی قواعد کی ترتیبات" : "System, session, fees, accounts and academic rules settings"}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
          <h2 className="text-lg font-semibold text-emerald-900 mb-3">{ur ? "سسٹم کا خلاصہ" : "System Overview"}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"><div className="text-gray-500">{ur ? "کل سیشنز" : "Total Sessions"}</div><div className="text-xl font-bold text-emerald-900">{sessionsCount}</div></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"><div className="text-gray-500">{ur ? "کل طلبہ (ریکارڈ)" : "Total Students"}</div><div className="text-xl font-bold text-emerald-900">{totalStudents}</div></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"><div className="text-gray-500">{ur ? "موجودہ سیشن کے امتحانات" : "Exams (Current)"}</div><div className="text-xl font-bold text-emerald-900">{examsCount}</div></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"><div className="text-gray-500">{ur ? "محفوظ نتائج" : "Saved Results"}</div><div className="text-xl font-bold text-emerald-900">{resultsCount}</div></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"><div className="text-gray-500">{ur ? "سرٹیفکیٹس" : "Certificates"}</div><div className="text-xl font-bold text-emerald-900">{certsCount}</div></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"><div className="text-gray-500">{ur ? "یوزرز" : "Users"}</div><div className="text-xl font-bold text-emerald-900">{usersCount}</div></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
          <h2 className="text-lg font-semibold text-emerald-900 mb-3">{ur ? "فعال سیشن اور زبان" : "Active Session & Language"}</h2>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-emerald-100 p-3">
              <div className="text-gray-500">{ur ? "فعال سیشن" : "Active Session"}</div>
              <div className="font-semibold text-emerald-900 mt-0.5">{session ? `${session.name} (${session.status})` : tr.noActiveSession}</div>
              {session && <div className="text-xs text-gray-500 mt-1">{formatDateDMY(session.startDate)} to {formatDateDMY(session.endDate)}</div>}
            </div>
            <div className="rounded-xl border border-emerald-100 p-3">
              <div className="text-gray-500">{ur ? "زبان" : "Language"}</div>
              <div className="font-semibold text-emerald-900 mt-0.5">{ur ? "اردو (منتخب)" : "English (Selected)"}</div>
              <div className="text-xs text-gray-500 mt-1">{ur ? "سائیڈبار میں EN/اردو ٹوگل سے زبان تبدیل کریں۔ ایڈمیشن فارم کا مخصوص مواد برقرار رہتا ہے۔" : "Use the EN/اردو toggle in the sidebar. Admission form specific content remains as configured."}</div>
            </div>
            <div className="rounded-xl border border-emerald-100 p-3">
              <div className="text-gray-500">{ur ? "امتحانی نظام" : "Examination System"}</div>
              <ul className="mt-1 text-gray-700 space-y-0.5 list-disc pl-5">
                <li>{ur ? "4 مراحل: ابتدائی تحریری، ششماہی، سہ ماہی، سالانہ" : "4 stages: Initial Written, Six-Monthly, Quarterly, Annual"}</li>
                <li>{ur ? "سالانہ وزن: ٪20، ٪20، ٪20، ٪40" : "Annual weights: 20%, 20%, 20%, 40%"}</li>
                <li>{ur ? "امتحان کے نام انگریزی، پرچے اردو میں" : "Exam names in English, papers in Urdu"}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
        <h2 className="text-lg font-semibold text-emerald-900 mb-3 border-b-2 border-emerald-200 pb-3">{tr.gradingSystem}</h2>
        <div className="overflow-auto border-t border-emerald-200 pt-4 rounded-xl">
          <table className="w-full text-sm border border-emerald-200/80 rounded-xl overflow-hidden">
            <thead className="bg-emerald-700 text-white">
              <tr>
                <th className="p-3 text-left border border-emerald-800/50">{ur ? "حاصل کردہ فیصد" : "Percentage"}</th>
                <th className="p-3 text-center border border-emerald-800/50">{ur ? "گریڈ" : "Grade"}</th>
                <th className="p-3 text-right border border-emerald-800/50">{ur ? "نتیجہ" : "Result"}</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr><td className="p-3 border border-emerald-100">90–100%</td><td className="p-3 text-center font-semibold border border-emerald-100">A+</td><td className="p-3 text-right border border-emerald-100">{ur ? "ممتاز" : "Excellent"}</td></tr>
              <tr className="bg-emerald-50/30"><td className="p-3 border border-emerald-100">80–89%</td><td className="p-3 text-center font-semibold border border-emerald-100">A</td><td className="p-3 text-right border border-emerald-100">{ur ? "بہترین" : "Very Good"}</td></tr>
              <tr><td className="p-3 border border-emerald-100">70–79%</td><td className="p-3 text-center font-semibold border border-emerald-100">B</td><td className="p-3 text-right border border-emerald-100">{ur ? "اچھا" : "Good"}</td></tr>
              <tr className="bg-emerald-50/30"><td className="p-3 border border-emerald-100">60–69%</td><td className="p-3 text-center font-semibold border border-emerald-100">C</td><td className="p-3 text-right border border-emerald-100">{ur ? "تسلی بخش" : "Satisfactory"}</td></tr>
              <tr><td className="p-3 border border-emerald-100">40–59%</td><td className="p-3 text-center font-semibold border border-emerald-100">D</td><td className="p-3 text-right border border-emerald-100">{ur ? "کامیاب" : "Pass"}</td></tr>
              <tr className="bg-red-50/30"><td className="p-3 border border-emerald-100">0–39%</td><td className="p-3 text-center font-semibold text-red-700 border border-emerald-100">F</td><td className="p-3 text-right text-red-700 border border-emerald-100">{ur ? "ناکام" : "Fail"}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-5 pt-4 border-t border-emerald-200 grid sm:grid-cols-3 gap-4">
          <div className="border-2 border-emerald-300 bg-emerald-50/50 rounded-xl p-3">
            <div className="text-sm font-semibold text-emerald-900 border-b border-emerald-300 pb-2 mb-2">{ur ? "کامیابی" : "Pass"}</div>
            <div className="text-emerald-800">{ur ? "٪40 یا اس سے زیادہ" : "40% or above"}</div>
          </div>
          <div className="border-2 border-amber-300 bg-amber-50/50 rounded-xl p-3">
            <div className="text-sm font-semibold text-amber-900 border-b border-amber-300 pb-2 mb-2">{ur ? "پوزیشن کی اہلیت" : "Position Eligibility"}</div>
            <div className="text-amber-800">{ur ? "٪70 یا اس سے زیادہ" : "70% or above"}</div>
          </div>
          <div className="border-2 border-blue-300 bg-blue-50/40 rounded-xl p-3">
            <div className="text-sm font-semibold text-blue-900 border-b border-blue-300 pb-2 mb-2">{ur ? "فیس تاخیر" : "Fee Late Rule"}</div>
            <div className="text-blue-800">{ur ? "7 تاریخ کے بعد ادائیگی = Late" : "Paid after 7th = Late"}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
          <h2 className="font-semibold mb-2 text-emerald-900">{tr.monthlyFeeCurrent}</h2>
          <form action={saveFee} className="flex gap-4 items-end flex-wrap">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">{tr.monthlyFeeAmount}</label>
              <input name="monthlyFee" type="number" defaultValue={feeSetting?.value || ""} className="border border-emerald-200/80 rounded-lg px-3 py-2.5 w-full min-w-0 sm:w-auto sm:min-w-[180px]"/>
            </div>
            <button className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2.5 rounded-lg">{tr.save}</button>
          </form>
          <p className="text-xs text-gray-500 mt-2">{ur ? "یہ رقم فیس صفحے پر بطور ڈیفالٹ استعمال ہوگی (موجودہ سیشن)." : "This amount is used as default on Fees page for the current session."}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
          <h2 className="font-semibold mb-2 text-emerald-900">{tr.sessionManagement}</h2>
          <p className="text-sm text-gray-700 mb-3">{tr.manageSessionsText} <Link className="text-emerald-700 underline font-medium" href="/sessions">{tr.sessionsPage}</Link>. {tr.sessionRequiredText}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/sessions" className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 text-sm">{ur ? "سیشنز کھولیں" : "Open Sessions"}</Link>
            <Link href="/students" className="px-3 py-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 hover:bg-gray-100 text-sm">{ur ? "طلبہ" : "Students"}</Link>
            <Link href="/examination" className="px-3 py-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 hover:bg-gray-100 text-sm">{ur ? "امتحانات" : "Examinations"}</Link>
            <Link href="/settings/audit" className="px-3 py-2 rounded-lg bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100 text-sm">{ur ? "آڈٹ لاگ" : "Audit Log"}</Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
        <h2 className="font-semibold mb-2 text-emerald-900">{ur ? "اکاؤنٹنٹ لاگ ان بنائیں" : "Create Accountant Login"}</h2>
        <p className="text-xs text-gray-600 mb-3">{ur ? "اکاؤنٹنٹ Management Portal سے لاگ ان کرے گا۔ اس کو اہم ماڈیولز (Dashboard, Students, Exams, Results, Certificates, Fees) کی رسائی ہوگی؛ Sessions/Settings/Audit صرف Admin کے لیے رہیں گے۔" : "Accountant logs in via Management Portal. Access includes important modules (Dashboard, Students, Exams, Results, Certificates, Fees); Sessions/Settings/Audit remain Admin-only."}</p>
        <form action={createAccountant} className="grid md:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-2"><label className="text-sm font-medium text-gray-700">{tr.name}</label><input name="name" className="w-full border border-emerald-200/80 rounded-lg px-3 py-2.5"/></div>
          <div className="flex flex-col gap-2"><label className="text-sm font-medium text-gray-700">{tr.username}</label><input name="username" required className="w-full border border-emerald-200/80 rounded-lg px-3 py-2.5"/></div>
          <div className="flex flex-col gap-2"><label className="text-sm font-medium text-gray-700">{tr.password}</label><input name="password" required className="w-full border border-emerald-200/80 rounded-lg px-3 py-2.5"/></div>
          <div className="flex flex-col gap-2"><label className="text-sm font-medium text-gray-700">{ur ? "کردار" : "Role"}</label><input value="ACCOUNTANT" disabled className="w-full border border-emerald-200/80 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-700"/></div>
          <div className="md:col-span-4 pt-1"><button className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2.5 rounded-lg">{ur ? "اکاؤنٹنٹ بنائیں" : "Create Accountant"}</button></div>
        </form>
        <div className="mt-4 text-sm">
          <b className="text-emerald-900">{ur ? "موجودہ اکاؤنٹنٹس" : "Existing Accountants"}</b>
          {accountants.length===0 ? <span className="ml-2 text-gray-500">{tr.none}</span> : (
            <div className="mt-2 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">{tr.username}</th><th className="p-2 text-left">{tr.name}</th><th className="p-2 text-left">{ur ? "کردار" : "Role"}</th></tr></thead><tbody>{accountants.map(a=><tr key={a.id}><td className="p-2">{a.username}</td><td className="p-2">{a.name||"-"}</td><td className="p-2">ACCOUNTANT</td></tr>)}</tbody></table></div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
        <h2 className="font-semibold mb-2 text-emerald-900">{tr.createParentLogin}</h2>
        <form action={createParent} className="grid md:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-2"><label className="text-sm font-medium text-gray-700">{tr.name}</label><input name="name" className="w-full border border-emerald-200/80 rounded-lg px-3 py-2.5"/></div>
          <div className="flex flex-col gap-2"><label className="text-sm font-medium text-gray-700">{tr.username}</label><input name="username" required className="w-full border border-emerald-200/80 rounded-lg px-3 py-2.5"/></div>
          <div className="flex flex-col gap-2"><label className="text-sm font-medium text-gray-700">{tr.password}</label><input name="password" required className="w-full border border-emerald-200/80 rounded-lg px-3 py-2.5"/></div>
          <div className="flex flex-col gap-2"><label className="text-sm font-medium text-gray-700">{tr.linkToStudent}</label><select name="parentStudentId" className="w-full border border-emerald-200/80 rounded-lg px-3 py-2.5"><option value="">({tr.none})</option>{students.map(e=><option key={e.studentId} value={e.studentId}>{e.student.admissionNo} - {e.student.nameEn}</option>)}</select></div>
          <div className="md:col-span-4 pt-1"><button className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2.5 rounded-lg">{tr.createParent}</button></div>
        </form>
        <div className="mt-4 text-sm">
          <b className="text-emerald-900">{tr.existingParents}</b>
          {parents.length===0 ? <span className="ml-2 text-gray-500">{tr.none}</span> : (
            <div className="mt-2 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">{tr.username}</th><th className="p-2 text-left">{tr.name}</th><th className="p-2 text-left">{tr.student}</th></tr></thead><tbody>{parents.map(p=><tr key={p.id}><td className="p-2">{p.username}</td><td className="p-2">{p.name||"-"}</td><td className="p-2">{p.parentStudent ? `${p.parentStudent.admissionNo} - ${p.parentStudent.nameEn}` : "-"}</td></tr>)}</tbody></table></div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
          <h2 className="font-semibold mb-2 text-emerald-900">{tr.changeMyPassword}</h2>
          <form action={changePassword} className="flex gap-4 items-end flex-wrap"><div className="flex flex-col gap-2"><label className="text-sm font-medium text-gray-700">{tr.newPassword}</label><input name="password" type="password" required className="border border-emerald-200/80 rounded-lg px-3 py-2.5 w-full min-w-0 sm:w-auto sm:min-w-[220px]"/></div><button className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2.5 rounded-lg">{tr.updatePassword}</button></form>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
          <h2 className="font-semibold mb-2 text-emerald-900">{ur ? "اہم قواعد" : "Important Rules"}</h2>
          <ul className="text-sm list-disc pl-5 space-y-1 text-gray-700">
            {ur ? (<>
              <li>رول نمبر امتحان کے وقت دیا جاتا ہے، سیشن میں منفرد اور لاک رہتا ہے۔</li>
              <li>داخلہ نمبر <b>MSB</b> سے شروع ہوتا ہے اور منفرد ہے۔</li>
              <li>امتحان کے پرچے (تحریری/زبانی) اردو میں تیار ہوتے ہیں۔</li>
              <li>سالانہ نتیجہ چاروں امتحانات کے وزنی فارمولے سے بنتا ہے۔</li>
            </>) : (<>
              <li>Roll number is assigned at exam time, unique per session and locked.</li>
              <li>Admission number starts with <b>MSB</b> and is unique.</li>
              <li>Exam papers (written/oral) are generated in Urdu.</li>
              <li>Annual result is calculated using weighted formula across four exams.</li>
            </>)}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-5">
        <h2 className="font-semibold mb-2 text-emerald-900">{ur ? "بیک اپ اور ایکسپورٹ" : "Backup & Export"}</h2>
        <div className="text-sm text-gray-700 space-y-2">
          <p>{ur ? "ڈیٹا کی حفاظت کے لیے CSV exports اور Supabase backups/PITR دونوں استعمال کریں (DB: Supabase ap-southeast-1)." : "Use both CSV exports and Supabase backups/PITR for data safety (DB: Supabase ap-southeast-1)."}</p>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
            <div className="font-semibold text-gray-900 mb-1">{ur ? "CSV ایکسپورٹس (app میں دستیاب):" : "CSV exports (available in app):"}</div>
            <ul className="list-disc pl-5 space-y-0.5">
              <li><Link className="text-emerald-700 underline" href="/api/export/students">{ur ? "طلبہ" : "Students"}</Link>, <Link className="text-emerald-700 underline" href="/api/export/fees">{ur ? "فیس" : "Fees"}</Link>, <Link className="text-emerald-700 underline" href="/api/export/results">{ur ? "نتائج" : "Results"}</Link>, <Link className="text-emerald-700 underline" href="/api/export/certificates">{ur ? "سرٹیفکیٹس" : "Certificates"}</Link></li>
            </ul>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-900 p-3 text-xs">
            <div className="font-semibold mb-1">{ur ? "Supabase پر آپ کو کیا کرنا ہوگا:" : "What you need to do in Supabase:"}</div>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>{ur ? "Supabase Dashboard → Project → Database/Backups کھولیں" : "Open Supabase Dashboard → Project → Database/Backups"}</li>
              <li>{ur ? "Automated backups enable/verify کریں" : "Enable/verify automated backups"}</li>
              <li>{ur ? "اگر plan میں ہو تو PITR enable کریں (retention منتخب کریں)" : "Enable PITR if available (choose retention)"}</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/backup" className="inline-flex px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 text-sm">{ur ? "بیک اپ سینٹر کھولیں" : "Open Backup Center"}</Link>
            <Link href="/settings/audit" className="inline-flex px-3 py-2 rounded-lg bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100 text-sm">{ur ? "آڈٹ لاگ دیکھیں" : "View Audit Log"}</Link>
          </div>
        </div>
      </div>


    </div>
  );
}
