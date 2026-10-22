import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  checkEligibility,
  determineLateStatus,
  evaluateSubmissionGate,
  validateFileConstraints,
} from "@/lib/submissions";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assessmentId = searchParams.get("assessmentId");
    const studentId = searchParams.get("studentId");

    const where: Prisma.SubmissionWhereInput = {};
    if (assessmentId) where.assessmentId = assessmentId;
    if (studentId) where.studentId = studentId;

    // CRITICAL SAFEGUARD: Exclude 'fileData' bytes to prevent PostgreSQL OOM and serverless memory blowup
    const submissions = await prisma.submission.findMany({
      where,
      select: {
        id: true,
        assessmentId: true,
        studentId: true,
        fileName: true,
        fileMime: true,
        fileSize: true,
        version: true,
        submittedAt: true,
        assessment: {
          select: {
            id: true,
            title: true,
            deadline: true,
            status: true,
            module: {
              select: { code: true, name: true },
            },
          },
        },
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    // Dynamically compute 'isLate' flag (Zero Stored Computed State)
    const formatted = submissions.map((s) => ({
      ...s,
      isLate: determineLateStatus(s.submittedAt, s.assessment.deadline),
    }));

    return NextResponse.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("GET /api/submissions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve submissions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const assessmentId = formData.get("assessmentId") as string | null;
    const studentId = formData.get("studentId") as string | null;
    const file = formData.get("file") as File | null;

    if (!assessmentId || !studentId) {
      return NextResponse.json(
        { success: false, error: "assessmentId and studentId are required fields" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file was attached in the request" },
        { status: 400 }
      );
    }

    // 1. Strict Payload & File Validation (Max 4.0 MB, PDF/DOCX)
    const fileCheck = validateFileConstraints(file.size, file.type, file.name);
    if (!fileCheck.valid) {
      return NextResponse.json(
        { success: false, error: fileCheck.error },
        { status: fileCheck.statusCode || 400 }
      );
    }

    // 2. Fetch Student & Verify Academic Eligibility
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, status: true, programmeId: true },
    });

    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    // 3. Fetch Assessment & Module Programme
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        module: { select: { programmeId: true } },
      },
    });

    if (!assessment) {
      return NextResponse.json({ success: false, error: "Assessment not found" }, { status: 404 });
    }

    // Eligibility check: student must be ENROLLED in programme offering this module
    const eligibility = checkEligibility({
      studentStatus: student.status,
      studentProgrammeId: student.programmeId,
      moduleProgrammeId: assessment.module.programmeId,
    });

    if (!eligibility.eligible) {
      return NextResponse.json(
        { success: false, error: eligibility.reason },
        { status: eligibility.statusCode || 403 }
      );
    }

    // 4. Check Existing Submission & Submission Gate
    const existing = await prisma.submission.findUnique({
      where: {
        assessmentId_studentId: { assessmentId, studentId },
      },
      select: {
        id: true,
        version: true,
        submittedAt: true,
      },
    });

    const now = new Date();
    const gate = evaluateSubmissionGate({
      assessmentStatus: assessment.status,
      deadline: assessment.deadline,
      existingSubmission: existing,
      now,
    });

    if (!gate.allowed) {
      return NextResponse.json(
        { success: false, error: gate.error },
        { status: gate.statusCode || 403 }
      );
    }

    // 5. Read binary file data into Buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 6. Record or Update submission
    let record;
    if (existing) {
      // Pre-deadline Resubmission: overwrite bytes, increment version
      record = await prisma.submission.update({
        where: { id: existing.id },
        data: {
          fileData: fileBuffer,
          fileName: file.name,
          fileMime: file.type || "application/octet-stream",
          fileSize: file.size,
          version: gate.nextVersion,
          submittedAt: now,
        },
        select: {
          id: true,
          assessmentId: true,
          studentId: true,
          fileName: true,
          fileMime: true,
          fileSize: true,
          version: true,
          submittedAt: true,
        },
      });
    } else {
      // First submission (on-time or late)
      record = await prisma.submission.create({
        data: {
          assessmentId,
          studentId,
          fileData: fileBuffer,
          fileName: file.name,
          fileMime: file.type || "application/octet-stream",
          fileSize: file.size,
          version: 1,
          submittedAt: now,
        },
        select: {
          id: true,
          assessmentId: true,
          studentId: true,
          fileName: true,
          fileMime: true,
          fileSize: true,
          version: true,
          submittedAt: true,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: existing
          ? `Work resubmitted successfully (Version ${record.version})`
          : "Work submitted successfully",
        data: {
          ...record,
          isLate: gate.isLate,
        },
      },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    console.error("POST /api/submissions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload submission" },
      { status: 500 }
    );
  }
}
