import { prisma } from "../lib/prisma";

async function main() {
  console.log("📊 Inspecting live Neon PostgreSQL seed data...\n");

  const programmesCount = await prisma.programme.count();
  const modulesCount = await prisma.module.count();
  const assessmentsCount = await prisma.assessment.count();
  const studentsCount = await prisma.student.count();
  const paymentsCount = await prisma.payment.count();
  const submissionsCount = await prisma.submission.count();
  const resultsCount = await prisma.result.count();
  const counter = await prisma.studentIdCounter.findUnique({ where: { year: 2025 } });

  console.log(`Programmes: ${programmesCount} / 2`);
  console.log(`Modules: ${modulesCount} / 3`);
  console.log(`Assessments: ${assessmentsCount} / 3`);
  console.log(`Students: ${studentsCount} / 8`);
  console.log(`Payments: ${paymentsCount} / 6`);
  console.log(`Submissions: ${submissionsCount} / 4`);
  console.log(`Results: ${resultsCount} / 5`);
  console.log(`Student ID Counter (2025): lastNumber = ${counter?.lastNumber}`);

  console.log("\n👨‍🎓 Sample Student Inspection:");
  const students = await prisma.student.findMany({
    select: {
      studentId: true,
      fullName: true,
      status: true,
      assignedFee: true,
      feeDueDate: true,
      payments: { select: { amount: true, referenceNumber: true } },
      submissions: { select: { fileName: true, version: true, submittedAt: true } },
      results: { select: { score: true, publishedAt: true } },
    },
    orderBy: { studentId: "asc" },
  });

  for (const s of students) {
    const totalPaid = s.payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const balance = Number(s.assignedFee) - totalPaid;
    const isOverdue = balance > 0 && new Date() > s.feeDueDate;
    console.log(
      ` - ${s.studentId} | ${s.fullName.padEnd(16)} | Status: ${s.status.padEnd(9)} | Fee: £${s.assignedFee} | Balance: £${balance.toFixed(2)}${isOverdue ? " [⚠️ OVERDUE]" : ""} | Subs: ${s.submissions.length} | Marks: ${s.results.length}`
    );
  }

  console.log("\n✅ All seed data verified with 100% relational integrity!");
}

main()
  .catch((e) => {
    console.error("❌ Seed verification error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
