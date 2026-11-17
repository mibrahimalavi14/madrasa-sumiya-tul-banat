import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { formatDateDMY, formatAge } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

export default async function StudentProfile({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  const { id } = await params;
  if (user?.role === "PARENT" && user.parentStudentId !== id) redirect("/dashboard");
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      enrollments: { include: { session: true }, orderBy: { createdAt: "desc" } },
      results: { include: { exam: { include: { session: true } } }, orderBy: { createdAt: "desc" } },
      feePayments: { include: { session: true }, orderBy: [{ year: "desc" }, { month: "desc" }] },
      certificates: { include: { session: true }, orderBy: { issueDate: "desc" } },
      siblingsA: { include: { studentB: true } },
      siblingsB: { include: { studentA: true } },
    }
  });
  if (!student) notFound();
  const siblings = [...student.siblingsA.map(s=>s.studentB), ...student.siblingsB.map(s=>s.studentA)];
  const isAdmin = user?.role === "ADMIN";
  const currentSession = student.enrollments.find(e=>e.session.isCurrent)?.session?.name || student.enrollments[0]?.session?.name;
  const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="font-medium text-gray-900 break-words">{value || "-"}</div>
    </div>
  );
  return (
    <div className="space-y-5">
      <Link href="/students" className="inline-flex items-center gap-2 text-sm text-emerald-800 hover:text-emerald-900 font-medium no-print">← Back / واپس</Link>
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Student Profile</h1>
        <p className="text-emerald-50 mt-1">{student.admissionNo} — {student.nameEn} {student.nameUr ? <span className="font-urdu">/ {student.nameUr}</span> : ""}</p>
      </div>

      <div className={`grid gap-3 no-print ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-4 sm:p-5">
          <div className="text-lg font-bold text-emerald-900">Profile</div>
        </div>
        {isAdmin && (
          <Link href={`/students/${id}/edit`} className="bg-white rounded-2xl shadow-sm border border-blue-200 p-4 sm:p-5 hover:shadow-md hover:bg-blue-50/40 transition block">
            <div className="text-lg font-bold text-blue-800">Edit</div>
          </Link>
        )}
        <Link href={`/students/${id}/admission-form`} className="bg-white rounded-2xl shadow-sm border border-amber-200 p-4 sm:p-5 hover:shadow-md hover:bg-amber-50/40 transition block">
          <div className="text-lg font-bold text-amber-800">Print</div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
          <h2 className="font-semibold text-emerald-900 mb-3">Student Details</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Info label="Admission No" value={student.admissionNo} />
            <Info label="Application No" value={student.applicationNo} />
            <Info label="Session" value={currentSession} />
            <Info label="Class for Admission" value={student.admissionClass} />
            <Info label="Name (English)" value={student.nameEn} />
            <Info label="Name (Urdu)" value={student.nameUr ? <span className="font-urdu">{student.nameUr}</span> : "-"} />
            <Info label="Age (auto from DOB)" value={formatAge(student.dob, student.age)} />
            <Info label="Date of Birth" value={formatDateDMY(student.dob)} />
            <Info label="Gender" value={student.gender} />
            <Info label="Status" value={student.status} />
            <Info label="Father / Mother Name" value={[student.fatherName, student.motherName].filter(Boolean).join(" / ")} />
            <Info label="Phone No" value={student.phone} />
            <Info label="Address" value={student.address} />
            <div className="sm:col-span-2"><Info label="Previous School/Madrasa" value={student.previousSchool} /></div>
          </div>
        </div>

        <div className="space-y-4">
          {siblings.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
              <h2 className="font-semibold text-emerald-900 mb-2">Siblings (Added)</h2>
              <div className="space-y-2">
                {siblings.map(s => (
                  <Link key={s.id} href={`/students/${s.id}`} className="block border border-emerald-100 rounded-xl p-3 hover:bg-emerald-50 transition">
                    <div className="font-medium text-emerald-900">{s.admissionNo} — {s.nameEn}</div>
                    {s.nameUr && <div className="text-sm text-gray-600 font-urdu">{s.nameUr}</div>}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-1">Siblings</h2>
              <p className="text-sm text-gray-500">No siblings added.</p>
              {isAdmin && <p className="text-xs text-gray-400 mt-2">To add siblings, use the Edit Student page.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold mb-2">Session Enrollments & Roll No (Complete History)</h2>
        <p className="text-xs text-gray-500 mb-2">"Roll Locked" means the roll number cannot be changed for this session once set. "Not Locked" means the roll number can still be set or changed.</p>
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-center">Session</th><th className="p-2 text-center">Roll No</th><th className="p-2 text-center">Monthly Fee</th><th className="p-2 text-center">Roll Status</th></tr></thead>
        <tbody>{student.enrollments.map((e: any)=>(<tr key={e.id} className="border-t"><td className="p-2 text-center">{e.session.name}</td><td className="p-2 text-center">{e.rollNo || "-"}</td><td className="p-2 text-center">{e.feeExempt ? <span className="text-amber-700">Exempt</span> : (e.monthlyFee != null ? `Rs ${e.monthlyFee}` : "-")}</td><td className="p-2 text-center">{e.rollLocked ? <span className="text-amber-700 font-medium">Locked</span> : <span className="text-emerald-700 font-medium">Not Locked</span>}</td></tr>))}{student.enrollments.length===0 && <tr><td colSpan={4} className="p-3 text-center text-gray-500">No enrollments.</td></tr>}</tbody></table>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold mb-2">Results (Complete History)</h2>
        {student.results.length===0?<p className="text-sm text-gray-500">No results.</p>:<table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2">Session</th><th className="p-2">Exam</th><th className="p-2 text-center">Obtained</th><th className="p-2 text-center">Total</th><th className="p-2 text-center">%</th><th className="p-2 text-center">Grade</th><th className="p-2 text-center">Status</th><th className="p-2 text-center">Position</th></tr></thead><tbody>{student.results.map((r: any)=>(<tr key={r.id} className="border-t"><td className="p-2">{r.exam?.session?.name || "-"}</td><td className="p-2">{r.exam?.name || "-"}</td><td className="p-2 text-center">{r.totalObtained ?? "-"}</td><td className="p-2 text-center">{r.totalMarks ?? "-"}</td><td className="p-2 text-center">{r.percentage?.toFixed(2)??"-"}</td><td className="p-2 text-center">{r.grade||"-"}</td><td className="p-2 text-center">{r.status||"-"}</td><td className="p-2 text-center">{r.position??"-"}</td></tr>))}</tbody></table>}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold mb-2">Fees (Complete History)</h2>
        {student.feePayments.length===0?<p className="text-sm text-gray-500">No fee records.</p>:<table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2">Session</th><th className="p-2">Month/Year</th><th className="p-2">Due</th><th className="p-2">Paid</th><th className="p-2">Balance</th><th className="p-2">Status</th><th className="p-2">Paid At</th></tr></thead><tbody>{student.feePayments.map((f: any)=>{ const paidAmt = Number(f.paidAmount ?? 0) > 0 ? Number(f.paidAmount ?? 0) : (f.isPaid ? Number(f.amount||0) : 0); const dueAmt = Number(f.amount||0); const balance = Math.max(0, dueAmt - paidAmt); const full = f.isPaid || (dueAmt>0 && paidAmt>=dueAmt); const partial = paidAmt>0 && paidAmt<dueAmt; return (<tr key={f.id} className="border-t"><td className="p-2 text-center">{f.session?.name || "-"}</td><td className="p-2 text-center">{f.month}/{f.year}</td><td className="p-2 text-center">Rs {dueAmt}</td><td className="p-2 text-center">Rs {paidAmt}</td><td className="p-2 text-center">{balance>0 ? `Rs ${balance}` : "-"}</td><td className="p-2 text-center">{full ? (f.isLate? <span className="text-amber-700 font-semibold">Late</span>:<span className="text-emerald-700 font-semibold">Paid ✓</span>) : (partial ? <span className="text-amber-700 font-semibold">Partial</span> : <span className="text-red-700">Unpaid</span>)}</td><td className="p-2 text-center">{formatDateDMY(f.paidAt)}</td></tr>); })}</tbody></table>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold mb-2">Certificates (Complete History)</h2>
        {student.certificates.length===0?<p className="text-sm text-gray-500">No certificates.</p>:<table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2">Session</th><th className="p-2">Type</th><th className="p-2">Serial No</th><th className="p-2">Issue Date</th><th className="p-2 text-center">Action</th></tr></thead><tbody>{student.certificates.map((c: any)=>(<tr key={c.id} className="border-t"><td className="p-2">{c.session?.name || "-"}</td><td className="p-2">{c.type === "ANNUAL" ? "Annual" : "Nazra Completion"}</td><td className="p-2">{c.serialNo || "-"}</td><td className="p-2">{formatDateDMY(c.issueDate)}</td><td className="p-2 text-center"><Link href={`/certificates/${c.id}/print`} className="text-emerald-700 underline font-medium">Print</Link></td></tr>))}</tbody></table>}
      </div>
    </div>
  );
}
