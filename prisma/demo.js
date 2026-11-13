const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.session.count();
  if (existing > 0) {
    console.log("Demo skipped: sessions already exist.");
    return;
  }

  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash: adminHash, role: "ADMIN", name: "Administrator" },
    create: { username: "admin", name: "Administrator", passwordHash: adminHash, role: "ADMIN" },
  });

  const session = await prisma.session.create({
    data: {
      name: "2026-2027",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      status: "ACTIVE",
      isCurrent: true,
    },
  });

  await prisma.setting.create({ data: { sessionId: session.id, key: "monthlyFee", value: "1500" } });

  const studentsData = [
    { admissionNo: "MSB0001", registrationNo: "REG0001", nameEn: "Ayesha Fatima", nameUr: "عائشہ فاطمہ", fatherName: "Muhammad Saleem", guardianName: "Muhammad Saleem", phone: "0300-1110001", parentPhone: "0300-1110001", address: "Street 1, Model Town", status: "ACTIVE" },
    { admissionNo: "MSB0002", registrationNo: "REG0002", nameEn: "Maryam Bibi", nameUr: "مریم بی بی", fatherName: "Abdul Rahman", guardianName: "Abdul Rahman", phone: "0300-1110002", parentPhone: "0300-1110002", address: "Street 2, Garden Block", status: "ACTIVE" },
    { admissionNo: "MSB0003", registrationNo: "REG0003", nameEn: "Hafsa Noor", nameUr: "حفصہ نور", fatherName: "Imran Ahmed", guardianName: "Imran Ahmed", phone: "0300-1110003", parentPhone: "0300-1110003", address: "Street 3, City Area", status: "ACTIVE" },
    { admissionNo: "MSB0004", registrationNo: "REG0004", nameEn: "Zainab Ali", nameUr: "زینب علی", fatherName: "Ali Hassan", guardianName: "Ali Hassan", phone: "0300-1110004", parentPhone: "0300-1110004", address: "Street 4, North Town", status: "ACTIVE" },
    { admissionNo: "MSB0005", registrationNo: "REG0005", nameEn: "Khadija Tul Kubra", nameUr: "خدیجہ الکبریٰ", fatherName: "Usman Ghani", guardianName: "Usman Ghani", phone: "0300-1110005", parentPhone: "0300-1110005", address: "Street 5, West Colony", status: "ACTIVE" },
  ];

  const students = [];
  for (const s of studentsData) {
    const st = await prisma.student.create({ data: { ...s, admissionDate: new Date("2026-04-05"), dob: new Date("2015-01-01") } });
    students.push(st);
    await prisma.studentEnrollment.create({ data: { studentId: st.id, sessionId: session.id } });
  }

  // siblings: Ayesha & Maryam
  await prisma.sibling.create({ data: { studentAId: students[0].id, studentBId: students[1].id } });

  // Parent login linked to first student
  const parentHash = await bcrypt.hash("parent123", 10);
  await prisma.user.upsert({
    where: { username: "parent" },
    update: { passwordHash: parentHash, role: "PARENT", name: "Parent Demo", parentStudentId: students[0].id },
    create: { username: "parent", name: "Parent Demo", passwordHash: parentHash, role: "PARENT", parentStudentId: students[0].id },
  });

  // Exam
  const exam = await prisma.exam.create({
    data: { sessionId: session.id, name: "Annual Examination 2026", subject: "Nazra Quran & Basic Islamic Studies", examDate: new Date("2027-02-15") },
  });

  // Papers 01-03 written and oral
  const writtenPapers = [], oralPapers = [];
  for (const code of ["01", "02", "03"]) {
    writtenPapers.push(await prisma.questionPaper.create({ data: { examId: exam.id, type: "WRITTEN", paperCode: code, title: `Written Paper ${code}`, mazhmoon: "Basic Islamic Studies", className: "Nazra Quran & Basic Islamic Studies" } }));
    oralPapers.push(await prisma.questionPaper.create({ data: { examId: exam.id, type: "ORAL", paperCode: code, title: `Oral Paper ${code}`, mazhmoon: "Nazra Quran & Basic Islamic Studies", className: "Nazra Quran & Basic Islamic Studies" } }));
  }

  // Sample questions
  const wQs = [
    { textUr: "نماز کے ارکان بیان کریں۔", textEn: "Describe the pillars of Salah.", type: "long", marks: 10, answerSpace: 5 },
    { textUr: "اسلام کے پانچ ستون لکھیں۔", textEn: "Write the five pillars of Islam.", type: "short", marks: 5, answerSpace: 4 },
    { textUr: "وضو کے فرائض کیا ہیں؟", textEn: "What are the obligatory acts of Wudu?", type: "short", marks: 5, answerSpace: 4 },
  ];
  for (let i=0;i<wQs.length;i++) await prisma.question.create({ data: { paperId: writtenPapers[0].id, order: i+1, ...wQs[i] } });
  const oQs = [
    { textUr: "سورۃ الفاتحہ کی تلاوت سنائیں۔", textEn: "Recite Surah Al-Fatiha.", type: "oral", marks: 20 },
    { textUr: "آخری دس سورۃ میں سے کوئی دو سنائیں۔", textEn: "Recite any two from last ten Surahs.", type: "oral", marks: 20 },
    { textUr: "روزمرہ کے اسلامی دعائیں سنائیں۔", textEn: "Recite daily Islamic duas.", type: "oral", marks: 10 },
  ];
  for (let i=0;i<oQs.length;i++) await prisma.question.create({ data: { paperId: oralPapers[0].id, order: i+1, ...oQs[i], answerSpace: 1 } });

  // Select all students for exam and assign/lock roll numbers
  for (let i=0;i<students.length;i++) {
    await prisma.examStudent.create({ data: { examId: exam.id, studentId: students[i].id } });
    await prisma.studentEnrollment.update({ where: { studentId_sessionId: { studentId: students[i].id, sessionId: session.id } }, data: { rollNo: String(i+1), rollLocked: true } });
  }

  // Oral marks (paper 01) and results
  const oralScores = [45, 40, 38, 30, 28]; // out of 50
  const writtenScores = [44, 41, 35, 25, 20]; // out of 50
  for (let i=0;i<students.length;i++) {
    await prisma.oralMark.create({ data: { examId: exam.id, paperId: oralPapers[0].id, studentId: students[i].id, obtained: oralScores[i], total: 50, remarks: "Good" } });
    const totalObt = oralScores[i] + writtenScores[i];
    const totalMarks = 100;
    const pct = (totalObt/totalMarks)*100;
    const grade = pct>=95?"A+":pct>=90?"A":pct>=85?"B+":pct>=80?"B":pct>=70?"C":pct>=55?"D":pct>=40?"E":"Fail";
    const status = pct>=40?"Pass":"Fail";
    await prisma.result.create({ data: { examId: exam.id, studentId: students[i].id, writtenObtained: writtenScores[i], writtenTotal: 50, oralObtained: oralScores[i], oralTotal: 50, totalObtained: totalObt, totalMarks, percentage: pct, grade, status } });
  }
  // positions (top 3 >=70)
  const results = await prisma.result.findMany({ where: { examId: exam.id } });
  const eligible = results.filter(r=> (r.percentage||0)>=70).sort((a,b)=>(b.percentage||0)-(a.percentage||0));
  let rank=0,last=null; for(let i=0;i<eligible.length;i++){const p=eligible[i].percentage||0; if(last===null||p!==last){rank=i+1;last=p;} if(rank<=3) await prisma.result.update({where:{id:eligible[i].id},data:{position:rank}});}

  // Fees for a few months
  const months = [4,5,6]; // Apr,May,Jun 2026
  for (const st of students) {
    for (const m of months) {
      const isPaid = m !== 6 || st.admissionNo !== "MSB0005"; // one unpaid
      const paidAt = isPaid ? new Date(2026, m-1, m===5 ? 9 : 5) : null; // May paid late (9th)
      const isLate = paidAt ? paidAt.getDate() > 7 : false;
      await prisma.feePayment.create({ data: { sessionId: session.id, studentId: st.id, month: m, year: 2026, amount: 1500, isPaid, paidAt, isLate } });
    }
  }

  // Certificate
  await prisma.certificate.create({ data: { sessionId: session.id, studentId: students[0].id, type: "ANNUAL", serialNo: "MSB-CERT-0001", details: "Annual examination performance certificate" } });

  console.log("Demo data created: session 2026-2027, 5 students, exam with papers/questions, results, fees, certificate, parent login (parent/parent123). Admin: admin/admin123");
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
