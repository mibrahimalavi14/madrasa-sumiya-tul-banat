import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatAdmissionNo, formatRegNo, parseDateInput } from "@/lib/utils";
import DateInputDMY from "@/components/DateInputDMY";
import ScrollToTopOnError from "@/components/ScrollToTopOnError";

async function createStudent(formData: FormData) {
  "use server";
  const user = await getAuthUser();
  if (user?.role !== "ADMIN") redirect("/login");
  const session = await getCurrentSession();
  if (!session || session.status !== "ACTIVE") redirect("/students/new?error=session");
  const count = await prisma.student.count();
  const admissionNo = String(formData.get("admissionNo") || "").trim() || formatAdmissionNo(count + 1);
  const registrationNo = formatRegNo(count + 1); // internal, not shown on admission form
  const rollNo = String(formData.get("rollNo") || "").trim() || null;
  const feeExempt = formData.get("feeExempt") === "on";
  if (rollNo) {
    const conflict = await prisma.studentEnrollment.findFirst({ where: { sessionId: session.id, rollNo } });
    if (conflict) redirect("/students/new?error=roll");
  }
  const nameEn = String(formData.get("nameEn") || "").trim();
  if (!nameEn) redirect("/students/new?error=required");
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
        applicationNo: String(formData.get("applicationNo") || "") || null,
        nameEn,
        nameUr: String(formData.get("nameUr") || "") || null,
        fatherName: String(formData.get("fatherName") || "") || null,
        motherName: String(formData.get("motherName") || "") || null,
        guardianName: String(formData.get("guardianName") || "") || null,
        gender: String(formData.get("gender") || "") || null,
        age: computedAge,
        admissionClass: String(formData.get("admissionClass") || "") || null,
        dob,
        address: String(formData.get("address") || "") || null,
        phone: String(formData.get("phone") || "") || null,
        previousSchool: String(formData.get("previousSchool") || "") || null,
        status: "REGISTERED",
      }
    });
    try {
      await prisma.studentEnrollment.create({ data: { studentId: student.id, sessionId: session.id, rollNo, rollLocked: !!rollNo, feeExempt, monthlyFee: feeExempt ? 0 : undefined } as any });
    } catch {
      await prisma.student.delete({ where: { id: student.id } }).catch(() => {});
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
    revalidatePath("/students");
    redirect("/students");
  } catch (e: any) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    console.error("createStudent failed", e);
    redirect("/students/new?error=save");
  }
}

export default async function NewStudent({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const user = await getAuthUser(); if (user?.role !== "ADMIN") redirect("/dashboard");
  const session = await getCurrentSession(); if (!session) return <p>Create an active session first.</p>;
  const sp = (await searchParams) || {};
  const [all, prev] = await Promise.all([
    prisma.student.findMany({ select: { id: true, admissionNo: true, nameEn: true }, orderBy: { nameEn: "asc" } }),
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
        <h1 className="text-2xl font-bold">Student Admission / طالب/طالبہ کا داخلہ</h1>
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
          Student Name (English) ضروری ہے۔
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
            <div><label className="text-sm text-gray-700">Roll No / رول نمبر</label><input name="rollNo" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200" placeholder="e.g. 1"/></div>
            <div><label className="text-sm text-gray-700">Application No / درخواست نمبر</label><input name="applicationNo" placeholder="e.g. APP-001" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div><label className="text-sm text-gray-700">Admission No / داخلہ نمبر</label><input name="admissionNo" placeholder="Leave empty for auto / خالی چھوڑیں تو خود بنے گا" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
          </div>
          <div className="mt-4 flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60">
            <input id="feeExempt" name="feeExempt" type="checkbox" className="mt-1 h-4 w-4" />
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
            <div><label className="text-sm text-gray-700">Student Name (English) / طالب/طالبہ کا نام (انگریزی)</label><input name="nameEn" required placeholder="Student name in English" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div><label className="text-sm text-gray-700">Student Name (Urdu) / طالب/طالبہ کا نام (اردو)</label><input name="nameUr" placeholder="طالب/طالبہ کا نام" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 font-urdu focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div>
              <label className="text-sm text-gray-700">Age / عمر</label>
              <input name="age" list="prev-ages" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="e.g. 8 years"/>
              <datalist id="prev-ages">{ageOpts.map((v) => <option key={v} value={v} />)}</datalist>
            </div>
            <div><label className="text-sm text-gray-700">Date of Birth / تاریخ پیدائش</label><DateInputDMY name="dob" className="mt-1" inputClassName="border border-gray-200 rounded-lg px-3 py-2.5" /></div>
            <div><label className="text-sm text-gray-700">Gender / جنس</label><select name="gender" className="mt-1 block w-full h-[46px] border border-gray-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"><option value="">Select</option><option value="Male">Male / لڑکا</option><option value="Female">Female / لڑکی</option></select></div>
            <div>
              <label className="text-sm text-gray-700">Class for Admission / کس جماعت میں داخلہ چاہیے</label>
              <input name="admissionClass" list="prev-classes" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="e.g. Nazra / Class 1"/>
              <datalist id="prev-classes">{classOpts.map((v) => <option key={v} value={v} />)}</datalist>
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
              <input name="fatherName" list="prev-parents" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="Father / Mother Name" />
              <datalist id="prev-parents">{parentOpts.map((v) => <option key={v} value={v} />)}</datalist>
              <input type="hidden" name="motherName" value="" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Phone No / فون نمبر</label>
              <input name="phone" list="prev-phones" placeholder="e.g. 03XXXXXXXXX" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/>
              <datalist id="prev-phones">{phoneOpts.map((v) => <option key={v} value={v} />)}</datalist>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700">Address / پتہ</label>
              <input name="address" list="prev-addresses" placeholder="Full address" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/>
              <datalist id="prev-addresses">{addressOpts.map((v) => <option key={v} value={v} />)}</datalist>
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
            <input name="previousSchool" list="prev-schools" placeholder="Previous school or madrasa" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/>
            <datalist id="prev-schools">{schoolOpts.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
        </div>

        <details className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 group">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <div>
              <div className="font-semibold text-emerald-900">Add Siblings / بہن بھائی شامل کریں (اختیاری)</div>
              <p className="text-xs text-gray-500 mt-0.5">If any siblings are already registered, select them here.</p>
            </div>
            <span className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg">+ Add Siblings</span>
          </summary>
          <div className="mt-4 border-t pt-4">
            <label className="text-sm text-gray-700">Select from registered students</label>
            <select name="siblings" multiple className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 h-36">
              {all.map(s => <option key={s.id} value={s.id}>{s.admissionNo} - {s.nameEn}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple. Leave empty if not needed.</p>
          </div>
        </details>

        <div className="flex items-center justify-end gap-3">
          <button type="submit" className="bg-emerald-800 hover:bg-emerald-900 text-white px-6 py-3 rounded-xl font-semibold shadow-sm">Save & Enroll in Current Session</button>
        </div>
      </form>
    </div>
  );
}
