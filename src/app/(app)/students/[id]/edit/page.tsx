import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseDateInput, toDateInputDMY } from "@/lib/utils";

async function updateStudent(formData: FormData) {
  "use server";
  const user = await getAuthUser(); if (user?.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  const id = String(formData.get("id"));
  const sessionId = String(formData.get("sessionId") || "");
  const rollNo = String(formData.get("rollNo") || "").trim() || null;
  await prisma.student.update({ where: { id }, data: {
    applicationNo: String(formData.get("applicationNo")||"") || null,
    nameEn: String(formData.get("nameEn")||""), nameUr: String(formData.get("nameUr")||"") || null,
    fatherName: String(formData.get("fatherName")||"") || null, motherName: String(formData.get("motherName")||"") || null,
    guardianName: String(formData.get("guardianName")||"") || null,
    gender: String(formData.get("gender")||"") || null,
    age: String(formData.get("age")||"") || null,
    admissionClass: String(formData.get("admissionClass")||"") || null,
    dob: parseDateInput(formData.get("dob")),
    address: String(formData.get("address")||"") || null,
    phone: String(formData.get("phone")||"") || null,
    previousSchool: String(formData.get("previousSchool")||"") || null,
    status: String(formData.get("status")||"ACTIVE"),
  }});
  if (sessionId) {
    if (rollNo) {
      const conflict = await prisma.studentEnrollment.findFirst({ where: { sessionId, rollNo, NOT: { studentId: id } }, select: { id: true } });
      if (conflict) redirect(`/students/${id}/edit?error=roll`);
    }
    try {
      await prisma.studentEnrollment.upsert({
        where: { studentId_sessionId: { studentId: id, sessionId } },
        update: { rollNo },
        create: { studentId: id, sessionId, rollNo },
      });
    } catch {
      redirect(`/students/${id}/edit?error=roll`);
    }
  }
  await prisma.sibling.deleteMany({ where: { OR: [{ studentAId: id }, { studentBId: id }] } });
  const siblingIds = formData.getAll("siblings").map(String).filter(Boolean).filter(s=>s!==id);
  for (const sid of siblingIds) {
    const [a,b] = id < sid ? [id, sid] : [sid, id];
    await prisma.sibling.upsert({ where: { studentAId_studentBId: { studentAId: a, studentBId: b } }, update: {}, create: { studentAId: a, studentBId: b } });
  }
  revalidatePath(`/students/${id}`); revalidatePath("/students"); redirect(`/students/${id}`);
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
      <form action={updateStudent} className="space-y-4">
        <input type="hidden" name="id" value={student.id} />
        <input type="hidden" name="sessionId" value={session?.id || ""} />
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3"><span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">1</span><h2 className="font-semibold text-emerald-900">Office Use</h2></div>
          <div className="grid md:grid-cols-4 gap-4">
            <div><label className="text-sm text-gray-700">Admission No</label><input value={student.admissionNo} disabled className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50"/></div>
            <div><label className="text-sm text-gray-700">Roll No (Session)</label><input name="rollNo" defaultValue={enrollment?.rollNo||""} placeholder={session ? `Session ${session.name}` : "No active session"} disabled={!session} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 disabled:bg-gray-50"/></div>
            <div><label className="text-sm text-gray-700">Application No</label><input name="applicationNo" defaultValue={student.applicationNo||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <div><label className="text-sm text-gray-700">Status</label><select name="status" defaultValue={student.status} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white"><option value="REGISTERED">REGISTERED</option><option value="ACTIVE">ACTIVE</option><option value="LEFT">LEFT</option></select></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3"><span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">2</span><h2 className="font-semibold text-emerald-900">Student Information</h2></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="text-sm text-gray-700">Student Name (English)</label><input name="nameEn" defaultValue={student.nameEn} required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <div><label className="text-sm text-gray-700">Student Name (Urdu)</label><input name="nameUr" defaultValue={student.nameUr||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 font-urdu"/></div>
            <div><label className="text-sm text-gray-700">Age</label><input name="age" defaultValue={student.age||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <div><label className="text-sm text-gray-700">Date of Birth</label><input name="dob" type="text" placeholder="DD/MM/YYYY" inputMode="numeric" defaultValue={toDateInputDMY(student.dob)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
            <div><label className="text-sm text-gray-700">Gender</label><select name="gender" defaultValue={student.gender||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
            <div><label className="text-sm text-gray-700">Class for Admission</label><input name="admissionClass" defaultValue={student.admissionClass||""} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5"/></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3"><span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold grid place-items-center">3</span><h2 className="font-semibold text-emerald-900">Parents Information</h2></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700">Father / Mother Name</label>
              <div className="mt-1 grid md:grid-cols-2 gap-3">
                <input name="fatherName" defaultValue={student.fatherName||""} placeholder="Father Name" className="w-full border border-gray-200 rounded-lg px-3 py-2.5"/>
                <input name="motherName" defaultValue={student.motherName||""} placeholder="Mother Name" className="w-full border border-gray-200 rounded-lg px-3 py-2.5"/>
              </div>
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
          <button className="bg-emerald-800 hover:bg-emerald-900 text-white px-6 py-3 rounded-xl font-semibold shadow-sm">Update Student</button>
        </div>
      </form>
    </div>
  );
}
