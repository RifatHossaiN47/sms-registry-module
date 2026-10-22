# Student Management System - Registry Module

A clean, full-stack web application built for the **PEN Global Technical Assessment**. This module implements the four everyday workflows of a University Registry Administrator: **Student Enrolment**, **Fees & Payment Ledgers**, **Coursework Submissions**, and **Academic Marksheets & Results**.

* **Live Demo:** [https://sms-registry-module-app.vercel.app/](https://sms-registry-module-app.vercel.app/)
* **GitHub Repository:** [https://github.com/RifatHossaiN47/sms-registry-module](https://github.com/RifatHossaiN47/sms-registry-module)
* **Tech Stack:** Next.js 16 (App Router), TypeScript, Neon Serverless PostgreSQL, Prisma ORM, Tailwind CSS

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

## 1. System Architecture & Diagrams

The application is structured into clean layers so the database, business calculations, API endpoints, and user interface stay separate and easy to test.

### End-to-End System Architecture
![System Architecture](docs/diagrams/system-architecture.png)

### Entity Relationship Diagram (ERD)
The database uses 8 normalized tables with foreign key connections.
![Entity Relationship Diagram](docs/diagrams/entity-relationship-diagram.png)

### Relational Schema Mapping & Rules
Shows foreign keys, database CHECK constraints, and uniqueness rules across all tables.
![Relational Schema Mapping](docs/diagrams/relational-schema-mapping.png)

---

## 2. The Four Core Registry Workflows

### Workflow 1: Student Enrolment & ID Generation
* **Automatic Student ID:** Generates sequential IDs formatted as `SMS-YYYY-NNNN` (e.g. `SMS-2026-0001`) using an atomic counter table in PostgreSQL to prevent duplicate IDs during simultaneous enrolments.
* **Academic Year Check:** Validates the university standard `YYYY/YY` format (e.g. `2025/26`) with regex.
* **Student Statuses:** Supports `ENROLLED`, `DEFERRED`, `WITHDRAWN`, and `COMPLETED`.
* **Search & Filter:** Instant search by student name, student ID, degree programme, or enrolment status.

### Workflow 2: Fees, Payments & Overdue Tracking
* **Fee Snapshot at Enrolment:** When a student enrols, the current programme tuition is saved into `student.assignedFee`. If tuition fees increase in future years, existing enrolled students keep their original agreed fee.
* **Accurate Money Math:** All currency calculations use Prisma's `Decimal` type to prevent standard JavaScript rounding bugs.
* **Live Balance Calculation:** Balance and overdue flags are calculated directly from payment history:
  * `outstandingBalance = assignedFee - totalPayments`
  * `isOverdue = (outstandingBalance > 0) && (currentDate > feeDueDate)`
* **Overdue Alert Banner:** The Registry Dashboard shows a red alert banner with the count of students behind on payments and the total overdue amount.
* **Payment Protection:** Uses database row-locking (`SELECT ... FOR UPDATE`) during payment recording so simultaneous clicks cannot cause duplicate payments or overpayments.

### Workflow 3: Coursework Submissions
* **Staff Assessment Setup:** Staff create assessments linked to modules with strict deadlines, and can toggle them between `OPEN` and `CLOSED`.
* **File Uploads:** Students can upload PDF or DOCX files up to 4.0 MB.
* **One Submission Per Student:** Enforced with a database `UNIQUE(assessmentId, studentId)` rule.
* **Resubmission Before Deadline:** Allowed. The system updates the file and increases the version number (`version = version + 1`).
* **Resubmission After Deadline:** Blocked with HTTP 409 Conflict.
* **First Upload After Deadline:** Accepted so students in emergencies can still submit, but automatically tagged with a yellow `Late` badge.
* **Closed Assessments:** Uploads to a `CLOSED` assessment are rejected with HTTP 403 Forbidden.

### Workflow 4: Marksheets & Degree Classification
* **Grades (0-100):** Staff enter marks validated both in code and by PostgreSQL CHECK constraints (`score >= 0 AND score <= 100`).
* **UK Degree Classifications:** Calculated automatically:
  * 70 to 100: **Distinction**
  * 60 to 69: **Merit**
  * 40 to 59: **Pass**
  * 0 to 39: **Fail**
* **Withhold / Publish Toggle:** Staff can mark a grade as Withheld (`publishedAt = null`) or Published. Students cannot see unapproved marks until staff publish them.
* **Transcript Access:** Withdrawn and Completed students can still log in and view their historical published marks.

---

## 3. Reliability & Server Safety Rules

1. **Preventing Server Memory Crashes:**  
   When listing submissions, the heavy binary file data is left out of the query. This keeps list responses small (under 5 KB) so serverless memory never runs out. File bytes are only fetched when someone clicks the Download button.
2. **4.0 MB File Size Limit:**  
   Files above 4.0 MB are rejected immediately before reading them into memory, protecting against serverless payload limits.
3. **Database Protection Rules:**  
   PostgreSQL CHECK constraints guard the database directly:
   * `check_payment_amount_positive`: Blocks any payment with amount <= 0.
   * `check_result_score_range`: Blocks any score outside 0 to 100.
4. **No Stale Saved Balances:**  
   Balances and overdue statuses are calculated fresh from the database whenever requested, so data never becomes stale or out of sync.
5. **Student Privacy Isolation:**  
   In the Student View, all database queries only fetch records belonging to that specific student ID.

---

## 4. Local Setup Guide

### Prerequisites
* Node.js 18.18 or later
* PostgreSQL (or free cloud database at [neon.tech](https://neon.tech))

### Step 1: Clone and Install
```bash
git clone https://github.com/RifatHossaiN47/sms-registry-module.git
cd sms-registry-module
npm install
```

### Step 2: Configure Environment
Create a `.env` file in the root folder (use `.env.example` as a template):
```env
# Neon Serverless PostgreSQL Connection String (port 6543)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.aws.neon.tech/sms-registry-db?sslmode=require"

# Direct Connection String for Migrations (port 5432)
DIRECT_URL="postgresql://user:password@ep-sample.aws.neon.tech/sms-registry-db?sslmode=require"
```

### Step 3: Set Up Database Tables
```bash
npx prisma db push
```

### Step 4: Load Demo Data
Loads 8 students, 2 degree programmes, 3 modules, 3 assessments, 5 submissions, and marks:
```bash
npx tsx prisma/seed.ts
```

### Step 5: Start the App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Automated Tests (52 Tests)

The project includes 52 automated tests covering business logic, API routes, and database safety:

```bash
# Run all 52 tests together
npm run test:all

# Or run individual suites:
npm run test:domain   # 29 unit tests for fee, submission, and grade logic
npm run test:api      # 14 integration tests for API endpoints
npm run test:audit    # 9 tests for security rules, file limits, and database checks
```

### Test Results

| Test Suite | File | Tests | Result |
| :--- | :--- | :---: | :---: |
| **Business Logic** | `scripts/test-domain-logic.ts` | 29 | 100% PASS |
| **API Endpoints** | `scripts/test-api-routes.ts` | 14 | 100% PASS |
| **Security & Safety** | `scripts/audit-security-and-performance.ts` | 9 | 100% PASS |
| **Total** | **All Tests** | **52** | **100% PASS** |

---

## 6. How I Built This & How I Used AI

*(Required by the PEN Global assessment)*

### Thinking Through the Problem
Before writing any code, I analyzed what a real university Registry department actually needs:
1. **Fees must not change retroactively:** If a university raises fees for 2027, students who enrolled in 2026 must still pay their original fee. So I made sure the fee is copied into `assignedFee` at enrolment.
2. **Never save calculated balances in the database:** If you save `balance` in a database column, it easily gets out of sync when payments happen. Calculating it on-the-fly from payment records prevents this problem completely.
3. **Planning the architecture first:** I drew the System Architecture, the Entity Relationship Diagram, and the Relational Schema in draw.io to make sure all tables and foreign keys were clean before writing code.

### Free AI Tools Used
I used free-tier AI tools as a technical assistant:
* **Claude 3.5 Sonnet (Free Web):** Helped brainstorm edge cases, like what should happen if two students enrol at the exact same second, or how to handle submissions close to a deadline.
* **Kimi Instant (Free Web):** Helped check regex patterns for academic years (`YYYY/YY`) and review deadline boundary rules.
* **Google Antigravity:** Helped write boilerplate code, scaffold TypeScript test files, and run tests in the terminal.

### How I Kept Control of the Code
AI was used to save typing time and explore ideas, but every technical decision was mine:
* **No Mock Data:** The assessment said not to mock data in `useState`. I insisted on using real PostgreSQL tables via Prisma for every single feature.
* **Clean User Interface:** I cleaned up the UI by removing developer debug text, raw regex patterns, and internal variable names so it looks like a real university tool.
* **Database Rules:** I added PostgreSQL CHECK constraints directly to the database so invalid payments or grades are blocked even if someone bypasses the frontend.
* **Step-by-Step QA:** I built the project in 10 testable steps, checking each step locally in the browser and terminal before moving to the next.

---

## 7. Assessment Requirements Checklist

- [x] **Next.js 14+ App Router:** Built with Next.js 16 App Router and TypeScript.
- [x] **Live Deployed App:** Live on Vercel at [https://sms-registry-module-app.vercel.app/](https://sms-registry-module-app.vercel.app/).
- [x] **Real PostgreSQL Database:** Connected to Neon Serverless PostgreSQL with committed `prisma/schema.prisma`.
- [x] **Zero Mock Data:** All records are read and written to the database.
- [x] **Four Workflows:** Student enrolment, fee tracking, coursework submissions, and grade marksheets.
- [x] **Handled Edge Cases:** Overdue balance alerts, late submission tagging, 4.0 MB upload limit, and grade withholding.
- [x] **Automated Tests:** 52 automated tests covering all logic, API routes, and database constraints.
- [x] **Documentation & Diagrams:** Complete setup steps, 3 architectural diagrams, and honest AI usage explanation.

---
*Candidate: Md Rifat Hossen (B.Sc. in CSE, CUET)*
