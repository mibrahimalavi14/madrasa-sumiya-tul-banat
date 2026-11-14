import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { formatDateDMY } from "@/lib/utils";

export default async function CertPrint({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const cert = await prisma.certificate.findUnique({ where: { id }, include: { student: true, session: true } });
  if (!cert) notFound();
  if (user.role === "PARENT" && user.parentStudentId !== cert.studentId) redirect("/dashboard");

  const isAnnual = cert.type === "ANNUAL";
  const titleUr = isAnnual ? "سالانہ سند" : "سند تکمیلِ ناظرہ";
  const titleEn = isAnnual ? "Annual Examination Certificate" : "Nazra Completion Certificate";
  const textUr = isAnnual
    ? "یہ تصدیق کی جاتی ہے کہ مذکورہ طالب علم/طالبہ نے اس مدرسہ میں سالانہ امتحان کامیابی سے مکمل کیا۔"
    : "یہ تصدیق کی جاتی ہے کہ مذکورہ طالب علم/طالبہ نے ناظرہ قرآنِ پاک کامیابی سے مکمل کر لیا ہے۔";

  return (
    <div className="bg-white p-6 max-w-4xl mx-auto print-area">
      <style>{`@media print { @page { size: A4; margin: 10mm; } .no-print { display: none !important; } }`}</style>
      <div className="no-print mb-4 flex gap-2">
        <a href="javascript:window.print()" className="bg-emerald-800 text-white px-4 py-2 rounded">Print</a>
      </div>
      <div className="border-8 border-double border-emerald-900 p-8 md:p-10 text-center relative bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06),transparent_45%)]">
        <div className="absolute inset-3 border border-emerald-200 pointer-events-none rounded-sm" />
        <div className="relative">
          <div className="flex justify-center mb-2"><Logo size={84} /></div>
          <div className="text-3xl font-bold text-emerald-900">Madrasa Sumiya-tul-Banat</div>
          <div className="text-3xl font-urdu text-emerald-800 mt-1">مدرسہ سمیّة البنات</div>
          <div className="mt-5 inline-block bg-emerald-900 text-white px-5 py-2 rounded text-base font-semibold tracking-wide">{titleEn}</div>
          <div className="text-3xl font-urdu mt-2 text-emerald-900">{titleUr}</div>

          <p className="mt-8 text-lg font-urdu leading-10 text-gray-800" dir="rtl">{textUr}</p>
          <p className="mt-4 text-base text-gray-800">
            This is to certify that <b>{cert.student.nameEn}</b>{" "}
            {cert.student.nameUr ? <span className="font-urdu">({cert.student.nameUr})</span> : null}
            , Admission No <b>{cert.student.admissionNo}</b>, has {isAnnual ? "successfully completed the Annual Examination" : "successfully completed Nazra Quran"} for session <b>{cert.session.name}</b>.
          </p>
          {cert.details && <p className="mt-3 text-sm text-gray-700"><b>Details:</b> {cert.details}</p>}

          <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm text-left max-w-2xl mx-auto">
            <div className="border border-emerald-100 rounded-lg p-3 bg-white/80"><div className="text-xs text-gray-500">Serial / Verification No</div><div className="font-semibold text-emerald-900">{cert.serialNo || "-"}</div></div>
            <div className="border border-emerald-100 rounded-lg p-3 bg-white/80"><div className="text-xs text-gray-500">Issue Date</div><div className="font-semibold text-emerald-900">{formatDateDMY(cert.issueDate)}</div></div>
            <div className="border border-emerald-100 rounded-lg p-3 bg-white/80"><div className="text-xs text-gray-500">Student / Admission</div><div className="font-semibold text-emerald-900">{cert.student.admissionNo} — {cert.student.nameEn}</div></div>
            <div className="border border-emerald-100 rounded-lg p-3 bg-white/80"><div className="text-xs text-gray-500">Session / Type</div><div className="font-semibold text-emerald-900">{cert.session.name} — {isAnnual ? "Annual" : "Nazra Completion"}</div></div>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 text-sm">
            <div><div className="border-t border-black pt-1 mt-8">Prepared By / تیار کنندہ</div></div>
            <div><div className="border-t border-black pt-1 mt-8">Office Seal / دفتر مہر</div></div>
            <div><div className="border-t border-black pt-1 mt-8">Principal / سربراہ</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
