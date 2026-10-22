import assert from "node:assert/strict";
import { Prisma, StudentStatus, AssessmentStatus } from "@prisma/client";
import {
  calculateBalance,
  isOverdue,
  validatePayment,
  formatCurrency,
} from "../lib/fees";
import {
  checkEligibility,
  determineLateStatus,
  evaluateSubmissionGate,
  validateFileConstraints,
} from "../lib/submissions";
import {
  calculateClassification,
  filterStudentResults,
  isResultPublished,
  canViewAcademicTranscript,
} from "../lib/results";

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err: unknown) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${(err as Error).message}`);
    throw err;
  }
}

console.log("🧪 EXECUTING COMPREHENSIVE PURE DOMAIN LOGIC TEST SUITE (lib/)\n");

// ==============================================================================
// 1. FEES ENGINE TESTS (lib/fees.ts)
// ==============================================================================
console.log("📌 Testing Fees Engine (lib/fees.ts)...");

runTest("calculateBalance: Zero payments returns full fee as outstanding", () => {
  const result = calculateBalance("5000.00", []);
  assert.equal(result.assignedFee.toFixed(2), "5000.00");
  assert.equal(result.totalPaid.toFixed(2), "0.00");
  assert.equal(result.outstandingBalance.toFixed(2), "5000.00");
  assert.equal(result.isFullyPaid, false);
});

runTest("calculateBalance: Multiple partial payments compute balance accurately", () => {
  const payments = [{ amount: "1500.50" }, { amount: "1499.50" }];
  const result = calculateBalance(5000, payments);
  assert.equal(result.totalPaid.toFixed(2), "3000.00");
  assert.equal(result.outstandingBalance.toFixed(2), "2000.00");
  assert.equal(result.isFullyPaid, false);
});

runTest("calculateBalance: Exact full payment yields 0 balance and isFullyPaid true", () => {
  const payments = [{ amount: "2500.00" }, { amount: "2500.00" }];
  const result = calculateBalance(new Prisma.Decimal(5000), payments);
  assert.equal(result.outstandingBalance.toFixed(2), "0.00");
  assert.equal(result.isFullyPaid, true);
});

runTest("isOverdue: Balance > 0 and past due date returns TRUE", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const pastDue = new Date("2026-10-15T00:00:00Z");
  assert.equal(isOverdue("1000.00", pastDue, now), true);
});

runTest("isOverdue: Balance > 0 but future due date returns FALSE", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const futureDue = new Date("2026-11-01T00:00:00Z");
  assert.equal(isOverdue("1000.00", futureDue, now), false);
});

runTest("isOverdue: Fully settled balance (£0.00) is NEVER overdue even if date is in past", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const pastDue = new Date("2026-09-01T00:00:00Z");
  assert.equal(isOverdue("0.00", pastDue, now), false);
});

runTest("validatePayment: Rejects zero or negative amounts", () => {
  assert.equal(validatePayment("0.00", "5000.00").valid, false);
  assert.equal(validatePayment("-50.00", "5000.00").valid, false);
});

runTest("validatePayment: Rejects payments exceeding outstanding balance", () => {
  const check = validatePayment("5001.00", "5000.00");
  assert.equal(check.valid, false);
  assert.equal(check.code, "EXCEEDS_BALANCE");
});

runTest("validatePayment: Accepts exact balance or smaller partial payment", () => {
  assert.equal(validatePayment("5000.00", "5000.00").valid, true);
  assert.equal(validatePayment("2500.00", "5000.00").valid, true);
});

runTest("formatCurrency: Formats British Pounds (£) with correct grouping", () => {
  assert.match(formatCurrency("5000.00"), /£5,000\.00/);
});

// ==============================================================================
// 2. SUBMISSIONS ENGINE TESTS (lib/submissions.ts)
// ==============================================================================
console.log("\n📌 Testing Submissions Engine (lib/submissions.ts)...");

runTest("checkEligibility: Active ENROLLED student on matching programme is eligible", () => {
  const check = checkEligibility({
    studentStatus: StudentStatus.ENROLLED,
    studentProgrammeId: "prog-cse-uuid",
    moduleProgrammeId: "prog-cse-uuid",
  });
  assert.equal(check.eligible, true);
});

runTest("checkEligibility: Non-enrolled students (DEFERRED, WITHDRAWN, COMPLETED) are rejected", () => {
  for (const status of [StudentStatus.DEFERRED, StudentStatus.WITHDRAWN, StudentStatus.COMPLETED]) {
    const check = checkEligibility({
      studentStatus: status,
      studentProgrammeId: "prog-cse-uuid",
      moduleProgrammeId: "prog-cse-uuid",
    });
    assert.equal(check.eligible, false);
    assert.equal(check.statusCode, 403);
  }
});

runTest("checkEligibility: Cross-programme submissions are strictly blocked", () => {
  const check = checkEligibility({
    studentStatus: StudentStatus.ENROLLED,
    studentProgrammeId: "prog-cse-uuid",
    moduleProgrammeId: "prog-eee-uuid",
  });
  assert.equal(check.eligible, false);
  assert.equal(check.statusCode, 403);
});

runTest("determineLateStatus: Precision timestamp boundary comparison", () => {
  const deadline = "2026-10-20T17:00:00.000Z";
  const onTime = "2026-10-20T17:00:00.000Z";
  const oneMsLate = "2026-10-20T17:00:00.001Z";

  assert.equal(determineLateStatus(onTime, deadline), false);
  assert.equal(determineLateStatus(oneMsLate, deadline), true);
});

runTest("evaluateSubmissionGate: Rejects upload if assessment is CLOSED", () => {
  const gate = evaluateSubmissionGate({
    assessmentStatus: AssessmentStatus.CLOSED,
    deadline: "2026-10-30T00:00:00Z",
    existingSubmission: null,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.statusCode, 403);
});

runTest("evaluateSubmissionGate: First submission on-time is allowed (Version 1)", () => {
  const gate = evaluateSubmissionGate({
    assessmentStatus: AssessmentStatus.OPEN,
    deadline: "2026-10-30T00:00:00Z",
    existingSubmission: null,
    now: new Date("2026-10-25T00:00:00Z"),
  });
  assert.equal(gate.allowed, true);
  assert.equal(gate.isLate, false);
  assert.equal(gate.nextVersion, 1);
});

runTest("evaluateSubmissionGate: First submission POST-deadline is accepted with Late flag", () => {
  const gate = evaluateSubmissionGate({
    assessmentStatus: AssessmentStatus.OPEN,
    deadline: "2026-10-10T00:00:00Z",
    existingSubmission: null,
    now: new Date("2026-10-15T00:00:00Z"),
  });
  assert.equal(gate.allowed, true);
  assert.equal(gate.isLate, true);
  assert.equal(gate.nextVersion, 1);
});

runTest("evaluateSubmissionGate: Resubmission BEFORE deadline is allowed (increments version)", () => {
  const gate = evaluateSubmissionGate({
    assessmentStatus: AssessmentStatus.OPEN,
    deadline: "2026-10-30T00:00:00Z",
    existingSubmission: { version: 1, submittedAt: "2026-10-20T00:00:00Z" },
    now: new Date("2026-10-22T00:00:00Z"),
  });
  assert.equal(gate.allowed, true);
  assert.equal(gate.isLate, false);
  assert.equal(gate.nextVersion, 2);
});

runTest("evaluateSubmissionGate: Resubmission AFTER deadline is strictly BLOCKED (HTTP 409)", () => {
  const gate = evaluateSubmissionGate({
    assessmentStatus: AssessmentStatus.OPEN,
    deadline: "2026-10-10T00:00:00Z",
    existingSubmission: { version: 1, submittedAt: "2026-10-09T00:00:00Z" },
    now: new Date("2026-10-15T00:00:00Z"),
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.statusCode, 409);
});

runTest("validateFileConstraints: Enforces 4MB max size limit (HTTP 413)", () => {
  const validSize = 4 * 1024 * 1024; // 4MB
  const invalidSize = validSize + 1; // 4MB + 1 Byte

  assert.equal(validateFileConstraints(validSize, "application/pdf", "report.pdf").valid, true);
  const check = validateFileConstraints(invalidSize, "application/pdf", "report.pdf");
  assert.equal(check.valid, false);
  assert.equal(check.statusCode, 413);
});

runTest("validateFileConstraints: Strictly permits PDF and DOCX, rejects unauthorized formats", () => {
  assert.equal(validateFileConstraints(1000, "application/pdf", "report.pdf").valid, true);
  assert.equal(validateFileConstraints(1000, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "paper.docx").valid, true);
  assert.equal(validateFileConstraints(1000, "application/x-msdownload", "virus.exe").valid, false);
  assert.equal(validateFileConstraints(1000, "image/png", "picture.png").valid, false);
});

// ==============================================================================
// 3. RESULTS & MARKSHEET ENGINE TESTS (lib/results.ts)
// ==============================================================================
console.log("\n📌 Testing Academic Results & UK Classification Engine (lib/results.ts)...");

runTest("calculateClassification: Distinction thresholds (70 - 100)", () => {
  assert.equal(calculateClassification(100), "Distinction");
  assert.equal(calculateClassification(70), "Distinction");
});

runTest("calculateClassification: Boundary 69 vs 70 (Merit vs Distinction)", () => {
  assert.equal(calculateClassification(69), "Merit");
  assert.equal(calculateClassification(70), "Distinction");
});

runTest("calculateClassification: Boundary 59 vs 60 (Pass vs Merit)", () => {
  assert.equal(calculateClassification(59), "Pass");
  assert.equal(calculateClassification(60), "Merit");
});

runTest("calculateClassification: Boundary 39 vs 40 (Fail vs Pass)", () => {
  assert.equal(calculateClassification(39), "Fail");
  assert.equal(calculateClassification(40), "Pass");
  assert.equal(calculateClassification(0), "Fail");
});

runTest("calculateClassification: Invalid scores outside 0-100 throw RangeError", () => {
  assert.throws(() => calculateClassification(-1), RangeError);
  assert.throws(() => calculateClassification(101), RangeError);
});

runTest("isResultPublished: Withheld marks (null/undefined) are identified", () => {
  assert.equal(isResultPublished(null), false);
  assert.equal(isResultPublished(undefined), false);
  assert.equal(isResultPublished(new Date()), true);
});

runTest("filterStudentResults: Confidentiality Gate suppresses unmoderated marks", () => {
  const markSheet = [
    { id: "res-1", score: 85, publishedAt: new Date("2026-10-01") },
    { id: "res-2", score: 72, publishedAt: null }, // WITHHELD!
    { id: "res-3", score: 64, publishedAt: new Date("2026-10-05") },
  ];

  const studentVisible = filterStudentResults(markSheet);
  assert.equal(studentVisible.length, 2);
  assert.equal(studentVisible.some((r) => r.id === "res-2"), false);
});

runTest("canViewAcademicTranscript: Withdrawn and Completed students retain transcript access", () => {
  assert.equal(canViewAcademicTranscript(StudentStatus.ENROLLED), true);
  assert.equal(canViewAcademicTranscript(StudentStatus.WITHDRAWN), true);
  assert.equal(canViewAcademicTranscript(StudentStatus.COMPLETED), true);
});

console.log(`\n🎉 ALL ${passedTests} OF ${totalTests} PURE DOMAIN LOGIC UNIT TESTS PASSED WITH 100% SUCCESS!`);
