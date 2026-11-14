import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseDateInput, toDateInputDMY } from "@/lib/utils";
import DateInputDMY from "@/components/DateInputDMY";
import ScrollToTopOnError from "@/components/ScrollToTopOnError";

async function updateStudent(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const id = String(formData.get("id"));
  const sessionId = String(formData.get("sessionId") || "");
  const rollNoInput = String(formData.get("rollNo") || "").trim() || null;
  const feeExempt = formData.get("feeExempt") === "on";
  const dob = parseDateInput(formData.get("dob"));
  const enteredAgeText = String(formData.get("age")||"").trim();
  if (dob && enteredAgeText) {
    const enteredMatch = enteredAgeText.match(/\d+/);
    if (enteredMatch) {
      const enteredYears = Number(enteredMatch[0]);
      const now = new Date();
      let dobYears = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) dobYears--;
      if (dobYears >= 0 && dobYears <= 130 && enteredYears !== dobYears) {
        redirect(`/students/${id}/edit?error=age`);
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
  await prisma.student.update({ where: { id }, data: {
    applicationNo: String(formData.get("applicationNo")||"") || null,
    nameEn: String(formData.get("nameEn")||""), nameUr: String(formData.get("nameUr")||"") || null,
    fatherName: (() => { const v = String(formData.get("fatherMotherName")||formData.get("fatherName")||"").trim(); if (!v) return null; const parts = v.split(/\s*\/\s*|\s+-\s+/); return (parts[0]||"").trim() || null; })(),
    motherName: (() => { const v = String(formData.get("fatherMotherName")||formData.get("fatherName")||"").trim(); if (!v) return null; const parts = v.split(/\s*\/\s*|\s+-\s+/); return (parts.slice(1).join(" / ")||"").trim() || null; })(),
    guardianName: String(formData.get("guardianName")||"") || null,
    gender: String(formData.get("gender")||"") || null,
    age: computedAge,
    admissionClass: String(formData.get("admissionClass")||"") || null,
    dob,
    address: String(formData.get("address")||"") || null,
    phone: String(formData.get("phone")||"") || null,
    previousSchool: String(formData.get("previousSchool")||"") || null,
    status: String(formData.get("status")||"ACTIVE"),
  }});
  if (sessionId) {
    const existing = await prisma.studentEnrollment.findUnique({
      where: { studentId_sessionId: { studentId: id, sessionId } },
      select: { rollNo: true, rollLocked: true }
    });
    const locked = !!(existing?.rollLocked && existing?.rollNo);
    const rollNo = locked ? existing!.rollNo : rollNoInput;
    if (rollNo) {
      const conflict = await prisma.studentEnrollment.findFirst({ where: { sessionId, rollNo, NOT: { studentId: id } }, select: { id: true } });
      if (conflict) redirect(`/students/${id}/edit?error=roll`);
    }
    const rollLocked = !!rollNo; // once a roll no is set for this session, lock it
    try {
      await prisma.studentEnrollment.upsert({
        where: { studentId_sessionId: { studentId: id, sessionId } },
        update: { rollNo, rollLocked, feeExempt, ...(feeExempt ? { monthlyFee: 0 } : {}) } as any,
        create: { studentId: id, sessionId, rollNo, rollLocked, feeExempt, monthlyFee: feeExempt ? 0 : null } as any,
      });
    } catch {
      redirect(`/students/${id}/edit?error=roll`);
    }
  }
  await prisma.sibling.deleteMany({ where: { OR: [{ studentAId: id }, { studentBId: id }] } });
  const siblingIds = Array.from(new Set(formData.getAll("siblings").map(String).filter(Boolean).filter(s=>s!==id)));
  if (siblingIds.length) {
    const pairs = siblingIds.map((sid) => {
      const [a,b] = id < sid ? [id, sid] : [sid, id];
      return { studentAId: a, studentBId: b };
    });
    await prisma.sibling.createMany({ data: pairs, skipDuplicates: true });
  }
  revalidatePath(`/students/${id}`); revalidatePath("/students"); redirect(`/students`);
}

export default async function EditStudent({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<{ error?: string }> }) {
  const user = await getAuthUser(); if (user?.role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  const sp = (await searchParams) || {};
  const session = await getCurrentSession();
  const student = await prisma.student.findUnique({ where: { id }, include: { siblingsA: true, siblingsB: true } });
  if (!student) notFound();
  const enrollment = session ? await prisma.studentEnrollment.findUnique({ where: { studentId_sessionId: { studentId: id, sessionId: session.id } } }) : null;
  const all = await prisma.student.findMany({ where: { id: { not: id } }, orderBy: { nameEn: "asc" } });
  const currentSibs = new Set([...student.siblingsA.map(s=>s.studentBId), ...student.siblingsB.map(s=>s.studentAId)]);
  return (
    <div className="max-w-5xl space-y-4">
      <ScrollToTopOnError active={!!sp.error} />
      <Link href={`/students/${student.id}`} className="inline-flex items-center gap-2 text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back</Link>
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Edit Student</h1>
        <p className="text-sm text-emerald-50 mt-1">{student.admissionNo} — {student.nameEn}</p>
      </div>
      {sp.error === "roll" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          یہ Roll No پہلے سے استعمال میں ہے۔ ہر طالب علم کا Roll No اس سیشن میں منفرد ہونا چاہیے۔
        </div>
      )}
      {sp.error === "age" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          درج کی گئی عمر تاریخِ پیدائش کے مطابق نہیں ہے۔ براہِ کرم درست عمر یا درست تاریخِ پیدائش درج کریں۔
        </div>
      )}
      <form action={updateStudent} className="space-y-4">
        <input type="hidden" name="id" value={student.id} />
        <input type="hidden" name="sessionId" value={session?.id || ""} />
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3"><span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">1</span><h2 className="font-semibold text-emerald-900">Office Use</h2></div>
          <div className="grid md:grid-cols-4 gap-4">
            <div><label className="text-sm text-gray-700">Admission No</label><input value={student.admissionNo} disabled className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50"/></div>
            <div>
              <label className="text-sm text-gray-700">Roll No (Session)</label>
              <input
                name="rollNo"
                defaultValue={enrollment?.rollNo || ""}
                placeholder={session ? `Session ${session.name}` : "No active session"}
                disabled={!session || !!(enrollment as any)?.rollLocked}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 disabled:bg-gray-50"
              />

            </div>
            <div><label className="text-sm text-gray-700">Application No</label><input name="applicationNo" defaultValue={student.applicationNo||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <div><label className="text-sm text-gray-700">Status</label><select name="status" defaultValue={student.status || "ACTIVE"} className="mt-1 block w-full h-[42px] border border-gray-200 rounded-lg px-3 py-0 leading-[40px] bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"><option value="REGISTERED">REGISTERED</option><option value="ACTIVE">ACTIVE</option><option value="LEFT">LEFT</option></select></div>
          </div>
          <div className="mt-4 flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60">
            <input id="feeExempt" name="feeExempt" type="checkbox" defaultChecked={!!(enrollment as any)?.feeExempt} className="mt-1 h-4 w-4" />
            <label htmlFor="feeExempt" className="text-sm text-gray-800">
              <span className="font-medium">Fee Exempt / فیس معاف</span>
              <span className="block text-xs text-gray-600 mt-0.5">No fee will be collected from this student (admission/record will remain).</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3"><span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">2</span><h2 className="font-semibold text-emerald-900">Student Information</h2></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="text-sm text-gray-700">Student Name (English)</label><input name="nameEn" defaultValue={student.nameEn} required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <div><label className="text-sm text-gray-700">Student Name (Urdu)</label><input name="nameUr" defaultValue={student.nameUr||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 font-urdu"/></div>
            <div><label className="text-sm text-gray-700">Age</label><input name="age" defaultValue={student.age||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <div><label className="text-sm text-gray-700">Date of Birth</label><DateInputDMY name="dob" defaultValue={toDateInputDMY(student.dob)} className="mt-1" inputClassName="border border-gray-200 rounded-lg px-3 py-2.5" /></div>
            <div><label className="text-sm text-gray-700">Gender</label><select name="gender" defaultValue={student.gender||""} className="mt-1 block w-full h-[42px] border border-gray-200 rounded-lg px-3 py-0 leading-[40px] bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
            <div><label className="text-sm text-gray-700">Class for Admission</label><input name="admissionClass" defaultValue={student.admissionClass||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3"><span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">3</span><h2 className="font-semibold text-emerald-900">Parents Information</h2></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700">Father / Mother Name</label>
              <input name="fatherMotherName" defaultValue={[student.fatherName, student.motherName].filter(Boolean).join(" / ")} placeholder="Father Name / Mother Name" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/>
            </div>
            <div><label className="text-sm text-gray-700">Phone No</label><input name="phone" defaultValue={student.phone||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <div className="md:col-span-2"><label className="text-sm text-gray-700">Address</label><input name="address" defaultValue={student.address||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <input type="hidden" name="guardianName" value={student.guardianName||""} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3"><span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">4</span><h2 className="font-semibold text-emerald-900">Previous Education</h2></div>
          <div><label className="text-sm text-gray-700">Previous School/Madrasa</label><input name="previousSchool" defaultValue={student.previousSchool||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
        </div>

        <details className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <div>
              <div className="font-semibold text-emerald-900">Add/Manage Siblings</div>
              <p className="text-xs text-gray-500 mt-0.5">Select/update registered siblings.</p>
            </div>
            <span className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg">+ Add Siblings</span>
          </summary>
          <div className="mt-4 border-t pt-4">
            <label className="text-sm text-gray-700">Select from registered students</label>
            <select name="siblings" multiple defaultValue={[...currentSibs]} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 h-36">{all.map(s => <option key={s.id} value={s.id}>{s.admissionNo} - {s.nameEn}</option>)}</select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple.</p>
          </div>
        </details>

        <div className="flex items-center justify-end gap-3">
          <button type="submit" className="bg-emerald-800 hover:bg-emerald-900 text-white px-6 py-3 rounded-xl font-semibold shadow-sm">Update Student</button>
        </div>
      </form>
    </div>
  );
}
