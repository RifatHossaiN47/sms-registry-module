import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { GET as getStudents, POST as postStudents } from "../app/api/students/route";
import { GET as getPayments, POST as postPayments } from "../app/api/payments/route";
import { GET as getAssessments, POST as postAssessments } from "../app/api/assessments/route";
import { GET as getSubmissions, POST as postSubmissions } from "../app/api/submissions/route";
import { GET as getResults } from "../app/api/results/route";

let totalTests = 0;
let passedTests = 0;

async function runTest(name: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err: unknown) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${(err as Error).message}`);
    throw err;
  }
}

console.log("🚀 TESTING SERVER ROUTE HANDLERS LAYER (Next.js App Router API Routes)\n");

async function main() {
  // Retrieve demo programmes and students from DB
  const progCSE = await prisma.programme.findUniqueOrThrow({ where: { code: "BENG-CSE" } });
  const sAlex = await prisma.student.findUniqueOrThrow({ where: { email: "alex.walker@student.pen.ac.uk" } });
  const sMarcus = await prisma.student.findUniqueOrThrow({ where: { email: "marcus.bennett@student.pen.ac.uk" } });
  const sLiam = await prisma.student.findUniqueOrThrow({ where: { email: "liam.oconnor@student.pen.ac.uk" } });
  const asmtOpen = await prisma.assessment.findFirstOrThrow({ where: { status: "OPEN" } });
  const asmtClosed = await prisma.assessment.findFirstOrThrow({ where: { status: "CLOSED" } });

  // -------------------------------------------------------------
  // 1. STUDENTS API ROUTE
  // -------------------------------------------------------------
  console.log("📌 Testing /api/students...");

  await runTest("POST /api/students: Rejects invalid academic year format with HTTP 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/students", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Test Candidate",
        email: "test.invalid@cuet.ac.bd",
        dateOfBirth: "2002-01-01",
        academicYear: "2024-2025", // Invalid! Must match ^\d{4}/\d{2}$
        programmeId: progCSE.id,
        feeDueDate: "2026-12-01",
      }),
    });
    const res = await postStudents(req);
    assert.equal(res.status, 400);
  });

  await runTest("POST /api/students: Rejects duplicate email enrolment with HTTP 409 Conflict", async () => {
    const req = new NextRequest("http://localhost:3000/api/students", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Alex Imposter",
        email: "alex.walker@student.pen.ac.uk", // Duplicate!
        dateOfBirth: "2002-01-01",
        academicYear: "2024/25",
        programmeId: progCSE.id,
        feeDueDate: "2026-12-01",
      }),
    });
    const res = await postStudents(req);
    assert.equal(res.status, 409);
  });

  await runTest("GET /api/students: Overdue filter returns Marcus Bennett with dynamic isOverdue = true", async () => {
    const req = new NextRequest("http://localhost:3000/api/students?overdueOnly=true");
    const res = await getStudents(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length >= 1);
    const marcus = body.data.find(
      (s: { email: string; isOverdue: boolean; outstandingBalance: number }) => s.email === sMarcus.email
    );
    assert.ok(marcus);
    assert.equal(marcus.isOverdue, true);
    assert.ok(marcus.outstandingBalance > 0);
  });

  // -------------------------------------------------------------
  // 2. PAYMENTS API ROUTE
  // -------------------------------------------------------------
  console.log("\n📌 Testing /api/payments...");

  await runTest("POST /api/payments: Rejects overpayment attempt with HTTP 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/payments", {
      method: "POST",
      body: JSON.stringify({
        studentId: sAlex.id, // Alex has balance £0.00
        amount: 500.0,
        paymentMethod: "CARD",
        referenceNumber: "TEST-OVERPAY-REF-99",
      }),
    });
    const res = await postPayments(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /exceeds outstanding balance|settled all assigned fees/);
  });

  await runTest("POST /api/payments: Rejects duplicate reference number with HTTP 409 Conflict", async () => {
    const req = new NextRequest("http://localhost:3000/api/payments", {
      method: "POST",
      body: JSON.stringify({
        studentId: sMarcus.id,
        amount: 100.0,
        paymentMethod: "BANK_TRANSFER",
        referenceNumber: "TX-BANK-2025-0001", // Duplicate!
      }),
    });
    const res = await postPayments(req);
    assert.equal(res.status, 409);
  });

  await runTest("GET /api/payments: Retrieves student ledger with dynamic financial totals", async () => {
    const req = new NextRequest(`http://localhost:3000/api/payments?studentId=${sMarcus.id}`);
    const res = await getPayments(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.summary.assignedFee, 5000);
    assert.equal(body.data.summary.outstandingBalance, 3000);
    assert.equal(body.data.summary.isOverdue, true);
  });

  // -------------------------------------------------------------
  // 3. ASSESSMENTS API ROUTE
  // -------------------------------------------------------------
  console.log("\n📌 Testing /api/assessments...");

  await runTest("POST /api/assessments: Rejects invalid module UUID with HTTP 404 Not Found", async () => {
    const req = new NextRequest("http://localhost:3000/api/assessments", {
      method: "POST",
      body: JSON.stringify({
        title: "Invalid Module Test",
        moduleId: "00000000-0000-0000-0000-000000000000",
        deadline: "2026-12-01T00:00:00Z",
      }),
    });
    const res = await postAssessments(req);
    assert.equal(res.status, 404);
  });

  await runTest("GET /api/assessments: Returns assessment list with aggregated submission counts", async () => {
    const req = new NextRequest("http://localhost:3000/api/assessments");
    const res = await getAssessments(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length >= 3);
  });

  // -------------------------------------------------------------
  // 4. SUBMISSIONS API ROUTE
  // -------------------------------------------------------------
  console.log("\n📌 Testing /api/submissions...");

  await runTest("POST /api/submissions: Rejects cross-programme upload with HTTP 403 Forbidden", async () => {
    const formData = new FormData();
    formData.append("assessmentId", asmtClosed.id); // asmtClosed is in EEE, Alex is in CSE
    formData.append("studentId", sAlex.id);
    const mockFile = new File(["dummy pdf content"], "lab.pdf", { type: "application/pdf" });
    formData.append("file", mockFile);

    const req = new NextRequest("http://localhost:3000/api/submissions", {
      method: "POST",
      body: formData,
    });
    const res = await postSubmissions(req);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /not enrolled in the degree programme/i);
  });

  await runTest("POST /api/submissions: Rejects upload to CLOSED assessment with HTTP 403 Forbidden", async () => {
    // Create a temporary closed assessment for CSE module
    const asmtClosedCSE = await prisma.assessment.create({
      data: {
        title: "CS301 Test Closed Assignment",
        moduleId: asmtOpen.moduleId,
        deadline: new Date(Date.now() - 10000),
        status: "CLOSED",
      },
    });

    try {
      const formData = new FormData();
      formData.append("assessmentId", asmtClosedCSE.id);
      formData.append("studentId", sAlex.id);
      const mockFile = new File(["dummy pdf content"], "lab.pdf", { type: "application/pdf" });
      formData.append("file", mockFile);

      const req = new NextRequest("http://localhost:3000/api/submissions", {
        method: "POST",
        body: formData,
      });
      const res = await postSubmissions(req);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.match(body.error, /officially CLOSED/i);
    } finally {
      await prisma.assessment.delete({ where: { id: asmtClosedCSE.id } });
    }
  });

  await runTest("POST /api/submissions: Rejects file > 4.0MB with HTTP 413 Payload Too Large", async () => {
    const formData = new FormData();
    formData.append("assessmentId", asmtOpen.id);
    formData.append("studentId", sAlex.id);

    // Create a 4.5MB dummy blob
    const largeBlob = new Blob([new Uint8Array(4.5 * 1024 * 1024)], { type: "application/pdf" });
    const largeFile = new File([largeBlob], "huge.pdf", { type: "application/pdf" });
    formData.append("file", largeFile);

    const req = new NextRequest("http://localhost:3000/api/submissions", {
      method: "POST",
      body: formData,
    });
    const res = await postSubmissions(req);
    assert.equal(res.status, 413);
    const body = await res.json();
    assert.match(body.error, /4\.0 MB/);
  });

  await runTest("GET /api/submissions: Submissions list excludes binary fileData bytes (OOM Protection)", async () => {
    const req = new NextRequest("http://localhost:3000/api/submissions");
    const res = await getSubmissions(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length > 0);
    for (const sub of body.data) {
      assert.equal(sub.fileData, undefined, "fileData binary bytes must NOT be sent in list queries!");
      assert.ok(typeof sub.isLate === "boolean");
    }
  });

  // -------------------------------------------------------------
  // 5. RESULTS API ROUTE & CONFIDENTIALITY GATE
  // -------------------------------------------------------------
  console.log("\n📌 Testing /api/results (Confidentiality Gate)...");

  await runTest("GET /api/results: Student role query strictly hides withheld/unmoderated results", async () => {
    // Liam O'Connor has a withheld score (publishedAt: null)
    const req = new NextRequest(`http://localhost:3000/api/results?role=student&studentId=${sLiam.id}`);
    const res = await getResults(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    // Liam should see 0 published results
    assert.equal(body.data.length, 0, "Confidentiality Gate: Student must not receive unmoderated grades!");
  });

  await runTest("GET /api/results: Staff role query reveals withheld result to examiners", async () => {
    const req = new NextRequest(`http://localhost:3000/api/results?role=staff&studentId=${sLiam.id}`);
    const res = await getResults(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].score, 74);
    assert.equal(body.data[0].isPublished, false);
    assert.equal(body.data[0].classification, "Distinction");
  });

  console.log(`\n🎉 ALL ${passedTests} OF ${totalTests} ROUTE HANDLER TESTS PASSED WITH 100% SUCCESS!`);
}

main()
  .catch((e) => {
    console.error("❌ Test suite aborted with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
