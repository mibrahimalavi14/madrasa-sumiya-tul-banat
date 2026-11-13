# Madrasa Sumiya-tul-Banat (مدرسہ سمیّة البنات)

Madrasa management system built with Next.js (App Router), SQLite, and Prisma.

## Features
- Admin & Parent login
- Academic sessions (yearly) with active-session gating, expiry, carry-forward students
- Dashboard overview
- Students: registration, list/search by Admission/Registration No, profile view/edit, printable admission form, siblings linking
- Examination: fixed subject (Nazra Quran & Basic Islamic Studies), select students, assign unique per-session locked roll numbers at exam time
- Question papers: auto 3 Written (Tehreeri, codes 01-03, mazhmoon Basic Islamic Studies) and 3 Oral (codes 01-03, mazhmoon Nazra Quran & Basic Islamic Studies) per exam; editable questions; printable written papers with answer space; oral teacher sheets (questions only)
- Oral conduct: select paper, view selected students, enter marks per student, auto-generate/update results
- Results: enter written marks, combined results saved with grading (Pass ≥40%, Fail <40%), grades (A+≥95, A≥90, B+≥85, B≥80, C≥70, D≥55, E≥40, Fail≤39), positions (top 3 only, ≥70%)
- Fees: monthly per-student, default amount from Settings, paid tick, paid after 7th marked Late
- Certificates: Annual and Nazra Completion, printable
- Bilingual UI labels (English/Urdu) and Urdu papers/certificates

## Setup
```bash
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js
npm run dev
```

Open http://localhost:3000

Default admin login:
- Username: `admin`
- Password: `admin123`

Or visit `/api/setup` once after db push to ensure admin exists.

## Notes
- Create an active session in **Sessions** before entering data.
- Admission No starts with `MSB` and is unique. Roll No is unique per session and locked once assigned.
- Fee "Late" is applied when payment date is after the 7th of the month.
