# Student Management System - Registry Module

A clean, production-grade web application built for the **PEN Global Technical Assessment** (React & AI Application Developer role). This system implements the four everyday workflows of a University Registry Administrator: **Student Enrolment**, **Fees & Payment Ledgers**, **Coursework Submissions**, and **Academic Marksheets & Results**.

* **Live Production URL:** [https://sms-registry-module-app.vercel.app/](https://sms-registry-module-app.vercel.app/)
* **GitHub Repository:** [https://github.com/RifatHossaiN47/sms-registry-module](https://github.com/RifatHossaiN47/sms-registry-module)
* **Core Tech Stack:** Next.js 16 (App Router), TypeScript, Neon Serverless PostgreSQL, Prisma ORM, Tailwind CSS

---

## Candidate Information

* **Candidate Name:** Md Rifat Hossen
* **Degree:** B.Sc. in Computer Science and Engineering, Chittagong University of Engineering and Technology (CUET)
* **Phone:** +880 1720447606
* **Email:** rifat8851@gmail.com
* **GitHub:** [https://github.com/RifatHossaiN47](https://github.com/RifatHossaiN47)
* **LinkedIn:** [https://www.linkedin.com/in/rifathossain47/](https://www.linkedin.com/in/rifathossain47/)
* **Portfolio:** [https://rifathossen47.web.app/](https://rifathossen47.web.app/)

---

## 1. System Architecture & Visual Blueprints

To ensure the application was reliable, scalable, and mathematically consistent before writing code, the system was designed upfront into three architectural blueprints in draw.io.

### 1.1 End-to-End System Architecture (5-Layer Decoupled Design)
The application enforces a unidirectional data flow across 5 decoupled layers, ensuring the browser client never communicates directly with the database.
![System Architecture](docs/diagrams/system-architecture.png)

### 1.2 Entity Relationship Diagram (ERD - 3NF Schema)
The database schema is normalized into Third Normal Form (3NF) across 8 entities, eliminating data redundancy and establishing strict referential integrity (`ON DELETE RESTRICT`).
![Entity Relationship Diagram](docs/diagrams/entity-relationship-diagram.png)

### 1.3 Relational Schema Mapping & Invariant Constraints
Detailed mapping of physical foreign key relationships, B-Tree indexes, uniqueness rules, and database-level PostgreSQL CHECK constraints.
![Relational Schema Mapping](docs/diagrams/relational-schema-mapping.png)

---

## 2. The Four Core Registry Workflows

### Workflow 1: Student Enrolment & ID Generation
* **Atomic Student ID Generation:** Automatically generates human-readable Student IDs formatted as `SMS-YYYY-NNNN` (e.g. `SMS-2026-0001`). It uses an isolated sequence counter table (`student_id_counters`) inside an interactive database transaction to eliminate concurrency race conditions during simultaneous enrolments.
* **Academic Year Validation:** Enforces the university standard `YYYY/YY` format (e.g. `2025/26`) through strict regex validation (`^\d{4}/\d{2}$`).
* **Lifecycle State Tracking:** Supports the four formal Registry states: `ENROLLED`, `DEFERRED`, `WITHDRAWN`, and `COMPLETED`.
* **Live Search & Multi-Attribute Filtering:** Real-time search across student names, student IDs, degree programmes, and enrolment statuses.

### Workflow 2: Fees, Payments & Overdue Arrears Ledger
* **Tuition Fee Snapshot at Enrolment:** When a student is enrolled, the current programme tuition is permanently saved into `student.assignedFee`. This ensures that if the university increases programme tuition fees in future years, existing enrolled students maintain their original agreed financial contract.
* **Fixed-Point Financial Math:** All monetary operations use Prisma's `Decimal` type to eliminate floating-point rounding errors common in JavaScript math.
* **Dynamic Overdue Balance Tracking:** Outstanding balances and overdue flags are never stored in database columns to prevent stale or desynchronized data. They are calculated dynamically from raw transaction records:
  * `outstandingBalance = assignedFee - SUM(payments.amount)`
  * `isOverdue = (outstandingBalance > 0) && (currentDate > feeDueDate)`
* **Overdue Alert Banner:** The Registry Dashboard displays a prominent alert banner showing the exact count of delinquent accounts in arrears and the total overdue sum.
* **Concurrency Row Locking:** Recording a payment executes inside an interactive transaction with row-level locks (`SELECT ... FOR UPDATE`) on the student record to prevent double-spending and overpayment race conditions.

### Workflow 3: Coursework Submissions & Gatekeeper Rules
* **Staff Assessment Hub:** Staff can create coursework assessments linked to modules with strict submission deadlines, and toggle assessment availability between `OPEN` and `CLOSED`.
* **Document Upload Support:** Students upload PDF or DOCX coursework files with an enforced 4.0 MB size ceiling.
* **One Submission Per Student:** Enforced with a database `UNIQUE(assessmentId, studentId)` constraint.
* **Pre-Deadline Resubmissions:** Students may resubmit work prior to the deadline. The system overwrites the file payload, logs the new timestamp, and increments the version counter (`version = version + 1`).
* **Post-Deadline Resubmissions:** Strictly rejected with HTTP 409 Conflict.
* **First Upload Post-Deadline:** Accepted to protect students in emergency scenarios, but automatically flagged with a visual yellow `Late` badge for academic examiners.
* **Closed Assessment Protection:** Uploads to a `CLOSED` assessment are rejected with HTTP 403 Forbidden.

### Workflow 4: Marksheets, Confidentiality Gate & Honours Classification
* **Numeric Marks (0-100):** Staff enter marks validated at both the application layer and by a PostgreSQL database CHECK constraint (`score >= 0 AND score <= 100`).
* **UK Honours Degree Classifications:** Calculated automatically in memory:
  * 70 to 100: **Distinction**
  * 60 to 69: **Merit**
  * 40 to 59: **Pass**
  * 0 to 39: **Fail**
* **Confidentiality Gate:** Staff can toggle marks between `Withheld` (`publishedAt = null`) and `Published`. Unmoderated marks are strictly filtered out by the API before reaching student browsers.
* **Historical Transcript Access:** Students who have `WITHDRAWN` or `COMPLETED` retain view access to their past published grades on their academic transcript.

---

## 3. Production Safeguards & Reliability Engineering

1. **Serverless Memory Crash Prevention (ByteA Isolation):**  
   In submission list queries (`/api/submissions`), the heavy binary `fileData` byte buffer is explicitly omitted using Prisma's `select`. This keeps list responses under 5 KB and prevents Out-Of-Memory (OOM) crashes in serverless environments. Only the dedicated streaming download endpoint (`/api/submissions/download/[id]`) retrieves the binary buffer.
2. **Strict 4.0 MB Payload Ceiling:**  
   Vercel serverless functions enforce a 4.5 MB request ceiling. The upload endpoint validates `file.size` before reading bytes into memory, rejecting oversized files with HTTP 413 Payload Too Large.
3. **Database-Level Invariant Defense:**  
   PostgreSQL CHECK constraints guard the database directly against illegal states:
   * `check_payment_amount_positive`: Blocks any payment with `amount <= 0`.
   * `check_result_score_range`: Blocks any score outside `0` to `100`.
4. **Zero-Stored Computed State:**  
   Balances, overdue flags, and classifications are computed on demand from raw ledger entries and marks. This guarantees data consistency and prevents desynchronization bugs.
5. **Session Role Isolation:**  
   The application includes an interactive Demo Persona Switcher (`Staff View` vs `Student View: Select Student`). In Student View, all database queries are strictly scoped to the active student ID, preventing cross-student data leaks.

---

## 4. Local Setup & Quickstart Guide

### Prerequisites
* Node.js 18.18 or later
* npm or pnpm
* PostgreSQL instance (or free cloud database at [neon.tech](https://neon.tech))

### Step 1: Clone Repository and Install Dependencies
```bash
git clone https://github.com/RifatHossaiN47/sms-registry-module.git
cd sms-registry-module
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the project root (use `.env.example` as a template):
```env
# Neon Serverless PostgreSQL Connection String (Pooled, port 6543)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.aws.neon.tech/sms-registry-db?sslmode=require"

# Direct Connection String for Migrations (Port 5432)
DIRECT_URL="postgresql://user:password@ep-sample.aws.neon.tech/sms-registry-db?sslmode=require"
```

### Step 3: Push Database Schema
```bash
npx prisma db push
```

### Step 4: Run Database Seed Script
Populates the database with realistic demonstration data (8 students across 2 degree programmes, tuition fees, sample payments, coursework assessments, uploaded submissions, and grades):
```bash
npx tsx prisma/seed.ts
```

### Step 5: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 5. Automated Test Suites & Audit Verification

The codebase includes **52 automated unit, route handler, and security penetration tests** split into three decoupled suites:

```bash
# Run all 52 tests together in one command
npm run test:all

# Or run individual test suites:
npm run test:domain   # 29 pure domain unit tests (fees, submissions, classifications)
npm run test:api      # 14 integration tests for Next.js App Router API endpoints
npm run test:audit    # 9 security penetration, file limit, and database invariant checks
```

### Test Coverage Summary

| Test Suite | File | Tests | Status |
| :--- | :--- | :---: | :---: |
| **Domain Logic** | `scripts/test-domain-logic.ts` | 29 | 100% PASS |
| **API Route Handlers** | `scripts/test-api-routes.ts` | 14 | 100% PASS |
| **Security & Latency Audit** | `scripts/audit-security-and-performance.ts` | 9 | 100% PASS |
| **Total** | **All Layers Verified** | **52** | **100% PASS** |

---

## 6. Engineering Methodology & AI Usage

### Pre-Stage Planning: Architecture Before Code
Before writing any code, I invested time in understanding the domain requirements and designing the system architecture. A university Registry system handles official academic records and financial ledgers, so data consistency, referential integrity, and edge-case handling needed to be planned and validated upfront.

---

### Phase 1: Requirements Analysis & Domain Modeling
I analyzed the assessment brief from the perspective of a University Registry Administrator to identify the core entities and operational rules:
1. **Entity Identification (3NF):** Modeled 8 normalized tables (`programmes`, `modules`, `students`, `payments`, `assessments`, `submissions`, `results`, and `student_id_counters`) in Third Normal Form to prevent data duplication.
2. **Tuition Fee Snapshotting:** Identified that student tuition contracts must remain consistent if future programme fees increase. Therefore, `programme.defaultFee` is copied into `students.assignedFee` at the moment of enrolment.
3. **No Stored Calculated Fields:** Ensured that `outstandingBalance`, `isOverdue`, `isLate`, and `classification` are never stored as columns in the database. Calculating them dynamically from raw records prevents data desynchronization and stale state bugs.

---

### Phase 2: Technical Review with Free AI Tools
To explore potential edge cases early, I consulted free-tier AI assistants as technical sounding boards:
* **Claude 3.5 Sonnet (Free Web):** Discussed database normalization trade-offs, potential concurrency collisions during student ID generation, and data privacy boundaries.
* **Kimi Instant (Free Web):** Reviewed coursework deadline boundary rules, comparing pre-deadline versus post-deadline resubmission logic, and verifying the academic year regex pattern (`^\d{4}/\d{2}$`).
* **Google Antigravity:** Used locally to help draft boilerplate TypeScript types, generate unit test matrices, and verify terminal test suites.
* **Human Decision Making:** When AI models suggested conflicting ideas (for instance, whether to store uploaded files in a separate table or keep them on the `submissions` record), I evaluated the trade-offs and chose to keep file bytes on `submissions` with explicit query projection (`omit fileData`), keeping the schema clean while preventing serverless memory issues.

---

### Phase 3: Visual Blueprints in draw.io
Before creating the Next.js project, I designed three diagrams in draw.io to validate the data flow and relationships:
1. **Entity Relationship Diagram (ERD):** Defined all 8 entities, their primary keys, attributes, and relationships with `ON DELETE RESTRICT` integrity.
2. **Relational Schema Mapping:** Mapped foreign keys, unique constraints, and PostgreSQL CHECK constraints (`amount > 0`, `score BETWEEN 0 AND 100`).
3. **System Architecture Diagram:** Mapped the 5-layer decoupled structure (Client UI -> Route Handlers -> Pure Domain Logic -> Data Access -> Neon PostgreSQL) to ensure the client never touches the database directly.

---

### Phase 4: Step-by-Step Implementation & Verification
With the blueprints ready, I implemented the application in a structured, step-by-step manner:
* **Real Database:** All features connect directly to a live Neon Serverless PostgreSQL database via Prisma, with zero mock data.
* **Concurrency Protection:** Implemented database row-level locking (`SELECT ... FOR UPDATE`) during payment recording to prevent simultaneous overpayment race conditions.
* **Automated Testing:** Wrote and executed 52 automated tests (`npm run test:all`) covering domain rules, API endpoints, and database safety before deploying.
* **Production Deployment:** Deployed to Vercel, configured production environment variables, and verified that all 4 workflows function correctly live on the web.

---

### Summary
AI tools helped accelerate typing, explore edge cases, and scaffold boilerplate tests. However, all architectural decisions, schema design, database constraints, UI refinements, and quality checks were personally planned, evaluated, and verified by me.

---

## 7. Assessment Rubric Alignment

| Assessment Dimension | Weight | Implementation Summary | Status |
| :--- | :---: | :--- | :---: |
| **Stakeholder Understanding** | 30% | Accurately models Registry operations: tuition fee snapshots, atomic sequential IDs (`SMS-YYYY-NNNN`), overdue arrears alerts, and UK Honours classifications. | Verified |
| **Feature Intuition & Edge Cases** | 30% | Handled non-trivial edge cases: dynamic overdue balances, pre-deadline resubmissions, late submission tags, 4.0 MB file limits, and confidentiality gates for withheld results. | Verified |
| **Technical Quality** | 25% | Clean 3NF schema, Next.js 16 App Router, TypeScript strict typing, serverless memory protection, row-level locking concurrency, and 52 passing automated tests. | Verified |
| **AI Usage & Methodology** | 15% | Transparent documentation of free AI pair-programming, pre-stage draw.io modeling, and personal code ownership. | Verified |

---

## 8. Final Checklist

- [x] **Next.js 14+ App Router:** Built with Next.js 16 App Router and TypeScript.
- [x] **Live Deployed App:** Hosted on Vercel at [https://sms-registry-module-app.vercel.app/](https://sms-registry-module-app.vercel.app/).
- [x] **Real PostgreSQL Database:** Connected to live Neon Serverless PostgreSQL with committed `prisma/schema.prisma`.
- [x] **Zero Mock Data:** All records are read and written to the database.
- [x] **Four Registry Workflows:** Fully functional student enrolment, fee ledgers, coursework submissions, and academic marksheets.
- [x] **Edge Case Handling:** Overdue fee detection, late submission tagging, 4.0 MB upload ceiling, and confidentiality gates for withheld results.
- [x] **Automated Test Coverage:** 52 automated tests covering domain logic, API routes, and security invariants.
- [x] **Documentation & Architectural Diagrams:** Complete setup instructions, three architectural diagrams, and transparent AI engineering methodology.

---
*Candidate: Md Rifat Hossen (B.Sc. in CSE, CUET)*
