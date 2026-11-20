# Remaining Setup & Inputs Needed (باقی سیٹ اپ / درکار معلومات)

یہ دستاویز اُن کاموں کے لیے ہے جو **app code کے علاوہ external service، infra access، یا آپ کے فیصلے/design** پر منحصر ہیں۔ میں (developer/agent) code-side کام کر سکتا ہوں، لیکن نیچے دی گئی معلومات/رسائی درکار ہوگی۔

---

## 1) Fully Automated DB Backup / PITR (ڈیٹابیس بیک اپ)

### موجودہ حالت
- Database: **Supabase Postgres (ap-southeast-1, Singapore)**
- App میں **CSV exports** دستیاب ہیں: Students, Fees, Results, Certificates (متعلقہ صفحات سے)
- Audit log موجود ہے

### آپ کو کیا کرنا ہوگا (Supabase/Vercel infra access)
1. **Supabase Dashboard** → اپنے project میں جائیں
2. **Database / Backups** سیکشن کھولیں
3. Plan کے مطابق **automated daily backups** enable/verify کریں
4. اگر دستیاب ہو تو **Point-in-Time Recovery (PITR)** enable کریں اور retention period منتخب کریں
5. وقتاً فوقتاً **manual backup/export** یا restore drill کریں (احتیاط کے ساتھ)
6. Vercel/env secrets اور deployment settings کا ریکارڈ محفوظ رکھیں

### میں کیا کر سکتا ہوں
- App-side exports/backup guidance کو بہتر رکھ سکتا ہوں
- ضرورت ہو تو اضافی export/report pages شامل کر سکتا ہوں (موجودہ data model کے مطابق)

---

## 2) Full RBAC - Extra Roles/Permissions (اضافی کردار و اجازتیں)

### موجودہ حالت
- موجودہ roles: **ADMIN**, **PARENT** (parent صرف اپنے بچے کے ریکارڈ تک محدود)

### مجھے آپ سے فیصلہ/تصدیق چاہیے
براہ کرم بتائیں کن roles کی ضرورت ہے اور ہر role کیا کر سکے گا۔ تجویز (مثال):

| Role | تجویز کردہ رسائی (مثال) |
|---|---|
| **ADMIN** | مکمل رسائی (موجودہ) |
| **TEACHER** | طلبہ/امتحانات/نتائج دیکھنا و درج کرنا، فیس/سیٹنگز محدود یا نہ ہو |
| **ACCOUNTANT** | فیس، رسیدیں، واؤچرز، رپورٹس، defaulters/arrears؛ طلبہ/نتائج صرف دیکھنا (اختیاری) |
| **VIEWER/STAFF** | صرف دیکھنے کی اجازت (کوئی تبدیلی نہیں) |
| **PARENT** | صرف اپنے بچے کا ڈیٹا (موجودہ) |

**براہ کرم تصدیق کریں:**  
- کون سے roles شامل کریں؟  
- ہر role کو کن modules (Dashboard/Students/Fees/Exams/Results/Certificates/Sessions/Settings/Audit) پر **View / Create / Edit / Print / Export** کی اجازت ہو؟

### میں کیا کر سکتا ہوں (تصدیق کے بعد)
- Schema/auth/guards/pages/actions میں additive RBAC implement کرنا  
- Existing ADMIN/PARENT behavior محفوظ رکھنا  
- UI میں role-appropriate menus/actions دکھانا

---

## 3) Certificate Template Editor / Custom Reports

### موجودہ حالت
- Annual اور Nazra Completion certificates، print/offline verification موجود
- Exam-wise/annual results reports, fee reports/vouchers, CSV exports موجود

### مجھے آپ سے کیا چاہیے
- **Certificate template:** اگر نیا ڈیزائن چاہیے تو sample image/PDF یا واضح layout، required fields، Urdu/English text، signatures/stamps کی جگہ بتائیں  
- **Template editor:** اگر in-app editor چاہیے تو بتائیں کون سی چیزیں editable ہوں (text, logo, borders, fields) — یہ بڑا feature ہے، scope clear ہونا ضروری ہے  
- **Custom reports:** کون سی report، کن columns/filters/grouping (class/subject/session/month)، اور print/PDF/CSV format؟

### میں کیا کر سکتا ہوں
- موجودہ data/model کے مطابق مخصوص certificate/report layouts بنا یا بہتر کر سکتا ہوں

---

## 4) Production / Real-Device QA (فائنل تصدیق)

Deploy کے بعد **Ctrl+F5** کریں اور live data پر یہ چیک کریں:

### Auth / Sessions
- [ ] Admin login/logout، Parent login (صرف اپنے بچے کا ڈیٹا)
- [ ] Active session، session switch/view، expired session read-only

### Students
- [ ] نیا داخلہ، edit، status (REGISTERED/ACTIVE/LEFT)، validation/errors
- [ ] Roll no assign/auto-assign/lock، roll no list print، admission form print
- [ ] Bulk carry to active session، profile history، CSV export

### Fees
- [ ] Session-bound months، monthly fee save/paid/partial/late (7th کے بعد)
- [ ] Receipt print، single/bulk vouchers، defaulters، arrears، monthly/session reports، CSV export
- [ ] Fee-exempt student behavior

### Exams / Results
- [ ] Exam create, student selection، papers (Urdu/print)، oral/written marks save
- [ ] Result generation, grading/position logic، exam-wise aur annual reports، annual result card/print، CSV export

### Certificates
- [ ] Issue (eligible cases), search/filter/pagination، print/offline verification، CSV export

### Dashboard / Settings / Audit
- [ ] Alerts/counts، navigation، settings changes، audit log entries، backup/export links

### UI / Devices
- [ ] Mobile sidebar/menu، tables/forms/cards spacing، Urdu/RTL، print margins/page breaks
- [ ] Slow network پر loading/perceived performance

مسائل ملیں تو **page URL + کیا کیا + کیا ہونا چاہیے تھا + screenshot/error** بھیج دیں۔