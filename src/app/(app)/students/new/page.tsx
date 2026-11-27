import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatAdmissionNo, formatRegNo, parseDateInput } from "@/lib/utils";
import DateInputDMY from "@/components/DateInputDMY";
import ScrollToTopOnError from "@/components/ScrollToTopOnError";
import PhoneInput from "@/components/PhoneInput";
import SuggestionInput from "@/components/SuggestionInput";
import { logAudit } from "@/lib/audit";
import { cookies } from "next/headers";

const DRAFT_COOKIE = "student_new_draft";
async function readDraft() {
  try {
    const jar = await cookies();
    const raw = jar.get(DRAFT_COOKIE)?.value;
    if (!raw) return null;
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch { return null; }
}
async function saveDraft(formData: FormData) {
  try {
    const data: any = {};
    for (const [k, v] of formData.entries()) {
      if (k === "siblings") { (data.siblings ||= []).push(String(v)); continue; }
      data[k] = String(v);
    }
    const raw = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
    const jar = await cookies();
    jar.set(DRAFT_COOKIE, raw, { path: "/students/new", httpOnly: true, sameSite: "lax", maxAge: 60 * 15 });
  } catch {}
}
async function clearDraft() { try { const jar = await cookies(); jar.delete(DRAFT_COOKIE); } catch {} }

async function createStudent(formData: FormData) {
  "use server";
  const user = await getAuthUser();
  if (user?.role !== "ADMIN") redirect("/login");
  const session = await getCurrentSession();
  if (!session || session.status !== "ACTIVE") { await saveDraft(formData); redirect("/students/new?error=session"); }
  const count = await prisma.student.count();
  const admissionNo = String(formData.get("admissionNo") || "").trim();
  const registrationNo = formatRegNo(count + 1); // internal, not shown on admission form
  const rollNo = String(formData.get("rollNo") || "").trim() || null;
  const feeExempt = formData.get("feeExempt") === "on";
  const statusInput = String(formData.get("status") || "REGISTERED").trim().toUpperCase();
  const status = statusInput === "ACTIVE" ? "ACTIVE" : "REGISTERED";
  const applicationNo = String(formData.get("applicationNo") || "").trim();
  const ageInput = String(formData.get("age") || "").trim();
  const gender = String(formData.get("gender") || "").trim();
  const admissionClass = String(formData.get("admissionClass") || "").trim();
  const fatherOrMotherName = String(formData.get("fatherName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const missing: string[] = [];
  if (!admissionNo) missing.push("Admission No");
  if (!applicationNo) missing.push("Application No");
  if (!rollNo) missing.push("Roll No");
  if (!ageInput) missing.push("Age");
  if (!gender) missing.push("Gender");
  if (!admissionClass) missing.push("Class for Admission");
  if (!fatherOrMotherName) missing.push("Father/Mother Name");
  if (!phone) missing.push("Phone No");
  if (!address) missing.push("Address");
  if (missing.length) {
    await saveDraft(formData);
    redirect(`/students/new?error=required&missing=${encodeURIComponent(missing.join(", "))}`);
  }
  if (rollNo) {
    const conflict = await prisma.studentEnrollment.findFirst({ where: { sessionId: session.id, rollNo } });
    if (conflict) { await saveDraft(formData); redirect("/students/new?error=roll"); }
  }
  const nameEn = String(formData.get("nameEn") || "").trim();
  if (!nameEn) { await saveDraft(formData); redirect("/students/new?error=required"); }
  const dob = parseDateInput(formData.get("dob"));
  const enteredAgeText = String(formData.get("age") || "").trim();
  if (dob && enteredAgeText) {
    const enteredMatch = enteredAgeText.match(/\d+/);
    if (enteredMatch) {
      const enteredYears = Number(enteredMatch[0]);
      const now = new Date();
      let dobYears = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) dobYears--;
      if (dobYears >= 0 && dobYears <= 130 && enteredYears !== dobYears) {
        await saveDraft(formData);
        redirect("/students/new?error=age");
      }
    }
  }
  const computedAge = (() => {
    if (!dob) return enteredAgeText || null;
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--;
    return (years >= 0 && years <= 130) ? `${years} years` : (enteredAgeText || null);
  })();
  try {
    const student = await prisma.student.create({
      data: {
        admissionNo, registrationNo,
        applicationNo,
        nameEn,
        nameUr: String(formData.get("nameUr") || "") || null,
        fatherName: fatherOrMotherName,
        motherName: String(formData.get("motherName") || "") || null,
        guardianName: String(formData.get("guardianName") || "") || null,
        gender,
        age: computedAge,
        admissionClass,
        dob,
        address,
        phone,
        previousSchool: String(formData.get("previousSchool") || "") || null,
        status,
      }
    });
    try {
      await prisma.studentEnrollment.create({ data: { studentId: student.id, sessionId: session.id, rollNo, rollLocked: !!rollNo, feeExempt, monthlyFee: feeExempt ? 0 : undefined } as any });
    } catch {
      await prisma.student.delete({ where: { id: student.id } }).catch(() => {});
      await saveDraft(formData);
      redirect("/students/new?error=roll");
    }
    const siblingIds = Array.from(new Set(formData.getAll("siblings").map(String).filter(Boolean)));
    if (siblingIds.length) {
      const pairs = siblingIds.map((sid) => {
        const [a, b] = student.id < sid ? [student.id, sid] : [sid, student.id];
        return { studentAId: a, studentBId: b };
      });
      await prisma.sibling.createMany({ data: pairs, skipDuplicates: true });
    }
    await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "STUDENT_CREATE", entityType: "Student", entityId: student.id, details: JSON.stringify({ admissionNo: student.admissionNo, nameEn: student.nameEn, sessionId: session.id }) });
    await clearDraft();
    revalidatePath("/students");
    redirect(`/students?highlight=${student.id}`);
  } catch (e: any) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    console.error("createStudent failed", e);
    await saveDraft(formData);
    redirect("/students/new?error=save");
  }
}

export default async function NewStudent({ searchParams }: { searchParams?: Promise<{ error?: string; missing?: string }> }) {
  const user = await getAuthUser(); if (user?.role !== "ADMIN") redirect("/dashboard");
  const session = await getCurrentSession(); if (!session) return <p>Create an active session first.</p>;
  const sp = (await searchParams) || {};
  const draft = sp.error ? await readDraft() : null;
  if (!sp.error) await clearDraft();
  const [all, prev] = await Promise.all([
    prisma.student.findMany({ select: { id: true, admissionNo: true, nameEn: true, fatherName: true }, orderBy: { admissionNo: "asc" } }),
    prisma.student.findMany({
      select: { age: true, admissionClass: true, previousSchool: true, fatherName: true, motherName: true, phone: true, address: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);
  const uniq = (vals: (string | null | undefined)[]) => Array.from(new Set(vals.map(v => (v || "").trim()).filter(Boolean))).slice(0, 50);
  const ageOpts = uniq(prev.map(p => p.age));
  const classOpts = uniq(prev.map(p => p.admissionClass));
  const schoolOpts = uniq(prev.map(p => p.previousSchool));
  const parentOpts = uniq(prev.flatMap(p => [p.fatherName, p.motherName]));
  const phoneOpts = uniq(prev.map(p => p.phone));
  const addressOpts = uniq(prev.map(p => p.address));
  return (
    <div className="max-w-5xl space-y-4">
      <ScrollToTopOnError active={!!sp.error} />
      <Link href="/students" className="inline-flex items-center gap-2 text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back / واپس</Link>
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Student Admission / طالبہ کا داخلہ فارم</h1>
        <p className="text-sm text-emerald-50 mt-1">Session: <b>{session.name}</b> — داخلہ فارم کے مطابق معلومات درج کریں۔</p>
      </div>
      {sp.error === "roll" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          یہ Roll No یا Admission No پہلے سے استعمال میں ہے۔ براہِ کرم درست/منفرد معلومات درج کریں۔
        </div>
      )}
      {sp.error === "session" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          کوئی فعال سیشن موجود نہیں۔ پہلے فعال سیشن بنائیں/منتخب کریں۔
        </div>
      )}
      {sp.error === "required" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          Please fill all required fields: Admission No, Application No, Roll No, Name (English), Age, Gender, Class for Admission, Father/Mother Name, Phone No, and Address.
          {sp.missing ? <div className="mt-1 font-medium">Missing: {sp.missing}</div> : null}
        </div>
      )}
      {sp.error === "age" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          درج کی گئی عمر تاریخِ پیدائش کے مطابق نہیں ہے۔ براہِ کرم درست عمر یا درست تاریخِ پیدائش درج کریں۔
        </div>
      )}
      {sp.error === "save" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          محفوظ نہیں ہو سکا۔ براہِ کرم معلومات چیک کریں (مثلاً Admission No / Roll No پہلے سے موجود نہ ہو) اور دوبارہ کوشش کریں۔
        </div>
      )}
      <form action={createStudent} className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">1</span>
            <h2 className="font-semibold text-emerald-900">Office Use / دفتری استعمال</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <div><label className="text-sm text-gray-700">Session / تعلیمی سیشن</label><input value={session.name} disabled className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50"/></div>
            <div><label className="text-sm text-gray-700">Roll No / رول نمبر</label><input name="rollNo" required defaultValue={draft?.rollNo || ""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200" placeholder="e.g. 1"/></div>
            <div><label className="text-sm text-gray-700">Application No / درخواست نمبر</label><input name="applicationNo" required defaultValue={draft?.applicationNo || ""} placeholder="e.g. MSB-01" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div><label className="text-sm text-gray-700">Admission No / داخلہ نمبر</label><input name="admissionNo" required defaultValue={draft?.admissionNo || ""} placeholder="e.g. MSB-01" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div>
              <label className="text-sm text-gray-700">Status / حیثیت</label>
              <select name="status" defaultValue={draft?.status || "REGISTERED"} className="mt-1 block w-full h-[42px] border border-gray-200 rounded-lg px-3 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-200" style={{ paddingTop: 0, paddingBottom: 0, lineHeight: "40px" }}>
                <option value="REGISTERED">REGISTERED</option>
                <option value="ACTIVE">ACTIVE</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60">
            <input id="feeExempt" name="feeExempt" type="checkbox" defaultChecked={draft?.feeExempt === "on"} className="mt-1 h-4 w-4" />
            <label htmlFor="feeExempt" className="text-sm text-gray-800">
              <span className="font-medium">Fee Exempt / فیس معاف</span>
              <span className="block text-xs text-gray-600 mt-0.5">No fee will be collected from this student (admission/record will remain).</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">2</span>
            <h2 className="font-semibold text-emerald-900">Student Information / طالب/طالبہ کی معلومات</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="text-sm text-gray-700">Student Name (English) / طالب/طالبہ کا نام (انگریزی)</label><input name="nameEn" required defaultValue={draft?.nameEn || ""} placeholder="Student name in English" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div><label className="text-sm text-gray-700">Student Name (Urdu) / طالب/طالبہ کا نام (اردو)</label><input name="nameUr" dir="rtl" defaultValue={draft?.nameUr || ""} placeholder="طالب یا طالبہ کا نام اردو میں" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 font-urdu text-right focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div>
              <label className="text-sm text-gray-700">Age / عمر</label>
              <div className="mt-1">
                <SuggestionInput name="age" required defaultValue={draft?.age || ""} suggestions={ageOpts} className="w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="e.g. 8 years" />
              </div>
            </div>
            <div><label className="text-sm text-gray-700">Date of Birth / تاریخ پیدائش</label><DateInputDMY name="dob" defaultValue={draft?.dob || ""} className="mt-1" inputClassName="border border-gray-200 rounded-lg px-3 py-2.5" /></div>
            <div>
              <label className="text-sm text-gray-700">Gender / جنس</label>
              <select name="gender" required defaultValue={draft?.gender || ""} className="mt-1 block w-full h-[42px] border border-gray-200 rounded-lg px-3 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-200" style={{ paddingTop: 0, paddingBottom: 0, lineHeight: "40px" }}>
                <option value="" disabled>Gender</option>
                <option value="Male">Male / لڑکا</option>
                <option value="Female">Female / لڑکی</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-700">Class for Admission / کس جماعت میں داخلہ چاہیے</label>
              <div className="mt-1">
                <SuggestionInput name="admissionClass" required defaultValue={draft?.admissionClass || ""} suggestions={classOpts} className="w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="e.g. Nazra / Class 1" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">3</span>
            <h2 className="font-semibold text-emerald-900">Parents Information / والدین کی معلومات</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700">Father / Mother Name / والد یا والدہ کا نام</label>
              <div className="mt-1">
                <SuggestionInput name="fatherName" required defaultValue={draft?.fatherName || ""} suggestions={parentOpts} className="w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="Father / Mother Name" />
              </div>
              <input type="hidden" name="motherName" value="" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Phone No / فون نمبر</label>
              <PhoneInput name="phone" required defaultValue={draft?.phone || ""} suggestions={phoneOpts} placeholder="03XX-XXXXXXX" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700">Address / پتہ</label>
              <div className="mt-1">
                <SuggestionInput name="address" required defaultValue={draft?.address || ""} suggestions={addressOpts} className="w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="Full address" />
              </div>
            </div>
            <input type="hidden" name="guardianName" value="" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">4</span>
            <h2 className="font-semibold text-emerald-900">Previous Education / سابقہ تعلیم</h2>
          </div>
          <div>
            <label className="text-sm text-gray-700">Previous School/Madrasa / سابقہ مدرسہ/سکول</label>
            <div className="mt-1">
              <SuggestionInput name="previousSchool" defaultValue={draft?.previousSchool || ""} suggestions={schoolOpts} className="w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="Previous school or madrasa" />
            </div>
          </div>
        </div>

        <details className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 group">
          <summary className="cursor-pointer list-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-emerald-900 break-words">Add Siblings / بہن بھائی شامل کریں (اختیاری)</div>
              <p className="text-xs text-gray-500 mt-0.5">If any siblings are already registered, select them here.</p>
            </div>
            <span className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg self-start shrink-0">+ Add Siblings</span>
          </summary>
          <div className="mt-4 border-t pt-4">
            <label className="text-sm text-gray-700">Select from registered students (Admission No order)</label>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto pr-1">
              {all.map(s => (
                <label key={s.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 hover:bg-emerald-50 cursor-pointer">
                  <input type="checkbox" name="siblings" value={s.id} defaultChecked={Array.isArray(draft?.siblings) ? draft.siblings.includes(s.id) : draft?.siblings === s.id} className="h-4 w-4 shrink-0" />
                  <span className="text-sm text-gray-800 break-words"><span className="font-medium text-emerald-800">{s.admissionNo}</span> - {s.nameEn}{s.fatherName ? <span className="text-gray-500"> — {s.fatherName}</span> : null}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Select all siblings that apply. Leave empty if not needed.</p>
          </div>
        </details>

        <div className="flex items-center justify-end gap-3">
          <button type="submit" className="bg-emerald-800 hover:bg-emerald-900 text-white px-6 py-3 rounded-xl font-semibold shadow-sm">Save & Enroll in Current Session</button>
        </div>
      </form>
    </div>
  );
}
