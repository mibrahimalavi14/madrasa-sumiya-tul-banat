import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import { formatDateDMY } from "@/lib/utils";

export default async function CertPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = await prisma.certificate.findUnique({ where: { id }, include: { student: true, session: true } });
  if (!cert) notFound();
  const titleUr = cert.type === "ANNUAL" ? "سالانہ سند" : "سند تکمیلِ ناظرہ";
  const titleEn = cert.type === "ANNUAL" ? "Annual Examination Certificate" : "Nazra Completion Certificate";
  const textUr = cert.type === "ANNUAL"
    ? "یہ تصدیق کیا جاتا ہے کہ مذکورہ طالب علم نے اس مدرسہ میں سالانہ امتحان کامیابی سے مکمل کیا۔"
    : "یہ تصدیق کیا جاتا ہے کہ مذکورہ طالب علم نے ناظرہ قرآن پاک کامیابی سے مکمل کر لیا ہے۔";
  return (
    <div className="bg-white p-6 max-w-4xl mx-auto">
      <div className="no-print mb-4"><a href="javascript:window.print()" className="bg-emerald-800 text-white px-4 py-2 rounded">Print</a></div>
      <div className="border-8 border-double border-emerald-900 p-10 text-center relative">
        <div className="flex justify-center mb-2"><Logo size={84} /></div>
        <div className="text-3xl font-bold text-emerald-900">Madrasa Sumiya-tul-Banat</div>
        <div className="text-3xl font-urdu text-emerald-800 mt-1">مدرسہ سمیّة البنات</div>
        <div className="mt-6 text-2xl font-semibold">{titleEn}</div>
        <div className="text-3xl font-urdu mt-1">{titleUr}</div>
        <p className="mt-8 text-lg font-urdu leading-10" dir="rtl">{textUr}</p>
        <p className="mt-4 text-base">This is to certify that <b>{cert.student.nameEn}</b> {cert.student.nameUr ? <span className="font-urdu">({cert.student.nameUr})</span>:null}, Admission No <b>{cert.student.admissionNo}</b>, has {cert.type==="ANNUAL"?"successfully completed the Annual Examination":"successfully completed Nazra Quran"} for session <b>{cert.session.name}</b>.</p>
        {cert.details && <p className="mt-2 text-sm">Details: {cert.details}</p>}
        <div className="mt-10 grid grid-cols-3 gap-6 text-sm">
          <div><div className="border-t border-black pt-1 mt-8">Date / تاریخ<br/>{formatDateDMY(cert.issueDate)}</div></div>
          <div><div className="border-t border-black pt-1 mt-8">Serial: {cert.serialNo||"-"}</div></div>
          <div><div className="border-t border-black pt-1 mt-8">Principal / سربراہ</div></div>
        </div>
      </div>
    </div>
  );
}
