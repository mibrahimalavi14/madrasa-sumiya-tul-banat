import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getAuthUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";

export default async function StudentsAttentionPage() {
  const user = await getAuthUser();
  if (user?.role !== "ADMIN" && user?.role !== "ACCOUNTANT") redirect("/dashboard");
  const session = await getCurrentSession();
  const lang = await getLang();
  const ur = lang === "ur";
  if (!session) return <p className="p-6">{ur ? "کوئی فعال سیشن نہیں۔" : "No active session."}</p>;

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { sessionId: session.id },
    select: {
      rollNo: true,
      student: {
        select: {
          id: true, admissionNo: true, nameEn: true, nameUr: true, fatherName: true,
          phone: true, admissionClass: true, dob: true, address: true, status: true,
        },
      },
    },
    orderBy: { student: { admissionNo: "asc" } },
  });

  const rows = enrollments.map((e) => {
    const s = e.student;
    const missing: string[] = [];
    if (!e.rollNo) missing.push(ur ? "رول نمبر" : "Roll No");
    if (!s.fatherName) missing.push(ur ? "والد کا نام" : "Father Name");
    if (!s.phone) missing.push(ur ? "فون" : "Phone");
    if (!s.admissionClass) missing.push(ur ? "کلاس" : "Class");
    if (!s.dob) missing.push(ur ? "تاریخ پیدائش" : "DOB");
    if (!s.address) missing.push(ur ? "پتہ" : "Address");
    return { ...s, rollNo: e.rollNo, missing };
  }).filter((r) => r.missing.length > 0);

  return (
    <div className="space-y-5 theme-students">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl p-5 shadow-sm">
        <h1 className="text-2xl font-bold">{ur ? "توجہ درکار طلبہ" : "Students Needing Attention"}</h1>
        <p className="text-sm text-amber-50 mt-1">{ur ? "جن طلبہ کی اہم معلومات نامکمل ہیں" : "Students with missing essential information"}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5 overflow-auto">
        <div className="text-sm text-gray-600 mb-3">{ur ? `کل: ${rows.length} طالب علم` : `Total: ${rows.length} student(s)`}</div>
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-amber-950"><tr>
            <th className="p-2 text-left">{ur ? "داخلہ نمبر" : "Admission No"}</th>
            <th className="p-2 text-left">{ur ? "نام" : "Name"}</th>
            <th className="p-2 text-center">{ur ? "رول نمبر" : "Roll No"}</th>
            <th className="p-2 text-left">{ur ? "کلاس" : "Class"}</th>
            <th className="p-2 text-left">{ur ? "نامکمل معلومات" : "Missing Info"}</th>
            <th className="p-2 text-center">{ur ? "عمل" : "Action"}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-medium">{r.admissionNo}</td>
                <td className="p-2">{r.nameEn}{r.nameUr ? <span className="font-urdu text-gray-600"> / {r.nameUr}</span> : ""}</td>
                <td className="p-2 text-center">{r.rollNo || "-"}</td>
                <td className="p-2">{r.admissionClass || "-"}</td>
                <td className="p-2 text-amber-800">{r.missing.join(ur ? "، " : ", ")}</td>
                <td className="p-2 text-center"><Link href={`/students/${r.id}`} className="text-emerald-700 underline">{ur ? "پروفائل" : "Profile"}</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">{ur ? "تمام اہم معلومات موجود ہیں۔" : "All essential information is complete."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}