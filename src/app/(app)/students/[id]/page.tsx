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
      results: { include: { exam: true }, orderBy: { createdAt: "desc" } },
      feePayments: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 24 },
      certificates: { include: { session: true } },
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
        <h2 className="font-semibold mb-2">Session Enrollments & Roll No</h2>
        <p className="text-xs text-gray-500 mb-2">"Roll Locked" means the roll number cannot be changed for this session once set. "Not Locked" means the roll number can still be set or changed.</p>
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-center">Session</th><th className="p-2 text-center">Roll No</th><th className="p-2 text-center">Roll Status</th></tr></thead>
        <tbody>{student.enrollments.map(e=>(<tr key={e.id} className="border-t"><td className="p-2 text-center">{e.session.name}</td><td className="p-2 text-center">{e.rollNo || "-"}</td><td className="p-2 text-center">{e.rollLocked ? <span className="text-amber-700 font-medium">Locked</span> : <span className="text-emerald-700 font-medium">Not Locked</span>}</td></tr>))}</tbody></table>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold mb-2">Results</h2>
        {student.results.length===0?<p className="text-sm text-gray-500">No results.</p>:<table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2">Exam</th><th className="p-2 text-center">Obtained</th><th className="p-2 text-center">Total</th><th className="p-2 text-center">%</th><th className="p-2 text-center">Grade</th><th className="p-2 text-center">Status</th><th className="p-2 text-center">Position</th></tr></thead><tbody>{student.results.map(r=>(<tr key={r.id} className="border-t"><td className="p-2">{r.exam.name}</td><td className="p-2 text-center">{r.totalObtained ?? "-"}</td><td className="p-2 text-center">{r.totalMarks ?? "-"}</td><td className="p-2 text-center">{r.percentage?.toFixed(2)??"-"}</td><td className="p-2 text-center">{r.grade||"-"}</td><td className="p-2 text-center">{r.status||"-"}</td><td className="p-2 text-center">{r.position??"-"}</td></tr>))}</tbody></table>}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5">
        <h2 className="font-semibold mb-2">Fees</h2>
        {student.feePayments.length===0?<p className="text-sm text-gray-500">No fee records.</p>:<table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2">Month/Year</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Paid At</th></tr></thead><tbody>{student.feePayments.map(f=>(<tr key={f.id} className="border-t"><td className="p-2 text-center">{f.month}/{f.year}</td><td className="p-2 text-center">Rs {f.amount}</td><td className="p-2 text-center">{f.isPaid ? (f.isLate? <span className="text-amber-700 font-semibold">Late</span>:<span className="text-emerald-700 font-semibold">Paid ✓</span>) : <span className="text-red-700">Unpaid</span>}</td><td className="p-2 text-center">{formatDateDMY(f.paidAt)}</td></tr>))}</tbody></table>}
      </div>
    </div>
  );
}
