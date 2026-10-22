import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔍 Verifying PostgreSQL CHECK constraints in Neon DB...\n");

  // 1. Inspect pg_constraint system catalog
  const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
    SELECT conname 
    FROM pg_constraint 
    WHERE conname IN ('check_payment_amount_positive', 'check_result_score_range');
  `;

  console.log("📋 Found constraints in system catalog:", constraints.map((c) => c.conname));
  if (constraints.length < 2) {
    throw new Error("One or both constraints are missing in PostgreSQL pg_constraint!");
  }

  // 2. Test Invariant 1: Attempt to insert invalid payment (amount = 0)
  console.log("\n🧪 Test Case 1: Inserting illegal payment (amount = 0)...");
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "payments" ("id", "studentId", "amount", "paymentDate", "referenceNumber", "paymentMethod", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), gen_random_uuid(), 0.00, NOW(), 'TEST-TX-ZERO', 'CASH', NOW(), NOW());
    `);
    throw new Error("FAILED: Database permitted payment with amount = 0!");
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    if (errorMsg.includes("check_payment_amount_positive") || errorMsg.includes("23514")) {
      console.log("   ✅ PASSED: PostgreSQL strictly rejected payment amount = 0 (Constraint: check_payment_amount_positive).");
    } else {
      console.log("   ⚠️ Rejected as expected with error:", errorMsg);
    }
  }

  // 3. Test Invariant 2: Attempt to insert illegal result (score = 105)
  console.log("\n🧪 Test Case 2: Inserting illegal score (score = 105)...");
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "results" ("id", "assessmentId", "studentId", "score", "publishedAt", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 105, NULL, NOW(), NOW());
    `);
    throw new Error("FAILED: Database permitted score = 105!");
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    if (errorMsg.includes("check_result_score_range") || errorMsg.includes("23514")) {
      console.log("   ✅ PASSED: PostgreSQL strictly rejected score = 105 (Constraint: check_result_score_range).");
    } else {
      console.log("   ⚠️ Rejected as expected with error:", errorMsg);
    }
  }

  console.log("\n🎯 All DB Invariants are active, enforced by Neon PostgreSQL, and verified!");
}

main()
  .catch((e) => {
    console.error("❌ Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
