import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatAdmissionNo, formatRegNo, parseDateInput } from "@/lib/utils";
import DateInputDMY from "@/components/DateInputDMY";

async function createStudent(formData: FormData) {
  "use server";
  const user = await getAuthUser();
  if (user?.role !== "ADMIN") redirect("/login");
  const session = await getCurrentSession();
  if (!session || session.status !== "ACTIVE") redirect("/students/new?error=session");
  const count = await prisma.student.count();
  const admissionNo = String(formData.get("admissionNo")||"").trim() || formatAdmissionNo(count + 1);
  const registrationNo = formatRegNo(count + 1); // internal, not shown on admission form
  const rollNo = String(formData.get("rollNo") || "").trim() || null;
  const feeExempt = formData.get("feeExempt") === "on";
  if (rollNo) {
    const conflict = await prisma.studentEnrollment.findFirst({ where: { sessionId: session.id, rollNo } });
    if (conflict) redirect("/students/new?error=roll");
  }
  const nameEn = String(formData.get("nameEn")||"").trim();
  if (!nameEn) redirect("/students/new?error=required");
  try {
    const student = await prisma.student.create({
      data: {
        admissionNo, registrationNo,
        applicationNo: String(formData.get("applicationNo")||"") || null,
        nameEn,
        nameUr: String(formData.get("nameUr")||"") || null,
        fatherName: String(formData.get("fatherName")||"") || null,
        motherName: String(formData.get("motherName")||"") || null,
        guardianName: String(formData.get("guardianName")||"") || null,
        gender: String(formData.get("gender")||"") || null,
        age: String(formData.get("age")||"") || null,
        admissionClass: String(formData.get("admissionClass")||"") || null,
        dob: parseDateInput(formData.get("dob")),
        address: String(formData.get("address")||"") || null,
        phone: String(formData.get("phone")||"") || null,
        previousSchool: String(formData.get("previousSchool")||"") || null,
        status: "ACTIVE",
      }
    });
    try {
      await prisma.studentEnrollment.create({ data: { studentId: student.id, sessionId: session.id, rollNo, feeExempt, monthlyFee: feeExempt ? 0 : undefined } as any });
    } catch {
      await prisma.student.delete({ where: { id: student.id } }).catch(() => {});
      redirect("/students/new?error=roll");
    }
    const siblingIds = formData.getAll("siblings").map(String).filter(Boolean);
    for (const sid of siblingIds) {
      const [a,b] = student.id < sid ? [student.id, sid] : [sid, student.id];
      await prisma.sibling.upsert({ where: { studentAId_studentBId: { studentAId: a, studentBId: b } }, update: {}, create: { studentAId: a, studentBId: b } });
    }
    revalidatePath("/students");
    redirect(`/students/${student.id}`);
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
  const all = await prisma.student.findMany({ orderBy: { nameEn: "asc" } });
  const count = await prisma.student.count();
  return (
    <div className="max-w-5xl space-y-4">
      <Link href="/students" className="inline-flex items-center gap-2 text-sm text-emerald-800 hover:text-emerald-900 font-medium">ΓåÉ Back / ┘ê╪º┘╛╪│</Link>
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Student Admission / ╪╖╪º┘ä╪¿/╪╖╪º┘ä╪¿█ü ┌⌐╪º ╪»╪º╪«┘ä█ü</h1>
        <p className="text-sm text-emerald-50 mt-1">Session: <b>{session.name}</b> ΓÇö admission form ke mutabiq maloomat darj karein.</p>
      </div>
      {sp.error === "roll" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          █î█ü Roll No ┘╛█ü┘ä█Æ ╪│█Æ ╪º╪│╪¬╪╣┘à╪º┘ä ┘à█î┌║ █ü█Æ█ö █ü╪▒ ╪╖╪º┘ä╪¿ ╪╣┘ä┘à ┌⌐╪º Roll No ┘à┘å┘ü╪▒╪» █ü┘ê┘å╪º ┌å╪º█ü█î█Æ█ö
        </div>
      )}
      <form action={createStudent} className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">1</span>
            <h2 className="font-semibold text-emerald-900">Office Use / ╪»┘ü╪¬╪▒█î ╪º╪│╪¬╪╣┘à╪º┘ä</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <div><label className="text-sm text-gray-700">Session / ╪¬╪╣┘ä█î┘à█î ╪│█î╪┤┘å</label><input value={session.name} disabled className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50"/></div>
            <div><label className="text-sm text-gray-700">Roll No / ╪▒┘ê┘ä ┘å┘à╪¿╪▒</label><input name="rollNo" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200" placeholder="e.g. 1"/></div>
            <div><label className="text-sm text-gray-700">Application No / ╪»╪▒╪«┘ê╪º╪│╪¬ ┘å┘à╪¿╪▒</label><input name="applicationNo" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div><label className="text-sm text-gray-700">Admission No / ╪»╪º╪«┘ä█ü ┘å┘à╪¿╪▒</label><input name="admissionNo" defaultValue={formatAdmissionNo(count+1)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
          </div>
          <div className="mt-4 flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60">
            <input id="feeExempt" name="feeExempt" type="checkbox" className="mt-1 h-4 w-4" />
            <label htmlFor="feeExempt" className="text-sm text-gray-800">
              <span className="font-medium">Fee Exempt / ┘ü█î╪│ ┘à╪╣╪º┘ü</span>
              <span className="block text-xs text-gray-600 mt-0.5">╪º╪│ ╪╖╪º┘ä╪¿ ╪╣┘ä┘à ╪│█Æ ┘ü█î╪│ ┘ê╪╡┘ê┘ä ┘å█ü█î┌║ ┌⌐█î ╪¼╪º╪¬█î (╪»╪º╪«┘ä█ü/╪▒█î┌⌐╪º╪▒┌ê ╪¿╪▒┘é╪▒╪º╪▒ ╪▒█ü█Æ ┌»╪º)█ö</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">2</span>
            <h2 className="font-semibold text-emerald-900">Student Information / ╪╖╪º┘ä╪¿/╪╖╪º┘ä╪¿█ü ┌⌐█î ┘à╪╣┘ä┘ê┘à╪º╪¬</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="text-sm text-gray-700">Student Name (English) / ╪╖╪º┘ä╪¿/╪╖╪º┘ä╪¿█ü ┌⌐╪º ┘å╪º┘à (╪º┘å┌»╪▒█î╪▓█î)</label><input name="nameEn" required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div><label className="text-sm text-gray-700">Student Name (Urdu) / ╪╖╪º┘ä╪¿/╪╖╪º┘ä╪¿█ü ┌⌐╪º ┘å╪º┘à (╪º╪▒╪»┘ê)</label><input name="nameUr" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 font-urdu focus:outline-none focus:ring-2 focus:ring-emerald-200"/></div>
            <div><label className="text-sm text-gray-700">Age / ╪╣┘à╪▒</label><input name="age" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="e.g. 8 years"/></div>
            <div><label className="text-sm text-gray-700">Date of Birth / ╪¬╪º╪▒█î╪« ┘╛█î╪»╪º╪ª╪┤</label><DateInputDMY name="dob" className="mt-1" inputClassName="border border-gray-200 rounded-lg px-3 py-2.5" /></div>
            <div><label className="text-sm text-gray-700">Gender / ╪¼┘å╪│</label><select name="gender" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white"><option value="">Select</option><option value="Male">Male / ┘ä┌æ┌⌐╪º</option><option value="Female">Female / ┘ä┌æ┌⌐█î</option></select></div>
            <div><label className="text-sm text-gray-700">Class for Admission / ┌⌐╪│ ╪¼┘à╪º╪╣╪¬ ┘à█î┌║ ╪»╪º╪«┘ä█ü ┌å╪º█ü█î█Æ</label><input name="admissionClass" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="e.g. Nazra / Class 1"/></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">3</span>
            <h2 className="font-semibold text-emerald-900">Parents Information / ┘ê╪º┘ä╪»█î┘å ┌⌐█î ┘à╪╣┘ä┘ê┘à╪º╪¬</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700">Father / Mother Name / ┘ê╪º┘ä╪» █î╪º ┘ê╪º┘ä╪»█ü ┌⌐╪º ┘å╪º┘à</label>
              <input name="fatherName" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5" placeholder="Father / Mother Name" />
              <input type="hidden" name="motherName" value="" />
            </div>
            <div><label className="text-sm text-gray-700">Phone No / ┘ü┘ê┘å ┘å┘à╪¿╪▒</label><input name="phone" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <div className="md:col-span-2"><label className="text-sm text-gray-700">Address / ┘╛╪¬█ü</label><input name="address" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <input type="hidden" name="guardianName" value="" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">4</span>
            <h2 className="font-semibold text-emerald-900">Previous Education / ╪│╪º╪¿┘é█ü ╪¬╪╣┘ä█î┘à</h2>
          </div>
          <div><label className="text-sm text-gray-700">Previous School/Madrasa / ╪│╪º╪¿┘é█ü ┘à╪»╪▒╪│█ü/╪│┌⌐┘ê┘ä</label><input name="previousSchool" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
        </div>

        <details className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 group">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <div>
              <div className="font-semibold text-emerald-900">Add Siblings / ╪¿█ü┘å ╪¿┌╛╪º╪ª█î ╪┤╪º┘à┘ä ┌⌐╪▒█î┌║ (╪º╪«╪¬█î╪º╪▒█î)</div>
              <p className="text-xs text-gray-500 mt-0.5">Agar pehle se registered behan bhai hain to yahan select karein.</p>
            </div>
            <span className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg">+ Add Siblings</span>
          </summary>
          <div className="mt-4 border-t pt-4">
            <label className="text-sm text-gray-700">Registered Students se select karein</label>
            <select name="siblings" multiple className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 h-36">
              {all.map(s => <option key={s.id} value={s.id}>{s.admissionNo} - {s.nameEn}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Multiple select ke liye Ctrl/Cmd dabayein. Zaroorat na ho to khali chhor dein.</p>
          </div>
        </details>

        <div className="flex items-center justify-end gap-3">
          <button type="submit" className="bg-emerald-800 hover:bg-emerald-900 text-white px-6 py-3 rounded-xl font-semibold shadow-sm">Save & Enroll in Current Session</button>
        </div>
      </form>
    </div>
  );
}
