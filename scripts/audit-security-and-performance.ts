/**
 * ==============================================================================
 * PEN GLOBAL ASSESSMENT - STEP 8: SECURITY & PERFORMANCE AUDIT SUITE
 * ==============================================================================
 * Candidate: Md Rifat Hossen (B.Sc. in CSE, CUET, CGPA 3.60/4.00)
 * Target Role: React & AI Application Developer (PEN Global, Agrabad)
 *
 * This test suite performs rigorous end-to-end security penetration tests,
 * database invariant verification, payload size audits, and latency profiling.
 *
 * DUAL-MODE ARCHITECTURE:
 * - If the Next.js dev server is running on localhost:3000, it performs live
 *   over-the-wire HTTP network penetration tests.
 * - If the dev server is offline, it seamlessly falls back to direct in-process
 *   Next.js App Router route handlers with Neon PostgreSQL, ensuring reliable
 *   execution in any terminal or CI/CD environment without manual prerequisites.
 * ==============================================================================
 */

import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { GET as getStudents } from "../app/api/students/route";
import { GET as getProgrammes } from "../app/api/programmes/route";
import { GET as getAssessments } from "../app/api/assessments/route";
import { GET as getSubmissions, POST as postSubmissions } from "../app/api/submissions/route";
import { GET as getResults } from "../app/api/results/route";

interface AuditResult {
  category: "SECURITY" | "PERFORMANCE" | "INVARIANT";
  testName: string;
  passed: boolean;
  details: string;
}

const auditLog: AuditResult[] = [];

function record(category: "SECURITY" | "PERFORMANCE" | "INVARIANT", testName: string, passed: boolean, details: string) {
  auditLog.push({ category, testName, passed, details });
  const icon = passed ? "✅ [PASS]" : "❌ [FAIL]";
  console.log(`  ${icon} [${category}] ${testName}`);
  console.log(`     ↳ ${details}`);
}

let isLiveServerAvailable = false;
let resolvedBaseUrl = "http://localhost:3000";

// Smart request dispatcher supporting live HTTP and in-process route handlers
async function executeRequest(
  urlPath: string,
  options?: { method?: string; body?: any; headers?: any }
): Promise<Response> {
  if (isLiveServerAvailable) {
    return await fetch(`${resolvedBaseUrl}${urlPath}`, options);
  }

  // In-process Route Handler dispatch
  const url = new URL(urlPath, "http://localhost:3000");
  const pathname = url.pathname;
  const req = new NextRequest(url.toString(), {
    method: options?.method || "GET",
    body: options?.body,
    headers: options?.headers,
  });

  if (pathname === "/api/submissions") {
    if (options?.method === "POST") {
      return await postSubmissions(req);
    }
    return await getSubmissions(req);
  }

  if (pathname === "/api/results") {
    return await getResults(req);
  }

  if (pathname === "/api/students") {
    return await getStudents(req);
  }

  if (pathname === "/api/programmes") {
    return await getProgrammes();
  }

  if (pathname === "/api/assessments") {
    return await getAssessments(req);
  }

  throw new Error(`Unknown route for in-process dispatcher: ${pathname}`);
}

async function runAudit() {
  console.log("\n================================================================================");
  console.log("🛡️  PEN GLOBAL SMS REGISTRY MODULE — STEP 8: SECURITY & PERFORMANCE AUDIT");
  console.log("================================================================================");

  // Detect whether Next.js live dev server is active
  const candidateUrls = process.env.TEST_BASE_URL
    ? [process.env.TEST_BASE_URL]
    : ["http://localhost:3000", "http://127.0.0.1:3000"];

  for (const candidate of candidateUrls) {
    try {
      const ping = await fetch(`${candidate}/api/programmes`, {
        signal: AbortSignal.timeout(1200),
      });
      if (ping.ok) {
        resolvedBaseUrl = candidate;
        isLiveServerAvailable = true;
        break;
      }
    } catch {
      // Check next candidate
    }
  }

  if (isLiveServerAvailable) {
    console.log(`🌐 EXECUTION MODE: Live HTTP Server (${resolvedBaseUrl})\n`);
  } else {
    console.log(`⚡ EXECUTION MODE: Direct In-Process Route Handlers + Neon DB\n`);
  }

  // Serverless Neon DB connection warm-up (prevents cold-start pooler drops)
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    await new Promise((r) => setTimeout(r, 1200));
    await prisma.$queryRaw`SELECT 1`;
  }

  // ----------------------------------------------------------------------------
  // SECTION 1: MEMORY BLOAT & POSTGRESQL OOM AUDIT (ByteA Isolation)
  // ----------------------------------------------------------------------------
  console.log("📌 1. Testing Memory Bloat Prevention (ByteA Payload Isolation)...");
  try {
    const res = await executeRequest("/api/submissions");
    const json = await res.json();
    const rawText = JSON.stringify(json);
    const sizeInKB = (Buffer.byteLength(rawText, "utf8") / 1024).toFixed(2);

    if (!json.success || !Array.isArray(json.data)) {
      throw new Error("Failed to retrieve submissions array");
    }

    let hasFileData = false;
    for (const sub of json.data) {
      if ("fileData" in sub && sub.fileData !== undefined) {
        hasFileData = true;
        break;
      }
    }

    if (!hasFileData) {
      record(
        "SECURITY",
        "PostgreSQL OOM & Buffer Isolation",
        true,
        `All ${json.data.length} submissions returned WITHOUT binary fileData bytes. Payload size: ${sizeInKB} KB.`
      );
    } else {
      record(
        "SECURITY",
        "PostgreSQL OOM & Buffer Isolation",
        false,
        "Critical leak: raw binary fileData detected in submission listing!"
      );
    }
  } catch (err: unknown) {
    record("SECURITY", "PostgreSQL OOM & Buffer Isolation", false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // SECTION 2: FILE UPLOAD 4.0 MB CEILING PENETRATION TEST
  // ----------------------------------------------------------------------------
  console.log("\n📌 2. Testing 4.0 MB File Size Enforcement (Payload Ceiling)...");
  try {
    const assessment = await prisma.assessment.findFirst({
      where: { status: "OPEN" },
      include: { module: { include: { programme: true } } },
    });

    const student = await prisma.student.findFirst({
      where: {
        status: "ENROLLED",
        programmeId: assessment?.module.programmeId,
      },
    });

    if (!assessment || !student) {
      throw new Error("Missing test seed data for assessment/student");
    }

    // Generate a 5.2 MB buffer in memory
    const oversizedBytes = Buffer.alloc(5.2 * 1024 * 1024, "A");
    const blob = new Blob([oversizedBytes], { type: "application/pdf" });

    const formData = new FormData();
    formData.append("assessmentId", assessment.id);
    formData.append("studentId", student.id);
    formData.append("file", blob, "oversized_malicious_exploit.pdf");

    const res = await executeRequest("/api/submissions", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();

    if (res.status === 413 && json.success === false && json.error.includes("4.0 MB")) {
      record(
        "SECURITY",
        "Strict 4.0 MB File Upload Rejection",
        true,
        `HTTP 413 Payload Too Large returned correctly: "${json.error}"`
      );
    } else {
      record(
        "SECURITY",
        "Strict 4.0 MB File Upload Rejection",
        false,
        `Server accepted or failed with unexpected status: ${res.status} (${JSON.stringify(json)})`
      );
    }
  } catch (err: unknown) {
    record("SECURITY", "Strict 4.0 MB File Upload Rejection", false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // SECTION 3: CONFIDENTIALITY GATE & PROVISIONAL GRADE LEAK AUDIT
  // ----------------------------------------------------------------------------
  console.log("\n📌 3. Testing Academic Marksheet Confidentiality Gate (RBAC Isolation)...");
  try {
    const withheldResult = await prisma.result.findFirst({
      where: { publishedAt: null },
      include: { student: true, assessment: true },
    });

    if (!withheldResult) {
      throw new Error("No withheld result found in seed data to verify");
    }

    // Query 1: As student role
    const studentRes = await executeRequest(
      `/api/results?role=student&studentId=${withheldResult.studentId}`
    );
    const studentJson = await studentRes.json();
    const leakedToStudent = studentJson.data?.some((r: { id: string }) => r.id === withheldResult.id);

    // Query 2: As staff role
    const staffRes = await executeRequest(
      `/api/results?role=staff&assessmentId=${withheldResult.assessmentId}`
    );
    const staffJson = await staffRes.json();
    const visibleToStaff = staffJson.data?.some((r: { id: string }) => r.id === withheldResult.id);

    if (!leakedToStudent && visibleToStaff) {
      record(
        "SECURITY",
        "Academic Confidentiality Gate Enforcement",
        true,
        `Student query strictly isolates unmoderated grade (Score: ${withheldResult.score}). Staff retains administrative visibility.`
      );
    } else {
      record(
        "SECURITY",
        "Academic Confidentiality Gate Enforcement",
        false,
        `Confidentiality breach: leakedToStudent=${leakedToStudent}, visibleToStaff=${visibleToStaff}`
      );
    }
  } catch (err: unknown) {
    record("SECURITY", "Academic Confidentiality Gate Enforcement", false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // SECTION 4: POSTGRESQL CHECK CONSTRAINT INVARIANT AUDIT
  // ----------------------------------------------------------------------------
  console.log("\n📌 4. Testing Raw PostgreSQL Invariant Constraints (CHECK Invariants)...");
  try {
    // 4A: Attempting negative payment (amount = -50.00)
    let paymentCheckPassed = false;
    let paymentErrorMsg = "";
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "payments" ("id", "studentId", "amount", "paymentDate", "referenceNumber", "paymentMethod", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), gen_random_uuid(), -50.00, NOW(), 'EXPLOIT-NEG-01', 'CASH', NOW(), NOW());`
      );
    } catch (err: unknown) {
      paymentErrorMsg = (err as Error).message;
      if (paymentErrorMsg.includes("check_payment_amount_positive") || paymentErrorMsg.includes("23514")) {
        paymentCheckPassed = true;
      }
    }

    if (paymentCheckPassed) {
      record(
        "INVARIANT",
        "PostgreSQL CHECK: check_payment_amount_positive",
        true,
        "Database rejected negative payment (amount = -50.00) with SQL error code 23514."
      );
    } else {
      record(
        "INVARIANT",
        "PostgreSQL CHECK: check_payment_amount_positive",
        false,
        `Expected 23514 check constraint error, but got: ${paymentErrorMsg}`
      );
    }

    // 4B: Attempting score > 100 (score = 105)
    let scoreCheckPassed = false;
    let scoreErrorMsg = "";
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "results" ("id", "assessmentId", "studentId", "score", "publishedAt", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 105, NOW(), NOW(), NOW());`
      );
    } catch (err: unknown) {
      scoreErrorMsg = (err as Error).message;
      if (scoreErrorMsg.includes("check_result_score_range") || scoreErrorMsg.includes("23514")) {
        scoreCheckPassed = true;
      }
    }

    if (scoreCheckPassed) {
      record(
        "INVARIANT",
        "PostgreSQL CHECK: check_result_score_range",
        true,
        "Database rejected out-of-range score (score = 105) with SQL error code 23514."
      );
    } else {
      record(
        "INVARIANT",
        "PostgreSQL CHECK: check_result_score_range",
        false,
        `Expected 23514 check constraint error, but got: ${scoreErrorMsg}`
      );
    }
  } catch (err: unknown) {
    record("INVARIANT", "PostgreSQL Invariant Verification", false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // SECTION 5: SQL INJECTION & PARAMETER TAMPERING DEFENSE
  // ----------------------------------------------------------------------------
  console.log("\n📌 5. Testing SQL Injection & Parameter Tampering Resilience...");
  try {
    const maliciousSearches = [
      "' OR '1'='1",
      "'; DROP TABLE students; --",
      "<script>alert('xss')</script>",
      "UNION SELECT * FROM payments--",
    ];

    let allSafe = true;
    for (const query of maliciousSearches) {
      const res = await executeRequest(`/api/students?search=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        allSafe = false;
        break;
      }
    }

    if (allSafe) {
      record(
        "SECURITY",
        "SQL Injection & Parameter Sanitization",
        true,
        "Prisma parameterization neutralized all SQL injection & XSS payloads without error."
      );
    } else {
      record(
        "SECURITY",
        "SQL Injection & Parameter Sanitization",
        false,
        "One or more injection payloads caused unexpected server failure."
      );
    }
  } catch (err: unknown) {
    record("SECURITY", "SQL Injection & Parameter Sanitization", false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // SECTION 6: NETWORK PAYLOAD SIZES & LATENCY PROFILING
  // ----------------------------------------------------------------------------
  console.log("\n📌 6. Auditing Network Payload Sizes & Query Latency...");
  const endpoints = [
    { url: "/api/students", targetName: "All Students Directory" },
    { url: "/api/programmes", targetName: "Degree Programmes & Modules" },
    { url: "/api/assessments", targetName: "Assessments & Gate Statuses" },
  ];

  for (const ep of endpoints) {
    try {
      const t0 = performance.now();
      const res = await executeRequest(ep.url);
      const t1 = performance.now();
      const json = await res.json();
      const rawText = JSON.stringify(json);
      const sizeKB = (Buffer.byteLength(rawText, "utf8") / 1024).toFixed(2);
      const latencyMs = (t1 - t0).toFixed(1);

      const isSnappy = parseFloat(sizeKB) < 10.0;
      record(
        "PERFORMANCE",
        `Endpoint: ${ep.url} (${ep.targetName})`,
        isSnappy,
        `Payload size: ${sizeKB} KB (Target < 10 KB) | Response Latency: ${latencyMs} ms`
      );
    } catch (err: unknown) {
      record("PERFORMANCE", `Endpoint: ${ep.url}`, false, (err as Error).message);
    }
  }

  // ----------------------------------------------------------------------------
  // SUMMARY SCORECARD
  // ----------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("📊 STEP 8 AUDIT SUMMARY & COMPLIANCE SCORECARD");
  console.log("================================================================================");

  const total = auditLog.length;
  const passed = auditLog.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Audit Checks Conducted : ${total}`);
  console.log(`Passed Checks                : ${passed} / ${total} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed Checks                : ${failed}`);

  if (failed === 0) {
    console.log("\n🏆 ALL SECURITY, PERFORMANCE, AND INVARIANT CRITERIA VERIFIED 100% SUCCESSFUL!\n");
  } else {
    console.log("\n⚠️ ATTENTION REQUIRED: Some audit checks failed.\n");
    process.exit(1);
  }
}

runAudit()
  .catch((err) => {
    console.error("Fatal audit execution error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
