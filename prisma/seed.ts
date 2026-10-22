import { PrismaClient, StudentStatus, AssessmentStatus, PaymentMethod, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to create valid mock PDF bytes
const createMockPdfBuffer = (title: string, author: string): Uint8Array => {
  const buf = Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Title (${title}) /Author (${author}) /Producer (PEN Global SMS Engine) /CreationDate (D:${new Date().toISOString()}) >>\nendobj\n` +
    `2 0 obj\n<< /Length 72 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(${title} - Md Rifat Hossen SMS Registry Module) Tj\nET\nendstream\nendobj\n` +
    `xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000130 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n252\n%%EOF`
  );
  return new Uint8Array(buf);
};

async function main() {
  console.log("🌱 Starting automated database seeding for PEN Global SMS Registry Module...\n");

  // -------------------------------------------------------------
  // 1. CLEAN SLATE: Orderly deletion respecting onDelete: Restrict
  // -------------------------------------------------------------
  console.log("🧹 Clearing existing records in reverse dependency order...");
  await prisma.result.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.module.deleteMany();
  await prisma.programme.deleteMany();
  await prisma.studentIdCounter.deleteMany();
  console.log("   ✅ Clean slate established.\n");

  const now = new Date();
  const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const past20Days = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
  const past15Days = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const past10Days = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const past5Days = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const past2Days = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const future15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const future30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const future45Days = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

  // -------------------------------------------------------------
  // 2. SEED PROGRAMMES (2 Distinct UK Programmes)
  // -------------------------------------------------------------
  console.log("🏛️  Seeding degree programmes...");
  const progCSE = await prisma.programme.create({
    data: {
      code: "BENG-CSE",
      name: "B.Sc. (Hons) in Computer Science & Engineering",
      defaultFee: new Prisma.Decimal("5000.00"),
    },
  });

  const progEEE = await prisma.programme.create({
    data: {
      code: "BENG-EEE",
      name: "B.Sc. (Hons) in Electrical & Electronic Engineering",
      defaultFee: new Prisma.Decimal("4500.00"),
    },
  });
  console.log(`   ✅ Programmes created: ${progCSE.code} (£5,000), ${progEEE.code} (£4,500)`);

  // -------------------------------------------------------------
  // 3. SEED MODULES (3 Key Modules)
  // -------------------------------------------------------------
  console.log("📚 Seeding modules...");
  const modAlgo = await prisma.module.create({
    data: {
      code: "CS301",
      name: "Advanced Algorithms & Data Structures",
      credits: 20,
      programmeId: progCSE.id,
    },
  });

  const modCloud = await prisma.module.create({
    data: {
      code: "CS302",
      name: "Cloud Computing & Distributed Systems",
      credits: 20,
      programmeId: progCSE.id,
    },
  });

  const modSignals = await prisma.module.create({
    data: {
      code: "EE201",
      name: "Signals & Linear Systems",
      credits: 20,
      programmeId: progEEE.id,
    },
  });
  console.log(`   ✅ Modules created: ${modAlgo.code}, ${modCloud.code}, ${modSignals.code}`);

  // -------------------------------------------------------------
  // 4. SEED ASSESSMENTS (2 OPEN, 1 CLOSED)
  // -------------------------------------------------------------
  console.log("📝 Seeding assessments...");
  // Assessment 1: OPEN with future deadline (Active)
  const asmt1 = await prisma.assessment.create({
    data: {
      title: "CS301 Coursework 1: Algorithmic Complexity & Graph Search",
      moduleId: modAlgo.id,
      deadline: future30Days,
      status: AssessmentStatus.OPEN,
    },
  });

  // Assessment 2: OPEN with past deadline (Allows Late Submissions)
  const asmt2 = await prisma.assessment.create({
    data: {
      title: "CS302 Term Project: Serverless Microservices Architecture",
      moduleId: modCloud.id,
      deadline: past10Days,
      status: AssessmentStatus.OPEN,
    },
  });

  // Assessment 3: CLOSED (Strictly locked by staff)
  const asmt3 = await prisma.assessment.create({
    data: {
      title: "EE201 Lab Report: Analog Filters & Frequency Synthesis",
      moduleId: modSignals.id,
      deadline: past20Days,
      status: AssessmentStatus.CLOSED,
    },
  });
  console.log(`   ✅ Assessments created: 2 OPEN (one with past deadline for late tests), 1 CLOSED`);

  // -------------------------------------------------------------
  // 5. SEED 8 STUDENTS & THEIR CASE HISTORIES
  // -------------------------------------------------------------
  console.log("👨‍🎓 Seeding 8 students covering all statuses and edge cases...");

  // Student 1: Model High Achiever (Enrolled, fully paid, on-time submission, published Distinction)
  const s1 = await prisma.student.create({
    data: {
      studentId: "SMS-2025-0001",
      fullName: "Alex Walker",
      email: "alex.walker@student.pen.ac.uk",
      dateOfBirth: new Date("2002-04-12"),
      academicYear: "2024/25",
      status: StudentStatus.ENROLLED,
      programmeId: progCSE.id,
      assignedFee: progCSE.defaultFee,
      feeDueDate: future45Days,
    },
  });

  await prisma.payment.create({
    data: {
      studentId: s1.id,
      amount: new Prisma.Decimal("5000.00"),
      paymentDate: past20Days,
      referenceNumber: "TX-BANK-2025-0001",
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Full annual tuition fees paid via Bank Transfer",
    },
  });

  const pdf1 = createMockPdfBuffer("CS301 Coursework", "Alex Walker");
  await prisma.submission.create({
    data: {
      assessmentId: asmt1.id,
      studentId: s1.id,
      fileData: pdf1,
      fileName: "CS301_Walker_GraphAlgorithms.pdf",
      fileMime: "application/pdf",
      fileSize: pdf1.length,
      version: 1,
      submittedAt: past5Days, // On-time
    },
  });

  await prisma.result.create({
    data: {
      assessmentId: asmt1.id,
      studentId: s1.id,
      score: 82, // Distinction (>= 70)
      publishedAt: past2Days, // Published
    },
  });

  // Student 2: Partially Paid, Active (Balance £2,000, NOT overdue)
  const s2 = await prisma.student.create({
    data: {
      studentId: "SMS-2025-0002",
      fullName: "Sofia Chowdhury",
      email: "sofia.chowdhury@student.pen.ac.uk",
      dateOfBirth: new Date("2003-09-18"),
      academicYear: "2024/25",
      status: StudentStatus.ENROLLED,
      programmeId: progCSE.id,
      assignedFee: progCSE.defaultFee,
      feeDueDate: future30Days,
    },
  });

  await prisma.payment.create({
    data: {
      studentId: s2.id,
      amount: new Prisma.Decimal("3000.00"),
      paymentDate: past10Days,
      referenceNumber: "TX-CARD-2025-0002",
      paymentMethod: PaymentMethod.CARD,
      notes: "First installment paid via Visa debit",
    },
  });

  // Student 3: Overdue Tuition Alert Trigger (Balance £3,000, feeDueDate was 15 days ago!)
  const s3 = await prisma.student.create({
    data: {
      studentId: "SMS-2025-0003",
      fullName: "Marcus Bennett",
      email: "marcus.bennett@student.pen.ac.uk",
      dateOfBirth: new Date("2001-11-05"),
      academicYear: "2024/25",
      status: StudentStatus.ENROLLED,
      programmeId: progCSE.id,
      assignedFee: progCSE.defaultFee,
      feeDueDate: past15Days, // OVERDUE!
    },
  });

  await prisma.payment.create({
    data: {
      studentId: s3.id,
      amount: new Prisma.Decimal("2000.00"),
      paymentDate: past30Days,
      referenceNumber: "TX-CASH-2025-0003",
      paymentMethod: PaymentMethod.CASH,
      notes: "Deposit paid at registry desk",
    },
  });

  const pdf3 = createMockPdfBuffer("CS301 Coursework", "Marcus Bennett");
  await prisma.submission.create({
    data: {
      assessmentId: asmt1.id,
      studentId: s3.id,
      fileData: pdf3,
      fileName: "CS301_Bennett_AlgoOptimization.pdf",
      fileMime: "application/pdf",
      fileSize: pdf3.length,
      version: 1,
      submittedAt: past10Days, // On-time
    },
  });

  await prisma.result.create({
    data: {
      assessmentId: asmt1.id,
      studentId: s3.id,
      score: 65, // Merit (>= 60)
      publishedAt: past2Days, // Published
    },
  });

  // Student 4: Late Submission Edge Case (Submitted after assessment deadline)
  const s4 = await prisma.student.create({
    data: {
      studentId: "SMS-2025-0004",
      fullName: "Aisha Rahman",
      email: "aisha.rahman@student.pen.ac.uk",
      dateOfBirth: new Date("2003-02-22"),
      academicYear: "2024/25",
      status: StudentStatus.ENROLLED,
      programmeId: progCSE.id,
      assignedFee: progCSE.defaultFee,
      feeDueDate: future15Days,
    },
  });

  await prisma.payment.create({
    data: {
      studentId: s4.id,
      amount: new Prisma.Decimal("5000.00"),
      paymentDate: past15Days,
      referenceNumber: "TX-BANK-2025-0004",
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Full fees settled",
    },
  });

  const pdf4 = createMockPdfBuffer("CS302 Project", "Aisha Rahman");
  await prisma.submission.create({
    data: {
      assessmentId: asmt2.id, // Deadline was 10 days ago
      studentId: s4.id,
      fileData: pdf4,
      fileName: "CS302_Rahman_ServerlessBackend_Late.pdf",
      fileMime: "application/pdf",
      fileSize: pdf4.length,
      version: 1,
      submittedAt: past5Days, // Submitted 5 days ago (> deadline 10 days ago => LATE!)
    },
  });

  // Student 5: Confidentiality Gate (Withheld / Unmoderated Result: publishedAt is NULL)
  const s5 = await prisma.student.create({
    data: {
      studentId: "SMS-2025-0005",
      fullName: "Liam O'Connor",
      email: "liam.oconnor@student.pen.ac.uk",
      dateOfBirth: new Date("2002-07-14"),
      academicYear: "2024/25",
      status: StudentStatus.ENROLLED,
      programmeId: progCSE.id,
      assignedFee: progCSE.defaultFee,
      feeDueDate: future45Days,
    },
  });

  await prisma.payment.create({
    data: {
      studentId: s5.id,
      amount: new Prisma.Decimal("5000.00"),
      paymentDate: past20Days,
      referenceNumber: "TX-CARD-2025-0005",
      paymentMethod: PaymentMethod.CARD,
      notes: "Full tuition paid",
    },
  });

  const pdf5 = createMockPdfBuffer("CS301 Coursework", "Liam O'Connor");
  await prisma.submission.create({
    data: {
      assessmentId: asmt1.id,
      studentId: s5.id,
      fileData: pdf5,
      fileName: "CS301_OConnor_DistributedLocks.pdf",
      fileMime: "application/pdf",
      fileSize: pdf5.length,
      version: 1,
      submittedAt: past5Days,
    },
  });

  await prisma.result.create({
    data: {
      assessmentId: asmt1.id,
      studentId: s5.id,
      score: 74, // Distinction grade entered by examiner
      publishedAt: null, // WITHHELD! Visible to staff, hidden from student!
    },
  });

  // Student 6: Deferred Status
  await prisma.student.create({
    data: {
      studentId: "SMS-2025-0006",
      fullName: "Emily Davis",
      email: "emily.davis@student.pen.ac.uk",
      dateOfBirth: new Date("2001-05-30"),
      academicYear: "2024/25",
      status: StudentStatus.DEFERRED,
      programmeId: progEEE.id,
      assignedFee: progEEE.defaultFee,
      feeDueDate: future45Days,
    },
  });

  // Student 7: Withdrawn Status (Retains past published grades, cannot submit new work)
  const s7 = await prisma.student.create({
    data: {
      studentId: "SMS-2025-0007",
      fullName: "Tariq Mansoor",
      email: "tariq.mansoor@student.pen.ac.uk",
      dateOfBirth: new Date("2000-12-10"),
      academicYear: "2023/24",
      status: StudentStatus.WITHDRAWN,
      programmeId: progEEE.id,
      assignedFee: progEEE.defaultFee,
      feeDueDate: past30Days,
    },
  });

  await prisma.payment.create({
    data: {
      studentId: s7.id,
      amount: new Prisma.Decimal("4500.00"),
      paymentDate: past30Days,
      referenceNumber: "TX-BANK-2024-0007",
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Historical settlement prior to academic withdrawal",
    },
  });

  await prisma.result.create({
    data: {
      assessmentId: asmt3.id,
      studentId: s7.id,
      score: 54, // Pass (>= 40)
      publishedAt: past20Days, // Historical published mark accessible to student
    },
  });

  // Student 8: Completed Alumnus Status
  const s8 = await prisma.student.create({
    data: {
      studentId: "SMS-2025-0008",
      fullName: "Chloe Evans",
      email: "chloe.evans@student.pen.ac.uk",
      dateOfBirth: new Date("1999-08-03"),
      academicYear: "2023/24",
      status: StudentStatus.COMPLETED,
      programmeId: progEEE.id,
      assignedFee: progEEE.defaultFee,
      feeDueDate: past30Days,
    },
  });

  await prisma.payment.create({
    data: {
      studentId: s8.id,
      amount: new Prisma.Decimal("4500.00"),
      paymentDate: past30Days,
      referenceNumber: "TX-CARD-2024-0008",
      paymentMethod: PaymentMethod.CARD,
      notes: "Final year fees fully settled",
    },
  });

  await prisma.result.create({
    data: {
      assessmentId: asmt3.id,
      studentId: s8.id,
      score: 78, // Distinction
      publishedAt: past15Days,
    },
  });

  // -------------------------------------------------------------
  // 6. INITIALIZE STUDENT ID COUNTER HELPER TABLE
  // -------------------------------------------------------------
  console.log("🔢 Initializing sequential Student ID counter (Year 2025: lastNumber = 8)...");
  await prisma.studentIdCounter.create({
    data: {
      year: 2025,
      lastNumber: 8,
    },
  });
  console.log("   ✅ StudentIdCounter initialized at 8 for 2025.\n");

  console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
  console.log("Summary of Seeded Data:");
  console.log(" - Programmes: 2 (BENG-CSE £5,000, BENG-EEE £4,500)");
  console.log(" - Modules: 3 (CS301, CS302, EE201)");
  console.log(" - Assessments: 3 (2 OPEN, 1 CLOSED)");
  console.log(" - Students: 8 (All 4 statuses: ENROLLED, DEFERRED, WITHDRAWN, COMPLETED)");
  console.log(" - Payments: 6 records (Full, Partial, Overdue balance scenarios)");
  console.log(" - Submissions: 4 PDF uploads (On-time, and 1 Late submission)");
  console.log(" - Results: 5 marks (Distinctions, Merits, Pass, 1 Withheld / Unpublished)");
  console.log("=================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
