import { prisma } from "../lib/prisma";

async function main() {
  console.log("⚙️  Applying PostgreSQL CHECK constraints (DB Invariants)...");

  // Idempotently apply check_payment_amount_positive constraint
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_payment_amount_positive'
      ) THEN
        ALTER TABLE "payments" ADD CONSTRAINT "check_payment_amount_positive" CHECK ("amount" > 0);
        RAISE NOTICE 'Constraint check_payment_amount_positive added.';
      ELSE
        RAISE NOTICE 'Constraint check_payment_amount_positive already exists.';
      END IF;
    END $$;
  `);
  console.log("✅ Invariant 1: payments.amount > 0 constraint verified.");

  // Idempotently apply check_result_score_range constraint
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_result_score_range'
      ) THEN
        ALTER TABLE "results" ADD CONSTRAINT "check_result_score_range" CHECK ("score" >= 0 AND "score" <= 100);
        RAISE NOTICE 'Constraint check_result_score_range added.';
      ELSE
        RAISE NOTICE 'Constraint check_result_score_range already exists.';
      END IF;
    END $$;
  `);
  console.log("✅ Invariant 2: results.score BETWEEN 0 AND 100 constraint verified.");

  console.log("\n🚀 All database invariants applied successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Failed to apply invariants:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
