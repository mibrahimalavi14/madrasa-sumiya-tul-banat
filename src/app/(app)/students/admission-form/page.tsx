import Link from "next/link";
import { getAuthUser } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";

export default async function BlankAdmissionForm() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const session = await getCurrentSession();
  const F = ({ label, labelUr, wide = false }: { label: string; labelUr: string; wide?: boolean }) => (
    <div className={wide ? "md:col-span-2" : ""}>
      <div className="text-[9.5px] leading-snug text-gray-700 mb-0.5 pt-0.5 whitespace-nowrap overflow-visible">{label} / <span className="font-urdu inline-block leading-snug">{labelUr}</span></div>
      <div className="border-b border-gray-600 h-5"></div>
    </div>
  );
  const Sec = ({ title, titleUr, children }: { title: string; titleUr: string; children: React.ReactNode }) => (
    <div className="mb-1">
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold px-2 py-0.5 rounded text-[10px] mb-0.5">{title} / <span className="font-urdu">{titleUr}</span></div>
      {children}
    </div>
  );
  return (
    <div className="bg-white p-1.5 md:p-2 max-w-4xl mx-auto print-area text-[10.5px] print:text-[10px]">
      <style>{`@media print{ @page{ size:A4; margin:6mm } .print-fit{font-size:10px; line-height:1.15} }`}</style>
      <div className="no-print mb-3 flex items-center gap-3 flex-wrap"><Link href="/students" className="text-sm text-emerald-800 hover:text-emerald-900 font-medium">← Back / واپس</Link><PrintButton label="Print Blank Form / خالی فارم پرنٹ کریں" /></div>
      <div className="border border-emerald-900 p-2 print:p-1.5 print-fit">
        <div className="text-center border-b border-emerald-900 pb-2 mb-1">
          <div className="text-lg print:text-base font-extrabold text-emerald-900 leading-tight">Madrasa Sumiya-tul-Banat</div>
          <div className="text-sm font-urdu text-emerald-800 leading-tight">مدرسہ سمیّة البنات</div>
          <div className="mt-0.5 mb-0.5 inline-block bg-emerald-900 text-white px-3 py-0.5 rounded text-[10px] font-semibold">Admission Form / <span className="font-urdu">داخلہ فارم</span></div>
        </div>

        <Sec title="Office Use" titleUr="دفتری استعمال (دفتر کی طرف سے پُر کیا جائے)">
          <div className="grid grid-cols-1 gap-x-3 gap-y-0.5">
            <F label="Session" labelUr="تعلیمی سیشن" />
            <F label="Application No" labelUr="درخواست نمبر" />
            <F label="Admission No" labelUr="داخلہ نمبر" />
          </div>
        </Sec>

        <Sec title="Student Information" titleUr="طالب/طالبہ کی معلومات">
          <div className="grid md:grid-cols-2 gap-x-4 gap-y-0.5">
            <F label="Student Name (English)" labelUr="طالب/طالبہ کا نام (انگریزی)" />
            <F label="Student Name (Urdu)" labelUr="طالب/طالبہ کا نام (اردو)" />
            <F label="Age" labelUr="عمر" />
            <F label="Date of Birth" labelUr="تاریخ پیدائش" />
            <F label="Gender" labelUr="جنس" />
            <F label="Class for Admission" labelUr="کس جماعت میں داخلہ چاہیے" />
          </div>
        </Sec>

        <Sec title="Parents Information" titleUr="والدین کی معلومات">
          <div className="grid md:grid-cols-2 gap-x-4 gap-y-0.5">
            <F label="Father / Mother Name" labelUr="والد یا والدہ کا نام" wide />
            <F label="Phone No" labelUr="فون نمبر" />
            <F label="Address" labelUr="پتہ" wide />
          </div>
        </Sec>

        <Sec title="Previous Education" titleUr="سابقہ تعلیم">
          <div className="grid md:grid-cols-1 gap-y-0.5">
            <F label="Previous School/Madrasa" labelUr="سابقہ مدرسہ/سکول" wide />
          </div>
        </Sec>

        <Sec title="Declaration" titleUr="اقرار نامہ">
          <div className="p-1 text-[9.5px] leading-4">
            <p>I hereby declare that the above information is correct and I/we shall abide by the rules and regulations of the madrasa.</p>
            <p className="font-urdu text-[10.5px] mt-0.5" dir="rtl">میں اقرار کرتا/کرتی ہوں کہ درج بالا تمام معلومات درست ہیں اور میں/ہم مدرسہ کے قواعد و ضوابط کی پابندی کریں گے۔</p>
            <div className="grid grid-cols-3 gap-6 mt-1">
              <div><div className="text-[8.5px] text-gray-600">Student Signature / <span className="font-urdu">طالب/طالبہ کے دستخط</span></div><div className="border-b border-gray-600 h-4 mt-2"></div></div>
              <div><div className="text-[8.5px] text-gray-600">Parent Signature / <span className="font-urdu">سرپرست کے دستخط</span></div><div className="border-b border-gray-600 h-4 mt-2"></div></div>
              <div><div className="text-[8.5px] text-gray-600">Date / <span className="font-urdu">تاریخ</span></div><div className="border-b border-gray-600 h-4 mt-2"></div></div>
            </div>
          </div>
        </Sec>

        <div className="mt-2 grid grid-cols-3 gap-6 text-[9.5px] text-center">
          <div><div className="border-t border-black pt-0.5 mt-4">Checked By / <span className="font-urdu">جانچ کنندہ</span></div></div>
          <div><div className="border-t border-black pt-0.5 mt-4">Office Incharge / <span className="font-urdu">دفتر انچارج</span></div></div>
          <div><div className="border-t border-black pt-0.5 mt-4">Principal / <span className="font-urdu">مہتممہ/مہتمم</span></div></div>
        </div>

        <div className="mt-1.5 border border-emerald-300 bg-emerald-50/60 rounded p-1.5">
          <div className="text-[10px] font-semibold text-emerald-900 mb-0.5 text-right font-urdu" dir="rtl">اہم قواعد و ضوابط:</div>
          <div className="font-urdu text-[10px] leading-[1.25] text-right" dir="rtl">
            <div>۱۔ طالب/طالبہ وقت پر مدرسہ تشریف لائیں اور باقاعدگی سے حاضری یقینی بنائیں۔</div>
            <div>۲۔ اساتذہ اور بزرگوں کا ادب و احترام کیا جائے اور نظم و ضبط برقرار رکھا جائے۔</div>
            <div>۳۔ ماہانہ فیس وقت پر جمع کرائیں اور تاخیر کی صورت میں پہلے سے اطلاع دیں۔</div>
            <div>۴۔ مدرسہ کی ملکیت اور وسائل کا خیال رکھا جائے، کسی چیز کو نقصان نہ پہنچایا جائے۔</div>
            <div>۵۔ لباس و ظاہری حالت شائستہ ہو اور دی گئی ہدایات پر عمل کیا جائے۔</div>
            <div>۶۔ والدین/سرپرست طالب/طالبہ کی تعلیمی و حاضری کے بارے میں رابطے میں رہیں۔</div>
            <div>۷۔ کسی بھی شکایت یا مسئلے کی صورت میں ادارے سے مناسب طریقے سے رابطہ کریں۔</div>
          </div>
        </div>
      </div>
    </div>
  );
}
